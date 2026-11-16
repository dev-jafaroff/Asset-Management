import {
  ArrowDownToLine,
  Cable,
  Cctv,
  Dock,
  Headset,
  Keyboard,
  Laptop,
  Monitor,
  Mouse,
  Package,
  PlugZap,
  Printer,
  Server,
  Shapes,
  Smartphone,
  Webcam,
  Wifi,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";
import { IconTile, type IconTileSize } from "@/components/shared/icon-tile";
import type { IntuneSyncState } from "@/lib/assets/asset-detail";
import type { AssetSource, AssetType } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

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
  OTHER: Shapes,
};

// Accessory categories pick their icon by key (Category.icon), since
// categories live in the database and can be renamed.
const accessoryIcons: Partial<Record<string, LucideIcon>> = {
  keyboard: Keyboard,
  mouse: Mouse,
  headset: Headset,
  dock: Dock,
  cable: Cable,
  webcam: Webcam,
  charger: PlugZap,
};

// A category without a known key gets a plain box.
function getAccessoryIcon(key: string | null): LucideIcon {
  return (key === null ? undefined : accessoryIcons[key]) ?? Package;
}

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

// Blue (Intune's own color) is the normal state; the others need a look.
const syncStateTones: Record<IntuneSyncState, string> = {
  synced: "text-primary",
  stale: "text-amber-600 dark:text-amber-400",
  missing: "text-destructive",
  never: "text-muted-foreground",
};

type SourceIconProps = {
  source: AssetSource;
  // Colors the icon by how fresh the synced data is.
  syncState?: IntuneSyncState;
  className?: string;
};

// Icon of the system a record came from; nothing for manual records.
export function SourceIcon({ source, syncState, className }: SourceIconProps) {
  const Icon = assetSourceIcons[source];
  if (!Icon) return null;
  return (
    <Icon
      aria-hidden
      className={cn(className, syncState && syncStateTones[syncState])}
    />
  );
}

type AssetTypeIconProps = {
  type: AssetType;
  size?: IconTileSize;
};

export function AssetTypeIcon({ type, size }: AssetTypeIconProps) {
  return <IconTile icon={assetTypeIcons[type]} size={size} />;
}

type AccessoryIconProps = {
  // The category's icon key, e.g. "keyboard".
  iconKey: string | null;
  size?: IconTileSize;
};

export function AccessoryIcon({ iconKey, size }: AccessoryIconProps) {
  return <IconTile icon={getAccessoryIcon(iconKey)} size={size} />;
}
