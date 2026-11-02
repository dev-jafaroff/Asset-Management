import type { AssetListItem } from "@/lib/assets/queries";

type AssetIdentity = Pick<AssetListItem, "id" | "assetTag" | "name">;
type AssetModelName = NonNullable<AssetListItem["model"]>;
type AssetAssignment = Pick<AssetListItem, "type" | "assignedTo" | "company">;
type AssetWithStatus = AssetAssignment & Pick<AssetListItem, "status">;

export type DisplayStatus = { label: string; color: string };

// "Assigned" is derived from the assignment, not stored as a status label.
const ASSIGNED_STATUS: DisplayStatus = {
  label: "Assigned",
  color: "var(--primary)",
};

// Labeled assets are known by their tag; phones and VMs by their name.
export function getAssetDisplayName(asset: AssetIdentity): string {
  return asset.assetTag ?? asset.name ?? `#${asset.id}`;
}

export function formatModelName(model: AssetModelName | null): string | null {
  if (!model) return null;
  return [model.manufacturer, model.name].filter(Boolean).join(" ");
}

// VMs are assigned to a company, every other type to a user.
export function getAssetHolder(asset: AssetAssignment): string | null {
  if (asset.type === "VM") return asset.company?.name ?? null;
  return asset.assignedTo?.displayName ?? null;
}

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
