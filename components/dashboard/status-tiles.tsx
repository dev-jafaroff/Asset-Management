import Link from "next/link";
import { connection } from "next/server";
import { StatusDot } from "@/components/assets/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ASSETS_PATH } from "@/lib/assets/asset-types";
import { getStatusCounts } from "@/lib/assets/queries";
import {
  ALL_STATUS_SLUG,
  STATUS_PARAM,
  toStatusParam,
} from "@/lib/assets/status-filters";
import { buildHref } from "@/lib/search-params";

const tileGrid = "grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7";

// "All assets" opened on one status tab, e.g. "/assets?status=in-repair".
function getStatusListHref(slug: string): string {
  return buildHref(ASSETS_PATH, {}, { [STATUS_PARAM]: toStatusParam(slug) });
}

// One tile per status tab of "All assets", with the same counts as the
// sidebar. A tile opens the list on that tab.
export async function StatusTiles() {
  // Live counts: rendered per request, never prerendered.
  await connection();
  const tabs = await getStatusCounts();

  return (
    <nav aria-label="Assets by status" className={tileGrid}>
      {tabs.map((tab) => (
        <Link
          key={tab.slug}
          href={getStatusListHref(tab.slug)}
          className="flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
        >
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {tab.color && <StatusDot color={tab.color} />}
            {tab.slug === ALL_STATUS_SLUG ? "All assets" : tab.label}
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            {tab.count}
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function StatusTilesFallback() {
  return (
    <div aria-busy className={tileGrid}>
      {Array.from({ length: 7 }, (_, index) => (
        <Skeleton key={index} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
