import { assetFormFieldLabels } from "@/lib/assets/asset-form";
import {
  getIntuneSyncStatus,
  type FieldChange,
} from "@/lib/assets/asset-detail";
import { normalizeSerial } from "@/lib/assets/format";
import { normalizeEmail } from "@/lib/auth/entra";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  describeDevice,
  getIntuneTenantIds,
  listIntuneDevices,
  type IntuneDevice,
} from "@/lib/intune/devices";
import { addNewDevices, getPcTag } from "@/lib/intune/new-devices";
import { prisma } from "@/lib/prisma";
import { runSync, type SyncMessage, type SyncTally } from "@/lib/sync/sync-run";
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
// - A device we do not have is added when its name is a free PC tag (a new
//   laptop named "PC-00123" after its label), with everything Intune knows
//   (lib/intune/new-devices.ts). Any other is reported, to be fixed (usually
//   a mistyped serial or hostname) or added by hand: no tag is made up here.
//   Personal devices are left alone.
// - The holder of an asset we have is never changed; Intune's primary user
//   is kept as a suggestion.
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

function isCompanyDevice(device: IntuneDevice): boolean {
  return device.managedDeviceOwnerType !== "personal";
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
  intuneSyncProblem: true,
} satisfies Prisma.AssetSelect;

type SyncedAsset = Prisma.AssetGetPayload<{ select: typeof assetSelect }>;

function loadAssets(
  where: Prisma.AssetWhereInput = {},
): Promise<SyncedAsset[]> {
  return prisma.asset.findMany({ where, select: assetSelect });
}

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

// ─── Reading ─────────────────────────────────────────────────────────────────

type DeviceRead = { devices: IntuneDevice[]; isEveryTenantRead: boolean };

// Every device of every Intune tenant. One tenant failing (e.g. no admin
// consent) does not stop the others.
async function readDevices(tally: SyncTally): Promise<DeviceRead> {
  const { tenantIds, errors } = getIntuneTenantIds();
  tally.errors.push(...errors);

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
  return { devices, isEveryTenantRead };
}

// ─── Problems ────────────────────────────────────────────────────────────────

// Something wrong with one asset, e.g. its serial typed differently here and
// in Intune. Kept on the asset (intuneSyncProblem) until a sync finds it fine.
type AssetProblem = { asset: SyncedAsset; text: string };

// What a sync found wrong: about one asset, or about a device we do not have.
type SyncProblems = { assets: AssetProblem[]; devices: string[] };

// As listed in the sync's result, e.g. "PC-00137: The Intune device …".
function describeAssetProblem({ asset, text }: AssetProblem): string {
  return `${asset.assetTag ?? asset.serial ?? `#${asset.id}`}: ${text}`;
}

// Writes each asset's problem and clears it from the assets now fine: every
// asset after a full sync, or only `assetId`. When not every tenant was read,
// a problem may just not have been seen, so none is cleared.
async function saveAssetProblems(
  problems: AssetProblem[],
  { assetId, clear }: { assetId?: number; clear: boolean },
): Promise<void> {
  const byAsset = new Map<number, { asset: SyncedAsset; texts: string[] }>();
  for (const { asset, text } of problems) {
    const known = byAsset.get(asset.id);
    if (known) known.texts.push(text);
    else byAsset.set(asset.id, { asset, texts: [text] });
  }
  const withProblems = [...byAsset.keys()];
  // Only the problems that are new or changed are written.
  const changed = [...byAsset.values()].flatMap(({ asset, texts }) => {
    const text = texts.join(" ");
    return asset.intuneSyncProblem === text ? [] : [{ id: asset.id, text }];
  });

  await prisma.$transaction([
    ...(clear
      ? [
          prisma.asset.updateMany({
            where: {
              intuneSyncProblem: { not: null },
              id: { notIn: withProblems, ...(assetId && { equals: assetId }) },
            },
            data: { intuneSyncProblem: null },
          }),
        ]
      : []),
    ...changed.map(({ id, text }) =>
      prisma.asset.update({ where: { id }, data: { intuneSyncProblem: text } }),
    ),
  ]);
}

// ─── Matching ────────────────────────────────────────────────────────────────

// Devices named after a tag (as they are, e.g. "PC-00137") whose serial is
// not that asset's: usually a serial typed wrong here or in Snipe-IT.
function findTagMismatch(
  device: IntuneDevice,
  byTag: Map<string, SyncedAsset>,
): AssetProblem | null {
  const asset = device.deviceName
    ? byTag.get(device.deviceName.toUpperCase())
    : undefined;
  if (!asset || !device.serialNumber) return null;
  const serial = normalizeSerial(device.serialNumber);
  if (asset.serial && normalizeSerial(asset.serial) === serial) return null;
  return {
    asset,
    text: `The Intune device named ${device.deviceName} has serial ${device.serialNumber}; this asset has ${asset.serial ?? "none"}. Fix the serial, or rename the device.`,
  };
}

type MatchResult = {
  // By asset id.
  matches: Map<number, Match>;
  // Company devices no asset was found for.
  unmatched: IntuneDevice[];
  problems: SyncProblems;
};

// Links the devices to the given assets: by serial (Windows, macOS), then by
// name (Linux, alone or as the second system of a dual-boot device).
function matchDevices(
  devices: IntuneDevice[],
  assets: SyncedAsset[],
): MatchResult {
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
  const result: MatchResult = {
    matches: new Map(),
    unmatched: [],
    problems: { assets: [], devices: [] },
  };

  const withSerial = devices.filter((device) => reportsSerial(device));
  const bySerialKey = getLatestBy(withSerial, (device) =>
    device.serialNumber ? normalizeSerial(device.serialNumber) : null,
  );
  for (const [serial, device] of bySerialKey) {
    const tagMismatch = findTagMismatch(device, byTag);
    if (tagMismatch) result.problems.assets.push(tagMismatch);
    const asset = bySerial.get(serial);
    if (asset) {
      result.matches.set(asset.id, {
        asset,
        device,
        secondary: null,
        lastCheckIn: device.lastSyncDateTime ?? null,
      });
    } else if (!tagMismatch && isCompanyDevice(device)) {
      result.unmatched.push(device);
    }
  }
  for (const device of withSerial) {
    if (!device.serialNumber && isCompanyDevice(device)) {
      result.problems.devices.push(
        `${describeDevice(device)} has no serial in Intune, so it cannot be matched.`,
      );
    }
  }

  const byName = getLatestBy(
    devices.filter((device) => !reportsSerial(device)),
    (device) => device.deviceName?.toUpperCase() ?? null,
  );
  for (const [name, device] of byName) {
    const asset = byTag.get(name);
    if (!asset) {
      if (isCompanyDevice(device)) result.unmatched.push(device);
      continue;
    }
    const lastCheckIn = device.lastSyncDateTime ?? null;
    const known = result.matches.get(asset.id);
    if (known) {
      known.secondary = device;
      known.lastCheckIn = getLaterDate(known.lastCheckIn, lastCheckIn);
    } else {
      result.matches.set(asset.id, {
        asset,
        device,
        secondary: null,
        lastCheckIn,
      });
    }
  }
  return result;
}

function describeUnmatched(device: IntuneDevice): string {
  return reportsSerial(device)
    ? `${describeDevice(device)} is in Intune but not here: fix its serial, or name it after its tag.`
    : `${describeDevice(device)} sends no serial and its name is no asset tag here: name the device after its tag.`;
}

// ─── Writing ─────────────────────────────────────────────────────────────────

// Writes what Intune owns of the asset, and its history. Returns the problem
// when it cannot be linked.
async function updateAsset(
  match: Match,
  tally: SyncTally,
): Promise<AssetProblem | null> {
  const { asset, device } = match;
  const fields = toIntuneFields(match);
  const changes = getLoggedChanges(asset, fields);
  const note = getLinkNote(asset, device);
  const isNews =
    changes.length > 0 ||
    note !== null ||
    asset.intunePrimaryUser !== fields.intunePrimaryUser;
  if (!isNews && isSameTime(asset.lastIntuneSync, fields.lastIntuneSync)) {
    return null;
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
    return null;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        asset,
        text: `The Intune device ${describeDevice(device)} is already linked to another asset.`,
      };
    }
    throw error;
  }
}

// Updates the matched assets, and keeps the problems found with them on
// each asset and in the result.
async function writeMatches(
  result: MatchResult,
  tally: SyncTally,
  scope: { assetId?: number; clear: boolean },
): Promise<void> {
  const problems = [...result.problems.assets];
  for (const match of result.matches.values()) {
    const problem = await updateAsset(match, tally);
    if (problem) problems.push(problem);
  }
  await saveAssetProblems(problems, scope);
  tally.errors.push(...problems.map(describeAssetProblem));
}

// Assets linked to Intune whose device is no longer there (wiped, retired,
// removed): every one not in `linked`, or only `assetId` when given.
async function flagMissing(
  tally: SyncTally,
  { linked, assetId }: { linked?: Set<number>; assetId?: number },
) {
  const gone = await prisma.asset.findMany({
    where: {
      intuneId: { not: null },
      missingInIntune: false,
      id: assetId ?? { notIn: [...(linked ?? [])] },
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
      data: ids.map((id) => ({
        assetId: id,
        type: "SYNC" as const,
        note: "No longer in Intune.",
      })),
    }),
  ]);
  tally.missing += ids.length;
}

// ─── Syncs ───────────────────────────────────────────────────────────────────

async function syncDevicesFromIntune(tally: SyncTally): Promise<void> {
  const { devices, isEveryTenantRead } = await readDevices(tally);

  let result = matchDevices(devices, await loadAssets());
  const named = result.unmatched.filter((device) => getPcTag(device));
  if (named.length > 0) {
    await addNewDevices(named, tally);
    // The new assets are linked like any other.
    result = matchDevices(devices, await loadAssets());
  }
  await writeMatches(result, tally, { clear: isEveryTenantRead });
  tally.errors.push(
    ...result.problems.devices,
    ...result.unmatched.map(describeUnmatched),
  );

  if (isEveryTenantRead) {
    await flagMissing(tally, { linked: new Set(result.matches.keys()) });
  } else {
    tally.errors.push(
      "Not every tenant could be read, so no asset was flagged as missing in Intune.",
    );
  }
}

// Started by the schedule (/api/cron/intune-sync) or by the Azure sync page.
export function syncIntune() {
  return runSync("INTUNE", syncDevicesFromIntune);
}

// One asset, now: the Intune badge on its page. Reads every device (a few
// hundred, one page per tenant), so a re-enrolled or dual-boot device is
// matched as in the full sync. Not recorded as a sync run.
export async function syncIntuneAsset(assetId: number): Promise<SyncMessage> {
  const tally: SyncTally = { created: 0, updated: 0, missing: 0, errors: [] };
  const { devices, isEveryTenantRead } = await readDevices(tally);
  const [asset] = await loadAssets({ id: assetId });
  if (!asset) {
    return { ok: false, text: "This asset no longer exists.", errors: [] };
  }

  // Matched alone, so the problems found are about this asset only.
  const result = matchDevices(devices, [asset]);
  await writeMatches(result, tally, {
    assetId: asset.id,
    clear: isEveryTenantRead,
  });
  const match = result.matches.get(asset.id);
  if (!match && isEveryTenantRead) {
    await flagMissing(tally, { assetId: asset.id });
  }

  // The device's own check-in can be old (e.g. at the service): say so, as
  // syncing again will not change it.
  const checkIn = match
    ? getIntuneSyncStatus({
        lastIntuneSync: match.lastCheckIn,
        missingInIntune: false,
      })
    : null;
  const text = !match
    ? "Not found in Intune."
    : [
        tally.updated > 0 ? "Updated from Intune." : "No changes in Intune.",
        checkIn?.state === "synced" ? null : `${checkIn?.label}.`,
      ]
        .filter(Boolean)
        .join(" ");
  return {
    ok: Boolean(match) && tally.errors.length === 0,
    text,
    errors: tally.errors,
  };
}
