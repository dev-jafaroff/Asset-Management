import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AssetTypeIcon } from "@/components/assets/asset-icons";
import { StatusDot } from "@/components/assets/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  assetTypeConfigs,
  getAssetTypeConfig,
  getAssetTypePath,
} from "@/lib/assets/asset-types";
import { STATUS_PARAM } from "@/lib/assets/status-filters";
import {
  listTypeBreakdowns,
  type TypeBreakdown,
  type TypeStatusCount,
} from "@/lib/dashboard/queries";
import { buildHref } from "@/lib/search-params";

function AssetsByTypeCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets by type</CardTitle>
        <CardDescription>
          How each type is split by status. Archived assets are not counted.
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// The type's list opened on one status tab, e.g. "/assets/pcs?status=in-storage".
function getStatusHref(typeSlug: string, status: TypeStatusCount): string {
  return buildHref(
    getAssetTypePath(typeSlug),
    {},
    { [STATUS_PARAM]: status.slug },
  );
}

// Each type with a bar split by status (as wide as the type's own total, so
// every type reads on its own) and the counts under it. A part of the bar or
// a count opens the type's list on that status.
export async function AssetsByType() {
  // Live counts: rendered per request, never prerendered.
  await connection();
  const breakdowns = await listTypeBreakdowns();

  return (
    <AssetsByTypeCard>
      <ul className="flex flex-col gap-4">
        {breakdowns.map((breakdown) => (
          <TypeRow key={breakdown.type} breakdown={breakdown} />
        ))}
      </ul>
    </AssetsByTypeCard>
  );
}

function TypeRow({ breakdown }: { breakdown: TypeBreakdown }) {
  const config = getAssetTypeConfig(breakdown.type);

  return (
    <li className="flex items-start gap-3">
      <AssetTypeIcon type={breakdown.type} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            href={getAssetTypePath(config.slug)}
            className="text-sm font-medium hover:text-primary hover:underline"
          >
            {config.label}
          </Link>
          <span className="text-sm font-semibold tabular-nums">
            {breakdown.total}
          </span>
        </div>

        {breakdown.total === 0 ? (
          <>
            <span aria-hidden className="h-2 rounded-full bg-muted" />
            <span className="text-xs text-muted-foreground">None yet</span>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="flex h-2 gap-0.5 overflow-hidden rounded-full"
            >
              {breakdown.statuses.map((status) => (
                <Link
                  key={status.slug}
                  href={getStatusHref(config.slug, status)}
                  tabIndex={-1}
                  title={`${status.count} ${status.label}`}
                  className="min-w-1 transition-opacity hover:opacity-75"
                  style={{
                    flex: `${status.count} 1 0`,
                    backgroundColor: status.color,
                  }}
                />
              ))}
            </span>
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {breakdown.statuses.map((status) => (
                <Link
                  key={status.slug}
                  href={getStatusHref(config.slug, status)}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <StatusDot color={status.color} />
                  <span className="font-medium text-foreground tabular-nums">
                    {status.count}
                  </span>
                  {status.label}
                </Link>
              ))}
            </span>
          </>
        )}
      </div>
    </li>
  );
}

export function AssetsByTypeFallback() {
  return (
    <AssetsByTypeCard>
      <div aria-busy className="flex flex-col gap-4">
        {assetTypeConfigs.map((config) => (
          <Skeleton key={config.type} className="h-12" />
        ))}
      </div>
    </AssetsByTypeCard>
  );
}
