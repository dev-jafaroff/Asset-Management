import type { Prisma } from "@/lib/generated/prisma/client";
import type { FieldChange } from "@/lib/assets/asset-detail";

// Only the fields whose value really changed.
export function getChangedFields(fields: FieldChange[]): FieldChange[] {
  return fields.filter(({ from, to }) => from !== to);
}

type AssetUpdateEvent = {
  assetId: number;
  // Null until sign-in exists (see lib/current-user.ts).
  actorId: number | null;
  changes: FieldChange[];
};

// Writes the UPDATED event of an edit. Call it in the same transaction as the
// update, so a change is never saved without its history entry.
export async function recordAssetUpdate(
  tx: Prisma.TransactionClient,
  { assetId, actorId, changes }: AssetUpdateEvent,
): Promise<void> {
  if (changes.length === 0) return;
  await tx.assetEvent.create({
    data: { assetId, actorId, type: "UPDATED", changes },
  });
}
