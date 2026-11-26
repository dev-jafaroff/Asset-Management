// Moves the old Snipe-IT into this app, once: its assets (keeping the tags
// printed on their labels, and the Snipe-IT id for the old QR codes), the
// lookups they use and their checkout history. Accessories and consumables
// are not migrated: they are entered fresh.
//
// npm run snipeit:migrate -- --dry-run   reads both sides, writes nothing
// npm run snipeit:migrate                migrates, in one transaction
//
// Before: the base seed (statuses, companies) and the user sync, so people
// are found by email. The database must have no assets yet.
import "dotenv/config";
import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import { normalizeSerial } from "@/lib/assets/format";
import { normalizeEmail } from "@/lib/auth/entra";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AssetType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  decodeHtml,
  hardwareSchema,
  parseRows,
  parseSnipeDateTime,
  snipeList,
  userSchema,
  type SnipeHardware,
} from "./client";
import { readActivity, toAssetEvents } from "./history";
import { getAssetType, getManufacturer, getStatusName } from "./mapping";

const isDryRun = process.argv.includes("--dry-run");

// Something that must be fixed first; nothing has been written.
class MigrationStop extends Error {
  name = "MigrationStop";
}

type PlannedAsset = {
  snipeId: number;
  type: AssetType;
  assetTag: string | null;
  serial: string | null;
  name: string | null;
  notes: string | null;
  purchaseCost: string | null;
  purchaseDate: Date | null;
  createdAt: Date | null;
  statusName: string;
  model: { name: string; manufacturer: string | null; category: string } | null;
  companyName: string | null;
  locationName: string | null;
  // Our User id; only for types that go to a person.
  assignedToId: number | null;
};

// ─── Reading ─────────────────────────────────────────────────────────────────

function text(value: string | null | undefined): string | null {
  const trimmed = value ? decodeHtml(value).trim() : "";
  return trimmed || null;
}

// Archived assets are left out of Snipe-IT's default list.
async function readHardware(): Promise<SnipeHardware[]> {
  const rows = [
    ...(await snipeList("/hardware")),
    ...(await snipeList("/hardware", { status: "Archived" })),
  ];
  const { items, invalid } = parseRows(rows, hardwareSchema);
  if (invalid > 0) {
    throw new MigrationStop(`${invalid} Snipe-IT assets could not be read.`);
  }
  return [...new Map(items.map((asset) => [asset.id, asset])).values()];
}

// Snipe-IT user id → our User id, matched by email. Deleted Snipe-IT users
// are included, so old history still finds people who are still here.
async function linkUsers(): Promise<Map<number, number>> {
  const rows = [
    ...(await snipeList("/users")),
    ...(await snipeList("/users", { deleted: "true" })),
  ];
  const ourIdByEmail = new Map(
    (await prisma.user.findMany({ select: { id: true, email: true } })).map(
      (user) => [user.email, user.id],
    ),
  );

  const links = new Map<number, number>();
  for (const user of parseRows(rows, userSchema).items) {
    const ourId = user.email && ourIdByEmail.get(normalizeEmail(user.email));
    if (ourId) links.set(user.id, ourId);
  }
  return links;
}

// ─── Planning ────────────────────────────────────────────────────────────────

// "1,250.00" → "1250.00"; anything else → null.
function parseCost(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[\s,]/g, "");
  return /^\d+(\.\d+)?$/.test(cleaned) && Number(cleaned) > 0 ? cleaned : null;
}

// "2024-05-01" → that day.
function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLabel(asset: SnipeHardware): string {
  return asset.asset_tag ?? `Snipe-IT #${asset.id}`;
}

function planAssets(
  hardware: SnipeHardware[],
  userIds: ReadonlyMap<number, number>,
  warnings: string[],
): PlannedAsset[] {
  const byId = new Map(hardware.map((asset) => [asset.id, asset]));
  const unmappedCategories = new Set<string>();
  const unmappedStatuses = new Set<string>();
  // Normalized serial → the tag that has it.
  const serialOwners = new Map<string, string>();
  const planned: PlannedAsset[] = [];

  for (const asset of hardware) {
    const category = text(asset.category?.name) ?? "(none)";
    const modelName = text(asset.model?.name);
    const type = getAssetType(category, modelName);
    const snipeStatus = text(asset.status_label?.name) ?? "(none)";
    const statusName = getStatusName(snipeStatus);
    if (!type) unmappedCategories.add(category);
    if (!statusName) unmappedStatuses.add(snipeStatus);
    if (!type || !statusName) continue;

    const label = getLabel(asset);
    const notes = [text(asset.notes)];

    // Serials are unique here; a repeated one stays on the first asset.
    let serial = text(asset.serial);
    if (serial) {
      const key = normalizeSerial(serial);
      const owner = serialOwners.get(key);
      if (owner) {
        warnings.push(
          `${label}: serial ${serial} is also on ${owner}; left empty here.`,
        );
        notes.push(
          `Snipe-IT had serial ${serial} here too (also on ${owner}).`,
        );
        serial = null;
      } else {
        serialOwners.set(key, label);
      }
    }

    // Snipe-IT's current location; an asset checked out to another asset
    // (e.g. a disk on a NAS) is where that one is.
    const holder = asset.assigned_to;
    const parent = holder?.type === "asset" ? byId.get(holder.id) : undefined;
    const locationName =
      text(asset.location?.name) ?? text(parent?.location?.name);

    const { assignTo, label: typeLabel } = getAssetTypeConfig(type);
    const holderUser =
      holder?.type === "user"
        ? holder
        : parent?.assigned_to?.type === "user"
          ? parent.assigned_to
          : null;
    let assignedToId: number | null = null;
    if (holderUser && assignTo === "user") {
      assignedToId = userIds.get(holderUser.id) ?? null;
      if (assignedToId === null) {
        warnings.push(
          `${label}: its holder is not among the synced users; migrated without one.`,
        );
      }
    } else if (holderUser) {
      warnings.push(
        `${label}: held by a person in Snipe-IT, but ${typeLabel.toLowerCase()} go to a ${assignTo}; kept at its location only.`,
      );
    }

    planned.push({
      snipeId: asset.id,
      type,
      assetTag: text(asset.asset_tag),
      serial,
      name: text(asset.name),
      notes: notes.filter(Boolean).join("\n") || null,
      purchaseCost: parseCost(asset.purchase_cost),
      purchaseDate: parseDate(asset.purchase_date?.date),
      createdAt: asset.created_at
        ? parseSnipeDateTime(asset.created_at.datetime)
        : null,
      statusName,
      model: modelName
        ? {
            name: modelName,
            manufacturer: getManufacturer(text(asset.manufacturer?.name)),
            category,
          }
        : null,
      companyName: text(asset.company?.name),
      locationName,
      assignedToId,
    });
  }

  if (unmappedCategories.size > 0 || unmappedStatuses.size > 0) {
    throw new MigrationStop(
      [
        "Not mapped in scripts/snipeit/mapping.ts:",
        ...[...unmappedCategories].map((name) => `  category "${name}"`),
        ...[...unmappedStatuses].map((name) => `  status "${name}"`),
      ].join("\n"),
    );
  }
  return planned;
}

// ─── Writing ─────────────────────────────────────────────────────────────────

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => !!value))];
}

type Lookups = {
  statusIds: Map<string, number>;
  companyIds: Map<string, number>;
  locationIds: Map<string, number>;
  modelIds: Map<string, number>;
};

function getModelKey(model: NonNullable<PlannedAsset["model"]>): string {
  return `${model.manufacturer ?? ""}\u0000${model.name}`;
}

// Finds or creates every status, company, location, category and model the
// assets use. Companies match by name in any case ("EIG" = "eig").
async function writeLookups(
  tx: Prisma.TransactionClient,
  plan: PlannedAsset[],
): Promise<Lookups> {
  const statusIds = new Map(
    (await tx.statusLabel.findMany({ select: { id: true, name: true } })).map(
      (status) => [status.name, status.id],
    ),
  );
  const missing = unique(plan.map((asset) => asset.statusName)).filter(
    (name) => !statusIds.has(name),
  );
  if (missing.length > 0) {
    throw new MigrationStop(
      `Statuses missing here: ${missing.join(", ")}. Run the base seed first.`,
    );
  }

  const companyIds = new Map(
    (await tx.company.findMany({ select: { id: true, name: true } })).map(
      (company) => [company.name.toLowerCase(), company.id],
    ),
  );
  for (const name of unique(plan.map((asset) => asset.companyName))) {
    if (companyIds.has(name.toLowerCase())) continue;
    const company = await tx.company.create({ data: { name } });
    companyIds.set(name.toLowerCase(), company.id);
  }

  const locationIds = new Map<string, number>();
  for (const name of unique(plan.map((asset) => asset.locationName))) {
    const location = await tx.location.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    locationIds.set(name, location.id);
  }

  const categoryIds = new Map<string, number>();
  for (const name of unique(
    plan.map((asset) => asset.model?.category ?? null),
  )) {
    const category = await tx.category.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    categoryIds.set(name, category.id);
  }

  const modelIds = new Map<string, number>();
  for (const { model } of plan) {
    if (!model || modelIds.has(getModelKey(model))) continue;
    const found =
      (await tx.assetModel.findFirst({
        where: { name: model.name, manufacturer: model.manufacturer },
        select: { id: true },
      })) ??
      (await tx.assetModel.create({
        data: {
          name: model.name,
          manufacturer: model.manufacturer,
          categoryId: categoryIds.get(model.category) ?? 0,
        },
        select: { id: true },
      }));
    modelIds.set(getModelKey(model), found.id);
  }

  return { statusIds, companyIds, locationIds, modelIds };
}

function toAssetData(
  asset: PlannedAsset,
  lookups: Lookups,
): Prisma.AssetCreateManyInput {
  return {
    type: asset.type,
    assetTag: asset.assetTag,
    serial: asset.serial,
    name: asset.name,
    notes: asset.notes,
    purchaseCost: asset.purchaseCost,
    purchaseDate: asset.purchaseDate,
    createdAt: asset.createdAt ?? undefined,
    source: "SNIPEIT",
    legacySnipeId: asset.snipeId,
    statusId: lookups.statusIds.get(asset.statusName) ?? 0,
    modelId: asset.model
      ? lookups.modelIds.get(getModelKey(asset.model))
      : null,
    companyId: asset.companyName
      ? lookups.companyIds.get(asset.companyName.toLowerCase())
      : null,
    locationId: asset.locationName
      ? lookups.locationIds.get(asset.locationName)
      : null,
    assignedToId: asset.assignedToId,
  };
}

async function writeMigration(
  plan: PlannedAsset[],
  activities: Awaited<ReturnType<typeof readActivity>>["activities"],
  userIds: ReadonlyMap<number, number>,
) {
  return prisma.$transaction(
    async (tx) => {
      const lookups = await writeLookups(tx, plan);
      const created = await tx.asset.createManyAndReturn({
        data: plan.map((asset) => toAssetData(asset, lookups)),
        select: { id: true, legacySnipeId: true },
      });
      const assetIds = new Map(
        created.map((asset) => [asset.legacySnipeId ?? 0, asset.id]),
      );

      await tx.assetEvent.createMany({
        data: created.map((asset) => ({
          assetId: asset.id,
          type: "IMPORTED" as const,
          note: `Snipe-IT asset #${asset.legacySnipeId}.`,
        })),
      });
      const history = toAssetEvents(activities, { assetIds, userIds });
      await tx.assetEvent.createMany({ data: history.events });

      return { assets: created.length, events: history.events.length };
    },
    { timeout: 120_000 },
  );
}

// ─── Report ──────────────────────────────────────────────────────────────────

function printCounts(title: string, counts: Map<string, number>) {
  console.log(`\n${title}`);
  const width = Math.max(...[...counts.keys()].map((key) => key.length));
  for (const [key, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(width)}  ${count}`);
  }
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items)
    counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

function printPlan(plan: PlannedAsset[]) {
  console.log(`\nAssets to migrate: ${plan.length}`);
  printCounts(
    "Per type",
    countBy(plan, (asset) => asset.type),
  );
  printCounts(
    "Per status",
    countBy(plan, (asset) => asset.statusName),
  );
  printCounts(
    "Holder",
    countBy(plan, (asset) =>
      asset.assignedToId
        ? "a person"
        : asset.locationName
          ? "a location only"
          : "nobody",
    ),
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const warnings: string[] = [];
  const existingAssets = await prisma.asset.count();
  if (existingAssets > 0) {
    const message = `The database already has ${existingAssets} assets; the migration needs an empty one.`;
    if (!isDryRun) throw new MigrationStop(message);
    warnings.push(message);
  }

  console.log("Reading Snipe-IT…");
  const hardware = await readHardware();
  const userIds = await linkUsers();
  const { activities, invalid } = await readActivity();
  if (invalid > 0)
    warnings.push(
      `${invalid} activity log entries could not be read; skipped.`,
    );

  const plan = planAssets(hardware, userIds, warnings);
  printPlan(plan);

  if (isDryRun) {
    // The Snipe-IT ids stand in for ours, to count the history.
    const history = toAssetEvents(activities, {
      assetIds: new Map(plan.map((asset) => [asset.snipeId, asset.snipeId])),
      userIds,
    });
    console.log(`\nHistory events: ${history.events.length}`);
    console.log(`  … about people not in Entra ID: ${history.unknownPeople}`);
  }

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length})`);
    for (const warning of warnings) console.log(`  ! ${warning}`);
  }

  if (isDryRun) {
    console.log("\nDry run: nothing was written.");
    return;
  }

  const result = await writeMigration(plan, activities, userIds);
  const migrated = await prisma.asset.count({ where: { source: "SNIPEIT" } });
  console.log(
    `\nMigrated ${result.assets} assets and ${result.events} history events.`,
  );
  if (migrated !== plan.length) {
    throw new MigrationStop(
      `Expected ${plan.length} migrated assets, found ${migrated}.`,
    );
  }
  console.log(`Count check passed: ${migrated} of ${plan.length}.`);
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof MigrationStop ? `\nStopped: ${error.message}` : error,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
