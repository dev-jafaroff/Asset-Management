import { AssetFilters } from "@/components/assets/asset-filters";
import { AssetTable } from "@/components/assets/asset-table";
import { ColumnMenu } from "@/components/assets/column-menu";
import { StatusTabs } from "@/components/assets/status-tabs";
import { ExportButton } from "@/components/shared/export-button";
import { ListSearch } from "@/components/shared/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBulkActionOptions,
  type BulkActionOptions,
} from "@/lib/assets/asset-form-options";
import {
  ASSET_EXPORT_PATH,
  ASSET_EXPORT_TYPE_PARAM,
  assignTargets,
  getAssetTypeConfig,
} from "@/lib/assets/asset-types";
import {
  listAssets,
  listStatusTabsWithCounts,
  parseAssetListParams,
} from "@/lib/assets/queries";
import {
  findStatusTab,
  STATUS_PARAM,
  toStatusParam,
} from "@/lib/assets/status-filters";
import { getCurrentUser } from "@/lib/current-user";
import type { AssetType } from "@/lib/generated/prisma/enums";
import { can } from "@/lib/permissions";
import { buildHref, type SearchParams } from "@/lib/search-params";

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

// The lists of the bulk action dialogs, for people who may use them. A type
// list needs the holders of its type only; "All assets" those of every type.
async function loadBulkOptions(
  type: AssetType | undefined,
): Promise<BulkActionOptions | undefined> {
  const user = await getCurrentUser();
  if (!can(user.role, "asset:edit")) return undefined;
  return getBulkActionOptions(
    type ? [getAssetTypeConfig(type).assignTo] : assignTargets,
  );
}

// Reading searchParams makes this render per request, so the list is always fresh.
export async function AssetList({
  type,
  basePath,
  searchParams,
}: AssetListProps) {
  const params = await searchParams;
  const { search, filters, statusSlug } = parseAssetListParams(params);

  // Tab counts follow the search and filters, so they show where the matches are.
  const tabs = await listStatusTabsWithCounts({ type, search, filters });
  const activeTab = findStatusTab(tabs, statusSlug);

  const [assets, bulkOptions] = await Promise.all([
    listAssets({ type, search, filters, status: activeTab.where }),
    loadBulkOptions(type),
  ]);

  return (
    <div className="flex min-h-0 flex-col gap-4">
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
        actions={
          <div className="flex gap-2">
            <ExportButton
              href={buildHref(ASSET_EXPORT_PATH, params, {
                [ASSET_EXPORT_TYPE_PARAM]:
                  type && getAssetTypeConfig(type).slug,
              })}
            />
            <ColumnMenu type={type} />
          </div>
        }
        tabs={tabs.map((tab) => ({
          slug: tab.slug,
          label: tab.label,
          color: tab.color,
          count: tab.count,
          href: buildHref(basePath, params, {
            [STATUS_PARAM]: toStatusParam(tab.slug),
          }),
        }))}
      />

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {getEmptyMessage(search, Object.keys(filters).length > 0)}
        </p>
      ) : (
        <AssetTable assets={assets} type={type} bulkOptions={bulkOptions} />
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
