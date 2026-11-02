import type { AssetType } from "@/lib/generated/prisma/enums";

export type AssetTypeConfig = {
  type: AssetType;
  slug: string;
  label: string;
  singularLabel: string;
  tagPrefix: string | null;
};

export const assetTypeConfigs: readonly AssetTypeConfig[] = [
  {
    type: "PC",
    slug: "pcs",
    label: "PCs",
    singularLabel: "PC",
    tagPrefix: "PC-",
  },
  {
    type: "MONITOR",
    slug: "monitors",
    label: "Monitors",
    singularLabel: "Monitor",
    tagPrefix: "MON-",
  },
  {
    type: "PRINTER",
    slug: "printers",
    label: "Printers",
    singularLabel: "Printer",
    tagPrefix: "PRN-",
  },
  {
    type: "PHONE",
    slug: "phones",
    label: "Phones",
    singularLabel: "Phone",
    tagPrefix: null,
  },
  {
    type: "VM",
    slug: "vms",
    label: "Virtual machines",
    singularLabel: "Virtual machine",
    tagPrefix: null,
  },
];

const TAG_SEQUENCE_DIGITS = 4;

// formatAssetTag("PC-", 7) → "PC-0007"
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
