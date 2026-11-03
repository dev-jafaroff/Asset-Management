import { AssetTable } from "@/components/assets/asset-table";
import { StatusTabs } from "@/components/assets/status-tabs";
import {
  getPageCount,
  ListPagination,
} from "@/components/shared/list-pagination";
import { SearchForm } from "@/components/shared/search-form";
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

// Reading searchParams makes this render per request, so the list is always fresh.
export async function AssetList({
  type,
  basePath,
  searchParams,
}: AssetListProps) {
  const params = await searchParams;
  const search = getParam(params, SEARCH_PARAM);

  // Tab counts follow the search, so they show where the matches are.
  const tabs = await listStatusTabsWithCounts({ type, search });
  const activeTab = findStatusTab(tabs, getParam(params, STATUS_PARAM));
  const total = activeTab.count;
  const pageCount = getPageCount(total, ASSET_PAGE_SIZE);
  // A page past the end (e.g. after a search narrowed the list) shows the last page.
  const page = Math.min(getPageParam(params), pageCount);

  const assets = await listAssets(
    { type, search, status: activeTab.where },
    page,
  );

  return (
    <div className="flex flex-col gap-4">
      <SearchForm
        action={basePath}
        label="Search this list"
        placeholder="Search by tag, serial, model or user"
        defaultValue={search}
        preserve={{ [STATUS_PARAM]: toStatusParam(activeTab.slug) }}
        className="max-w-sm"
      />

      <StatusTabs
        activeSlug={activeTab.slug}
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
          No assets match the current filters.
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

export function AssetListFallback() {
  return <p className="text-sm text-muted-foreground">Loading assets…</p>;
}
