import {
  recordAssetCheckin,
  recordAssetCheckout,
} from "@/lib/assets/asset-events";
import {
  getAssetTypeConfig,
  type AssignTarget,
} from "@/lib/assets/asset-types";
import { getCheckoutBlocker, isAssetAssigned } from "@/lib/assets/format";
import { getAssetSaveConflict } from "@/lib/assets/queries";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Checkout and checkin of one asset, shared by its page and, later, bulk
// actions, scanning and offboarding on the user page.

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

type AssignmentChange = {
  assetId: number;
  // Null until sign-in exists (see lib/current-user.ts).
  actorId: number | null;
  note: string | null;
};

// Why a checkout or checkin was refused, as shown to the user; null when done.
type AssignmentResult = string | null;

// What a checkout or checkin dialog shows when it cannot be saved: a message
// for the whole dialog, or one under a field (holderId, statusId, note).
export type AssignmentErrors = {
  message?: string;
  fields?: Record<string, string>;
};

// Runs one checkout or checkin; refusals by the database (e.g. a person
// removed a moment ago) come back as a message too.
async function runAssignment(
  change: (tx: Prisma.TransactionClient) => Promise<AssignmentResult>,
): Promise<AssignmentResult> {
  try {
    return await prisma.$transaction(change);
  } catch (error) {
    const conflict = getAssetSaveConflict(error);
    if (conflict) return conflict;
    throw error;
  }
}

// Hands the asset to a person, company or location (per its type).
export function checkOutAsset({
  assetId,
  actorId,
  note,
  holderId,
}: AssignmentChange & { holderId: number }): Promise<AssignmentResult> {
  return runAssignment(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: assignmentSelect,
    });
    if (!asset) return "This asset no longer exists.";
    const blocker = getCheckoutBlocker(asset);
    if (blocker) return blocker;

    const { assignTo } = getAssetTypeConfig(asset.type);
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
export function checkInAsset({
  assetId,
  actorId,
  note,
  statusId,
}: AssignmentChange & { statusId: number }): Promise<AssignmentResult> {
  return runAssignment(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: assignmentSelect,
    });
    if (!asset) return "This asset no longer exists.";
    if (!isAssetAssigned(asset)) return "It is not checked out.";

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
