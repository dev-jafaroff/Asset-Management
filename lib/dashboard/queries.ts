import { withHeldAccessories } from "@/lib/accessories/queries";
import {
  listAssetEvents,
  parseFieldChanges,
  type AssetEventWithAsset,
} from "@/lib/assets/asset-detail";
import { assetFormFieldLabels } from "@/lib/assets/asset-form";
import { isIntuneHolderMismatch } from "@/lib/assets/format";
import { assetListSelect } from "@/lib/assets/queries";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { holdsItemsWhere } from "@/lib/users/queries";
import { daysBetween } from "@/lib/utils";

// ─── Needs attention ─────────────────────────────────────────────────────────

// An asset out of use (e.g. "In repair") for longer than this is flagged.
export const LONG_UNAVAILABLE_DAYS = 14;

// What a dashboard list needs to name and link an asset.
const attentionAssetSelect = {
  id: true,
  type: true,
  assetTag: true,
  name: true,
  createdAt: true,
  model: assetListSelect.model,
  status: { select: { name: true } },
} satisfies Prisma.AssetSelect;

type AttentionAsset = Prisma.AssetGetPayload<{
  select: typeof attentionAssetSelect;
}>;

export type UnavailableAsset = AttentionAsset & { days: number };

// When the asset got its current status: the latest history entry that set
// it, e.g. "Status: In stock → In repair". One created with it has none, so
// its creation counts. Not updatedAt, which any edit moves.
function getStatusSince(
  asset: AttentionAsset,
  events: { createdAt: Date; changes: Prisma.JsonValue }[],
): Date {
  const setStatus = events.find((event) =>
    parseFieldChanges(event.changes).some(
      (change) =>
        change.field === assetFormFieldLabels.statusId &&
        change.to === asset.status.name,
    ),
  );
  return setStatus?.createdAt ?? asset.createdAt;
}

// Assets out of use (In repair, or another UNDEPLOYABLE status) for more than
// LONG_UNAVAILABLE_DAYS, longest first.
export async function listLongUnavailableAssets(
  now: Date = new Date(),
): Promise<UnavailableAsset[]> {
  const assets = await prisma.asset.findMany({
    where: { status: { type: "UNDEPLOYABLE" } },
    select: {
      ...attentionAssetSelect,
      // Only entries that can change the status, newest first.
      events: {
        where: { type: { in: ["UPDATED", "CHECKIN"] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true, changes: true },
      },
    },
  });

  return assets
    .map(({ events, ...asset }) => ({
      ...asset,
      days: daysBetween(getStatusSince(asset, events), now),
    }))
    .filter((asset) => asset.days > LONG_UNAVAILABLE_DAYS)
    .sort((a, b) => b.days - a.days);
}

const inactiveHolderSelect = {
  id: true,
  displayName: true,
  department: true,
  _count: { select: { assignedAssets: true } },
} satisfies Prisma.UserSelect;

export type InactiveHolder = Prisma.UserGetPayload<{
  select: typeof inactiveHolderSelect;
}> & { heldAccessories: number };

// People who left but still hold assets or accessories: to be taken back
// (offboarding).
export async function listInactiveHolders(): Promise<InactiveHolder[]> {
  const people = await prisma.user.findMany({
    where: { isActive: false, ...holdsItemsWhere },
    select: inactiveHolderSelect,
    orderBy: { displayName: "asc" },
  });
  return withHeldAccessories(people);
}

// Devices the Intune sync no longer finds, e.g. wiped or removed there.
export function listMissingInIntune(): Promise<AttentionAsset[]> {
  return prisma.asset.findMany({
    where: { missingInIntune: true, status: { type: { not: "ARCHIVED" } } },
    select: attentionAssetSelect,
    orderBy: [{ assetTag: "asc" }, { id: "asc" }],
  });
}

export type IntuneHolderMismatch = AttentionAsset & {
  // Intune's primary user: their name when they work here, else the email.
  intuneUser: string;
};

// Devices whose Intune primary user is not who holds them here
// (isIntuneHolderMismatch), to check out to the right person.
export async function listIntuneHolderMismatches(): Promise<
  IntuneHolderMismatch[]
> {
  const assets = await prisma.asset.findMany({
    where: {
      intunePrimaryUser: { not: null },
      missingInIntune: false,
      status: { type: { not: "ARCHIVED" } },
    },
    select: {
      ...attentionAssetSelect,
      intunePrimaryUser: true,
      assignedTo: { select: { email: true } },
      status: { select: { name: true, type: true } },
    },
    orderBy: [{ assetTag: "asc" }, { id: "asc" }],
  });
  const mismatched = assets.filter(isIntuneHolderMismatch);
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: mismatched.flatMap((asset) => asset.intunePrimaryUser ?? []),
      },
    },
    select: { email: true, displayName: true },
  });
  const names = new Map(users.map((user) => [user.email, user.displayName]));
  return mismatched.map((asset) => ({
    ...asset,
    intuneUser:
      names.get(asset.intunePrimaryUser ?? "") ?? asset.intunePrimaryUser ?? "",
  }));
}

// ─── Recent activity ─────────────────────────────────────────────────────────

const RECENT_ACTIVITY_COUNT = 10;

// The latest things people did, newest first. Intune sync is left out: once
// it runs it writes many entries a day and would push people's actions off.
export function listRecentActivity(): Promise<AssetEventWithAsset[]> {
  return listAssetEvents({ type: { not: "SYNC" } }, RECENT_ACTIVITY_COUNT);
}
