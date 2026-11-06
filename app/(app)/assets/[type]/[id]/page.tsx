import {
  Building2,
  LockKeyhole,
  MapPin,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
  AssetHistory,
  AssetHistoryFallback,
} from "@/components/assets/asset-history";
import { AssetTypeIcon } from "@/components/assets/asset-icons";
import { StatusBadge } from "@/components/assets/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { DetailList } from "@/components/shared/detail-list";
import { IconTile } from "@/components/shared/icon-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  assetSourceLabels,
  buildDetailSections,
  getAssetDetail,
  getCheckedOutAt,
  type AssetDetail,
  type DetailSection,
} from "@/lib/assets/asset-detail";
import {
  ASSETS_PATH,
  getAssetPath,
  getAssetTypeBySlug,
  getAssetTypeConfig,
  getAssetTypePath,
  type AssignTarget,
} from "@/lib/assets/asset-types";
import {
  formatModelName,
  getAssetDisplayName,
  getAssetDisplayStatus,
  getAssetHolder,
} from "@/lib/assets/format";
import { getPositiveIntParam } from "@/lib/search-params";
import { formatDateTime } from "@/lib/utils";

type AssetPageProps = PageProps<"/assets/[type]/[id]">;

// Shared by the page and its metadata; cached per request (see getAssetDetail).
async function loadAsset(params: AssetPageProps["params"]) {
  const route = await params;
  const id = getPositiveIntParam(route, "id");
  const asset = id === undefined ? null : await getAssetDetail(id);
  if (!asset) notFound();

  // An old or hand-typed link with the wrong type (e.g. /assets/monitors/7
  // for a PC) goes to the asset's real page.
  if (getAssetTypeBySlug(route.type)?.type !== asset.type) {
    redirect(getAssetPath(asset.type, asset.id));
  }
  return asset;
}

export async function generateMetadata({
  params,
}: AssetPageProps): Promise<Metadata> {
  const asset = await loadAsset(params);
  return { title: getAssetDisplayName(asset) };
}

// The asset is read per request, so it streams in after the layout.
export default function AssetPage({ params }: AssetPageProps) {
  return (
    <Suspense fallback={<AssetPageFallback />}>
      <AssetPageContent params={params} />
    </Suspense>
  );
}

function AssetPageFallback() {
  return <p className="text-sm text-muted-foreground">Loading asset…</p>;
}

async function AssetPageContent({ params }: Pick<AssetPageProps, "params">) {
  const asset = await loadAsset(params);
  const config = getAssetTypeConfig(asset.type);
  const title = getAssetDisplayName(asset);
  const sourceLabel = assetSourceLabels[asset.source];

  // e.g. "Dell Latitude 5440 · WS-00007"; whatever is already the title is left out.
  const description = [formatModelName(asset.model), asset.name]
    .filter((part) => part && part !== title)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={title}
        description={description || undefined}
        breadcrumbs={[
          { label: "Assets", href: ASSETS_PATH },
          { label: config.label, href: getAssetTypePath(config.slug) },
          { label: title },
        ]}
        badges={
          <>
            <StatusBadge status={getAssetDisplayStatus(asset)} />
            {sourceLabel && <Badge variant="outline">{sourceLabel}</Badge>}
          </>
        }
      />

      {/* Main column with the cards; history on the right on wide screens. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-4">
          <AssignmentCard asset={asset} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {buildDetailSections(asset).map((section) => (
              <DetailCard key={section.title} section={section} />
            ))}
          </div>
        </div>

        {/* A long history must not hold back the cards above. */}
        <Suspense fallback={<AssetHistoryFallback />}>
          <AssetHistory assetId={asset.id} />
        </Suspense>
      </div>
    </>
  );
}

// ─── Assignment ──────────────────────────────────────────────────────────────

const holderIcons: Record<AssignTarget, LucideIcon> = {
  user: UserRound,
  company: Building2,
  location: MapPin,
};

// Second line under the holder: who the person is, or what kind of holder it is.
const holderDetails: Record<AssignTarget, (asset: AssetDetail) => string> = {
  user: ({ assignedTo }) =>
    [assignedTo?.department, assignedTo?.jobTitle, assignedTo?.email]
      .filter(Boolean)
      .join(" · "),
  company: () => "Company",
  location: () => "Location",
};

function AssignmentCard({ asset }: { asset: AssetDetail }) {
  const { assignTo } = getAssetTypeConfig(asset.type);
  const holder = getAssetHolder(asset);
  const checkedOutAt = getCheckedOutAt(asset);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment</CardTitle>
      </CardHeader>
      <CardContent>
        {holder ? (
          <div className="flex flex-wrap items-center gap-3">
            <IconTile icon={holderIcons[assignTo]} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{holder}</p>
              <p className="text-xs text-muted-foreground">
                {holderDetails[assignTo](asset)}
              </p>
            </div>
            {checkedOutAt && (
              <p className="text-right text-xs text-muted-foreground">
                Checked out
                <br />
                <span className="font-medium text-foreground">
                  {formatDateTime(checkedOutAt)}
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <AssetTypeIcon type={asset.type} size="md" />
            <p className="text-muted-foreground">
              Not assigned to a {assignTo}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Details ─────────────────────────────────────────────────────────────────

function DetailCard({ section }: { section: DetailSection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {section.title}
          {section.readOnly && (
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <LockKeyhole aria-hidden className="size-3" />
              read-only
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DetailList items={section.fields} />
      </CardContent>
    </Card>
  );
}
