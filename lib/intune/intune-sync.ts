import { assetFormFieldLabels } from "@/lib/assets/asset-form";
import type { FieldChange } from "@/lib/assets/asset-detail";
import { normalizeSerial } from "@/lib/assets/format";
import { normalizeEmail } from "@/lib/auth/entra";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  getIntuneTenantIds,
  listIntuneDevices,
  type IntuneDevice,
} from "@/lib/intune/devices";
import { prisma } from "@/lib/prisma";
import { runSync, type SyncTally } from "@/lib/sync/sync-run";
import { formatCount } from "@/lib/utils";

// Our assets, kept up to date from Intune (docs/PLAN.md, Intune sync):
// - An Intune device is linked to the asset with the same serial. Devices
//   that send no serial (Linux) are linked by name, which is the asset tag
//   (e.g. "PC-00049"). Intune then owns the asset's name, OS, OS version and
//   check-in time.
// - A dual-boot device is in Intune twice, as Windows and as Linux. The
//   record with the serial is the asset's; the other gives its second OS
//   and counts as a check-in, so the device is not stale while it runs
//   Linux.
// - Nothing is created: every company device has a label, so a device we do
//   not have is reported, to be fixed (usually a mistyped serial) or added
//   by hand. Personal devices are left alone.
// - The holder is never changed; Intune's primary user is kept as a
//   suggestion.
// - An asset whose device left Intune is flagged missingInIntune, never
//   deleted. Only after every tenant was read, so a tenant that failed does
//   not make its devices look gone.

function getLaterDate(a: Date | null, b: Date | null): Date | null {
  if (!a || !b) return a ?? b;
  return a > b ? a : b;
}

// A re-enrolled device leaves its old record behind until Intune cleans it
// up: per key (serial or name), the record that checked in last is the
// device. Devices without a key are left out.
function getLatestBy(
  devices: IntuneDevice[],
  getKey: (device: IntuneDevice) => string | null,
): Map<string, IntuneDevice> {
  const latest = new Map<string, IntuneDevice>();
  for (const device of devices) {
    const key = getKey(device);
    if (!key) continue;
    const known = latest.get(key);
    const checkedIn = device.lastSyncDateTime?.getTime() ?? 0;
    if (!known || checkedIn > (known.lastSyncDateTime?.getTime() ?? 0)) {
      latest.set(key, device);
    }
  }
  return latest;
}

// Intune gets no serial from Linux devices ("Linux (ubuntu)"); they are
// matched by name instead. A Windows or macOS device always has one.
const osWithoutSerial = ["Linux"];

function reportsSerial(device: IntuneDevice): boolean {
  const os = device.operatingSystem ?? "";
  return !osWithoutSerial.some((name) => os.startsWith(name));
}

const assetSelect = {
  id: true,
  assetTag: true,
  serial: true,
  name: true,
  operatingSystem: true,
  osVersion: true,
  secondaryOperatingSystem: true,
  secondaryOsVersion: true,
  intuneId: true,
  intunePrimaryUser: true,
  lastIntuneSync: true,
  missingInIntune: true,
} satisfies Prisma.AssetSelect;

type SyncedAsset = Prisma.AssetGetPayload<{ select: typeof assetSelect }>;

// An asset and the Intune record that is its device; a dual-boot device's
// other record is `secondary`. lastCheckIn is the latest of both.
type Match = {
  asset: SyncedAsset;
  device: IntuneDevice;
  secondary: IntuneDevice | null;
  lastCheckIn: Date | null;
};

// What Intune owns of an asset.
type IntuneFields = Pick<
  SyncedAsset,
  | "name"
  | "operatingSystem"
  | "osVersion"
  | "secondaryOperatingSystem"
  | "secondaryOsVersion"
  | "intuneId"
  | "intunePrimaryUser"
  | "lastIntuneSync"
  | "missingInIntune"
>;

function toIntuneFields({
  device,
  secondary,
  lastCheckIn,
}: Match): IntuneFields {
  return {
    name: device.deviceName,
    operatingSystem: device.operatingSystem,
    osVersion: device.osVersion,
    secondaryOperatingSystem: secondary?.operatingSystem ?? null,
    secondaryOsVersion: secondary?.osVersion ?? null,
    intuneId: device.id,
    intunePrimaryUser: device.userPrincipalName
      ? normalizeEmail(device.userPrincipalName)
      : null,
    lastIntuneSync: lastCheckIn,
    missingInIntune: false,
  };
}

// Changes written to the asset's history. The check-in time changes every
// hour and the primary user is only a suggestion, so neither is logged.
const loggedFields = [
  ["name", assetFormFieldLabels.name],
  ["operatingSystem", assetFormFieldLabels.operatingSystem],
  ["osVersion", "OS version"],
  ["secondaryOperatingSystem", "Second OS"],
  ["secondaryOsVersion", "Second OS version"],
] as const;

function getLoggedChanges(
  asset: SyncedAsset,
  fields: IntuneFields,
): FieldChange[] {
  return loggedFields
    .filter(([field]) => asset[field] !== fields[field])
    .map(([field, label]) => ({
      field: label,
      from: asset[field],
      to: fields[field],
    }));
}

// Why the asset is (again) linked to Intune, if it is news.
function getLinkNote(asset: SyncedAsset, device: IntuneDevice): string | null {
  if (asset.intuneId === null) return "Found in Intune.";
  if (asset.missingInIntune) return "Back in Intune.";
  if (asset.intuneId !== device.id) return "Enrolled in Intune again.";
  return null;
}

function isSameTime(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

// e.g. "PC-00049 (Windows, serial 5CD311KCYM, HP Pavilion)"
function describeDevice(device: IntuneDevice): string {
  const details = [
    device.operatingSystem,
    device.serialNumber && `serial ${device.serialNumber}`,
    [device.manufacturer, device.model].filter(Boolean).join(" "),
  ].filter(Boolean);
  return `${device.deviceName ?? "A device"} (${details.join(", ")})`;
}

async function updateAsset(match: Match, tally: SyncTally): Promise<void> {
  const { asset, device } = match;
  const fields = toIntuneFields(match);
  const changes = getLoggedChanges(asset, fields);
  const note = getLinkNote(asset, device);
  const isNews =
    changes.length > 0 ||
    note !== null ||
    asset.intunePrimaryUser !== fields.intunePrimaryUser;
  if (!isNews && isSameTime(asset.lastIntuneSync, fields.lastIntuneSync)) {
    return;
  }

  try {
    await prisma.$transaction([
      prisma.asset.update({ where: { id: asset.id }, data: fields }),
      ...(changes.length > 0 || note
        ? [
            prisma.assetEvent.create({
              data: {
                assetId: asset.id,
                type: "SYNC",
                changes: changes.length > 0 ? changes : undefined,
                note,
              },
            }),
          ]
        : []),
    ]);
    if (isNews) tally.updated++;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      tally.errors.push(
        `${asset.assetTag ?? asset.serial}: the Intune device ${describeDevice(device)} is already linked to another asset.`,
      );
      return;
    }
    throw error;
  }
}

// Devices named after a tag (as they are, e.g. "PC-00137") whose serial is
// not that asset's: usually a serial typed wrong here or in Snipe-IT.
function findTagMismatch(
  device: IntuneDevice,
  byTag: Map<string, SyncedAsset>,
): string | null {
  const asset = device.deviceName
    ? byTag.get(device.deviceName.toUpperCase())
    : undefined;
  if (!asset || !device.serialNumber) return null;
  const serial = normalizeSerial(device.serialNumber);
  if (asset.serial && normalizeSerial(asset.serial) === serial) return null;
  return `${asset.assetTag}: the Intune device of that name has serial ${device.serialNumber}, this asset has ${asset.serial ?? "none"}.`;
}

// Assets whose device is no longer in Intune (wiped, retired, removed).
async function flagMissing(linked: Set<number>, tally: SyncTally) {
  const gone = await prisma.asset.findMany({
    where: {
      intuneId: { not: null },
      missingInIntune: false,
      id: { notIn: [...linked] },
    },
    select: { id: true },
  });
  if (gone.length === 0) return;

  const ids = gone.map((asset) => asset.id);
  await prisma.$transaction([
    prisma.asset.updateMany({
      where: { id: { in: ids } },
      data: { missingInIntune: true },
    }),
    prisma.assetEvent.createMany({
      data: ids.map((assetId) => ({
        assetId,
        type: "SYNC" as const,
        note: "No longer in Intune.",
      })),
    }),
  ]);
  tally.missing += ids.length;
}

async function syncDevicesFromIntune(tally: SyncTally): Promise<void> {
  const { tenantIds, errors } = getIntuneTenantIds();
  tally.errors.push(...errors);

  // One tenant failing (e.g. no admin consent) does not stop the others.
  const devices: IntuneDevice[] = [];
  let isEveryTenantRead = errors.length === 0 && tenantIds.length > 0;
  for (const tenantId of tenantIds) {
    try {
      const result = await listIntuneDevices(tenantId);
      devices.push(...result.devices);
      if (result.invalid > 0) {
        isEveryTenantRead = false;
        tally.errors.push(
          `Skipped ${formatCount(result.invalid, "device")} of tenant ${tenantId} that Graph sent in an unexpected shape.`,
        );
      }
    } catch (error) {
      isEveryTenantRead = false;
      tally.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const matches = await matchDevices(devices, tally);
  for (const match of matches.values()) await updateAsset(match, tally);

  if (isEveryTenantRead) await flagMissing(new Set(matches.keys()), tally);
  else {
    tally.errors.push(
      "Not every tenant could be read, so no asset was flagged as missing in Intune.",
    );
  }
}

// Every asset that has a device in Intune, by asset id. What cannot be
// matched is reported, except personal devices.
async function matchDevices(
  devices: IntuneDevice[],
  tally: SyncTally,
): Promise<Map<number, Match>> {
  const assets = await prisma.asset.findMany({
    where: { OR: [{ serial: { not: null } }, { intuneId: { not: null } }] },
    select: assetSelect,
  });
  const bySerial = new Map(
    assets.flatMap((asset) =>
      asset.serial ? [[normalizeSerial(asset.serial), asset] as const] : [],
    ),
  );
  const byTag = new Map(
    assets.flatMap((asset) =>
      asset.assetTag ? [[asset.assetTag.toUpperCase(), asset] as const] : [],
    ),
  );

  const matches = new Map<number, Match>();
  const report = (device: IntuneDevice, problem: string) => {
    if (device.managedDeviceOwnerType !== "personal") {
      tally.errors.push(`${describeDevice(device)} ${problem}`);
    }
  };

  // By serial: Windows and macOS.
  const withSerial = devices.filter((device) => reportsSerial(device));
  const bySerialKey = getLatestBy(withSerial, (device) =>
    device.serialNumber ? normalizeSerial(device.serialNumber) : null,
  );
  for (const [serial, device] of bySerialKey) {
    const tagMismatch = findTagMismatch(device, byTag);
    if (tagMismatch) tally.errors.push(tagMismatch);
    const asset = bySerial.get(serial);
    if (asset) {
      matches.set(asset.id, {
        asset,
        device,
        secondary: null,
        lastCheckIn: device.lastSyncDateTime ?? null,
      });
    } else if (!tagMismatch) {
      report(device, "is in Intune but not here: fix its serial or add it.");
    }
  }
  for (const device of withSerial.filter((device) => !device.serialNumber)) {
    report(device, "has no serial in Intune, so it cannot be matched.");
  }

  // By name: Linux, alone or as the second system of a dual-boot device.
  const byName = getLatestBy(
    devices.filter((device) => !reportsSerial(device)),
    (device) => device.deviceName?.toUpperCase() ?? null,
  );
  for (const [name, device] of byName) {
    const asset = byTag.get(name);
    if (!asset) {
      report(
        device,
        "sends no serial and its name is no asset tag here: name the device after its tag.",
      );
      continue;
    }
    const lastCheckIn = device.lastSyncDateTime ?? null;
    const known = matches.get(asset.id);
    if (known) {
      known.secondary = device;
      known.lastCheckIn = getLaterDate(known.lastCheckIn, lastCheckIn);
    } else {
      matches.set(asset.id, { asset, device, secondary: null, lastCheckIn });
    }
  }
  return matches;
}

// Started by the schedule (/api/cron/intune-sync) or by the Azure sync page.
export function syncIntune() {
  return runSync("INTUNE", syncDevicesFromIntune);
}
