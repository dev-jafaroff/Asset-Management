import type { Prisma } from "@/lib/generated/prisma/client";
import type { SyncKind } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const syncRunSelect = {
  id: true,
  kind: true,
  startedAt: true,
  finishedAt: true,
  created: true,
  updated: true,
  missing: true,
  errors: true,
} satisfies Prisma.SyncRunSelect;

type SyncRunRecord = Prisma.SyncRunGetPayload<{
  select: typeof syncRunSelect;
}>;

// A run as the page shows it: errors as a list (stored as JSON).
export type SyncRunRow = Omit<SyncRunRecord, "errors"> & { errors: string[] };

function toSyncRunRow({ errors, ...run }: SyncRunRecord): SyncRunRow {
  return {
    ...run,
    errors: Array.isArray(errors)
      ? errors.filter((error) => typeof error === "string")
      : [],
  };
}

// The latest runs of every sync, newest first.
export async function listRecentSyncRuns(take = 20): Promise<SyncRunRow[]> {
  const runs = await prisma.syncRun.findMany({
    select: syncRunSelect,
    orderBy: { startedAt: "desc" },
    take,
  });
  return runs.map(toSyncRunRow);
}

// The latest run of each kind; a sync that never ran is missing.
export async function getLastSyncRuns(): Promise<
  Partial<Record<SyncKind, SyncRunRow>>
> {
  const runs = await prisma.syncRun.findMany({
    select: syncRunSelect,
    orderBy: { startedAt: "desc" },
    distinct: ["kind"],
  });
  return Object.fromEntries(runs.map((run) => [run.kind, toSyncRunRow(run)]));
}
