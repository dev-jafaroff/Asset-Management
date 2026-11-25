// What is in the old Snipe-IT, before the migration is mapped: categories,
// statuses, models, custom fields, tag formats and how many assigned people
// we already have from the user sync. Read-only; prints names of things and
// counts, never people's names or emails.
//
// npm run snipeit:inspect
import "dotenv/config";
import { normalizeEmail } from "@/lib/auth/entra";
import { prisma } from "@/lib/prisma";
import {
  accessorySchema,
  categorySchema,
  customFieldSchema,
  decodeHtml,
  hardwareSchema,
  modelSchema,
  namedSchema,
  parseRows,
  snipeList,
  snipeTotal,
  statusLabelSchema,
  userSchema,
  type SnipeHardware,
} from "./client";

function heading(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 70 - title.length))}`);
}

function warnInvalid(what: string, invalid: number) {
  if (invalid > 0) console.log(`  ! ${invalid} ${what} did not parse`);
}

// Counts per key, largest first: [["Laptops", 120], …]
function countBy<T>(items: T[], key: (item: T) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function printCounts(rows: [string, number][], indent = "  ") {
  const width = Math.max(0, ...rows.map(([label]) => label.length));
  for (const [label, count] of rows) {
    console.log(`${indent}${label.padEnd(width)}  ${count}`);
  }
}

// "PC-00012" → "AA-99999", so tag formats can be compared without listing tags.
function getShape(value: string): string {
  return value.replace(/[A-Za-z]/g, "A").replace(/[0-9]/g, "9");
}

function refName(ref: { name: string } | null | undefined): string {
  return ref ? decodeHtml(ref.name) : "(none)";
}

async function inspectLookups() {
  heading("Totals");
  const lists = [
    ["Assets", "/hardware"],
    ["Assets (deleted)", "/hardware?status=Deleted"],
    ["Accessories", "/accessories"],
    ["Consumables", "/consumables"],
    ["Components", "/components"],
    ["Licenses", "/licenses"],
    ["Users", "/users"],
  ] as const;
  const totals = await Promise.all(
    lists.map(([, path]) => {
      const [base, query] = path.split("?");
      return snipeTotal(base, Object.fromEntries(new URLSearchParams(query)));
    }),
  );
  printCounts(lists.map(([label], index) => [label, totals[index]]));

  heading("Categories (type · assets)");
  const categories = parseRows(await snipeList("/categories"), categorySchema);
  warnInvalid("categories", categories.invalid);
  for (const category of categories.items) {
    console.log(
      `  ${decodeHtml(category.name)} · ${category.category_type ?? "?"} · ${category.assets_count ?? 0}`,
    );
  }

  heading("Status labels (type · assets)");
  const statuses = parseRows(
    await snipeList("/statuslabels"),
    statusLabelSchema,
  );
  warnInvalid("status labels", statuses.invalid);
  for (const status of statuses.items) {
    console.log(
      `  ${decodeHtml(status.name)} · ${status.type ?? "?"} · ${status.assets_count ?? 0}`,
    );
  }

  heading("Models per category");
  const models = parseRows(await snipeList("/models"), modelSchema);
  warnInvalid("models", models.invalid);
  printCounts(countBy(models.items, (model) => refName(model.category)));

  for (const [title, path] of [
    ["Manufacturers", "/manufacturers"],
    ["Companies", "/companies"],
    ["Locations", "/locations"],
  ] as const) {
    heading(title);
    const { items, invalid } = parseRows(await snipeList(path), namedSchema);
    warnInvalid(title.toLowerCase(), invalid);
    console.log(`  ${items.map((item) => decodeHtml(item.name)).join(", ")}`);
  }

  heading("Custom fields (format · column)");
  const fields = parseRows(await snipeList("/fields"), customFieldSchema);
  warnInvalid("custom fields", fields.invalid);
  for (const field of fields.items) {
    console.log(
      `  ${decodeHtml(field.name)} · ${field.format ?? "?"} · ${field.db_column_name ?? "?"}`,
    );
  }
}

function inspectTags(assets: SnipeHardware[]) {
  heading("Asset tag formats per category (shape · count · example)");
  const byCategory = countBy(assets, (asset) => refName(asset.category));
  for (const [category] of byCategory) {
    console.log(`  ${category}`);
    const inCategory = assets.filter(
      (asset) => refName(asset.category) === category,
    );
    const shapes = countBy(inCategory, (asset) =>
      asset.asset_tag ? getShape(asset.asset_tag) : "(no tag)",
    );
    for (const [shape, count] of shapes.slice(0, 5)) {
      const example = inCategory.find(
        (asset) =>
          (asset.asset_tag ? getShape(asset.asset_tag) : "(no tag)") === shape,
      )?.asset_tag;
      console.log(
        `    ${shape.padEnd(16)} ${String(count).padStart(4)}  ${example ?? ""}`,
      );
    }
  }

  const tags = assets.flatMap((asset) =>
    asset.asset_tag ? [asset.asset_tag] : [],
  );
  const duplicateTags =
    tags.length - new Set(tags.map((tag) => tag.toUpperCase())).size;
  const serials = assets.flatMap((asset) =>
    asset.serial?.trim()
      ? [asset.serial.replace(/\s+/g, "").toUpperCase()]
      : [],
  );
  const duplicateSerials = serials.length - new Set(serials).size;

  heading("Data quality");
  printCounts([
    ["Without a serial", assets.length - serials.length],
    ["Duplicate serials (normalized)", duplicateSerials],
    ["Duplicate tags", duplicateTags],
    ["Without a model", assets.filter((asset) => !asset.model).length],
    ["Without a company", assets.filter((asset) => !asset.company).length],
  ]);
}

function inspectCustomFieldUse(assets: SnipeHardware[]) {
  heading("Custom fields filled per category");
  const filled = new Map<string, number>();
  for (const asset of assets) {
    for (const [field, { value }] of Object.entries(
      asset.custom_fields ?? {},
    )) {
      if (value === null || value === "") continue;
      const key = `${refName(asset.category)} · ${decodeHtml(field)}`;
      filled.set(key, (filled.get(key) ?? 0) + 1);
    }
  }
  printCounts([...filled].sort((a, b) => a[0].localeCompare(b[0])));
}

async function inspectAssignments(assets: SnipeHardware[]) {
  heading("Assigned to (type · assets)");
  printCounts(
    countBy(assets, (asset) => asset.assigned_to?.type ?? "(nobody)"),
  );

  const users = parseRows(await snipeList("/users"), userSchema);
  warnInvalid("users", users.invalid);
  const emailById = new Map(
    users.items.flatMap((user) =>
      user.email?.trim()
        ? [[user.id, normalizeEmail(user.email)] as const]
        : [],
    ),
  );
  const synced = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map(
      (user) => user.email,
    ),
  );

  const holderIds = new Set(
    assets.flatMap((asset) =>
      asset.assigned_to?.type === "user" ? [asset.assigned_to.id] : [],
    ),
  );
  const holders = [...holderIds];
  const withEmail = holders.filter((id) => emailById.has(id));
  const matched = withEmail.filter((id) => synced.has(emailById.get(id) ?? ""));

  heading("People holding assets vs. the user sync");
  printCounts([
    ["People holding assets", holders.length],
    ["… with an email in Snipe-IT", withEmail.length],
    ["… found among synced users", matched.length],
    ["… not found (left, or another email)", withEmail.length - matched.length],
    ["… without an email", holders.length - withEmail.length],
  ]);
}

async function inspectAccessories() {
  heading("Accessories (category · total · left)");
  const accessories = parseRows(
    await snipeList("/accessories"),
    accessorySchema,
  );
  warnInvalid("accessories", accessories.invalid);
  for (const accessory of accessories.items) {
    console.log(
      `  ${decodeHtml(accessory.name)} · ${refName(accessory.category)} · ${accessory.qty ?? "?"} · ${accessory.remaining_qty ?? "?"}`,
    );
  }
}

async function main() {
  await inspectLookups();

  const assets = parseRows(await snipeList("/hardware"), hardwareSchema);
  heading("Assets");
  console.log(`  ${assets.items.length} read`);
  warnInvalid("assets", assets.invalid);
  heading("Assets per status");
  printCounts(countBy(assets.items, (asset) => refName(asset.status_label)));

  inspectTags(assets.items);
  inspectCustomFieldUse(assets.items);
  await inspectAssignments(assets.items);
  await inspectAccessories();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
