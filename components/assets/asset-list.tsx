import { AssetFilters } from "@/components/assets/asset-filters";
import { AssetTable } from "@/components/assets/asset-table";
import { ColumnMenu } from "@/components/assets/column-menu";
import { StatusTabs } from "@/components/assets/status-tabs";
import {
  getPageCount,
  ListPagination,
} from "@/components/shared/list-pagination";
import { ListSearch } from "@/components/shared/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { parseAssetFilters } from "@/lib/assets/asset-filters";
import {
  ASSET_PAGE_SIZE,
  listAssets,
  listStatusTabsWithCounts,
} from "@/lib/assets/queries";
import {
  findStatusTab,
  STATUS_PARAM,
  toStatusParam,
} from "@/lib/assets/status-filters";
import type { AssetType } from "@/lib/generated/prisma/enums";
import {
  buildHref,
  getPageParam,
  getParam,
  PAGE_PARAM,
  SEARCH_PARAM,
  type SearchParams,
} from "@/lib/search-params";

type AssetListProps = {
  // Omitted on "All assets".
  type?: AssetType;
  basePath: string;
  searchParams: Promise<SearchParams>;
};

// Says what narrowed the list, so a forgotten filter is easy to spot.
function getEmptyMessage(search: string | undefined, hasFilters: boolean) {
  const query = search ? ` “${search}”` : "";
  if (hasFilters) return `No assets match${query} with the current filters.`;
  if (search) return `No assets match${query}.`;
  return "No assets with this status.";
}

// Reading searchParams makes this render per request, so the list is always fresh.
export async function AssetList({
  type,
  basePath,
  searchParams,
}: AssetListProps) {
  const params = await searchParams;
  const search = getParam(params, SEARCH_PARAM);
  const filters = parseAssetFilters(params);

  // Tab counts follow the search and filters, so they show where the matches are.
  const tabs = await listStatusTabsWithCounts({ type, search, filters });
  const activeTab = findStatusTab(tabs, getParam(params, STATUS_PARAM));
  const total = activeTab.count;
  const pageCount = getPageCount(total, ASSET_PAGE_SIZE);
  // A page past the end (e.g. after a search narrowed the list) shows the last page.
  const page = Math.min(getPageParam(params), pageCount);

  const assets = await listAssets(
    { type, search, filters, status: activeTab.where },
    page,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ListSearch
          label="Search this list"
          placeholder="Search by tag, serial, model or user"
          className="max-w-sm"
        />
        <AssetFilters
          type={type}
          values={filters}
          basePath={basePath}
          params={params}
        />
      </div>

      <StatusTabs
        activeSlug={activeTab.slug}
        actions={<ColumnMenu type={type} />}
        tabs={tabs.map((tab) => ({
          slug: tab.slug,
          label: tab.label,
          color: tab.color,
          count: tab.count,
          href: buildHref(basePath, params, {
            [STATUS_PARAM]: toStatusParam(tab.slug),
            [PAGE_PARAM]: undefined,
          }),
        }))}
      />

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {getEmptyMessage(search, Object.keys(filters).length > 0)}
        </p>
      ) : (
        <>
          <AssetTable assets={assets} type={type} />
          <ListPagination
            page={page}
            pageCount={pageCount}
            pageSize={ASSET_PAGE_SIZE}
            total={total}
            pathname={basePath}
            params={params}
          />
        </>
      )}
    </div>
  );
}

const FALLBACK_ROWS = 8;

// Outline of the toolbar, tabs and table while the list loads.
export function AssetListFallback() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full max-w-sm" />
      <Skeleton className="h-9 w-full max-w-2xl" />
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        {Array.from({ length: FALLBACK_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-5" />
        ))}
      </div>
      <span className="sr-only">Loading assets…</span>
    </div>
  );
}
