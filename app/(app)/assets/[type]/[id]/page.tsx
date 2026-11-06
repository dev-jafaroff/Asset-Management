import { Building2, ExternalLink, LockKeyhole, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ComponentProps, type ReactNode } from "react";
import {
  AssetHistory,
  AssetHistoryFallback,
} from "@/components/assets/asset-history";
import { AssetTypeIcon, SourceIcon } from "@/components/assets/asset-icons";
import { StatusBadge } from "@/components/assets/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { CopyButton } from "@/components/shared/copy-button";
import { DateTime } from "@/components/shared/date-time";
import { DetailList } from "@/components/shared/detail-list";
import { IconTile } from "@/components/shared/icon-tile";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildDetailSections,
  getAssetSourceBadge,
  getAssetDetail,
  getCheckedOutAt,
  type AssetDetail,
  type DetailField,
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
// Lists use the full width for their columns; a detail page is capped, so
// cards do not stretch into wide empty rows on large screens.
export default function AssetPage({ params }: AssetPageProps) {
  return (
    <div className="max-w-screen-2xl">
      <Suspense fallback={<AssetPageFallback />}>
        <AssetPageContent params={params} />
      </Suspense>
    </div>
  );
}

// Main column with the cards; history on the right on wide screens.
function AssetDetailGrid({
  main,
  aside,
}: {
  main: ReactNode;
  aside: ReactNode;
}) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-4">{main}</div>
      {aside}
    </div>
  );
}

// Outline of the page while the asset loads, so nothing jumps when it arrives.
function AssetPageFallback() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <AssetDetailGrid
        main={
          <>
            <Skeleton className="h-28 rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
            </div>
          </>
        }
        aside={<Skeleton className="h-96 rounded-xl" />}
      />
      <span className="sr-only">Loading asset…</span>
    </div>
  );
}

async function AssetPageContent({ params }: Pick<AssetPageProps, "params">) {
  const asset = await loadAsset(params);
  const config = getAssetTypeConfig(asset.type);
  const title = getAssetDisplayName(asset);

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
            {asset.assetTag && (
              <CopyButton
                value={asset.assetTag}
                label="asset tag"
                className="-ml-2"
              />
            )}
            <StatusBadge status={getAssetDisplayStatus(asset)} />
            <SourceBadge asset={asset} />
          </>
        }
      />

      <AssetDetailGrid
        main={
          <>
            <AssignmentCard asset={asset} />
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {buildDetailSections(asset).map((section) => (
                <DetailCard key={section.title} section={section} />
              ))}
            </div>
          </>
        }
        aside={
          // A long history must not hold back the cards above.
          <Suspense fallback={<AssetHistoryFallback />}>
            <AssetHistory assetId={asset.id} />
          </Suspense>
        }
      />
    </>
  );
}

// ─── Assignment ──────────────────────────────────────────────────────────────

// People get their initials; companies and locations an icon.
const holderAvatars: Record<AssignTarget, (holder: string) => ReactNode> = {
  user: (holder) => <UserAvatar name={holder} />,
  company: () => <IconTile icon={Building2} size="md" />,
  location: () => <IconTile icon={MapPin} size="md" />,
};

// The person's email opens a new mail.
function UserHolderDetails({ user }: { user: AssetDetail["assignedTo"] }) {
  if (!user) return null;
  const role = [user.department, user.jobTitle].filter(Boolean).join(" · ");
  return (
    <>
      {role}
      {role && user.email && " · "}
      {user.email && (
        <a
          href={`mailto:${user.email}`}
          className="hover:text-primary hover:underline"
        >
          {user.email}
        </a>
      )}
    </>
  );
}

// Second line under the holder: who the person is, or what kind of holder it is.
const holderDetails: Record<AssignTarget, (asset: AssetDetail) => ReactNode> = {
  user: ({ assignedTo }) => <UserHolderDetails user={assignedTo} />,
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
            {holderAvatars[assignTo](holder)}
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
                <DateTime
                  date={checkedOutAt}
                  className="font-medium text-foreground"
                />
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

// Links to another system (e.g. Intune) open in a new tab, so this page stays open.
function ExternalAnchor(props: ComponentProps<"a">) {
  return <a target="_blank" rel="noopener noreferrer" {...props} />;
}

// Where the record came from, e.g. "Intune" with a cloud icon. For Intune the
// cloud is colored by how fresh the data is (details on hover and in the
// Intune card, which also links to the device in Intune).
function SourceBadge({ asset }: { asset: AssetDetail }) {
  const badge = getAssetSourceBadge(asset);
  if (!badge) return null;
  const status = badge.syncStatus?.label;

  return (
    <Badge variant="outline" title={status && `${badge.label}: ${status}`}>
      <SourceIcon source={badge.source} syncState={badge.syncStatus?.state} />
      {badge.label}
      {status && <span className="sr-only">: {status}</span>}
    </Badge>
  );
}

// Dates as relative time, links (mailto:, tel:) and a copy button where set.
// Empty values stay null, so the list shows its dash.
function renderFieldValue(field: DetailField): ReactNode {
  const { value, href, copyable } = field;
  if (value === null || value === "") return null;
  if (value instanceof Date) return <DateTime date={value} />;

  const text = String(value);
  const content = href ? (
    <a href={href} className="text-primary hover:underline">
      {text}
    </a>
  ) : (
    text
  );
  if (!copyable) return content;

  return (
    <span className="inline-flex items-center gap-1">
      {content}
      <CopyButton
        value={text}
        label={field.label.toLowerCase()}
        className="-my-1"
      />
    </span>
  );
}

function DetailCard({ section }: { section: DetailSection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {section.source && (
            <SourceIcon
              source={section.source}
              syncState={section.syncState}
              className="size-4 text-primary"
            />
          )}
          {section.title}
          {section.readOnly && (
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <LockKeyhole aria-hidden className="size-3" />
              read-only
            </span>
          )}
        </CardTitle>
        {section.link && (
          <CardAction>
            <ExternalAnchor
              href={section.link.href}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {section.link.label}
              <ExternalLink aria-hidden className="size-3" />
            </ExternalAnchor>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <DetailList
          items={section.fields.map((field) => ({
            label: field.label,
            value: renderFieldValue(field),
            mono: field.mono,
          }))}
        />
      </CardContent>
    </Card>
  );
}
