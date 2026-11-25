import { DateTime } from "@/components/shared/date-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SyncRunRow } from "@/lib/sync/queries";
import { getSyncJob } from "@/lib/sync/sync-jobs";
import { formatSyncCounts } from "@/lib/sync/sync-run";
import { formatCount, formatDuration } from "@/lib/utils";

// What one run did, e.g. "3 added, 1 marked as left", with its problems
// listed under it. Used by the sync cards and the table below.
export function SyncRunSummary({ run }: { run: SyncRunRow }) {
  const job = getSyncJob(run.kind);
  if (!run.finishedAt) return <p className="text-muted-foreground">Running…</p>;

  return (
    <div className="space-y-1">
      <p>
        {job ? formatSyncCounts(run, job.countLabels) : "Finished"}
        {run.errors.length > 0 && (
          <span className="text-destructive">
            {" "}
            · {formatCount(run.errors.length, "problem")}
          </span>
        )}
      </p>
      {run.errors.length > 0 && (
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {run.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The latest runs of every sync, newest first: the sync log.
export function SyncRunTable({ runs }: { runs: SyncRunRow[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No sync has run yet.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sync</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Took</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id} className="align-top">
            <TableCell className="font-medium">
              {getSyncJob(run.kind)?.title ?? run.kind}
            </TableCell>
            <TableCell>
              <DateTime date={run.startedAt} />
            </TableCell>
            <TableCell className="tabular-nums">
              {run.finishedAt
                ? formatDuration(
                    run.finishedAt.getTime() - run.startedAt.getTime(),
                  )
                : "—"}
            </TableCell>
            <TableCell className="whitespace-normal">
              <SyncRunSummary run={run} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
