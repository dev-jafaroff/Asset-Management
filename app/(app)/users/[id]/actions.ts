"use server";

import { returnAllAccessories } from "@/lib/accessories/assignments";
import { openAssignmentWhere } from "@/lib/accessories/queries";
import {
  authorizeBulk,
  finishBulk,
  runBulk,
  type BulkActionResult,
} from "@/lib/assets/bulk-actions";
import { checkInAsset } from "@/lib/assets/checkout";
import { prisma } from "@/lib/prisma";
import { checkinSchema, type CheckinValues } from "@/lib/schemas/asset";
import { userIdSchema } from "@/lib/schemas/user";

// Offboarding: takes back everything the person holds: each asset with the
// same status and note, then all their accessories. `userId` is bound by the page, but it still comes from
// the browser, so it is validated like the rest.
export async function checkInAllFromUser(
  userId: unknown,
  values: CheckinValues,
): Promise<BulkActionResult> {
  const input = await authorizeBulk(values, checkinSchema);
  if ("errors" in input) return input;
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { errors: { message: "Unknown person." } };

  const holderId = id.data;
  const [assets, hasAccessories] = await Promise.all([
    prisma.asset.findMany({
      where: { assignedToId: holderId },
      select: { id: true },
      orderBy: [{ type: "asc" }, { assetTag: "asc" }, { id: "asc" }],
    }),
    prisma.accessoryAssignment
      .count({ where: { ...openAssignmentWhere, userId: holderId } })
      .then((count) => count > 0),
  ]);
  if (assets.length === 0 && !hasAccessories) {
    return { errors: { message: "They hold nothing to take back." } };
  }

  const { actorId } = input;
  const summary = await runBulk(
    assets.map((asset) => asset.id),
    (assetId) =>
      checkInAsset({ assetId, actorId, fromUserId: holderId, ...input.values }),
  );
  // Accessories have no status, so they all come back as they are.
  const accessories = hasAccessories
    ? await returnAllAccessories({ userId: holderId, actorId })
    : 0;
  return finishBulk({ ...summary, accessories });
}
