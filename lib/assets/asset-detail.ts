import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AssetSource, AssetType } from "@/lib/generated/prisma/enums";
import {
  getAssetPath,
  getAssetTypeBySlug,
  getAssetTypeConfig,
} from "@/lib/assets/asset-types";
import { assetListSelect } from "@/lib/assets/queries";
import {
  formatModelName,
  isIntuneHolderMismatch,
  isIntuneManaged,
  joinOsName,
} from "@/lib/assets/format";
import { prisma } from "@/lib/prisma";
import { getPositiveIntParam } from "@/lib/search-params";
import { daysBetween, formatAge, formatDate } from "@/lib/utils";

// Everything the list shows, plus the fields only the detail page needs.
const assetDetailSelect = {
  ...assetListSelect,
  purchaseCost: true,
  purchaseDate: true,
  source: true,
  lastIntuneSync: true,
  missingInIntune: true,
  intuneId: true,
  intunePrimaryUser: true,
  intuneSyncProblem: true,
  assignedTo: {
    select: {
      id: true,
      displayName: true,
      email: true,
      department: true,
      jobTitle: true,
    },
  },
  // Latest checkout only: when the current holder got the asset.
  events: {
    where: { type: "CHECKOUT" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true },
  },
} satisfies Prisma.AssetSelect;

export type AssetDetail = Prisma.AssetGetPayload<{
  select: typeof assetDetailSelect;
}>;

// Wrapped in cache(), so the page and its metadata share one query per request.
export const getAssetDetail = cache(
  async (id: number): Promise<AssetDetail | null> =>
    prisma.asset.findUnique({ where: { id }, select: assetDetailSelect }),
);

// The asset of an /assets/[type]/[id] page (detail or edit). An unknown id
// is a 404; an old or hand-typed link with the wrong type (e.g.
// /assets/monitors/7 for a PC) goes to `pathFor` the asset's real type.
export async function getRouteAsset(
  route: { type: string; id: string },
  pathFor: (type: AssetType, id: number) => string,
): Promise<AssetDetail> {
  const id = getPositiveIntParam(route, "id");
  const asset = id === undefined ? null : await getAssetDetail(id);
  if (!asset) notFound();
  if (getAssetTypeBySlug(route.type)?.type !== asset.type) {
    redirect(pathFor(asset.type, asset.id));
  }
  return asset;
}

// The page of a migrated asset, by its Snipe-IT id (old QR labels); null
// when no asset came with that id.
export async function getLegacyAssetPath(
  snipeId: number,
): Promise<string | null> {
  const asset = await prisma.asset.findUnique({
    where: { legacySnipeId: snipeId },
    select: { id: true, type: true },
  });
  return asset ? getAssetPath(asset.type, asset.id) : null;
}

// Intune's primary user, when they should perhaps hold the asset instead
// (isIntuneHolderMismatch): our user with that email if they are an active
// employee, else only the email.
export type IntuneHolderSuggestion = {
  email: string;
  user: { id: number; displayName: string } | null;
  // Someone else holds it; otherwise nobody does.
  isHeldByOther: boolean;
};

export async function getIntuneHolderSuggestion(
  asset: AssetDetail,
): Promise<IntuneHolderSuggestion | null> {
  if (!asset.intunePrimaryUser || !isIntuneHolderMismatch(asset)) return null;
  const user = await prisma.user.findFirst({
    where: { email: asset.intunePrimaryUser, isActive: true },
    select: { id: true, displayName: true },
  });
  return {
    email: asset.intunePrimaryUser,
    user,
    isHeldByOther: asset.assignedTo !== null,
  };
}

export function getCheckedOutAt(asset: AssetDetail): Date | null {
  return asset.events[0]?.createdAt ?? null;
}

const INTUNE_DEVICE_URL =
  "https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/";

// The device's page in the Intune admin center, e.g. to check compliance.
export function getIntuneDeviceUrl(asset: AssetDetail): string | null {
  return asset.intuneId
    ? `${INTUNE_DEVICE_URL}${encodeURIComponent(asset.intuneId)}`
    : null;
}

// ─── Intune sync status ──────────────────────────────────────────────────────

// A device that has not checked in with Intune for longer than this needs a
// look (e.g. switched off, at the service). It is the device's own check-in,
// not our sync: syncing again does not change it.
const INTUNE_STALE_AFTER_DAYS = 7;

export type IntuneSyncState = "synced" | "stale" | "missing" | "never";

export type IntuneSyncStatus = { state: IntuneSyncState; label: string };

type IntuneSyncFields = Pick<AssetDetail, "lastIntuneSync" | "missingInIntune">;

// How fresh the Intune data of a device is. Missing wins over everything:
// the last known sync time no longer matters once Intune lost the device.
export function getIntuneSyncStatus(
  asset: IntuneSyncFields,
  now: Date = new Date(),
): IntuneSyncStatus {
  if (asset.missingInIntune) {
    return { state: "missing", label: "No longer in Intune" };
  }
  if (!asset.lastIntuneSync) {
    return { state: "never", label: "Never checked in with Intune" };
  }
  const days = daysBetween(asset.lastIntuneSync, now);
  if (days > INTUNE_STALE_AFTER_DAYS) {
    return {
      state: "stale",
      label: `No check-in with Intune for ${days} days`,
    };
  }
  return { state: "synced", label: "Checked in with Intune recently" };
}

// A device that should be in Intune (e.g. a PC) but is not linked to an
// Intune device yet. A linked one has the Intune card instead (as has one
// the sync found a problem with, to sync it again once fixed).
export function isNotInIntune(asset: AssetDetail): boolean {
  return (
    getAssetTypeConfig(asset.type).enrolledInIntune === true &&
    !isIntuneManaged(asset)
  );
}

// ─── Detail sections ─────────────────────────────────────────────────────────

export type DetailField = {
  label: string;
  // A date is shown as relative time ("2 hours ago"), exact on hover.
  value: string | number | Date | null;
  // Identifiers (serials, IMEIs, versions) read better in a monospace font.
  mono?: boolean;
  // Adds a copy button, for values often pasted elsewhere (serial, IMEI).
  copyable?: boolean;
  // Makes the value a link, e.g. mailto: or tel:.
  href?: string;
};

export type DetailSection = {
  title: string;
  // System the fields come from; its icon is shown next to the title.
  source?: AssetSource;
  // How fresh the data is: colors that icon, and editors can sync the record
  // from the title.
  syncStatus?: IntuneSyncStatus;
  // Opens the record in that system.
  link?: { label: string; href: string };
  // Fields owned by another system (e.g. Intune) cannot be edited here.
  readOnly?: boolean;
  // What the last sync found wrong, shown above the fields.
  problem?: string;
  fields: DetailField[];
};

// "+994 50 123 45 67" → "tel:+994501234567"
function getPhoneHref(phoneNumber: string | null): string | undefined {
  return phoneNumber ? `tel:${phoneNumber.replace(/[^\d+]/g, "")}` : undefined;
}

// Purchase cost and currency, e.g. "1,480.00 ₼".
const costFormat = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCost(cost: Prisma.Decimal): string {
  return `${costFormat.format(Number(cost))} ₼`;
}

function formatPurchase(asset: AssetDetail): string | null {
  const parts = [
    asset.purchaseDate && formatDate(asset.purchaseDate),
    asset.purchaseCost && formatCost(asset.purchaseCost),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Fields every asset has.
function buildDetailsSection(asset: AssetDetail): DetailSection {
  return {
    title: "Details",
    fields: [
      { label: "Serial", value: asset.serial, mono: true, copyable: true },
      { label: "Model", value: formatModelName(asset.model) },
      { label: "Category", value: asset.model?.category.name ?? null },
      { label: "Company", value: asset.company?.name ?? null },
      { label: "Location", value: asset.location?.name ?? null },
      { label: "Purchased", value: formatPurchase(asset) },
      {
        label: "Age",
        value: asset.purchaseDate && formatAge(asset.purchaseDate),
      },
    ],
  };
}

// Fields of one asset type, next to the common details. Null: nothing extra.
const typeSections: Record<
  AssetType,
  (asset: AssetDetail) => DetailSection | null
> = {
  PC: () => null,
  MONITOR: () => null,
  PRINTER: () => null,
  PHONE: (asset) => ({
    title: "Phone",
    fields: [
      { label: "IMEI", value: asset.imei, mono: true, copyable: true },
      {
        label: "Phone number",
        value: asset.phoneNumber,
        mono: true,
        copyable: true,
        href: getPhoneHref(asset.phoneNumber),
      },
      { label: "OS", value: asset.operatingSystem },
    ],
  }),
  VM: (asset) => ({
    title: "Virtual machine",
    fields: [
      { label: "Name", value: asset.name },
      { label: "OS", value: asset.operatingSystem },
      { label: "Host", value: asset.vmHost },
      { label: "vCPU", value: asset.vCpu },
      {
        label: "RAM",
        value: asset.ramGb === null ? null : `${asset.ramGb} GB`,
      },
    ],
  }),
  ACCESS_POINT: () => null,
  CAMERA: () => null,
  OTHER: () => null,
};

// An asset the sync could not link, e.g. as its serial differs from the
// device named after its tag.
const NOT_LINKED_STATUS: IntuneSyncStatus = {
  state: "never",
  label: "Not linked to an Intune device",
};

// Shown for any asset linked to Intune, whatever its type or source, and for
// one the sync could not link: its problem, and the title to sync it again
// once fixed.
function buildIntuneSection(asset: AssetDetail): DetailSection | null {
  const problem = asset.intuneSyncProblem ?? undefined;
  if (!isIntuneManaged(asset)) {
    return problem
      ? {
          title: "Intune",
          source: "INTUNE",
          syncStatus: NOT_LINKED_STATUS,
          problem,
          fields: [],
        }
      : null;
  }

  const intuneUrl = getIntuneDeviceUrl(asset);
  const syncStatus = getIntuneSyncStatus(asset);
  return {
    title: "Intune",
    source: "INTUNE",
    syncStatus,
    readOnly: true,
    link: intuneUrl ? { label: "Open in Intune", href: intuneUrl } : undefined,
    problem,
    fields: [
      { label: "Device name", value: asset.name },
      { label: "OS", value: asset.operatingSystem },
      { label: "OS version", value: asset.osVersion, mono: true },
      ...(asset.secondaryOperatingSystem
        ? [
            {
              label: "Second OS (dual boot)",
              value: joinOsName(
                asset.secondaryOperatingSystem,
                asset.secondaryOsVersion,
              ),
            },
          ]
        : []),
      { label: "Last sync", value: asset.lastIntuneSync },
      { label: "Sync status", value: syncStatus.label },
    ],
  };
}

// Cards of the detail page, in display order.
export function buildDetailSections(asset: AssetDetail): DetailSection[] {
  return [
    buildDetailsSection(asset),
    typeSections[asset.type](asset),
    buildIntuneSection(asset),
  ].filter((section) => section !== null);
}

// ─── History ─────────────────────────────────────────────────────────────────

// One changed field of an UPDATED or SYNC event, stored in AssetEvent.changes as
// an array. Values are saved as shown at the time (e.g. the location's name),
// so history stays true after a location or status is renamed.
export type FieldChange = {
  field: string;
  from: string | null;
  to: string | null;
};

function isTextOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFieldChange(value: unknown): value is FieldChange {
  return (
    typeof value === "object" &&
    value !== null &&
    "field" in value &&
    "from" in value &&
    "to" in value &&
    typeof value.field === "string" &&
    isTextOrNull(value.from) &&
    isTextOrNull(value.to)
  );
}

// The column is free JSON, so anything not in the expected shape is skipped.
export function parseFieldChanges(changes: Prisma.JsonValue): FieldChange[] {
  return Array.isArray(changes) ? changes.filter(isFieldChange) : [];
}

export const assetEventSelect = {
  id: true,
  type: true,
  createdAt: true,
  changes: true,
  note: true,
  actor: { select: { id: true, displayName: true } },
  targetUser: { select: { id: true, displayName: true } },
} satisfies Prisma.AssetEventSelect;

type AssetEventRow = Prisma.AssetEventGetPayload<{
  select: typeof assetEventSelect;
}>;

export type AssetHistoryEvent = Omit<AssetEventRow, "changes"> & {
  changes: FieldChange[];
};

// Newest first; events saved in the same moment keep the order they were written.
const newestFirst = [
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.AssetEventOrderByWithRelationInput[];

export async function listAssetHistory(
  assetId: number,
): Promise<AssetHistoryEvent[]> {
  const events = await prisma.assetEvent.findMany({
    where: { assetId },
    select: assetEventSelect,
    orderBy: newestFirst,
  });
  return events.map((event) => ({
    ...event,
    changes: parseFieldChanges(event.changes),
  }));
}

// Events of many assets (a person's page, the dashboard) also say which
// asset each one is about.
const eventWithAssetSelect = {
  ...assetEventSelect,
  asset: {
    select: {
      id: true,
      type: true,
      assetTag: true,
      name: true,
      model: assetListSelect.model,
    },
  },
} satisfies Prisma.AssetEventSelect;

export type AssetEventWithAsset = AssetHistoryEvent & {
  asset: Prisma.AssetEventGetPayload<{
    select: typeof eventWithAssetSelect;
  }>["asset"];
};

// Events across assets, newest first; `take` keeps only the latest few.
export async function listAssetEvents(
  where: Prisma.AssetEventWhereInput,
  take?: number,
): Promise<AssetEventWithAsset[]> {
  const events = await prisma.assetEvent.findMany({
    where,
    select: eventWithAssetSelect,
    orderBy: newestFirst,
    take,
  });
  return events.map((event) => ({
    ...event,
    changes: parseFieldChanges(event.changes),
  }));
}
