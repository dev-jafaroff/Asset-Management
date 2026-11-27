"use client";

import { RefreshCw, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { runSyncNow } from "@/app/(app)/admin/sync/actions";
import {
  SYNC_ANIMATION_MS,
  SyncingCloud,
} from "@/components/assets/asset-icons";
import { Button } from "@/components/ui/button";
import type { SyncMessage } from "@/lib/sync/sync-run";
import { cn } from "@/lib/utils";

// A clean run's message goes away by itself; one with problems stays until
// it is dismissed, so it can be read.
const SUCCESS_MESSAGE_MS = 5000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Runs a sync and keeps what it said: shared by the sync buttons and the
// Intune card's title on an asset's page. "Syncing" lasts at least one trip
// of the cloud's colors, so a sync of one device (a fraction of a second)
// still shows it moving.
export function useSyncAction(action: () => Promise<SyncMessage>) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<SyncMessage | null>(null);

  useEffect(() => {
    if (!message?.ok) return;
    const timer = setTimeout(() => setMessage(null), SUCCESS_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const [result] = await Promise.all([action(), wait(SYNC_ANIMATION_MS)]);
      setMessage(result);
    });
  }

  return { isPending, message, run, dismiss: () => setMessage(null) };
}

// What a sync did, with its problems listed under it.
export function SyncMessageBox({
  message,
  onDismiss,
  className,
}: {
  message: SyncMessage;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        message.ok ? "bg-muted/50" : "border-destructive/40 bg-destructive/5",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{message.text}</p>
        {message.errors.length > 0 && (
          <ul className="list-inside list-disc text-muted-foreground">
            {message.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
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

type SyncButtonProps = {
  // A SyncKind of lib/sync/sync-jobs.ts.
  kind: string;
  label: string;
};

// Runs a sync now instead of waiting for the schedule, then says what
// changed, in a box that opens under the button over what follows.
export function SyncButton({ kind, label }: SyncButtonProps) {
  const { isPending, message, run, dismiss } = useSyncAction(() =>
    runSyncNow(kind),
  );

  return (
    <div className="relative">
      <Button variant="outline" onClick={run} disabled={isPending}>
        {isPending ? <SyncingCloud /> : <RefreshCw aria-hidden />}
        {isPending ? "Syncing…" : label}
      </Button>
      {message && (
        <SyncMessageBox
          message={message}
          onDismiss={dismiss}
          className="absolute top-full right-0 z-20 mt-2 w-80 bg-popover shadow-md"
        />
      )}
    </div>
  );
}
