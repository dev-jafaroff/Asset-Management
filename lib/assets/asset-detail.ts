import { cache } from "react";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AssetSource, AssetType } from "@/lib/generated/prisma/enums";
import { assetListSelect } from "@/lib/assets/queries";
import { formatModelName } from "@/lib/assets/format";
import { prisma } from "@/lib/prisma";
import { daysBetween, formatAge, formatDate } from "@/lib/utils";

// Everything the list shows, plus the fields only the detail page needs.
const assetDetailSelect = {
  ...assetListSelect,
  notes: true,
  purchaseCost: true,
  purchaseDate: true,
  source: true,
  lastIntuneSync: true,
  missingInIntune: true,
  intuneId: true,
  model: {
    select: {
      id: true,
      name: true,
      manufacturer: true,
      category: { select: { name: true } },
    },
  },
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

export function getCheckedOutAt(asset: AssetDetail): Date | null {
  return asset.events[0]?.createdAt ?? null;
}

// Where the record came from; manual records show no badge.
const assetSourceLabels: Record<AssetSource, string | null> = {
  MANUAL: null,
  INTUNE: "Intune",
  SNIPEIT: "Snipe-IT",
};

const INTUNE_DEVICE_URL =
  "https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/";

// The device's page in the Intune admin center, e.g. to check compliance.
export function getIntuneDeviceUrl(asset: AssetDetail): string | null {
  return asset.intuneId
    ? `${INTUNE_DEVICE_URL}${encodeURIComponent(asset.intuneId)}`
    : null;
}

// ─── Intune sync status ──────────────────────────────────────────────────────

// A device that has not synced for longer than this needs a look.
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
    return { state: "missing", label: "Missing in the last sync" };
  }
  if (!asset.lastIntuneSync) {
    return { state: "never", label: "Never synced" };
  }
  const days = daysBetween(asset.lastIntuneSync, now);
  if (days > INTUNE_STALE_AFTER_DAYS) {
    return { state: "stale", label: `Not synced for ${days} days` };
  }
  return { state: "synced", label: "Up to date" };
}

export type AssetSourceBadge = {
  source: AssetSource;
  label: string;
  // Intune records also show how fresh their data is.
  syncStatus: IntuneSyncStatus | null;
};

// Badge next to the title: where the record came from.
export function getAssetSourceBadge(
  asset: AssetDetail,
): AssetSourceBadge | null {
  const label = assetSourceLabels[asset.source];
  if (!label) return null;
  const syncStatus =
    asset.source === "INTUNE" ? getIntuneSyncStatus(asset) : null;
  return { source: asset.source, label, syncStatus };
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
  // Colors that icon by how fresh the data is.
  syncState?: IntuneSyncState;
  // Opens the record in that system.
  link?: { label: string; href: string };
  // Fields owned by another system (e.g. Intune) cannot be edited here.
  readOnly?: boolean;
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

function formatPurchase(asset: AssetDetail): string | null {
  const parts = [
    asset.purchaseDate && formatDate(asset.purchaseDate),
    asset.purchaseCost && `${costFormat.format(Number(asset.purchaseCost))} ₼`,
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
      { label: "Notes", value: asset.notes },
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
};

// Shown for any asset synced from Intune, whatever its type.
function buildIntuneSection(asset: AssetDetail): DetailSection | null {
  if (asset.source !== "INTUNE") return null;
  const intuneUrl = getIntuneDeviceUrl(asset);
  const syncStatus = getIntuneSyncStatus(asset);
  return {
    title: "Intune",
    source: "INTUNE",
    syncState: syncStatus.state,
    readOnly: true,
    link: intuneUrl ? { label: "Open in Intune", href: intuneUrl } : undefined,
    fields: [
      { label: "Device name", value: asset.name },
      { label: "OS", value: asset.operatingSystem },
      { label: "OS version", value: asset.osVersion, mono: true },
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
function parseFieldChanges(changes: Prisma.JsonValue): FieldChange[] {
  return Array.isArray(changes) ? changes.filter(isFieldChange) : [];
}

const assetEventSelect = {
  id: true,
  type: true,
  createdAt: true,
  changes: true,
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
export async function listAssetHistory(
  assetId: number,
): Promise<AssetHistoryEvent[]> {
  const events = await prisma.assetEvent.findMany({
    where: { assetId },
    select: assetEventSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return events.map((event) => ({
    ...event,
    changes: parseFieldChanges(event.changes),
  }));
}
