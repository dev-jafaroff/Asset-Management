import type { AssetType } from "@/lib/generated/prisma/enums";

// What an asset of this type is handed out to. Drives the derived "Assigned"
// status, the status tabs and the holder column, so no code checks types by name.
export type AssignTarget = "user" | "company" | "location";

export type AssetTypeConfig = {
  type: AssetType;
  slug: string;
  label: string;
  singularLabel: string;
  tagPrefix: string | null;
  assignTo: AssignTarget;
};

export const assetTypeConfigs: readonly AssetTypeConfig[] = [
  {
    type: "PC",
    slug: "pcs",
    label: "PCs",
    singularLabel: "PC",
    tagPrefix: "PC-",
    assignTo: "user",
  },
  {
    type: "MONITOR",
    slug: "monitors",
    label: "Monitors",
    singularLabel: "Monitor",
    tagPrefix: "MN-",
    assignTo: "user",
  },
  {
    type: "PRINTER",
    slug: "printers",
    label: "Printers",
    singularLabel: "Printer",
    tagPrefix: "PRN-",
    assignTo: "user",
  },
  {
    type: "PHONE",
    slug: "phones",
    label: "Phones",
    singularLabel: "Phone",
    tagPrefix: null,
    assignTo: "user",
  },
  {
    type: "VM",
    slug: "vms",
    label: "Virtual machines",
    singularLabel: "Virtual machine",
    tagPrefix: null,
    // Many users share one VM.
    assignTo: "company",
  },
  {
    type: "ACCESS_POINT",
    slug: "access-points",
    label: "Access points",
    singularLabel: "Access point",
    tagPrefix: "AP-",
    // Installed at a location; network details live in UniFi.
    assignTo: "location",
  },
  {
    type: "CAMERA",
    slug: "cameras",
    label: "Cameras",
    singularLabel: "Camera",
    tagPrefix: "CAM-",
    assignTo: "location",
  },
  {
    type: "OTHER",
    slug: "other",
    label: "Other",
    singularLabel: "Other device",
    tagPrefix: "OT-",
    // Devices with only one or two of a kind, e.g. the server room card reader.
    // The model's category says what each one is; a kind that grows gets its own type.
    assignTo: "location",
  },
];

export const ASSETS_PATH = "/assets";

// List page of one asset type, e.g. "/assets/pcs".
export function getAssetTypePath(slug: string): string {
  return `${ASSETS_PATH}/${slug}`;
}

// Form for a new asset of one type, e.g. "/assets/pcs/new".
export function getNewAssetPath(slug: string): string {
  return `${getAssetTypePath(slug)}/new`;
}

// Detail page of one asset, e.g. "/assets/pcs/7".
export function getAssetPath(type: AssetType, id: number): string {
  return `${getAssetTypePath(getAssetTypeConfig(type).slug)}/${id}`;
}

const TAG_SEQUENCE_DIGITS = 5;

// formatAssetTag("PC-", 7) → "PC-00007"
export function formatAssetTag(tagPrefix: string, sequence: number): string {
  return `${tagPrefix}${String(sequence).padStart(TAG_SEQUENCE_DIGITS, "0")}`;
}

export function getAssetTypeBySlug(slug: string): AssetTypeConfig | undefined {
  return assetTypeConfigs.find((config) => config.slug === slug);
}

export function getAssetTypeConfig(type: AssetType): AssetTypeConfig {
  const config = assetTypeConfigs.find((entry) => entry.type === type);
  if (!config) throw new Error(`Unknown asset type: ${type}`);
  return config;
}

// The singular label inside a sentence: "New virtual machine", but "New PC".
export function getAssetNoun(config: AssetTypeConfig): string {
  const { singularLabel } = config;
  return singularLabel === singularLabel.toUpperCase()
    ? singularLabel
    : singularLabel.charAt(0).toLowerCase() + singularLabel.slice(1);
}
