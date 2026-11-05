import {
  Cctv,
  Laptop,
  Monitor,
  Printer,
  Server,
  Smartphone,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { IconTile, type IconTileSize } from "@/components/shared/icon-tile";
import type { AssetType } from "@/lib/generated/prisma/enums";

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

type AssetTypeIconProps = {
  type: AssetType;
  size?: IconTileSize;
};

export function AssetTypeIcon({ type, size }: AssetTypeIconProps) {
  return <IconTile icon={assetTypeIcons[type]} size={size} />;
}
