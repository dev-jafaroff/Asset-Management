import { notFound } from "next/navigation";
import { cache } from "react";
import type { FormOption } from "@/lib/assets/asset-form-options";
import { ASSETS_PATH } from "@/lib/assets/asset-types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPositiveIntParam } from "@/lib/search-params";

export const ACCESSORIES_PATH = `${ASSETS_PATH}/accessories`;
export const NEW_ACCESSORY_PATH = `${ACCESSORIES_PATH}/new`;

// e.g. "/assets/accessories/3"
export function getAccessoryPath(id: number): string {
  return `${ACCESSORIES_PATH}/${id}`;
}

export function getEditAccessoryPath(id: number): string {
  return `${getAccessoryPath(id)}/edit`;
}

// Handed out now: not returned yet.
const openAssignmentWhere = {
  returnedAt: null,
} satisfies Prisma.AccessoryAssignmentWhereInput;

const categorySelect = {
  select: { id: true, name: true, icon: true },
} satisfies Prisma.CategoryDefaultArgs;

// The stock numbers of an accessory: total, handed out and left.
export type AccessoryStock = {
  total: number;
  assigned: number;
  inStock: number;
};

function toStock(total: number, assigned: number): AccessoryStock {
  return { total, assigned, inStock: total - assigned };
}

// How many of each accessory are handed out now, by accessory id.
async function countAssigned(): Promise<Map<number, number>> {
  const groups = await prisma.accessoryAssignment.groupBy({
    by: ["accessoryId"],
    where: openAssignmentWhere,
    _sum: { quantity: true },
  });
  return new Map(
    groups.map((group) => [group.accessoryId, group._sum.quantity ?? 0]),
  );
}

// ─── List ────────────────────────────────────────────────────────────────────

const accessoryListSelect = {
  id: true,
  name: true,
  totalQuantity: true,
  category: categorySelect,
} satisfies Prisma.AccessorySelect;

export type AccessoryListItem = Prisma.AccessoryGetPayload<{
  select: typeof accessoryListSelect;
}> & { stock: AccessoryStock };

// Every word must match the name or the category, e.g. "logitech mouse".
function buildSearchWhere(search?: string): Prisma.AccessoryWhereInput {
  const terms = search?.split(/\s+/).filter(Boolean) ?? [];
  return {
    AND: terms.map((term) => {
      const contains = { contains: term, mode: "insensitive" as const };
      return { OR: [{ name: contains }, { category: { name: contains } }] };
    }),
  };
}

// All accessories with their stock, by category and name.
export async function listAccessories(
  search?: string,
): Promise<AccessoryListItem[]> {
  const [accessories, assigned] = await Promise.all([
    prisma.accessory.findMany({
      where: buildSearchWhere(search),
      select: accessoryListSelect,
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    countAssigned(),
  ]);
  return accessories.map((accessory) => ({
    ...accessory,
    stock: toStock(accessory.totalQuantity, assigned.get(accessory.id) ?? 0),
  }));
}

// ─── Detail ──────────────────────────────────────────────────────────────────

const personSelect = {
  select: { id: true, displayName: true },
} satisfies Prisma.UserDefaultArgs;

const accessoryDetailSelect = {
  ...accessoryListSelect,
  // Who has it now, longest first.
  assignments: {
    where: openAssignmentWhere,
    select: {
      id: true,
      quantity: true,
      assignedAt: true,
      user: {
        select: { id: true, displayName: true, email: true, isActive: true },
      },
      assignedBy: personSelect,
    },
    orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.AccessorySelect;

type AccessoryRow = Prisma.AccessoryGetPayload<{
  select: typeof accessoryDetailSelect;
}>;

export type AccessoryDetail = AccessoryRow & { stock: AccessoryStock };
export type AccessoryHolder = AccessoryRow["assignments"][number];

async function findAccessory(id: number): Promise<AccessoryDetail | null> {
  const accessory = await prisma.accessory.findUnique({
    where: { id },
    select: accessoryDetailSelect,
  });
  if (!accessory) return null;
  const assigned = accessory.assignments.reduce(
    (sum, assignment) => sum + assignment.quantity,
    0,
  );
  return { ...accessory, stock: toStock(accessory.totalQuantity, assigned) };
}

// Wrapped in cache(), so the page and its metadata share one query per request.
const getAccessoryDetail = cache(findAccessory);

// The accessory of an /assets/accessories/[id] page; an unknown id is a 404.
export async function getRouteAccessory(route: {
  id: string;
}): Promise<AccessoryDetail> {
  const id = getPositiveIntParam(route, "id");
  const accessory = id === undefined ? null : await getAccessoryDetail(id);
  if (!accessory) notFound();
  return accessory;
}

// ─── History ─────────────────────────────────────────────────────────────────

type Person = { id: number; displayName: string };

// One line of an accessory's history, newest first.
export type AccessoryHistoryEntry =
  | {
      kind: "assigned" | "returned";
      key: string;
      date: Date;
      actor: Person | null;
      user: Person;
      quantity: number;
    }
  | {
      kind: "stock";
      key: string;
      date: Date;
      actor: Person | null;
      // Null when the accessory was added.
      from: number | null;
      to: number;
      note: string | null;
    };

// Handouts, returns and stock changes in one timeline. A returned handout
// gives two entries: when it went out and when it came back.
export async function listAccessoryHistory(
  accessoryId: number,
): Promise<AccessoryHistoryEntry[]> {
  const [assignments, stockChanges] = await Promise.all([
    prisma.accessoryAssignment.findMany({
      where: { accessoryId },
      select: {
        id: true,
        quantity: true,
        assignedAt: true,
        returnedAt: true,
        user: personSelect,
        assignedBy: personSelect,
        returnedBy: personSelect,
      },
    }),
    prisma.accessoryStockChange.findMany({
      where: { accessoryId },
      select: {
        id: true,
        fromQuantity: true,
        toQuantity: true,
        note: true,
        createdAt: true,
        actor: personSelect,
      },
    }),
  ]);

  // A partial return splits a handout into rows that keep its person and
  // date; they are one handout, so it shows once with the full quantity.
  const handouts = new Map<
    string,
    AccessoryHistoryEntry & { kind: "assigned" }
  >();
  for (const assignment of assignments) {
    const handoutKey = `${assignment.user.id}-${assignment.assignedAt.getTime()}`;
    const handout = handouts.get(handoutKey);
    if (handout) {
      handout.quantity += assignment.quantity;
      continue;
    }
    handouts.set(handoutKey, {
      kind: "assigned",
      key: `assigned-${assignment.id}`,
      date: assignment.assignedAt,
      actor: assignment.assignedBy,
      user: assignment.user,
      quantity: assignment.quantity,
    });
  }

  const entries: AccessoryHistoryEntry[] = [
    ...handouts.values(),
    ...assignments.flatMap((assignment): AccessoryHistoryEntry[] =>
      assignment.returnedAt
        ? [
            {
              kind: "returned",
              key: `returned-${assignment.id}`,
              date: assignment.returnedAt,
              actor: assignment.returnedBy,
              user: assignment.user,
              quantity: assignment.quantity,
            },
          ]
        : [],
    ),
    ...stockChanges.map((change): AccessoryHistoryEntry => ({
      kind: "stock",
      key: `stock-${change.id}`,
      date: change.createdAt,
      actor: change.actor,
      from: change.fromQuantity,
      to: change.toQuantity,
      note: change.note,
    })),
  ];
  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ─── Form ────────────────────────────────────────────────────────────────────

// Categories of accessories: the ones no asset model uses (Laptop, Monitor…
// belong to assets). A new category shows up here until a model uses it.
export async function listAccessoryCategoryOptions(): Promise<FormOption[]> {
  const categories = await prisma.category.findMany({
    where: { models: { none: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));
}
