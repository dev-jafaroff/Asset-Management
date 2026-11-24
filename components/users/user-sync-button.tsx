"use client";

import { RefreshCw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { syncUsersNow } from "@/app/(app)/users/actions";
import { Button } from "@/components/ui/button";
import type { SyncMessage } from "@/lib/sync/sync-run";
import { cn } from "@/lib/utils";

// "Sync now": pulls the employees from Entra ID instead of waiting for the
// schedule, then says what changed.
export function UserSyncButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<SyncMessage | null>(null);

  function sync() {
    setMessage(null);
    startTransition(async () => setMessage(await syncUsersNow()));
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="outline" onClick={sync} disabled={isPending}>
        <RefreshCw aria-hidden className={cn(isPending && "animate-spin")} />
        {isPending ? "Syncing…" : "Sync from Entra"}
      </Button>
      {message && (
        <div
          role="status"
          className={cn(
            "flex max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            message.ok
              ? "bg-muted/50"
              : "border-destructive/40 bg-destructive/5",
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
            onClick={() => setMessage(null)}
            aria-label="Dismiss"
          >
            <X aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
