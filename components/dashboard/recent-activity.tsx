import Link from "next/link";
import { connection } from "next/server";
import {
  History,
  HistoryFallback,
  type HistorySubject,
} from "@/components/assets/asset-history";
import type { AssetEventWithAsset } from "@/lib/assets/asset-detail";
import { getAssetPath } from "@/lib/assets/asset-types";
import { getAssetDisplayName } from "@/lib/assets/format";
import { listRecentActivity } from "@/lib/dashboard/queries";
import { getUserPath } from "@/lib/users/queries";

const TITLE = "Recent activity";

// The asset, and for a checkout or checkin the person too, e.g.
// "PC-00016 to Shane Predovic". Both link to their pages.
const recentEventSubject: HistorySubject<AssetEventWithAsset> = (
  event,
  style,
) => (
  <>
    <Link
      href={getAssetPath(event.asset.type, event.asset.id)}
      className="font-medium text-primary hover:underline"
    >
      {getAssetDisplayName(event.asset)}
    </Link>
    {style.targetPreposition && event.targetUser && (
      <>
        {` ${style.targetPreposition} `}
        <Link
          href={getUserPath(event.targetUser.id)}
          className="font-medium text-primary hover:underline"
        >
          {event.targetUser.displayName}
        </Link>
      </>
    )}
  </>
);

export async function RecentActivity() {
  // Live data: rendered per request, never prerendered.
  await connection();
  const events = await listRecentActivity();
  return <History title={TITLE} events={events} subject={recentEventSubject} />;
}

export function RecentActivityFallback() {
  return <HistoryFallback title={TITLE} />;
}
