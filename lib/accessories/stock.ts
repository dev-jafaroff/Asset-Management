import type { AssignmentErrors } from "@/lib/assets/checkout";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  describeHandedOut,
  type AccessoryFormData,
} from "@/lib/schemas/accessory";

// An accessory's total and how many are handed out, read under a row lock.
// Every change of either (stock edit, handout, return) takes the lock first,
// so two people at once can never hand out more than there is.
export async function lockAccessoryStock(
  tx: Prisma.TransactionClient,
  accessoryId: number,
): Promise<{ total: number; assigned: number } | null> {
  const locked = await tx.$queryRaw<{ totalQuantity: number }[]>`
    SELECT "totalQuantity" FROM "Accessory" WHERE "id" = ${accessoryId} FOR UPDATE
  `;
  if (locked.length === 0) return null;
  const assigned = await tx.accessoryAssignment.aggregate({
    where: { accessoryId, returnedAt: null },
    _sum: { quantity: true },
  });
  return {
    total: locked[0].totalQuantity,
    assigned: assigned._sum.quantity ?? 0,
  };
}

// Refusals by the database, as the form shows them.
function getAccessorySaveConflict(error: unknown): AssignmentErrors | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (error.code === "P2002") {
    return { fields: { name: "Another accessory already has this name." } };
  }
  if (error.code === "P2003") {
    return {
      message: "The chosen category no longer exists. Reload the page.",
    };
  }
  return null;
}

async function runAccessorySave<Result>(
  save: () => Promise<Result>,
): Promise<Result | { errors: AssignmentErrors }> {
  try {
    return await save();
  } catch (error) {
    const conflict = getAccessorySaveConflict(error);
    if (conflict) return { errors: conflict };
    throw error;
  }
}

type AccessorySave = {
  data: AccessoryFormData;
  // Null until sign-in exists (see lib/current-user.ts).
  actorId: number | null;
};

// Adds an accessory; its first total starts the stock history.
export function createAccessory({
  data,
  actorId,
}: AccessorySave): Promise<{ id: number } | { errors: AssignmentErrors }> {
  const { note, totalQuantity, ...fields } = data;
  return runAccessorySave(() =>
    prisma.accessory.create({
      data: {
        ...fields,
        totalQuantity,
        stockChanges: {
          create: { actorId, toQuantity: totalQuantity, note },
        },
      },
      select: { id: true },
    }),
  );
}

// Saves the form of an existing accessory. A new total is written to the
// stock history, and cannot go below what is handed out.
export function updateAccessory({
  accessoryId,
  data,
  actorId,
}: AccessorySave & { accessoryId: number }): Promise<
  { saved: true } | { errors: AssignmentErrors }
> {
  const { note, totalQuantity, ...fields } = data;
  return runAccessorySave(() =>
    prisma.$transaction(async (tx) => {
      const stock = await lockAccessoryStock(tx, accessoryId);
      if (!stock) {
        return { errors: { message: "This accessory no longer exists." } };
      }
      if (totalQuantity < stock.assigned) {
        return {
          errors: {
            fields: {
              totalQuantity: `${describeHandedOut(stock.assigned)}, so the total cannot be lower.`,
            },
          },
        };
      }

      await tx.accessory.update({
        where: { id: accessoryId },
        data: { ...fields, totalQuantity },
      });
      if (totalQuantity !== stock.total) {
        await tx.accessoryStockChange.create({
          data: {
            accessoryId,
            actorId,
            fromQuantity: stock.total,
            toQuantity: totalQuantity,
            note,
          },
        });
      }
      return { saved: true as const };
    }),
  );
}
