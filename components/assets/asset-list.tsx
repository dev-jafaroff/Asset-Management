import { AssetTable } from "@/components/assets/asset-table";
import { StatusTabs } from "@/components/assets/status-tabs";
import {
  getPageCount,
  ListPagination,
} from "@/components/shared/list-pagination";
import { SearchForm } from "@/components/shared/search-form";
import {
  ASSET_PAGE_SIZE,
  countAssets,
  listAssets,
  listStatusLabels,
} from "@/lib/assets/queries";
import {
  ALL_STATUS_SLUG,
  buildStatusTabs,
  findStatusTab,
  STATUS_PARAM,
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

  const tabs = buildStatusTabs(await listStatusLabels());
  const activeTab = findStatusTab(tabs, getParam(params, STATUS_PARAM));

  // Tab counts follow the search, so they show where the matches are.
  const counts = await Promise.all(
    tabs.map((tab) => countAssets({ type, search, status: tab.where })),
  );
  const total = counts[tabs.indexOf(activeTab)];
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
        preserve={{
          [STATUS_PARAM]:
            activeTab.slug === ALL_STATUS_SLUG ? undefined : activeTab.slug,
        }}
        className="max-w-sm"
      />

      <StatusTabs
        activeSlug={activeTab.slug}
        tabs={tabs.map((tab, index) => ({
          slug: tab.slug,
          label: tab.label,
          color: tab.color,
          count: counts[index],
          href: buildHref(basePath, params, {
            [STATUS_PARAM]: tab.slug === ALL_STATUS_SLUG ? undefined : tab.slug,
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
