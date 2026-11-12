import type { Prisma } from "@/lib/generated/prisma/client";
import type { AssetEventType } from "@/lib/generated/prisma/enums";
import type { FieldChange } from "@/lib/assets/asset-detail";
import { assetFormFieldLabels, holderFields } from "@/lib/assets/asset-form";
import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import { getAssetHolder, type AssetAssignment } from "@/lib/assets/format";

// Only the fields whose value really changed.
export function getChangedFields(fields: FieldChange[]): FieldChange[] {
  return fields.filter(({ from, to }) => from !== to);
}

type AssetEventInput = {
  assetId: number;
  // Null until sign-in exists (see lib/current-user.ts).
  actorId: number | null;
  type: AssetEventType;
  // The person a checkout or checkin was for.
  targetUserId?: number | null;
  changes?: FieldChange[];
};

// Writes one history event. Call it in the same transaction as the change,
// so a change is never saved without its history entry.
export async function recordAssetEvent(
  tx: Prisma.TransactionClient,
  { assetId, actorId, type, targetUserId = null, changes }: AssetEventInput,
): Promise<void> {
  await tx.assetEvent.create({
    data: { assetId, actorId, type, targetUserId, changes },
  });
}

type AssetUpdateInput = Pick<AssetEventInput, "assetId" | "actorId"> & {
  changes: FieldChange[];
};

// The UPDATED event of an edit; nothing is written when nothing changed.
export async function recordAssetUpdate(
  tx: Prisma.TransactionClient,
  input: AssetUpdateInput,
): Promise<void> {
  if (input.changes.length === 0) return;
  await recordAssetEvent(tx, { ...input, type: "UPDATED" });
}

type AssetCheckoutInput = Pick<AssetEventInput, "actorId"> & {
  asset: AssetAssignment & { id: number };
};

// The CHECKOUT event for an asset's current holder; nothing when it has none.
// A person is linked as the target; a company or location is written as a
// change (e.g. "Location: — → Server room"), so history names it too.
export async function recordAssetCheckout(
  tx: Prisma.TransactionClient,
  { asset, actorId }: AssetCheckoutInput,
): Promise<void> {
  const holder = getAssetHolder(asset);
  if (!holder) return;

  const { assignTo } = getAssetTypeConfig(asset.type);
  await recordAssetEvent(tx, {
    assetId: asset.id,
    actorId,
    type: "CHECKOUT",
    targetUserId: asset.assignedTo?.id ?? null,
    changes:
      assignTo === "user"
        ? undefined
        : [
            {
              field: assetFormFieldLabels[holderFields[assignTo]],
              from: null,
              to: holder,
            },
          ],
  });
}
