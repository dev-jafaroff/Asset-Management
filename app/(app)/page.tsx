import { Suspense } from "react";
import {
  AssetsByType,
  AssetsByTypeFallback,
} from "@/components/dashboard/assets-by-type";
import {
  NeedsAttention,
  NeedsAttentionFallback,
} from "@/components/dashboard/needs-attention";
import {
  RecentActivity,
  RecentActivityFallback,
} from "@/components/dashboard/recent-activity";
import {
  StatusTiles,
  StatusTilesFallback,
} from "@/components/dashboard/status-tiles";
import { PageHeader } from "@/components/layout/page-header";

// Each part reads live data and streams in on its own, so a slow one does
// not hold back the rest.
export default function HomePage() {
  return (
    <div className="flex max-w-screen-2xl flex-col gap-4">
      <PageHeader title="Home" description="Overview of your IT assets." />

      <Suspense fallback={<StatusTilesFallback />}>
        <StatusTiles />
      </Suspense>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Suspense fallback={<NeedsAttentionFallback />}>
            <NeedsAttention />
          </Suspense>
          <Suspense fallback={<AssetsByTypeFallback />}>
            <AssetsByType />
          </Suspense>
        </div>
        <Suspense fallback={<RecentActivityFallback />}>
          <RecentActivity />
        </Suspense>
      </div>
    </div>
  );
}
