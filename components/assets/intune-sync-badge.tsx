"use client";

import { syncAssetFromIntune } from "@/app/(app)/assets/[type]/[id]/actions";
import { SourceIcon, SyncingCloud } from "@/components/assets/asset-icons";
import { SyncMessageBox, useSyncAction } from "@/components/sync/sync-button";
import { Badge } from "@/components/ui/badge";
import type { IntuneSyncStatus } from "@/lib/assets/asset-detail";

type IntuneSyncBadgeProps = {
  assetId: number;
  syncStatus: IntuneSyncStatus;
};

// The "Intune" badge of a linked asset, as a button: pulls this one device
// from Intune now. The cloud's color says when the device last checked in
// with Intune; while the sync runs, colors travel around its outline.
export function IntuneSyncBadge({ assetId, syncStatus }: IntuneSyncBadgeProps) {
  const { isPending, message, run, dismiss } = useSyncAction(() =>
    syncAssetFromIntune(assetId),
  );

  return (
    <span className="relative inline-flex">
      <Badge
        variant="outline"
        render={<button type="button" onClick={run} disabled={isPending} />}
        title={`Intune: ${syncStatus.label}. Click to sync this device now.`}
        className="cursor-pointer hover:bg-muted disabled:cursor-default"
      >
        {isPending ? (
          <SyncingCloud />
        ) : (
          <SourceIcon source="INTUNE" syncState={syncStatus.state} />
        )}
        {isPending ? "Syncing…" : "Intune"}
        <span className="sr-only">: {syncStatus.label}</span>
      </Badge>
      {message && (
        <SyncMessageBox
          message={message}
          onDismiss={dismiss}
          className="absolute top-full left-0 z-20 mt-2 w-72 bg-popover shadow-md"
        />
      )}
    </span>
  );
}
