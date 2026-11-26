import {
  ArrowDownToLine,
  Battery,
  BatteryCharging,
  Cable,
  Calculator,
  Cctv,
  Cpu,
  CreditCard,
  Dock,
  DoorClosed,
  EthernetPort,
  Fingerprint,
  Gamepad2,
  HardDrive,
  Headphones,
  Headset,
  IdCard,
  KeyRound,
  Keyboard,
  Laptop,
  Lightbulb,
  Lock,
  MemoryStick,
  Mic,
  Monitor,
  Mouse,
  Network,
  Package,
  PcCase,
  Phone,
  Plug,
  PlugZap,
  Presentation,
  Printer,
  Projector,
  QrCode,
  RadioTower,
  Router,
  ScanBarcode,
  ScanLine,
  Server,
  Shapes,
  Shredder,
  Smartphone,
  Speaker,
  Tablet,
  Thermometer,
  Toolbox,
  Tv,
  Usb,
  Video,
  Watch,
  Webcam,
  Wifi,
  Wrench,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";
import { IconTile, type IconTileSize } from "@/components/shared/icon-tile";
import type { IntuneSyncState } from "@/lib/assets/asset-detail";
import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import type { AssetSource, AssetType } from "@/lib/generated/prisma/enums";
import {
  getCategoryIconLabel,
  type CategoryIconKey,
} from "@/lib/schemas/lookup";
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

// Categories pick their icon by key (Category.icon), since categories live
// in the database and can be renamed. The keys an admin can pick are listed
// in lib/schemas/lookup.ts.
const categoryIcons: Record<CategoryIconKey, LucideIcon> = {
  laptop: Laptop,
  desktop: PcCase,
  monitor: Monitor,
  tablet: Tablet,
  phone: Smartphone,
  server: Server,
  "hard-drive": HardDrive,
  chip: Cpu,
  keyboard: Keyboard,
  mouse: Mouse,
  headset: Headset,
  headphones: Headphones,
  webcam: Webcam,
  dock: Dock,
  printer: Printer,
  scanner: ScanLine,
  "barcode-scanner": ScanBarcode,
  shredder: Shredder,
  calculator: Calculator,
  "access-point": Wifi,
  router: Router,
  switch: Network,
  ethernet: EthernetPort,
  antenna: RadioTower,
  camera: Cctv,
  "video-camera": Video,
  projector: Projector,
  tv: Tv,
  speaker: Speaker,
  microphone: Mic,
  conference: Presentation,
  "card-reader": IdCard,
  "payment-card": CreditCard,
  fingerprint: Fingerprint,
  lock: Lock,
  key: KeyRound,
  door: DoorClosed,
  "qr-code": QrCode,
  charger: PlugZap,
  cable: Cable,
  plug: Plug,
  battery: Battery,
  ups: BatteryCharging,
  usb: Usb,
  "memory-stick": MemoryStick,
  "desk-phone": Phone,
  watch: Watch,
  gamepad: Gamepad2,
  thermometer: Thermometer,
  lightbulb: Lightbulb,
  tools: Wrench,
  toolbox: Toolbox,
  package: Package,
  other: Shapes,
};

function isCategoryIconKey(key: string): key is CategoryIconKey {
  return Object.hasOwn(categoryIcons, key);
}

// A category without a known key gets a plain box.
function getCategoryIcon(key: string | null): LucideIcon {
  return key !== null && isCategoryIconKey(key) ? categoryIcons[key] : Package;
}

// Rounder cloud than lucide's, as in the design mockups. Drawn clockwise
// from the bottom left, which SyncingCloud's animation follows.
const CLOUD_PATH = "M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z";

const SourceCloud = createLucideIcon("SourceCloud", [
  ["path", { d: CLOUD_PATH, key: "cloud" }],
]);

// Microsoft's four colors, travelling around the cloud while a sync runs.
const syncColors = ["#f25022", "#7fba00", "#00a4ef", "#ffb900"];
const SEGMENT = 100 / syncColors.length;
// One trip around the cloud.
const CHASE_SECONDS = 1.6;

// The Intune cloud while it syncs: it stays still and its outline cycles
// through the colors, clockwise. Every segment runs the same animation, a
// quarter of a trip behind the one before. Without motion (reduced motion
// settings) the four colors stand.
export function SyncingCloud({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="butt"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      {syncColors.map((color, index) => (
        <path
          key={color}
          d={CLOUD_PATH}
          pathLength={100}
          stroke={color}
          strokeDasharray={`${SEGMENT} ${100 - SEGMENT}`}
          strokeDashoffset={-index * SEGMENT}
          style={{
            animation: `outline-chase ${CHASE_SECONDS}s linear ${(-index * CHASE_SECONDS) / syncColors.length}s infinite`,
          }}
          className="motion-reduce:animate-none!"
        />
      ))}
    </svg>
  );
}

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
  return (
    <IconTile
      icon={assetTypeIcons[type]}
      size={size}
      label={getAssetTypeConfig(type).singularLabel}
    />
  );
}

type CategoryIconProps = {
  // The category's icon key, e.g. "keyboard".
  iconKey: string | null;
  size?: IconTileSize;
};

export function CategoryIcon({ iconKey, size }: CategoryIconProps) {
  return (
    <IconTile
      icon={getCategoryIcon(iconKey)}
      size={size}
      label={getCategoryIconLabel(iconKey)}
    />
  );
}
