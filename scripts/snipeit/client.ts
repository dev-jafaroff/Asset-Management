import "dotenv/config";
import { z } from "zod";
import { requireEnv } from "@/lib/env";

// Read-only access to the old Snipe-IT (REST API v1), for the one-off
// migration. Only GET requests: nothing in Snipe-IT is changed.
//
// SNIPEIT_URL="https://snipe-it.example.com" (no /api, no trailing slash)
// SNIPEIT_API_TOKEN="<personal API key>"

// Snipe-IT's own upper limit for one page.
const PAGE_SIZE = 500;
// Snipe-IT throttles API calls (120 a minute by default).
const MAX_ATTEMPTS = 5;

export class SnipeItError extends Error {
  name = "SnipeItError";
}

function getBaseUrl(): string {
  return `${requireEnv("SNIPEIT_URL").replace(/\/+$/, "")}/api/v1`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Some failures come back as 200 with { status: "error", messages }.
const errorBodySchema = z.object({
  status: z.literal("error"),
  messages: z.unknown(),
});

async function snipeGet(
  path: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  const url = new URL(`${getBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${requireEnv("SNIPEIT_API_TOKEN")}`,
        Accept: "application/json",
      },
    });

    if (response.status === 429 && attempt < MAX_ATTEMPTS) {
      const seconds = Number(response.headers.get("Retry-After")) || 30;
      await wait(seconds * 1000);
      continue;
    }
    if (!response.ok) {
      throw new SnipeItError(
        `Snipe-IT refused ${url.pathname}: HTTP ${response.status}${
          response.status === 401 ? " (check SNIPEIT_API_TOKEN)" : ""
        }`,
      );
    }

    const body: unknown = await response.json();
    const error = errorBodySchema.safeParse(body);
    if (error.success) {
      throw new SnipeItError(
        `Snipe-IT refused ${url.pathname}: ${JSON.stringify(error.data.messages)}`,
      );
    }
    return body;
  }
}

const pageSchema = z.object({
  total: z.number(),
  rows: z.array(z.unknown()),
});

// How many rows a list has, without reading them.
export async function snipeTotal(
  path: string,
  params: Record<string, string | number> = {},
): Promise<number> {
  return pageSchema.parse(await snipeGet(path, { ...params, limit: 1 })).total;
}

// Every row of a list, page after page. Rows are not checked here: the
// caller parses them with the schemas below.
export async function snipeList(
  path: string,
  params: Record<string, string | number> = {},
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = pageSchema.parse(
      await snipeGet(path, { ...params, limit: PAGE_SIZE, offset }),
    );
    rows.push(...page.rows);
    if (page.rows.length < PAGE_SIZE || rows.length >= page.total) {
      return rows;
    }
  }
}

// Parses each row; rows that do not fit are counted, not fatal.
export function parseRows<Schema extends z.ZodType>(
  rows: unknown[],
  schema: Schema,
): { items: z.output<Schema>[]; invalid: number } {
  const items: z.output<Schema>[] = [];
  let invalid = 0;
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
    else invalid++;
  }
  return { items, invalid };
}

// Snipe-IT sends text HTML-escaped, e.g. "Dell &amp; Co".
const htmlEntities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&#39;": "'",
};

export function decodeHtml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#0?39);/g, (entity) => {
    return htmlEntities[entity] ?? entity;
  });
}

// Snipe-IT's own time zone (Admin → Settings → Localization). Its dates come
// as wall-clock text in that zone, e.g. "2026-03-02 14:05:00".
const SNIPEIT_TIME_ZONE = "Asia/Baku";

const zoneClock = new Intl.DateTimeFormat("en-US", {
  timeZone: SNIPEIT_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

// "2026-03-02 14:05:00" (Baku) → 2026-03-02T10:05:00Z
export function parseSnipeDateTime(text: string): Date {
  const asUtc = new Date(`${text.trim().replace(" ", "T")}Z`);
  if (Number.isNaN(asUtc.getTime())) {
    throw new SnipeItError(`Unreadable Snipe-IT date: ${text}`);
  }
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(zoneClock.formatToParts(asUtc).find((p) => p.type === type)?.value);
  // How far the zone's clock is ahead of UTC at that moment.
  const offset =
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    ) - asUtc.getTime();
  return new Date(asUtc.getTime() - offset);
}

// ─── Row schemas (only the fields the migration reads) ───────────────────────

const refSchema = z.object({ id: z.number(), name: z.string() }).nullish();

export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  // "asset", "accessory", "consumable", "component", "license"
  category_type: z.string().nullish(),
  assets_count: z.number().nullish(),
});

export const statusLabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  // "deployable", "pending", "undeployable", "archived"
  type: z.string().nullish(),
  assets_count: z.number().nullish(),
});

export const modelSchema = z.object({
  id: z.number(),
  name: z.string(),
  model_number: z.string().nullish(),
  manufacturer: refSchema,
  category: refSchema,
  assets_count: z.number().nullish(),
});

export const namedSchema = z.object({ id: z.number(), name: z.string() });

export const customFieldSchema = z.object({
  id: z.number(),
  name: z.string(),
  db_column_name: z.string().nullish(),
  format: z.string().nullish(),
});

export const userSchema = z.object({
  id: z.number(),
  email: z.string().nullish(),
  username: z.string().nullish(),
  activated: z.boolean().nullish(),
});

// Empty custom fields come as [] (a PHP empty array), not {}.
const customFieldValuesSchema = z
  .union([
    z.record(z.string(), z.object({ value: z.unknown() })),
    z
      .array(z.unknown())
      .transform((): Record<string, { value: unknown }> => ({})),
  ])
  .nullish();

export const hardwareSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  asset_tag: z.string().nullish(),
  serial: z.string().nullish(),
  model: refSchema,
  category: refSchema,
  manufacturer: refSchema,
  company: refSchema,
  location: refSchema,
  status_label: z
    .object({
      id: z.number(),
      name: z.string(),
      status_type: z.string().nullish(),
    })
    .nullish(),
  // A user, a location or another asset.
  assigned_to: z
    .object({ id: z.number(), type: z.string().nullish() })
    .nullish(),
  notes: z.string().nullish(),
  purchase_cost: z.union([z.string(), z.number()]).nullish(),
  purchase_date: z.object({ date: z.string() }).nullish(),
  created_at: z.object({ datetime: z.string() }).nullish(),
  custom_fields: customFieldValuesSchema,
});

export type SnipeHardware = z.infer<typeof hardwareSchema>;

// One entry of the activity log (Reports → Activity).
export const activitySchema = z.object({
  id: z.number(),
  // "checkout", "checkin from", "update", "create new", "delete"…
  action_type: z.string(),
  item: z.object({ id: z.number(), type: z.string().nullish() }).nullish(),
  // Who it was checked out to or in from: a user, a location or an asset.
  target: z
    .object({ id: z.number(), name: z.string().nullish(), type: z.string() })
    .nullish(),
  // The Snipe-IT user who did it.
  admin: z.object({ id: z.number() }).nullish(),
  note: z.string().nullish(),
  created_at: z.object({ datetime: z.string() }),
  // When it happened, if entered by hand (e.g. a checkout dated earlier).
  action_date: z.object({ datetime: z.string() }).nullish(),
});

export type SnipeActivity = z.infer<typeof activitySchema>;

export const accessorySchema = z.object({
  id: z.number(),
  name: z.string(),
  category: refSchema,
  qty: z.number().nullish(),
  remaining_qty: z.number().nullish(),
});
