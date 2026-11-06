import {
  ArrowDownToLine,
  Cctv,
  Laptop,
  Monitor,
  Printer,
  Server,
  Smartphone,
  Wifi,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";
import { IconTile, type IconTileSize } from "@/components/shared/icon-tile";
import type { AssetSource, AssetType } from "@/lib/generated/prisma/enums";

// Icon registry: the one place that decides which icon an asset type uses
// (tables, sidebar, dashboard, scan results).
// lucide-react only bundles the icons imported here. An icon lucide lacks
// can be added with createLucideIcon from lucide-react, so it works the same way.
export const assetTypeIcons: Record<AssetType, LucideIcon> = {
  PC: Laptop,
  MONITOR: Monitor,
  PRINTER: Printer,
  PHONE: Smartphone,
  VM: Server,
  ACCESS_POINT: Wifi,
  CAMERA: Cctv,
};

// Rounder cloud than lucide's, as in the design mockups.
const SourceCloud = createLucideIcon("SourceCloud", [
  [
    "path",
    {
      d: "M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z",
      key: "cloud",
    },
  ],
]);

// Systems a record can come from (badges, card titles). Manual entry has none.
export const assetSourceIcons: Record<AssetSource, LucideIcon | null> = {
  MANUAL: null,
  INTUNE: SourceCloud,
  SNIPEIT: ArrowDownToLine,
};

type AssetTypeIconProps = {
  type: AssetType;
  size?: IconTileSize;
};

export function AssetTypeIcon({ type, size }: AssetTypeIconProps) {
  return <IconTile icon={assetTypeIcons[type]} size={size} />;
}
