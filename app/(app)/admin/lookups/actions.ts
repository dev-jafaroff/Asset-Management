"use server";

import { refresh } from "next/cache";
import type { z } from "zod";
import type { AssignmentErrors } from "@/lib/assets/checkout";
import { getCurrentUser } from "@/lib/current-user";
import { Prisma } from "@/lib/generated/prisma/client";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getFirstFieldErrors } from "@/lib/schemas/asset";
import {
  categorySchema,
  lookupIdSchema,
  lookupRowIdSchema,
  lookupSlugSchema,
  modelSchema,
  namedLookupSchema,
  statusSchema,
  type LookupSlug,
  type LookupValues,
} from "@/lib/schemas/lookup";

type LookupSave = (
  id: number | null,
  values: LookupValues,
) => Promise<AssignmentErrors | null>;

// Checks a dialog's values with the tab's schema, then saves them. Refusals
// by the database come back as messages the dialog shows.
function lookupSaver<Schema extends z.ZodType>(
  schema: Schema,
  // e.g. "Another company already has this name."
  duplicate: string,
  save: (
    id: number | null,
    data: z.output<Schema>,
  ) => Promise<AssignmentErrors | null | void>,
): LookupSave {
  return async (id, values) => {
    const input = schema.safeParse(values);
    if (!input.success) return { fields: getFirstFieldErrors(input.error) };
    try {
      return (await save(id, input.data)) ?? null;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
      if (error.code === "P2002") return { fields: { name: duplicate } };
      if (error.code === "P2025" || error.code === "P2003") {
        return { message: "It changed in the meantime. Reload the page." };
      }
      throw error;
    }
  };
}

const lookupSavers: Record<LookupSlug, LookupSave> = {
  categories: lookupSaver(
    categorySchema,
    "Another category already has this name.",
    async (id, data) => {
      await (id === null
        ? prisma.category.create({ data })
        : prisma.category.update({ where: { id }, data }));
    },
  ),
  models: lookupSaver(
    modelSchema,
    "This manufacturer already has a model with this name.",
    async (id, data) => {
      await (id === null
        ? prisma.assetModel.create({ data })
        : prisma.assetModel.update({ where: { id }, data }));
    },
  ),
  companies: lookupSaver(
    namedLookupSchema,
    "Another company already has this name.",
    async (id, data) => {
      await (id === null
        ? prisma.company.create({ data })
        : prisma.company.update({ where: { id }, data }));
    },
  ),
  locations: lookupSaver(
    namedLookupSchema,
    "Another location already has this name.",
    async (id, data) => {
      await (id === null
        ? prisma.location.create({ data })
        : prisma.location.update({ where: { id }, data }));
    },
  ),
  // The type says what a status means (e.g. archived), so it is fixed while
  // assets use it: changing it would quietly change all of them.
  statuses: lookupSaver(
    statusSchema,
    "Another status already has this name.",
    async (id, data) => {
      if (id === null) {
        await prisma.statusLabel.create({ data });
        return;
      }
      return prisma.$transaction(async (tx) => {
        const status = await tx.statusLabel.findUniqueOrThrow({
          where: { id },
          select: { type: true, _count: { select: { assets: true } } },
        });
        if (status.type !== data.type && status._count.assets > 0) {
          return {
            fields: {
              type: "Assets use this status, so its type cannot change.",
            },
          };
        }
        await tx.statusLabel.update({ where: { id }, data });
        return null;
      });
    },
  ),
};

// Only admins change lookup tables. Returns the table, or the message to
// show when the user or the table is not allowed.
async function authorizeLookup(
  slug: unknown,
): Promise<{ table: LookupSlug } | { errors: AssignmentErrors }> {
  const user = await getCurrentUser();
  if (!can(user.role, "lookup:manage")) {
    return { errors: { message: "Only admins can change lookup tables." } };
  }
  const table = lookupSlugSchema.safeParse(slug);
  if (!table.success) {
    return { errors: { message: "Unknown table. Reload the page." } };
  }
  return { table: table.data };
}

// Adds a row (id null) or saves one, from a lookup dialog; null when done.
// The tab and id are bound by the page, but still come from the browser.
export async function saveLookup(
  slug: unknown,
  id: unknown,
  values: LookupValues,
): Promise<AssignmentErrors | null> {
  const auth = await authorizeLookup(slug);
  if ("errors" in auth) return auth.errors;
  const row = lookupIdSchema.safeParse(id);
  if (!row.success) return { message: "Unknown row. Reload the page." };

  const errors = await lookupSavers[auth.table](row.data, values);
  if (errors) return errors;
  refresh();
  return null;
}

const lookupDeleters: Record<LookupSlug, (id: number) => Promise<unknown>> = {
  statuses: (id) => prisma.statusLabel.delete({ where: { id } }),
  models: (id) => prisma.assetModel.delete({ where: { id } }),
  categories: (id) => prisma.category.delete({ where: { id } }),
  companies: (id) => prisma.company.delete({ where: { id } }),
  locations: (id) => prisma.location.delete({ where: { id } }),
};

// Deletes a row nothing uses; null when done. A row in use is refused by the
// database itself (every relation to a lookup is restrict), so a row that
// got used a moment ago is refused too.
export async function deleteLookup(
  slug: unknown,
  id: unknown,
): Promise<AssignmentErrors | null> {
  const auth = await authorizeLookup(slug);
  if ("errors" in auth) return auth.errors;
  const row = lookupRowIdSchema.safeParse(id);
  if (!row.success) return { message: "Unknown row. Reload the page." };

  try {
    await lookupDeleters[auth.table](row.data);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
    if (error.code === "P2003") {
      return { message: "It is in use now, so it cannot be deleted." };
    }
    if (error.code === "P2025") {
      return { message: "It was already deleted. Reload the page." };
    }
    throw error;
  }
  refresh();
  return null;
}
