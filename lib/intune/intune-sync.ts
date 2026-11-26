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
// - An Intune device is linked to the asset with the same serial. Intune
//   then owns its name, OS, OS version and check-in time.
// - Nothing is created: every company device has a label, so a device we do
//   not have is reported, to be fixed (usually a mistyped serial) or added
//   by hand. Personal devices are left alone.
// - The holder is never changed; Intune's primary user is kept as a
//   suggestion.
// - An asset whose device left Intune is flagged missingInIntune, never
//   deleted. Only after every tenant was read, so a tenant that failed does
//   not make its devices look gone.

// A re-enrolled device leaves its old record behind until Intune cleans it
// up; the record that checked in last is the device.
function getDevicesBySerial(
  devices: IntuneDevice[],
): Map<string, IntuneDevice> {
  const bySerial = new Map<string, IntuneDevice>();
  for (const device of devices) {
    if (!device.serialNumber) continue;
    const serial = normalizeSerial(device.serialNumber);
    const known = bySerial.get(serial);
    const checkedIn = device.lastSyncDateTime?.getTime() ?? 0;
    if (!known || checkedIn > (known.lastSyncDateTime?.getTime() ?? 0)) {
      bySerial.set(serial, device);
    }
  }
  return bySerial;
}

// Intune gets no serial from Linux devices ("Linux (ubuntu)"), so they can
// never be matched; that is no problem worth reporting on every run. A
// Windows or macOS device without one is.
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
  intuneId: true,
  intunePrimaryUser: true,
  lastIntuneSync: true,
  missingInIntune: true,
} satisfies Prisma.AssetSelect;

type SyncedAsset = Prisma.AssetGetPayload<{ select: typeof assetSelect }>;

// What Intune owns of an asset.
type IntuneFields = Pick<
  SyncedAsset,
  | "name"
  | "operatingSystem"
  | "osVersion"
  | "intuneId"
  | "intunePrimaryUser"
  | "lastIntuneSync"
  | "missingInIntune"
>;

function toIntuneFields(device: IntuneDevice): IntuneFields {
  return {
    name: device.deviceName,
    operatingSystem: device.operatingSystem,
    osVersion: device.osVersion,
    intuneId: device.id,
    intunePrimaryUser: device.userPrincipalName
      ? normalizeEmail(device.userPrincipalName)
      : null,
    lastIntuneSync: device.lastSyncDateTime ?? null,
    missingInIntune: false,
  };
}

// Changes written to the asset's history. The check-in time changes every
// hour and the primary user is only a suggestion, so neither is logged.
const loggedFields = [
  ["name", assetFormFieldLabels.name],
  ["operatingSystem", assetFormFieldLabels.operatingSystem],
  ["osVersion", "OS version"],
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

function describeDevice(device: IntuneDevice): string {
  const model = [device.manufacturer, device.model].filter(Boolean).join(" ");
  return `${device.deviceName ?? "A device"} (serial ${device.serialNumber}${model ? `, ${model}` : ""})`;
}

async function updateAsset(
  asset: SyncedAsset,
  device: IntuneDevice,
  tally: SyncTally,
): Promise<void> {
  const fields = toIntuneFields(device);
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

  const withoutSerial = devices.filter(
    (device) => !device.serialNumber && reportsSerial(device),
  );
  if (withoutSerial.length > 0) {
    tally.errors.push(
      `${formatCount(withoutSerial.length, "device")} in Intune without a serial cannot be matched and were skipped.`,
    );
  }

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

  const linked = new Set<number>();
  for (const [serial, device] of getDevicesBySerial(devices)) {
    const asset = bySerial.get(serial);
    const tagMismatch = findTagMismatch(device, byTag);
    if (tagMismatch) tally.errors.push(tagMismatch);
    if (!asset) {
      if (!tagMismatch && device.managedDeviceOwnerType !== "personal") {
        tally.errors.push(
          `${describeDevice(device)} is in Intune but not here: fix its serial or add it.`,
        );
      }
      continue;
    }
    linked.add(asset.id);
    await updateAsset(asset, device, tally);
  }

  if (isEveryTenantRead) await flagMissing(linked, tally);
  else {
    tally.errors.push(
      "Not every tenant could be read, so no asset was flagged as missing in Intune.",
    );
  }
}

// Started by the schedule (/api/cron/intune-sync) or by the Azure sync page.
export function syncIntune() {
  return runSync("INTUNE", syncDevicesFromIntune);
}
