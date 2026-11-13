"use client";

import { CircleDot, X } from "lucide-react";
import { useState } from "react";
import {
  bulkChangeStatus,
  bulkCheckIn,
  bulkCheckOut,
  type BulkActionResult,
} from "@/app/(app)/assets/actions";
import {
  AssignmentDialog,
  ChoiceField,
  type AssignmentSubmit,
} from "@/components/assets/assignment-dialog";
import { CheckinDialog } from "@/components/assets/checkin-dialog";
import { CheckoutDialog } from "@/components/assets/checkout-dialog";
import { Button } from "@/components/ui/button";
import type { BulkActionOptions } from "@/lib/assets/asset-form-options";
import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import type { BulkSummary } from "@/lib/assets/bulk-actions";
import type { AssetListItem } from "@/lib/assets/queries";
import type { CheckoutValues, StatusChangeValues } from "@/lib/schemas/asset";
import { formatCount } from "@/lib/utils";

type BulkActionBarProps = {
  // The selected rows, in the list's order.
  selected: AssetListItem[];
  options: BulkActionOptions;
  onClear: () => void;
};

// What the last action did, e.g. "Checked out" with its summary.
type Outcome = BulkSummary & { action: string };

// Above an asset list: what is selected and what can be done with it, or,
// once an action ran, what it did.
export function BulkActionBar({
  selected,
  options,
  onClear,
}: BulkActionBarProps) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // A new selection starts a new round, so the old summary goes.
  if (selected.length > 0 && outcome) setOutcome(null);

  if (selected.length === 0) {
    return outcome ? (
      <OutcomeMessage outcome={outcome} onDismiss={() => setOutcome(null)} />
    ) : null;
  }

  const assetIds = selected.map((asset) => asset.id);
  const count = formatCount(selected.length, "asset");

  // Runs the action on the selection; the dialog closes and the summary shows.
  function submitWith<Values>(
    action: (assetIds: number[], values: Values) => Promise<BulkActionResult>,
    actionLabel: string,
  ): AssignmentSubmit<Values> {
    return async (values) => {
      const result = await action(assetIds, values);
      if ("errors" in result) return result.errors;
      setOutcome({ ...result.summary, action: actionLabel });
      onClear();
      return null;
    };
  }

  // All selected assets must go to the same kind of holder, e.g. PCs and
  // monitors to a person, but not PCs and access points together.
  const assignTargets = [
    ...new Set(
      selected.map((asset) => getAssetTypeConfig(asset.type).assignTo),
    ),
  ];
  const [assignTo] = assignTargets;
  const canCheckOut = assignTargets.length === 1;

  return (
    <div
      role="region"
      aria-label="Selected assets"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2"
    >
      <span className="mr-2 text-sm font-medium">
        {selected.length} selected
      </span>

      <CheckoutDialog
        title={`Check out ${count}`}
        description={`Every selected asset goes to the same ${assignTo}.`}
        assignTo={assignTo}
        holders={options.holders[assignTo] ?? []}
        disabled={!canCheckOut}
        onSubmit={submitWith(
          (ids, values: CheckoutValues) =>
            bulkCheckOut(ids, { ...values, assignTo }),
          "Checked out",
        )}
      />
      <CheckinDialog
        title={`Check in ${count}`}
        description="Take them back from whoever has them."
        statuses={options.statuses}
        defaultStatusId={options.defaultStatusId}
        onSubmit={submitWith(bulkCheckIn, "Checked in")}
      />
      <StatusDialog
        title={`Change the status of ${count}`}
        statuses={options.statuses}
        onSubmit={submitWith(bulkChangeStatus, "Updated")}
      />

      <Button variant="ghost" size="sm" onClick={onClear}>
        <X aria-hidden />
        Clear
      </Button>

      {!canCheckOut && (
        <p className="basis-full text-xs text-muted-foreground">
          To check out, select assets that go to the same kind of holder:
          people, companies or locations.
        </p>
      )}
    </div>
  );
}

type StatusDialogProps = {
  title: string;
  statuses: BulkActionOptions["statuses"];
  onSubmit: AssignmentSubmit<StatusChangeValues>;
};

// Gives the selection a new status, e.g. "In repair". Holders stay.
function StatusDialog({ title, statuses, onSubmit }: StatusDialogProps) {
  const [statusId, setStatusId] = useState<number | null>(null);

  return (
    <AssignmentDialog
      triggerLabel="Change status"
      triggerIcon={CircleDot}
      title={title}
      description="Who or where they are assigned to stays the same."
      submitLabel="Change status"
      notePlaceholder="Optional, e.g. Sent for repair, ticket 1234"
      onOpen={() => setStatusId(null)}
      onSubmit={(note) => onSubmit({ statusId, note })}
    >
      {(fieldErrors, clearFieldError) => (
        <ChoiceField
          label="New status"
          value={statusId}
          onChange={(id) => {
            setStatusId(id);
            clearFieldError("statusId");
          }}
          choices={statuses}
          placeholder="Choose a status"
          error={fieldErrors.statusId}
          description="Archived only works for assets that are checked in."
        />
      )}
    </AssignmentDialog>
  );
}

type OutcomeMessageProps = {
  outcome: Outcome;
  onDismiss: () => void;
};

// e.g. "Checked out 2 assets. Skipped 1: PC-00007 — In repair assets cannot
// be checked out."
function OutcomeMessage({ outcome, onDismiss }: OutcomeMessageProps) {
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
