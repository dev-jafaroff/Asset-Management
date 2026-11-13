import {
  ArrowDownToLine,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "@/components/shared/icon-tile";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listAssetHistory,
  type AssetHistoryEvent,
  type FieldChange,
} from "@/lib/assets/asset-detail";
import type { AssetEventType } from "@/lib/generated/prisma/enums";
import { DateTime } from "@/components/shared/date-time";

type EventStyle = {
  label: string;
  icon: LucideIcon;
  // Colors of the icon tile; empty keeps the muted default.
  tone?: string;
  // Joins the label and the person, e.g. "Checked out to Aysel Huseynova".
  targetPreposition?: string;
};

const eventStyles: Record<AssetEventType, EventStyle> = {
  CREATED: { label: "Created", icon: Plus },
  UPDATED: { label: "Updated", icon: Pencil },
  CHECKOUT: {
    label: "Checked out",
    icon: LogOut,
    tone: "bg-primary/10 text-primary",
    targetPreposition: "to",
  },
  CHECKIN: { label: "Checked in", icon: LogIn, targetPreposition: "from" },
  SYNC: {
    label: "Intune sync",
    icon: RefreshCw,
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  IMPORTED: {
    label: "Imported from Snipe-IT",
    icon: ArrowDownToLine,
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

function HistoryCard({
  count,
  children,
}: {
  count?: number;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        {count !== undefined && (
          <CardAction className="text-xs text-muted-foreground">
            {count === 1 ? "1 event" : `${count} events`}
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChangeList({ changes }: { changes: FieldChange[] }) {
  return (
    <ul className="mt-1.5 space-y-0.5 rounded-md bg-muted px-2.5 py-1.5 text-xs">
      {changes.map(({ field, from, to }) => (
        <li key={field}>
          {field} <del className="text-muted-foreground">{from ?? "—"}</del>
          {" → "}
          <ins className="no-underline">{to ?? "—"}</ins>
        </li>
      ))}
    </ul>
  );
}

function HistoryEntry({
  event,
  isLast,
}: {
  event: AssetHistoryEvent;
  isLast: boolean;
}) {
  const style = eventStyles[event.type];
  const target = style.targetPreposition && event.targetUser;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* Line joining this event to the next (older) one. */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute top-8.5 bottom-1 left-3.75 w-px bg-border"
        />
      )}
      <IconTile icon={style.icon} size="md" className={style.tone} />
      <div className="min-w-0 flex-1 pt-1">
        <p>
          <span className="font-medium">{style.label}</span>
          {target && (
            <>
              {` ${style.targetPreposition} `}
              <span className="font-medium text-primary">
                {target.displayName}
              </span>
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.actor && `by ${event.actor.displayName} · `}
          <DateTime date={event.createdAt} />
        </p>
        {event.changes.length > 0 && <ChangeList changes={event.changes} />}
        {event.note && (
          <p className="mt-1.5 text-xs whitespace-pre-wrap text-muted-foreground italic">
            “{event.note}”
          </p>
        )}
      </div>
    </li>
  );
}

// Everything that happened to the asset, newest first (from AssetEvent).
export async function AssetHistory({ assetId }: { assetId: number }) {
  const events = await listAssetHistory(assetId);

  return (
    <HistoryCard count={events.length}>
      {events.length === 0 ? (
        <p className="text-muted-foreground">No history yet.</p>
      ) : (
        <ol>
          {events.map((event, index) => (
            <HistoryEntry
              key={event.id}
              event={event}
              isLast={index === events.length - 1}
            />
          ))}
        </ol>
      )}
    </HistoryCard>
  );
}

export function AssetHistoryFallback() {
  return (
    <HistoryCard>
      <p className="text-muted-foreground">Loading history…</p>
    </HistoryCard>
  );
}
