"use client";

import { BellRing } from "lucide-react";
import { requestIntuneCheckIn } from "@/app/(app)/assets/[type]/[id]/actions";
import { SyncingCloud } from "@/components/assets/asset-icons";
import { SyncMessageBox, useSyncAction } from "@/components/sync/sync-button";
import { Button } from "@/components/ui/button";

// "Request check-in" under the Intune card's fields: asks the device to
// check in with Intune now instead of at its next scheduled check-in (about
// every 8 hours). Its new data arrives with a later sync.
export function IntuneCheckInButton({ assetId }: { assetId: number }) {
  const { isPending, message, run, dismiss } = useSyncAction(() =>
    requestIntuneCheckIn(assetId),
  );

  return (
    <div className="relative border-t pt-3">
      <Button
        variant="outline"
        size="sm"
        onClick={run}
        disabled={isPending}
        title="Ask the device to check in with Intune now, instead of at its next scheduled check-in."
      >
        {isPending ? <SyncingCloud /> : <BellRing aria-hidden />}
        {isPending ? "Requesting…" : "Request check-in"}
      </Button>
      {message && (
        <SyncMessageBox
          message={message}
          onDismiss={dismiss}
          className="absolute top-full left-0 z-20 mt-2 w-80 bg-popover shadow-md"
        />
      )}
    </div>
  );
}
