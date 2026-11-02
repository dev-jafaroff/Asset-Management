import { connection } from "next/server";
import { AssetTable } from "@/components/assets/asset-table";
import { type AssetListFilter, listAssets } from "@/lib/assets/queries";

export async function AssetList({ filter = {} }: { filter?: AssetListFilter }) {
  // Inventory must always be fresh: render at request time, never at build time.
  await connection();
  const assets = await listAssets(filter);

  if (assets.length === 0) {
    return <p className="text-sm text-muted-foreground">No assets found.</p>;
  }

  return <AssetTable assets={assets} type={filter.type} />;
}

export function AssetListFallback() {
  return <p className="text-sm text-muted-foreground">Loading assets…</p>;
}
