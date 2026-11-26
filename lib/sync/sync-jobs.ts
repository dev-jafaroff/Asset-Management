import type { SyncKind } from "@/lib/generated/prisma/enums";
import { syncIntune } from "@/lib/intune/intune-sync";
import type { SyncCountLabels, SyncOutcome } from "@/lib/sync/sync-run";
import { syncUsers } from "@/lib/users/user-sync";

// Every sync the Azure sync page (/admin/sync) shows and can start. A new
// one (e.g. Intune) is one more entry here; the page, the button and the
// Server Action need no change.
export type SyncJob = {
  kind: SyncKind;
  // "Entra ID"
  title: string;
  description: string;
  buttonLabel: string;
  countLabels: SyncCountLabels;
  run: () => Promise<SyncOutcome>;
};

export const syncJobs: readonly SyncJob[] = [
  {
    kind: "USERS",
    title: "Entra ID",
    description: "Employees from the employees group, in both tenants.",
    buttonLabel: "Sync from Entra",
    countLabels: {
      created: "added",
      updated: "updated",
      missing: "marked as left",
    },
    run: syncUsers,
  },
  {
    kind: "INTUNE",
    title: "Intune",
    description:
      "Devices of both tenants, matched to our assets by serial. Nothing is created and holders are never changed.",
    buttonLabel: "Sync from Intune",
    countLabels: {
      created: "added",
      updated: "updated",
      missing: "flagged missing",
    },
    run: syncIntune,
  },
];

export function getSyncJob(kind: string): SyncJob | undefined {
  return syncJobs.find((job) => job.kind === kind);
}
