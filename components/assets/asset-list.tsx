import { connection } from "next/server";
import { type AssetListFilter, listAssets } from "@/lib/assets/queries";

// Temporary list view; replaced by the data table in the next step.
export async function AssetList({ filter }: { filter?: AssetListFilter }) {
  // Inventory must always be fresh: render at request time, never at build time.
  await connection();
  const assets = await listAssets(filter);

  if (assets.length === 0) {
    return <p className="text-sm text-muted-foreground">No assets found.</p>;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {assets.map((asset) => (
        <li
          key={asset.id}
          className="flex items-center justify-between gap-4 px-4 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {asset.assetTag ?? asset.name ?? `#${asset.id}`}
            </p>
            <p className="truncate text-muted-foreground">
              {[asset.model?.manufacturer, asset.model?.name]
                .filter(Boolean)
                .join(" ")}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p>{asset.status.name}</p>
            <p className="text-muted-foreground">
              {asset.assignedTo?.displayName ?? asset.company?.name ?? "—"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AssetListFallback() {
  return <p className="text-sm text-muted-foreground">Loading assets…</p>;
}
