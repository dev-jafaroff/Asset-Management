"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { getSyncJob } from "@/lib/sync/sync-jobs";
import { describeSyncOutcome, type SyncMessage } from "@/lib/sync/sync-run";

// A sync button on the Azure sync page: the same sync the schedule runs.
export async function runSyncNow(kind: string): Promise<SyncMessage> {
  const user = await getCurrentUser();
  if (!can(user.role, "sync:run")) {
    return { ok: false, text: "Only admins can run a sync.", errors: [] };
  }
  const job = getSyncJob(kind);
  if (!job) return { ok: false, text: "Unknown sync.", errors: [] };

  const outcome = await job.run();
  refresh();
  return describeSyncOutcome(outcome, job.countLabels);
}
