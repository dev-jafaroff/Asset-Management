import {
  getAssetTypeConfig,
  type AssignTarget,
} from "@/lib/assets/asset-types";
import type { AssetListItem } from "@/lib/assets/queries";

type AssetIdentity = Pick<AssetListItem, "id" | "assetTag" | "name" | "model">;
type AssetModelName = Pick<
  NonNullable<AssetListItem["model"]>,
  "name" | "manufacturer"
>;
export type AssetAssignment = Pick<
  AssetListItem,
  "type" | "assignedTo" | "company" | "location"
>;
type AssetWithStatus = AssetAssignment & Pick<AssetListItem, "status">;

export type DisplayStatus = { label: string; color: string };

// "Assigned" is derived from the assignment, not stored as a status label.
export const ASSIGNED_STATUS: DisplayStatus = {
  label: "Assigned",
  color: "var(--primary)",
};

// Labeled assets are known by their tag, VMs by their name, phones by their model.
export function getAssetDisplayName(asset: AssetIdentity): string {
  return (
    asset.assetTag ??
    asset.name ??
    formatModelName(asset.model) ??
    `#${asset.id}`
  );
}

export function formatModelName(model: AssetModelName | null): string | null {
  if (!model) return null;
  return [model.manufacturer, model.name].filter(Boolean).join(" ");
}

const holderNames: Record<
  AssignTarget,
  (asset: AssetAssignment) => string | null
> = {
  user: (asset) => asset.assignedTo?.displayName ?? null,
  company: (asset) => asset.company?.name ?? null,
  location: (asset) => asset.location?.name ?? null,
};

// Who or where the asset is handed out to, per its type's assignTo.
export function getAssetHolder(asset: AssetAssignment): string | null {
  return holderNames[getAssetTypeConfig(asset.type).assignTo](asset);
}

// Database equivalent: assignedWhere in lib/assets/status-filters.ts.
export function isAssetAssigned(asset: AssetAssignment): boolean {
  return getAssetHolder(asset) !== null;
}

// A deployable asset that is handed out shows as "Assigned"; any other status
// (e.g. In repair) stays visible even while the asset is assigned.
export function getAssetDisplayStatus(asset: AssetWithStatus): DisplayStatus {
  if (asset.status.type === "DEPLOYABLE" && isAssetAssigned(asset)) {
    return ASSIGNED_STATUS;
  }
  return { label: asset.status.name, color: asset.status.color };
}

// Why an asset cannot be checked out now, or null when it can. Only assets
// ready to hand out (In stock, In storage) can; one in repair or archived not.
export function getCheckoutBlocker(asset: AssetWithStatus): string | null {
  if (isAssetAssigned(asset)) return "It is already checked out.";
  if (asset.status.type !== "DEPLOYABLE") {
    return `${asset.status.name} assets cannot be checked out.`;
  }
  return null;
}

// Serials as compared between Intune, Snipe-IT and the forms: "pf3a 1bcd"
// and "PF3A1BCD" are the same device.
export function normalizeSerial(serial: string): string {
  return serial.replace(/\s+/g, "").toUpperCase();
}

// Linked to an Intune device by the sync (found by its serial), whether it
// was added by hand, migrated from Snipe-IT or created from Intune.
export function isIntuneManaged(asset: { intuneId: string | null }): boolean {
  return asset.intuneId !== null;
}

// joinOsName("Windows", "10.0.26100") → "Windows 10.0.26100"
export function joinOsName(
  system: string | null,
  version: string | null,
): string | null {
  return [system, version].filter(Boolean).join(" ") || null;
}

// Every system of a device, a dual-boot PC's second one after its first:
// "Windows 10.0.26100 · Linux (ubuntu) 22.04".
export function formatOperatingSystem(
  asset: Pick<
    AssetListItem,
    | "operatingSystem"
    | "osVersion"
    | "secondaryOperatingSystem"
    | "secondaryOsVersion"
  >,
): string | null {
  const systems = [
    joinOsName(asset.operatingSystem, asset.osVersion),
    joinOsName(asset.secondaryOperatingSystem, asset.secondaryOsVersion),
  ].filter(Boolean);
  return systems.length > 0 ? systems.join(" · ") : null;
}

type IntuneHolderFields = {
  type: AssetListItem["type"];
  intunePrimaryUser: string | null;
  assignedTo: { email: string } | null;
  status: { type: AssetListItem["status"]["type"] };
};

// Whether Intune's primary user is worth suggesting as the holder: someone
// else holds the device, or nobody does while it could be checked out (one
// at the service keeps its Intune user, and that is fine). Only for types
// held by people. The sync never changes the holder itself.
export function isIntuneHolderMismatch(asset: IntuneHolderFields): boolean {
  if (!asset.intunePrimaryUser) return false;
  if (getAssetTypeConfig(asset.type).assignTo !== "user") return false;
  if (asset.assignedTo) {
    return asset.assignedTo.email !== asset.intunePrimaryUser;
  }
  return asset.status.type === "DEPLOYABLE";
}
