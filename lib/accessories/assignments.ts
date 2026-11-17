import { openAssignmentWhere } from "@/lib/accessories/queries";
import { lockAccessoryStock } from "@/lib/accessories/stock";
import type { AssetChangeResult } from "@/lib/assets/checkout";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Handing accessories out and taking them back, by quantity. Each assignment
// row is its own history: who got how many, when, and when they came back.

// Null until sign-in exists (see lib/current-user.ts).
type Actor = { actorId: number | null };

// Runs one change; a person or accessory removed a moment ago comes back as
// a message instead of an error page.
async function runAccessoryChange(
  change: (tx: Prisma.TransactionClient) => Promise<AssetChangeResult>,
): Promise<AssetChangeResult> {
  try {
    return await prisma.$transaction(change);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return "The person or the accessory no longer exists. Reload the page.";
    }
    throw error;
  }
}

// Gives `quantity` of the accessory to a person, out of what is in stock.
export function assignAccessory({
  accessoryId,
  userId,
  quantity,
  actorId,
}: Actor & {
  accessoryId: number;
  userId: number;
  quantity: number;
}): Promise<AssetChangeResult> {
  return runAccessoryChange(async (tx) => {
    const stock = await lockAccessoryStock(tx, accessoryId);
    if (!stock) return "This accessory no longer exists.";
    const inStock = stock.total - stock.assigned;
    if (quantity > inStock) {
      return inStock === 0
        ? "None are left in stock."
        : `Only ${inStock} left in stock.`;
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    if (!user) return "This person no longer exists.";
    if (!user.isActive) return "This person has left the company.";

    await tx.accessoryAssignment.create({
      data: { accessoryId, userId, quantity, assignedById: actorId },
    });
    return null;
  });
}

// Takes `quantity` of one assignment back. When only part comes back, the
// assignment is split: the returned part is closed and the rest stays open,
// both keeping the original handout date.
export function returnAccessory({
  assignmentId,
  quantity,
  actorId,
}: Actor & {
  assignmentId: number;
  quantity: number;
}): Promise<AssetChangeResult> {
  return runAccessoryChange(async (tx) => {
    const found = await tx.accessoryAssignment.findUnique({
      where: { id: assignmentId },
      select: { accessoryId: true },
    });
    if (!found) return "This handout no longer exists.";
    // Locked like a handout, so two returns at once cannot both succeed.
    await lockAccessoryStock(tx, found.accessoryId);

    const assignment = await tx.accessoryAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      select: {
        accessoryId: true,
        userId: true,
        quantity: true,
        assignedAt: true,
        assignedById: true,
        returnedAt: true,
      },
    });
    if (assignment.returnedAt) return "It was already returned.";
    if (quantity > assignment.quantity) {
      return `They only have ${assignment.quantity}.`;
    }

    const returned = { returnedAt: new Date(), returnedById: actorId };
    if (quantity === assignment.quantity) {
      await tx.accessoryAssignment.update({
        where: { id: assignmentId },
        data: returned,
      });
      return null;
    }

    await tx.accessoryAssignment.update({
      where: { id: assignmentId },
      data: { quantity: assignment.quantity - quantity },
    });
    await tx.accessoryAssignment.create({
      data: {
        accessoryId: assignment.accessoryId,
        userId: assignment.userId,
        assignedAt: assignment.assignedAt,
        assignedById: assignment.assignedById,
        quantity,
        ...returned,
      },
    });
    return null;
  });
}

// Offboarding: takes back every accessory the person still has. Returns how
// many pieces came back, e.g. 3 for one headset and two mice.
export function returnAllAccessories({
  userId,
  actorId,
}: Actor & { userId: number }): Promise<number> {
  const where = { ...openAssignmentWhere, userId };
  return prisma.$transaction(async (tx) => {
    const accessories = await tx.accessoryAssignment.findMany({
      where,
      distinct: ["accessoryId"],
      select: { accessoryId: true },
      orderBy: { accessoryId: "asc" },
    });
    // Locked like single returns, in one order, so they wait for each other.
    for (const { accessoryId } of accessories) {
      await lockAccessoryStock(tx, accessoryId);
    }
    const held = await tx.accessoryAssignment.aggregate({
      where,
      _sum: { quantity: true },
    });
    await tx.accessoryAssignment.updateMany({
      where,
      data: { returnedAt: new Date(), returnedById: actorId },
    });
    return held._sum.quantity ?? 0;
  });
}
