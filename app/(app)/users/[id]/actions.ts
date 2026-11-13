"use server";

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

// Offboarding: takes back everything the person holds, with the same status
// and note on each. `userId` is bound by the page, but it still comes from
// the browser, so it is validated like the rest.
export async function checkInAllFromUser(
  userId: unknown,
  values: CheckinValues,
): Promise<BulkActionResult> {
  const input = await authorizeBulk(values, checkinSchema);
  if ("errors" in input) return input;
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { errors: { message: "Unknown person." } };

  const assets = await prisma.asset.findMany({
    where: { assignedToId: id.data },
    select: { id: true },
    orderBy: [{ type: "asc" }, { assetTag: "asc" }, { id: "asc" }],
  });
  if (assets.length === 0) {
    return { errors: { message: "They hold no assets." } };
  }

  const { actorId } = input;
  return finishBulk(
    await runBulk(
      assets.map((asset) => asset.id),
      (assetId) =>
        checkInAsset({
          assetId,
          actorId,
          fromUserId: id.data,
          ...input.values,
        }),
    ),
  );
}
