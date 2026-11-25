import type { AssetType } from "@/lib/generated/prisma/enums";

// How Snipe-IT's data maps onto ours: the decisions, in one place. Names are
// as Snipe-IT shows them (npm run snipeit:inspect lists them). A name not
// listed here stops the migration, so nothing is guessed.

// Snipe-IT category → our asset type.
const typeByCategory: Record<string, AssetType> = {
  "Personal Computers": "PC",
  WorkStations: "PC",
  Monitors: "MONITOR",
  Printers: "PRINTER",
  // Split by model below; switches, the gateway and the door reader stay Other.
  "Network Devices": "OTHER",
  Servers: "OTHER",
  Storages: "OTHER",
  TV: "OTHER",
  UPS: "OTHER",
  "Video Conferencing System": "OTHER",
};

// Snipe-IT model → our asset type, where the category is too broad.
const typeByModel: Record<string, AssetType> = {
  "AC LR": "ACCESS_POINT",
  "AC Lite": "ACCESS_POINT",
  "U6 Lite": "ACCESS_POINT",
  "G3 Flex": "CAMERA",
  "G5 Dome Ultra": "CAMERA",
};

// null when the category is not mapped.
export function getAssetType(
  category: string,
  model: string | null,
): AssetType | null {
  return (model && typeByModel[model]) || typeByCategory[category] || null;
}

// Snipe-IT status label → ours (prisma/seed.ts). Who holds an asset is
// kept apart from its status, as Snipe-IT's "Deployed" is.
const statusByName: Record<string, string> = {
  "Ready to Deploy": "In stock",
  Broken: "In repair",
  Pending: "Pending",
  Archived: "Archived",
};

export function getStatusName(snipeStatus: string): string | null {
  return statusByName[snipeStatus] ?? null;
}

// Snipe-IT manufacturers that mean "not known"; stored as none.
const unknownManufacturers = new Set(["Unknown"]);

export function getManufacturer(name: string | null): string | null {
  return name && !unknownManufacturers.has(name) ? name : null;
}
