import { timingSafeEqual } from "node:crypto";
import type { SyncKind } from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCount } from "@/lib/utils";

// What every sync (users from Entra, devices from Intune) shares: the
// SyncRun record, one run at a time, the schedule's secret and the message.

// Counted by the job as it goes, so a run that fails halfway still records
// what it did.
export type SyncTally = {
  created: number;
  updated: number;
  // People turned inactive, or devices flagged missing in Intune.
  missing: number;
  errors: string[];
};

export type SyncOutcome =
  | ({ status: "done" } & SyncTally)
  // Another run of the same kind has not finished.
  | { status: "busy" };

// A run that never finished (e.g. the server restarted) stops blocking new
// ones after this long.
const STALE_RUN_MS = 30 * 60 * 1000;

export async function runSync(
  kind: SyncKind,
  job: (tally: SyncTally) => Promise<void>,
): Promise<SyncOutcome> {
  // A check, not a lock: the schedule and "Sync now" at the very same
  // second could both start, and the sync is safe to run twice.
  const running = await prisma.syncRun.findFirst({
    where: {
      kind,
      finishedAt: null,
      startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) },
    },
    select: { id: true },
  });
  if (running) return { status: "busy" };

  const run = await prisma.syncRun.create({
    data: { kind },
    select: { id: true },
  });
  const tally: SyncTally = { created: 0, updated: 0, missing: 0, errors: [] };
  try {
    await job(tally);
  } catch (error) {
    tally.errors.push(error instanceof Error ? error.message : String(error));
  }

  const { errors, ...counts } = tally;
  await prisma.syncRun.update({
    where: { id: run.id },
    data: {
      ...counts,
      finishedAt: new Date(),
      errors: errors.length > 0 ? errors : Prisma.DbNull,
    },
  });
  return { status: "done", ...tally };
}

// ─── Schedule ────────────────────────────────────────────────────────────────

// The scheduler sends "Authorization: Bearer <CRON_SECRET>". Without
// CRON_SECRET set, nothing gets in.
export function isScheduledRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// The scheduler's reply: 409 while another run is going, otherwise the
// counts and errors (a run with errors still finished, so 200).
export function syncOutcomeResponse(outcome: SyncOutcome): Response {
  return Response.json(outcome, {
    status: outcome.status === "busy" ? 409 : 200,
  });
}

// ─── Message ─────────────────────────────────────────────────────────────────

// What "Sync now" shows.
export type SyncMessage = { ok: boolean; text: string; errors: string[] };

// How each count reads, e.g. { created: "added", missing: "marked as left" }.
type SyncCountLabels = Record<keyof Omit<SyncTally, "errors">, string>;

// e.g. "Synced: 3 added, 1 marked as left." or "Synced: nothing changed."
export function describeSyncOutcome(
  outcome: SyncOutcome,
  labels: SyncCountLabels,
): SyncMessage {
  if (outcome.status === "busy") {
    return {
      ok: false,
      text: "A sync is already running. Try again in a minute.",
      errors: [],
    };
  }

  const changes = (Object.keys(labels) as (keyof SyncCountLabels)[])
    .filter((count) => outcome[count] > 0)
    .map((count) => `${outcome[count]} ${labels[count]}`);
  const summary = changes.length > 0 ? changes.join(", ") : "nothing changed";
  const { errors } = outcome;
  return {
    ok: errors.length === 0,
    text:
      errors.length === 0
        ? `Synced: ${summary}.`
        : `Synced with ${formatCount(errors.length, "problem")}: ${summary}.`,
    errors,
  };
}
