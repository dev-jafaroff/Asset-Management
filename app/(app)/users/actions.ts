"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { describeSyncOutcome, type SyncMessage } from "@/lib/sync/sync-run";
import { syncUsers } from "@/lib/users/user-sync";

// "Sync now" on the users page: the same sync the schedule runs.
export async function syncUsersNow(): Promise<SyncMessage> {
  const user = await getCurrentUser();
  if (!can(user.role, "sync:run")) {
    return { ok: false, text: "Only admins can sync users.", errors: [] };
  }

  const outcome = await syncUsers();
  refresh();
  return describeSyncOutcome(outcome, {
    created: "added",
    updated: "updated",
    missing: "marked as left",
  });
}
