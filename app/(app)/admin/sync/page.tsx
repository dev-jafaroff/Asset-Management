import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DateTime } from "@/components/shared/date-time";
import { SyncButton } from "@/components/sync/sync-button";
import { SyncRunSummary, SyncRunTable } from "@/components/sync/sync-run-table";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import {
  getLastSyncRuns,
  listRecentSyncRuns,
  type SyncRunRow,
} from "@/lib/sync/queries";
import { syncJobs, type SyncJob } from "@/lib/sync/sync-jobs";

export const metadata: Metadata = { title: "Azure sync" };

// Everything synced from Microsoft (people from Entra ID, devices from
// Intune): run a sync now, and see what the last runs did.
export default function SyncPage() {
  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Azure sync"
        description="Data pulled from Microsoft on a schedule. Run a sync here to get changes now."
      />
      <Suspense fallback={<SyncPageFallback />}>
        <SyncPageContent />
      </Suspense>
    </div>
  );
}

async function SyncPageContent() {
  const user = await getCurrentUser();
  if (!can(user.role, "sync:run")) notFound();

  const [lastRuns, recentRuns] = await Promise.all([
    getLastSyncRuns(),
    listRecentSyncRuns(),
  ]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {syncJobs.map((job) => (
          <SyncJobCard key={job.kind} job={job} lastRun={lastRuns[job.kind]} />
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>
            By the schedule and by the buttons above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncRunTable runs={recentRuns} />
        </CardContent>
      </Card>
    </>
  );
}

function SyncJobCard({
  job,
  lastRun,
}: {
  job: SyncJob;
  lastRun: SyncRunRow | undefined;
}) {
  return (
    <Card>
      {/* The button sits in the header, so it is at the same height on every
          card, however long the description or the last run's problems. */}
      <CardHeader>
        <CardTitle>{job.title}</CardTitle>
        <CardDescription>{job.description}</CardDescription>
        <CardAction>
          <SyncButton kind={job.kind} label={job.buttonLabel} />
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm">
        {lastRun ? (
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Last run <DateTime date={lastRun.startedAt} />
            </p>
            <SyncRunSummary run={lastRun} />
          </div>
        ) : (
          <p className="text-muted-foreground">Never run.</p>
        )}
      </CardContent>
    </Card>
  );
}

function SyncPageFallback() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
