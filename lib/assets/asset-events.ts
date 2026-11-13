import type { Prisma } from "@/lib/generated/prisma/client";
import type { AssetEventType } from "@/lib/generated/prisma/enums";
import { formatCost, type FieldChange } from "@/lib/assets/asset-detail";
import {
  assetFormFieldLabels,
  holderFields,
  type AssetFormField,
} from "@/lib/assets/asset-form";
import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import {
  formatModelName,
  getAssetHolder,
  type AssetAssignment,
} from "@/lib/assets/format";
import { formatDate } from "@/lib/utils";

// ─── Changes ─────────────────────────────────────────────────────────────────

// What an edit compares, read before and after the save.
export const assetChangeSelect = {
  assetTag: true,
  name: true,
  serial: true,
  imei: true,
  phoneNumber: true,
  operatingSystem: true,
  vmHost: true,
  vCpu: true,
  ramGb: true,
  purchaseDate: true,
  purchaseCost: true,
  notes: true,
  model: { select: { name: true, manufacturer: true } },
  status: { select: { name: true } },
  company: { select: { name: true } },
  location: { select: { name: true } },
  assignedTo: { select: { displayName: true } },
} satisfies Prisma.AssetSelect;

type AssetChangeFields = Prisma.AssetGetPayload<{
  select: typeof assetChangeSelect;
}>;

// Each form field as history shows it: names instead of ids, formatted
// dates and amounts. Saved as text, so history stays true after a rename.
const historyValues: Record<
  AssetFormField,
  (asset: AssetChangeFields) => string | null
> = {
  assetTag: (asset) => asset.assetTag,
  name: (asset) => asset.name,
  serial: (asset) => asset.serial,
  modelId: (asset) => formatModelName(asset.model),
  statusId: (asset) => asset.status.name,
  companyId: (asset) => asset.company?.name ?? null,
  locationId: (asset) => asset.location?.name ?? null,
  assignedToId: (asset) => asset.assignedTo?.displayName ?? null,
  imei: (asset) => asset.imei,
  phoneNumber: (asset) => asset.phoneNumber,
  operatingSystem: (asset) => asset.operatingSystem,
  vmHost: (asset) => asset.vmHost,
  vCpu: (asset) => asset.vCpu?.toString() ?? null,
  ramGb: (asset) => asset.ramGb?.toString() ?? null,
  purchaseDate: (asset) => asset.purchaseDate && formatDate(asset.purchaseDate),
  purchaseCost: (asset) => asset.purchaseCost && formatCost(asset.purchaseCost),
  notes: (asset) => asset.notes,
};

// The fields an edit really changed, e.g. "Location: Baku office → Server room".
export function getAssetChanges(
  before: AssetChangeFields,
  after: AssetChangeFields,
  fields: AssetFormField[],
): FieldChange[] {
  return getChangedFields(
    fields.map((field) => ({
      field: assetFormFieldLabels[field],
      from: historyValues[field](before),
      to: historyValues[field](after),
    })),
  );
}

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
  // Typed with a checkout or checkin, e.g. "Charger handed over".
  note?: string | null;
};

// Writes one history event. Call it in the same transaction as the change,
// so a change is never saved without its history entry.
export async function recordAssetEvent(
  tx: Prisma.TransactionClient,
  {
    assetId,
    actorId,
    type,
    targetUserId = null,
    changes = [],
    note = null,
  }: AssetEventInput,
): Promise<void> {
  await tx.assetEvent.create({
    data: {
      assetId,
      actorId,
      type,
      targetUserId,
      // An event without field changes stores none, not an empty list.
      changes: changes.length > 0 ? changes : undefined,
      note,
    },
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

// ─── Checkout and checkin ────────────────────────────────────────────────────

type AssetHolderState = AssetAssignment & { id: number };

// A person is linked as the event's target. A company or location has no such
// link, so it is written as a change (e.g. "Location: — → Server room").
function getHolderChanges(
  before: AssetHolderState | null,
  after: AssetHolderState,
): FieldChange[] {
  const { assignTo } = getAssetTypeConfig(after.type);
  if (assignTo === "user") return [];
  return getChangedFields([
    {
      field: assetFormFieldLabels[holderFields[assignTo]],
      from: before && getAssetHolder(before),
      to: getAssetHolder(after),
    },
  ]);
}

type AssetCheckoutInput = Pick<AssetEventInput, "actorId" | "note"> & {
  asset: AssetHolderState;
};

// The CHECKOUT event for an asset's current holder; nothing when it has none.
export async function recordAssetCheckout(
  tx: Prisma.TransactionClient,
  { asset, actorId, note }: AssetCheckoutInput,
): Promise<void> {
  if (!getAssetHolder(asset)) return;
  await recordAssetEvent(tx, {
    assetId: asset.id,
    actorId,
    type: "CHECKOUT",
    targetUserId: asset.assignedTo?.id ?? null,
    changes: getHolderChanges(null, asset),
    note,
  });
}

type AssetCheckinInput = Pick<AssetEventInput, "actorId" | "note"> & {
  // The asset before and after the checkin, with its status.
  before: AssetHolderState & { status: { name: string } };
  after: AssetHolderState & { status: { name: string } };
};

// The CHECKIN event: who or where it came back from, and the status it got,
// e.g. "Status: In stock → In storage".
export async function recordAssetCheckin(
  tx: Prisma.TransactionClient,
  { before, after, actorId, note }: AssetCheckinInput,
): Promise<void> {
  await recordAssetEvent(tx, {
    assetId: after.id,
    actorId,
    type: "CHECKIN",
    targetUserId: before.assignedTo?.id ?? null,
    changes: [
      ...getHolderChanges(before, after),
      ...getChangedFields([
        {
          field: assetFormFieldLabels.statusId,
          from: before.status.name,
          to: after.status.name,
        },
      ]),
    ],
    note,
  });
}
