import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AssetTypeIcon } from "@/components/assets/asset-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assetTypeConfigs, getAssetTypePath } from "@/lib/assets/asset-types";
import { countAssetsByType } from "@/lib/assets/queries";

function AssetsByTypeCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets by type</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Every type with its count; the bar compares it with the largest type.
// A row opens the type's list.
export async function AssetsByType() {
  // Live counts: rendered per request, never prerendered.
  await connection();
  const counts = await countAssetsByType();
  const largest = Math.max(1, ...Object.values(counts));

  return (
    <AssetsByTypeCard>
      <ul className="-mx-2 flex flex-col">
        {assetTypeConfigs.map((config) => {
          const count = counts[config.type];

          return (
            <li key={config.type}>
              <Link
                href={getAssetTypePath(config.slug)}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <AssetTypeIcon type={config.type} />
                <span className="w-32 shrink-0 text-sm">{config.label}</span>
                <span
                  aria-hidden
                  className="h-1.5 flex-1 rounded-full bg-muted"
                >
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${(count / largest) * 100}%` }}
                  />
                </span>
                <span className="w-10 text-right text-sm font-medium tabular-nums">
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </AssetsByTypeCard>
  );
}

export function AssetsByTypeFallback() {
  return (
    <AssetsByTypeCard>
      <div aria-busy className="flex flex-col gap-3">
        {assetTypeConfigs.map((config) => (
          <Skeleton key={config.type} className="h-5" />
        ))}
      </div>
    </AssetsByTypeCard>
  );
}
