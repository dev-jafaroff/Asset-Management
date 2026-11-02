import { AssetTable } from "@/components/assets/asset-table";
import { StatusTabs } from "@/components/assets/status-tabs";
import {
  countAssets,
  listAssets,
  listStatusLabels,
} from "@/lib/assets/queries";
import { buildStatusTabs, findStatusTab } from "@/lib/assets/status-filters";
import type { AssetType } from "@/lib/generated/prisma/enums";

type AssetListProps = {
  // Omitted on "All assets".
  type?: AssetType;
  basePath: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Reading searchParams makes this render per request, so the list is always fresh.
export async function AssetList({
  type,
  basePath,
  searchParams,
}: AssetListProps) {
  const { status } = await searchParams;
  const tabs = buildStatusTabs(await listStatusLabels());
  const activeTab = findStatusTab(
    tabs,
    typeof status === "string" ? status : undefined,
  );

  const [assets, counts] = await Promise.all([
    listAssets({ type, status: activeTab.where }),
    Promise.all(tabs.map((tab) => countAssets({ type, status: tab.where }))),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <StatusTabs
        basePath={basePath}
        activeSlug={activeTab.slug}
        tabs={tabs.map((tab, index) => ({
          slug: tab.slug,
          label: tab.label,
          color: tab.color,
          count: counts[index],
        }))}
      />

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assets with this status.
        </p>
      ) : (
        <AssetTable assets={assets} type={type} />
      )}
    </div>
  );
}

export function AssetListFallback() {
  return <p className="text-sm text-muted-foreground">Loading assets…</p>;
}
