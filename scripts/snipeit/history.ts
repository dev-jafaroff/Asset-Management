import type { FieldChange } from "@/lib/assets/asset-detail";
import { assetFormFieldLabels } from "@/lib/assets/asset-form";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  activitySchema,
  decodeHtml,
  parseRows,
  parseSnipeDateTime,
  snipeList,
  type SnipeActivity,
} from "./client";

// Snipe-IT's checkout and checkin log, as our asset history. Other entries
// (created, updated, deleted, audits) are not carried over: the asset itself
// is the result of those.

const eventTypes = {
  checkout: { type: "CHECKOUT", verb: "Checked out to" },
  "checkin from": { type: "CHECKIN", verb: "Checked in from" },
} as const;

type LoggedAction = keyof typeof eventTypes;

function isLoggedAction(action: string): action is LoggedAction {
  return Object.hasOwn(eventTypes, action);
}

export async function readActivity(): Promise<{
  activities: SnipeActivity[];
  invalid: number;
}> {
  const { items, invalid } = parseRows(
    await snipeList("/reports/activity", { item_type: "asset" }),
    activitySchema,
  );
  return { activities: items, invalid };
}

export type HistoryLinks = {
  // Snipe-IT asset id → our asset id.
  assetIds: ReadonlyMap<number, number>;
  // Snipe-IT user id → our user id.
  userIds: ReadonlyMap<number, number>;
};

export type HistoryResult = {
  events: Prisma.AssetEventCreateManyInput[];
  // People in the log who are not among our users (e.g. left long ago).
  unknownPeople: number;
};

function toEvent(
  activity: SnipeActivity & { action_type: LoggedAction },
  assetId: number,
  { userIds }: HistoryLinks,
): { event: Prisma.AssetEventCreateManyInput; unknownPerson: boolean } {
  const { type, verb } = eventTypes[activity.action_type];
  const isCheckout = type === "CHECKOUT";
  const target = activity.target;
  const targetName = target?.name ? decodeHtml(target.name) : null;

  let targetUserId: number | null = null;
  let changes: FieldChange[] = [];
  // Said in words when there is no other place for it.
  let about: string | null = null;
  let unknownPerson = false;

  if (target?.type === "user") {
    targetUserId = userIds.get(target.id) ?? null;
    if (targetUserId === null) {
      unknownPerson = true;
      about = `${verb} ${targetName ?? "a former user"} (not in Entra ID).`;
    }
  } else if (target?.type === "location") {
    changes = [
      {
        field: assetFormFieldLabels.locationId,
        from: isCheckout ? null : targetName,
        to: isCheckout ? targetName : null,
      },
    ];
  } else if (target?.type === "asset") {
    about = `${verb} asset ${targetName ?? `#${target.id}`}.`;
  }

  const snipeNote = activity.note?.trim() ? decodeHtml(activity.note) : null;
  const note = [about, snipeNote].filter(Boolean).join(" ") || null;

  return {
    event: {
      assetId,
      type,
      actorId: (activity.admin && userIds.get(activity.admin.id)) ?? null,
      targetUserId,
      changes: changes.length > 0 ? changes : undefined,
      note,
      createdAt: parseSnipeDateTime(
        (activity.action_date ?? activity.created_at).datetime,
      ),
    },
    unknownPerson,
  };
}

// The checkouts and checkins of the migrated assets, oldest first.
export function toAssetEvents(
  activities: SnipeActivity[],
  links: HistoryLinks,
): HistoryResult {
  const events: Prisma.AssetEventCreateManyInput[] = [];
  let unknownPeople = 0;

  for (const activity of activities) {
    const { action_type: action } = activity;
    if (!isLoggedAction(action) || !activity.item) continue;
    // Entries of assets deleted in Snipe-IT are left behind with them.
    const assetId = links.assetIds.get(activity.item.id);
    if (assetId === undefined) continue;

    const result = toEvent(
      { ...activity, action_type: action },
      assetId,
      links,
    );
    events.push(result.event);
    if (result.unknownPerson) unknownPeople++;
  }

  events.sort(
    (a, b) =>
      new Date(a.createdAt ?? 0).getTime() -
      new Date(b.createdAt ?? 0).getTime(),
  );
  return { events, unknownPeople };
}
