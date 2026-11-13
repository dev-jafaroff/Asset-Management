import { notFound } from "next/navigation";
import { cache } from "react";
import {
  assetEventSelect,
  parseFieldChanges,
  type AssetHistoryEvent,
} from "@/lib/assets/asset-detail";
import { assetListSelect } from "@/lib/assets/queries";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPositiveIntParam } from "@/lib/search-params";

export const USERS_PATH = "/users";
export const USER_PAGE_SIZE = 25;

// e.g. "/users/12"
export function getUserPath(id: number): string {
  return `${USERS_PATH}/${id}`;
}

// ─── List ────────────────────────────────────────────────────────────────────

const userListSelect = {
  id: true,
  displayName: true,
  email: true,
  department: true,
  jobTitle: true,
  isActive: true,
  _count: { select: { assignedAssets: true } },
} satisfies Prisma.UserSelect;

export type UserListItem = Prisma.UserGetPayload<{
  select: typeof userListSelect;
}>;

export const USER_TAB_PARAM = "status";

type UserTab = { slug: string; label: string; where: Prisma.UserWhereInput };

// The first tab is the default. "Holding items" is for offboarding: people
// who still have something, whether they left or not.
const userTabs: UserTab[] = [
  { slug: "active", label: "Active", where: { isActive: true } },
  {
    slug: "holding",
    label: "Holding items",
    where: { assignedAssets: { some: {} } },
  },
  { slug: "left", label: "Left", where: { isActive: false } },
];

// Every word must match the name, email, department or job title, so
// "aysel it" finds Aysel Huseynova from the IT department.
function buildUserSearchWhere(search?: string): Prisma.UserWhereInput {
  const terms = search?.split(/\s+/).filter(Boolean) ?? [];
  return {
    AND: terms.map((term) => {
      const contains = { contains: term, mode: "insensitive" as const };
      return {
        OR: [
          { displayName: contains },
          { email: contains },
          { department: contains },
          { jobTitle: contains },
        ],
      };
    }),
  };
}

export type UserTabWithCount = UserTab & { count: number };

// Every tab with the number of people it holds under the search.
export async function listUserTabsWithCounts(
  search?: string,
): Promise<UserTabWithCount[]> {
  const searchWhere = buildUserSearchWhere(search);
  const counts = await Promise.all(
    userTabs.map((tab) =>
      prisma.user.count({ where: { AND: [tab.where, searchWhere] } }),
    ),
  );
  return userTabs.map((tab, index) => ({ ...tab, count: counts[index] }));
}

// The tab of the URL param; anything unknown is the first (Active).
export function findUserTab<T extends UserTab>(tabs: T[], slug?: string): T {
  return tabs.find((tab) => tab.slug === slug) ?? tabs[0];
}

// The default tab has no param, so the plain URL stays clean.
export function toUserTabParam(slug: string): string | undefined {
  return slug === userTabs[0].slug ? undefined : slug;
}

// `page` is 1-based.
export async function listUsers(
  filter: { tab: UserTab; search?: string },
  page: number,
): Promise<UserListItem[]> {
  return prisma.user.findMany({
    where: { AND: [filter.tab.where, buildUserSearchWhere(filter.search)] },
    select: userListSelect,
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    skip: (page - 1) * USER_PAGE_SIZE,
    take: USER_PAGE_SIZE,
  });
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function getUserDetailSelect(userId: number) {
  return {
    id: true,
    displayName: true,
    email: true,
    department: true,
    jobTitle: true,
    role: true,
    isActive: true,
    assignedAssets: {
      select: {
        ...assetListSelect,
        // When this person got it: their latest checkout of the asset.
        events: {
          where: { type: "CHECKOUT", targetUserId: userId },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: [{ type: "asc" }, { assetTag: "asc" }, { id: "asc" }],
    },
  } satisfies Prisma.UserSelect;
}

export type UserDetail = NonNullable<Awaited<ReturnType<typeof findUser>>>;
export type UserAsset = UserDetail["assignedAssets"][number];

function findUser(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: getUserDetailSelect(id),
  });
}

// Wrapped in cache(), so the page and its metadata share one query per request.
const getUserDetail = cache(findUser);

// The person of a /users/[id] page; an unknown id is a 404.
export async function getRouteUser(route: { id: string }): Promise<UserDetail> {
  const id = getPositiveIntParam(route, "id");
  const user = id === undefined ? null : await getUserDetail(id);
  if (!user) notFound();
  return user;
}

// When the person got the asset; null for records imported without history.
export function getReceivedAt(asset: UserAsset): Date | null {
  return asset.events[0]?.createdAt ?? null;
}

// ─── History ─────────────────────────────────────────────────────────────────

export type UserHistoryEvent = AssetHistoryEvent & {
  asset: Pick<UserAsset, "id" | "type" | "assetTag" | "name" | "model">;
};

// Everything handed to or taken back from the person, newest first.
export async function listUserHistory(
  userId: number,
): Promise<UserHistoryEvent[]> {
  const events = await prisma.assetEvent.findMany({
    where: { targetUserId: userId },
    select: {
      ...assetEventSelect,
      asset: {
        select: {
          id: true,
          type: true,
          assetTag: true,
          name: true,
          model: assetListSelect.model,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return events.map((event) => ({
    ...event,
    changes: parseFieldChanges(event.changes),
  }));
}
