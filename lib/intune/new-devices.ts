import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import { checkOutAsset } from "@/lib/assets/checkout";
import { normalizeEmail } from "@/lib/auth/entra";
import { describeDevice, type IntuneDevice } from "@/lib/intune/devices";
import { prisma } from "@/lib/prisma";
import type { SyncTally } from "@/lib/sync/sync-run";

// New PCs from Intune. IT names a new laptop after its label (the next free
// tag, e.g. "PC-00123") when it installs the OS; once it is in Intune, the
// sync adds it here with everything Intune knows, so nobody types it twice:
// - tag and serial from the device; OS and the rest from the matching that
//   follows (lib/intune/intune-sync.ts);
// - the model by its name, which Intune and our models share ("83K1"),
//   added when it is new;
// - checked out to its primary user in Intune, if they work here;
// - the company the holder's other assets belong to, or else the one most
//   people of their email domain have: a guess, said so in the history.
// Without a holder (e.g. a shared device) it is Pending, for IT to finish.

const pcTagPrefix = getAssetTypeConfig("PC").tagPrefix ?? "";

// "PC-00123" for a device named after a PC label; null for any other name.
export function getPcTag(device: IntuneDevice): string | null {
  const name = device.deviceName?.trim().toUpperCase() ?? "";
  const number = name.slice(pcTagPrefix.length);
  return pcTagPrefix && name.startsWith(pcTagPrefix) && /^\d+$/.test(number)
    ? name
    : null;
}

type Lookups = {
  // Status of a new device with a holder ("In stock", shown as Assigned)
  // and of one without ("Pending").
  readyStatusId: number;
  pendingStatusId: number;
  // Category for a model seen for the first time: the one most PC models
  // have ("Personal Computers").
  pcCategoryId: number | null;
};

async function loadLookups(): Promise<Lookups | string> {
  const [ready, pending, category] = await Promise.all([
    prisma.statusLabel.findFirst({
      where: { type: "DEPLOYABLE" },
      orderBy: { id: "asc" },
      select: { id: true },
    }),
    prisma.statusLabel.findFirst({
      where: { type: "PENDING" },
      orderBy: { id: "asc" },
      select: { id: true },
    }),
    prisma.category.findFirst({
      where: { models: { some: { assets: { some: { type: "PC" } } } } },
      orderBy: { models: { _count: "desc" } },
      select: { id: true },
    }),
  ]);
  if (!ready || !pending) {
    return "New PCs in Intune were not added: a status of type Deployable and one of type Pending are needed.";
  }
  return {
    readyStatusId: ready.id,
    pendingStatusId: pending.id,
    pcCategoryId: category?.id ?? null,
  };
}

// The model of that name, preferring the same manufacturer; added when new,
// with the manufacturer as our other models spell it ("LENOVO" → "Lenovo").
async function getModelId(
  device: IntuneDevice,
  categoryId: number | null,
): Promise<number | null> {
  if (!device.model) return null;
  const models = await prisma.assetModel.findMany({
    where: { name: { equals: device.model, mode: "insensitive" } },
    select: { id: true, manufacturer: true },
  });
  const isSameMaker = (manufacturer: string | null) =>
    manufacturer?.toLowerCase() === device.manufacturer?.toLowerCase();
  const known =
    models.find((model) => isSameMaker(model.manufacturer)) ?? models[0];
  if (known) return known.id;
  if (categoryId === null) return null;

  const spelled = device.manufacturer
    ? await prisma.assetModel.findFirst({
        where: {
          manufacturer: { equals: device.manufacturer, mode: "insensitive" },
        },
        select: { manufacturer: true },
      })
    : null;
  const model = await prisma.assetModel.create({
    data: {
      name: device.model,
      manufacturer: spelled?.manufacturer ?? device.manufacturer,
      categoryId,
    },
    select: { id: true },
  });
  return model.id;
}

type Holder = { id: number; email: string };

async function getHolder(device: IntuneDevice): Promise<Holder | null> {
  if (!device.userPrincipalName) return null;
  return prisma.user.findFirst({
    where: { email: normalizeEmail(device.userPrincipalName), isActive: true },
    select: { id: true, email: true },
  });
}

type CompanyGuess = { id: number; name: string; basis: string };

// The company most of these assets belong to.
async function getMostCommonCompany(where: {
  assignedToId?: number;
  assignedTo?: { email: { endsWith: string } };
}): Promise<{ id: number; name: string } | null> {
  const [top] = await prisma.asset.groupBy({
    by: ["companyId"],
    where: { ...where, companyId: { not: null } },
    _count: { companyId: true },
    orderBy: { _count: { companyId: "desc" } },
    take: 1,
  });
  if (!top?.companyId) return null;
  return prisma.company.findUnique({
    where: { id: top.companyId },
    select: { id: true, name: true },
  });
}

async function guessCompany(holder: Holder): Promise<CompanyGuess | null> {
  const own = await getMostCommonCompany({ assignedToId: holder.id });
  if (own) return { ...own, basis: "the holder's other assets" };
  const domain = holder.email.split("@")[1];
  const shared = await getMostCommonCompany({
    assignedTo: { email: { endsWith: `@${domain}` } },
  });
  return shared
    ? { ...shared, basis: `most people with an @${domain} email` }
    : null;
}

async function addDevice(
  assetTag: string,
  device: IntuneDevice,
  lookups: Lookups,
): Promise<string | null> {
  const [modelId, holder] = await Promise.all([
    getModelId(device, lookups.pcCategoryId),
    getHolder(device),
  ]);
  const company = holder ? await guessCompany(holder) : null;
  const note = [
    `Added from Intune, named ${assetTag} after its label.`,
    company && `Company ${company.name} guessed from ${company.basis}.`,
    !holder && "No holder in Intune: finish it and set its status.",
  ]
    .filter(Boolean)
    .join(" ");

  const asset = await prisma.asset.create({
    data: {
      type: "PC",
      assetTag,
      serial: device.serialNumber,
      modelId,
      companyId: company?.id ?? null,
      statusId: holder ? lookups.readyStatusId : lookups.pendingStatusId,
      source: "INTUNE",
      events: { create: { type: "CREATED", note } },
    },
    select: { id: true },
  });

  if (!holder) return null;
  const refused = await checkOutAsset({
    assetId: asset.id,
    actorId: null,
    holderId: holder.id,
    note: "Checked out to the device's primary user in Intune.",
  });
  return refused && `${assetTag} was added but not checked out: ${refused}`;
}

// One asset per tag; of a dual-boot device's two records, the Windows one,
// which has the serial.
export async function addNewDevices(
  devices: IntuneDevice[],
  tally: SyncTally,
): Promise<void> {
  const byTag = new Map<string, IntuneDevice>();
  for (const device of devices) {
    const tag = getPcTag(device);
    if (!tag) continue;
    const known = byTag.get(tag);
    if (!known || (!known.serialNumber && device.serialNumber)) {
      byTag.set(tag, device);
    }
  }
  if (byTag.size === 0) return;

  const lookups = await loadLookups();
  if (typeof lookups === "string") {
    tally.errors.push(lookups);
    return;
  }

  for (const [assetTag, device] of byTag) {
    try {
      const problem = await addDevice(assetTag, device, lookups);
      tally.created++;
      if (problem) tally.errors.push(problem);
    } catch (error) {
      tally.errors.push(
        `${describeDevice(device)} could not be added: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
