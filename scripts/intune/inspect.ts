// What is in Intune, before the sync is written: devices per tenant and
// operating system, serial quality, and how they match the assets we have
// (by serial, as the sync will). Read-only; prints counts, models, serials
// and asset tags, never people's names, emails or device names.
//
// npm run intune:inspect
import "dotenv/config";
import { normalizeSerial } from "@/lib/assets/format";
import { normalizeEmail } from "@/lib/auth/entra";
import {
  getIntuneTenantIds,
  listIntuneDevices,
  type IntuneDevice,
} from "@/lib/intune/devices";
import { prisma } from "@/lib/prisma";
import { daysBetween } from "@/lib/utils";
import { countBy, heading, printCounts } from "../report";

// Short enough to tell the tenants apart without printing their ids.
function tenantLabel(tenantId: string): string {
  return `tenant …${tenantId.slice(-4)}`;
}

function labelOf(value: string | null): string {
  return value ?? "(empty)";
}

async function readDevices(): Promise<IntuneDevice[]> {
  const { tenantIds, errors } = getIntuneTenantIds();
  for (const error of errors) console.log(`  ! ${error}`);

  const devices: IntuneDevice[] = [];
  for (const tenantId of tenantIds) {
    heading(tenantLabel(tenantId));
    try {
      const result = await listIntuneDevices(tenantId);
      devices.push(...result.devices);
      printCounts([
        ["Devices", result.devices.length],
        ["Did not parse", result.invalid],
      ]);
    } catch (error) {
      console.log(`  ! ${error instanceof Error ? error.message : error}`);
    }
  }
  return devices;
}

function inspectDevices(devices: IntuneDevice[]) {
  heading("Operating system · owner");
  printCounts(
    countBy(
      devices,
      (device) =>
        `${labelOf(device.operatingSystem)} · ${labelOf(device.managedDeviceOwnerType)}`,
    ),
  );

  heading("Models (top 20)");
  printCounts(
    countBy(
      devices,
      (device) => `${labelOf(device.manufacturer)} ${labelOf(device.model)}`,
    ).slice(0, 20),
  );

  const now = new Date();
  const daysSinceSync = (device: IntuneDevice) =>
    device.lastSyncDateTime ? daysBetween(device.lastSyncDateTime, now) : null;
  heading("Last check-in with Intune");
  printCounts([
    [
      "Within 7 days",
      devices.filter((d) => (daysSinceSync(d) ?? 999) <= 7).length,
    ],
    [
      "8–30 days ago",
      devices.filter((d) => {
        const days = daysSinceSync(d);
        return days !== null && days > 7 && days <= 30;
      }).length,
    ],
    [
      "31–90 days ago",
      devices.filter((d) => {
        const days = daysSinceSync(d);
        return days !== null && days > 30 && days <= 90;
      }).length,
    ],
    [
      "Over 90 days ago",
      devices.filter((d) => (daysSinceSync(d) ?? 0) > 90).length,
    ],
    ["Never", devices.filter((d) => daysSinceSync(d) === null).length],
  ]);

  heading("Serials");
  const serials = devices.flatMap((device) =>
    device.serialNumber ? [normalizeSerial(device.serialNumber)] : [],
  );
  const repeated = countBy(serials, (serial) => serial).filter(
    ([, count]) => count > 1,
  );
  printCounts([
    ["Without a serial", devices.length - serials.length],
    ["Serials on more than one device", repeated.length],
  ]);
  if (repeated.length > 0) {
    console.log("  Repeated (placeholders like 'Default string' show here):");
    printCounts(repeated.slice(0, 10), "    ");
  }
}

async function inspectMatching(devices: IntuneDevice[]) {
  const assets = await prisma.asset.findMany({
    where: { serial: { not: null } },
    select: {
      type: true,
      serial: true,
      assignedTo: { select: { email: true } },
    },
  });
  const assetBySerial = new Map(
    assets.flatMap((asset) =>
      asset.serial ? [[normalizeSerial(asset.serial), asset] as const] : [],
    ),
  );
  const matched = devices.flatMap((device) => {
    const asset = device.serialNumber
      ? assetBySerial.get(normalizeSerial(device.serialNumber))
      : undefined;
    return asset ? [{ device, asset }] : [];
  });

  heading("Intune devices found among our assets (by serial)");
  printCounts([
    ["Found", matched.length],
    ["Not found", devices.length - matched.length],
  ]);
  console.log("  Found, per our asset type:");
  printCounts(
    countBy(matched, ({ asset }) => asset.type),
    "    ",
  );

  heading("In Intune, not among our assets (OS · model)");
  const matchedIds = new Set(matched.map(({ device }) => device.id));
  printCounts(
    countBy(
      devices.filter((device) => !matchedIds.has(device.id)),
      (device) =>
        `${labelOf(device.operatingSystem)} · ${labelOf(device.manufacturer)} ${labelOf(device.model)}`,
    ),
  );

  heading("Our PCs not in Intune (status · tag)");
  const intuneSerials = new Set(
    devices.flatMap((device) =>
      device.serialNumber ? [normalizeSerial(device.serialNumber)] : [],
    ),
  );
  const pcs = await prisma.asset.findMany({
    where: { type: "PC" },
    select: {
      assetTag: true,
      serial: true,
      status: { select: { name: true } },
    },
    orderBy: { assetTag: "asc" },
  });
  const missing = pcs.filter(
    (pc) => !pc.serial || !intuneSerials.has(normalizeSerial(pc.serial)),
  );
  printCounts([
    ["PCs", pcs.length],
    ["… not in Intune", missing.length],
    ["… of which without a serial", missing.filter((pc) => !pc.serial).length],
  ]);
  printCounts(
    countBy(missing, (pc) => pc.status.name),
    "    ",
  );
  console.log(`  ${missing.map((pc) => pc.assetTag ?? "(no tag)").join(", ")}`);

  heading("Intune primary user vs. who holds it here (found devices)");
  printCounts(
    countBy(matched, ({ device, asset }) => {
      const intuneUser = device.userPrincipalName
        ? normalizeEmail(device.userPrincipalName)
        : null;
      const holder = asset.assignedTo?.email ?? null;
      if (!intuneUser && !holder) return "Neither has one";
      if (!intuneUser) return "Only we have a holder";
      if (!holder) return "Only Intune has a user";
      return intuneUser === holder ? "Same person" : "Different people";
    }),
  );
}

async function main() {
  const devices = await readDevices();
  heading("All tenants");
  console.log(`  ${devices.length} devices`);
  if (devices.length === 0) return;

  inspectDevices(devices);
  await inspectMatching(devices);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
