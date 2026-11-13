import {
  getChangedFields,
  recordAssetCheckin,
  recordAssetCheckout,
  recordAssetUpdate,
} from "@/lib/assets/asset-events";
import { assetFormFieldLabels } from "@/lib/assets/asset-form";
import {
  getAssetTypeConfig,
  type AssignTarget,
} from "@/lib/assets/asset-types";
import { getCheckoutBlocker, isAssetAssigned } from "@/lib/assets/format";
import { getAssetSaveConflict } from "@/lib/assets/queries";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Checkout, checkin and status changes of one asset, shared by its page,
// bulk actions and, later, scanning and offboarding on the user page.

// Everything the rules and the history entry need.
const assignmentSelect = {
  id: true,
  type: true,
  status: { select: { id: true, name: true, type: true, color: true } },
  assignedTo: { select: { id: true, displayName: true, email: true } },
  company: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
} satisfies Prisma.AssetSelect;

// The column that holds the holder, per the type's assignTo.
const holderData: Record<
  AssignTarget,
  (holderId: number | null) => Prisma.AssetUncheckedUpdateInput
> = {
  user: (holderId) => ({ assignedToId: holderId }),
  company: (holderId) => ({ companyId: holderId }),
  location: (holderId) => ({ locationId: holderId }),
};

type AssetChange = {
  assetId: number;
  // Null until sign-in exists (see lib/current-user.ts).
  actorId: number | null;
  note: string | null;
};

// Why a change was refused, as shown to the user; null when done.
export type AssetChangeResult = string | null;

// What a checkout or checkin dialog shows when it cannot be saved: a message
// for the whole dialog, or one under a field (holderId, statusId, note).
export type AssignmentErrors = {
  message?: string;
  fields?: Record<string, string>;
};

// Runs one change; refusals by the database (e.g. a person removed a moment
// ago) come back as a message too.
async function runAssetChange(
  change: (tx: Prisma.TransactionClient) => Promise<AssetChangeResult>,
): Promise<AssetChangeResult> {
  try {
    return await prisma.$transaction(change);
  } catch (error) {
    const conflict = getAssetSaveConflict(error);
    if (conflict) return conflict;
    throw error;
  }
}

// Hands the asset to a person, company or location (per its type).
// `assignTo` is the kind of holder chosen; when given, an asset of a type
// that goes to another kind is refused, e.g. a VM given to a person.
export function checkOutAsset({
  assetId,
  actorId,
  note,
  holderId,
  assignTo: chosen,
}: AssetChange & {
  holderId: number;
  assignTo?: AssignTarget;
}): Promise<AssetChangeResult> {
  return runAssetChange(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: assignmentSelect,
    });
    if (!asset) return "This asset no longer exists.";
    const blocker = getCheckoutBlocker(asset);
    if (blocker) return blocker;

    const { assignTo, label } = getAssetTypeConfig(asset.type);
    if (chosen && chosen !== assignTo) {
      return `${label} go to a ${assignTo}, not a ${chosen}.`;
    }
    const checkedOut = await tx.asset.update({
      where: { id: assetId },
      data: holderData[assignTo](holderId),
      select: assignmentSelect,
    });
    await recordAssetCheckout(tx, { asset: checkedOut, actorId, note });
    return null;
  });
}

// Takes the asset back and gives it the chosen status, e.g. "In storage".
// `fromUserId` is the person it is taken from, when that is what was asked
// (e.g. "check in all" on their page); it is refused if someone else has it.
export function checkInAsset({
  assetId,
  actorId,
  note,
  statusId,
  fromUserId,
}: AssetChange & {
  statusId: number;
  fromUserId?: number;
}): Promise<AssetChangeResult> {
  return runAssetChange(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: assignmentSelect,
    });
    if (!asset) return "This asset no longer exists.";
    if (!isAssetAssigned(asset)) return "It is not checked out.";
    if (fromUserId !== undefined && asset.assignedTo?.id !== fromUserId) {
      return "It is no longer checked out to them.";
    }

    const { assignTo } = getAssetTypeConfig(asset.type);
    const checkedIn = await tx.asset.update({
      where: { id: assetId },
      data: { ...holderData[assignTo](null), statusId },
      select: assignmentSelect,
    });
    await recordAssetCheckin(tx, {
      before: asset,
      after: checkedIn,
      actorId,
      note,
    });
    return null;
  });
}

// Gives the asset another status, e.g. "In repair", and writes it to the
// history. A handed-out asset keeps its holder, but cannot be archived.
export function changeAssetStatus({
  assetId,
  actorId,
  note,
  statusId,
}: AssetChange & { statusId: number }): Promise<AssetChangeResult> {
  return runAssetChange(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: assignmentSelect,
    });
    if (!asset) return "This asset no longer exists.";
    const status = await tx.statusLabel.findUnique({
      where: { id: statusId },
      select: { type: true },
    });
    if (!status) return "This status no longer exists.";
    if (status.type === "ARCHIVED" && isAssetAssigned(asset)) {
      return "It is checked out: check it in first.";
    }

    const changed = await tx.asset.update({
      where: { id: assetId },
      data: { statusId },
      select: assignmentSelect,
    });
    // Nothing is written when it already had this status.
    await recordAssetUpdate(tx, {
      assetId,
      actorId,
      note,
      changes: getChangedFields([
        {
          field: assetFormFieldLabels.statusId,
          from: asset.status.name,
          to: changed.status.name,
        },
      ]),
    });
    return null;
  });
}
