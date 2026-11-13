import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BulkActionResult, BulkSummary } from "@/lib/assets/bulk-actions";
import type { AssignmentErrors } from "@/lib/assets/checkout";
import { formatCount } from "@/lib/utils";

// What an action on several assets did, e.g. "Checked out" with its summary.
export type BulkOutcome = BulkSummary & { action: string };

// Turns a bulk action's result into what its dialog expects: the errors to
// show, or null once it ran, after `onDone` got the outcome to show.
export function handleBulkResult(
  result: BulkActionResult,
  action: string,
  onDone: (outcome: BulkOutcome) => void,
): AssignmentErrors | null {
  if ("errors" in result) return result.errors;
  onDone({ ...result.summary, action });
  return null;
}

type BulkOutcomeMessageProps = {
  outcome: BulkOutcome;
  onDismiss: () => void;
};

// e.g. "Checked out 2 assets. Skipped 1: PC-00007 — In repair assets cannot
// be checked out." Shown by the list's selection bar and the user page.
export function BulkOutcomeMessage({
  outcome,
  onDismiss,
}: BulkOutcomeMessageProps) {
  const { action, done, skipped } = outcome;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">
          {done > 0
            ? `${action} ${formatCount(done, "asset")}.`
            : "Nothing was changed."}
        </p>
        {skipped.length > 0 && (
          <div className="text-muted-foreground">
            <p>Skipped {skipped.length}:</p>
            <ul className="list-inside list-disc">
              {skipped.map((asset) => (
                <li key={asset.assetId}>
                  <span className="font-medium text-foreground">
                    {asset.name}
                  </span>
                  {" — "}
                  {asset.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
