"use client";

import { useState, type ReactNode } from "react";
import { CheckinDialog } from "@/components/assets/checkin-dialog";
import {
  BulkOutcomeMessage,
  handleBulkResult,
  type BulkOutcome,
} from "@/components/shared/bulk-outcome";
import type { Choice } from "@/components/shared/choice-select";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BulkActionResult } from "@/lib/assets/bulk-actions";
import { formatAccessoryCount } from "@/lib/schemas/accessory";
import type { CheckinValues } from "@/lib/schemas/asset";
import { formatCount } from "@/lib/utils";

// "Check in all": only given to people who may edit, when there is something
// to take back.
type CheckInAll = {
  userName: string;
  // Pieces of accessories that come back with the assets.
  accessories: number;
  statuses: Choice[];
  defaultStatusId: number | null;
  onSubmit: (values: CheckinValues) => Promise<BulkActionResult>;
};

type UserAssetsCardProps = {
  count: number;
  checkIn: CheckInAll | null;
  // The asset table, or a note when there is none.
  children: ReactNode;
};

// e.g. "Take back all 3 assets and 2 accessories. Each asset gets its own
// history entry."
function describeCheckInAll(assets: number, accessories: number): string {
  const items =
    accessories > 0
      ? `${formatCount(assets, "asset")} and ${formatAccessoryCount(accessories)}`
      : formatCount(assets, "asset");
  return `Take back all ${items}. Each asset gets its own history entry.`;
}

// Everything the person holds. "Check in all" takes it back in one go, e.g.
// when they leave, and then says what was done and what was skipped.
export function UserAssetsCard({
  count,
  checkIn,
  children,
}: UserAssetsCardProps) {
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned assets</CardTitle>
        <CardAction className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {formatCount(count, "asset")}
          </span>
          {checkIn && (
            <CheckinDialog
              triggerLabel="Check in all"
              title={`Check in all from ${checkIn.userName}`}
              description={describeCheckInAll(count, checkIn.accessories)}
              statuses={checkIn.statuses}
              defaultStatusId={checkIn.defaultStatusId}
              onSubmit={async (values) =>
                handleBulkResult(
                  await checkIn.onSubmit(values),
                  "Checked in",
                  setOutcome,
                )
              }
            />
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {outcome && (
          <BulkOutcomeMessage
            outcome={outcome}
            onDismiss={() => setOutcome(null)}
          />
        )}
        {children}
      </CardContent>
    </Card>
  );
}
