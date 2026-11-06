import {
  getAssetTypeConfig,
  type AssignTarget,
} from "@/lib/assets/asset-types";
import type { AssetListItem } from "@/lib/assets/queries";

type AssetIdentity = Pick<AssetListItem, "id" | "assetTag" | "name" | "model">;
type AssetModelName = NonNullable<AssetListItem["model"]>;
type AssetAssignment = Pick<
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
