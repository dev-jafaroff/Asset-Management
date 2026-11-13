"use client";

import { CircleDot, X } from "lucide-react";
import { useState } from "react";
import {
  bulkChangeStatus,
  bulkCheckIn,
  bulkCheckOut,
} from "@/app/(app)/assets/actions";
import {
  AssignmentDialog,
  ChoiceField,
  type AssignmentSubmit,
} from "@/components/assets/assignment-dialog";
import { CheckinDialog } from "@/components/assets/checkin-dialog";
import { CheckoutDialog } from "@/components/assets/checkout-dialog";
import {
  BulkOutcomeMessage,
  handleBulkResult,
  type BulkOutcome,
} from "@/components/shared/bulk-outcome";
import { Button } from "@/components/ui/button";
import type { BulkActionOptions } from "@/lib/assets/asset-form-options";
import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import type { BulkActionResult } from "@/lib/assets/bulk-actions";
import type { AssetListItem } from "@/lib/assets/queries";
import type { CheckoutValues, StatusChangeValues } from "@/lib/schemas/asset";
import { formatCount } from "@/lib/utils";

type BulkActionBarProps = {
  // The selected rows, in the list's order.
  selected: AssetListItem[];
  options: BulkActionOptions;
  onClear: () => void;
};

// Above an asset list: what is selected and what can be done with it, or,
// once an action ran, what it did.
export function BulkActionBar({
  selected,
  options,
  onClear,
}: BulkActionBarProps) {
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);

  // A new selection starts a new round, so the old summary goes.
  if (selected.length > 0 && outcome) setOutcome(null);

  if (selected.length === 0) {
    return outcome ? (
      <BulkOutcomeMessage
        outcome={outcome}
        onDismiss={() => setOutcome(null)}
      />
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
      return handleBulkResult(result, actionLabel, (outcome) => {
        setOutcome(outcome);
        onClear();
      });
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
