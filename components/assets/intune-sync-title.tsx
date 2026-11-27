"use client";

import { syncAssetFromIntune } from "@/app/(app)/assets/[type]/[id]/actions";
import { SourceIcon, SyncingCloud } from "@/components/assets/asset-icons";
import { SyncMessageBox, useSyncAction } from "@/components/sync/sync-button";
import type { IntuneSyncStatus } from "@/lib/assets/asset-detail";

type IntuneSyncTitleProps = {
  assetId: number;
  syncStatus: IntuneSyncStatus;
};

// The Intune card's title at its own size, outlined like a badge so it reads
// as a button: pulls this one device from Intune now. The cloud's color says when the device last checked in
// with Intune; while the sync runs, colors travel around its outline.
export function IntuneSyncTitle({ assetId, syncStatus }: IntuneSyncTitleProps) {
  const { isPending, message, run, dismiss } = useSyncAction(() =>
    syncAssetFromIntune(assetId),
  );

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        title={`${syncStatus.label}. Click to sync this device now.`}
        className="-my-1 -ml-1 inline-flex cursor-pointer items-center gap-2 rounded-4xl border px-2.5 py-0.5 transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
      >
        {isPending ? (
          <SyncingCloud className="size-4" />
        ) : (
          <SourceIcon
            source="INTUNE"
            syncState={syncStatus.state}
            className="size-4"
          />
        )}
        {isPending ? "Syncing…" : "Intune"}
        <span className="sr-only">: {syncStatus.label}</span>
      </button>
      {message && (
        <SyncMessageBox
          message={message}
          onDismiss={dismiss}
          className="absolute top-full left-0 z-20 mt-2 w-72 bg-popover font-normal shadow-md"
        />
      )}
    </span>
  );
}
