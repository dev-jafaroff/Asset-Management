import {
  Building2,
  CloudOff,
  ExternalLink,
  LockKeyhole,
  MapPin,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ComponentProps, type ReactNode } from "react";
import {
  AssetHistory,
  HistoryFallback,
} from "@/components/assets/asset-history";
import {
  submitCheckin,
  submitCheckout,
} from "@/app/(app)/assets/[type]/[id]/actions";
import { AssetTypeIcon, SourceIcon } from "@/components/assets/asset-icons";
import { IntuneCheckInButton } from "@/components/assets/intune-check-in-button";
import { IntuneSyncTitle } from "@/components/assets/intune-sync-title";
import { AssetNotesCard } from "@/components/assets/asset-notes-card";
import { CheckinDialog } from "@/components/assets/checkin-dialog";
import { CheckoutDialog } from "@/components/assets/checkout-dialog";
import { StatusBadge } from "@/components/assets/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { CopyButton } from "@/components/shared/copy-button";
import { DateTime } from "@/components/shared/date-time";
import { DetailList } from "@/components/shared/detail-list";
import { IconTile } from "@/components/shared/icon-tile";
import { RequirePermission } from "@/components/shared/require-permission";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  isNotInIntune,
  getCheckedOutAt,
  getIntuneHolderSuggestion,
  getRouteAsset,
  type AssetDetail,
  type IntuneHolderSuggestion,
  type DetailField,
  type DetailSection,
} from "@/lib/assets/asset-detail";
import {
  ASSETS_PATH,
  getAssetPath,
  getAssetTypeConfig,
  getAssetTypePath,
  getEditAssetPath,
  type AssignTarget,
} from "@/lib/assets/asset-types";
import {
  canRequestIntuneCheckIn,
  formatModelName,
  getAssetDisplayName,
  getAssetDisplayStatus,
  getAssetHolder,
  getCheckoutBlocker,
} from "@/lib/assets/format";
import {
  getCheckinOptions,
  getHolderOptions,
} from "@/lib/assets/asset-form-options";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";

type AssetPageProps = PageProps<"/assets/[type]/[id]">;

// Shared by the page and its metadata; cached per request (see getAssetDetail).
async function loadAsset(params: AssetPageProps["params"]) {
  return getRouteAsset(await params, getAssetPath);
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
  const [user, suggestion] = await Promise.all([
    getCurrentUser(),
    getIntuneHolderSuggestion(asset),
  ]);
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
            <NotInIntuneBadge asset={asset} />
          </>
        }
        actions={
          <RequirePermission permission="asset:edit">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={getEditAssetPath(asset.type, asset.id)} />}
            >
              <Pencil aria-hidden />
              Edit
            </Button>
          </RequirePermission>
        }
      />

      <AssetDetailGrid
        main={
          <>
            <AssignmentCard asset={asset} suggestion={suggestion} />
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {buildDetailSections(asset).map((section) => (
                <DetailCard
                  key={section.title}
                  assetId={asset.id}
                  section={section}
                  footer={
                    section.source === "INTUNE" && (
                      <IntuneCardFooter asset={asset} />
                    )
                  }
                />
              ))}
            </div>
            <AssetNotesCard
              assetId={asset.id}
              notes={asset.notes}
              canEdit={can(user.role, "asset:edit")}
            />
          </>
        }
        aside={
          // A long history must not hold back the cards above.
          <Suspense fallback={<HistoryFallback />}>
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

// Check out when the asset is free, check in when it is handed out.
// The lists are only loaded for people who may use them.
type AssignmentProps = {
  asset: AssetDetail;
  // Intune's primary user, when it is not who holds the asset.
  suggestion: IntuneHolderSuggestion | null;
};

async function AssignmentActions({ asset, suggestion }: AssignmentProps) {
  const { assignTo } = getAssetTypeConfig(asset.type);
  const holder = getAssetHolder(asset);
  const assetName = getAssetDisplayName(asset);

  if (holder) {
    const { statuses, defaultStatusId } = await getCheckinOptions();
    return (
      <CheckinDialog
        title={`Check in ${assetName}`}
        description={`Take it back from ${holder}.`}
        statuses={statuses}
        defaultStatusId={defaultStatusId}
        onSubmit={submitCheckin.bind(null, asset.id)}
      />
    );
  }
  if (getCheckoutBlocker(asset)) return null;
  return (
    <CheckoutDialog
      title={`Check out ${assetName}`}
      description={`Choose the ${assignTo} it goes to.`}
      assignTo={assignTo}
      holders={await getHolderOptions(assignTo)}
      // Intune's primary user, ready to confirm.
      defaultHolderId={suggestion?.user?.id}
      onSubmit={submitCheckout.bind(null, asset.id)}
    />
  );
}

// Who Intune says uses the device, when that is not its holder here. The
// holder is changed by hand: checkout preselects them when it is free.
function IntuneHolderHint({
  suggestion,
}: {
  suggestion: IntuneHolderSuggestion;
}) {
  const name = suggestion.user?.displayName ?? suggestion.email;
  const advice = suggestion.isHeldByOther
    ? "Check it in and out to change the holder."
    : suggestion.user
      ? "Check out suggests them."
      : null;

  return (
    <p className="mt-4 flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
      <SourceIcon
        source="INTUNE"
        className="mt-px size-3.5 shrink-0 text-primary"
      />
      <span>
        Intune&apos;s primary user is{" "}
        <span className="font-medium text-foreground">{name}</span>
        {!suggestion.user && " (not among the employees)"}
        {suggestion.isHeldByOther ? ", not the holder." : "."}
        {advice && ` ${advice}`}
      </span>
    </p>
  );
}

function AssignmentCard({ asset, suggestion }: AssignmentProps) {
  const { assignTo } = getAssetTypeConfig(asset.type);
  const holder = getAssetHolder(asset);
  const checkedOutAt = getCheckedOutAt(asset);
  // e.g. "In repair assets cannot be checked out."
  const blocker = holder ? null : getCheckoutBlocker(asset);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment</CardTitle>
        <CardAction>
          <RequirePermission permission="asset:edit">
            <AssignmentActions asset={asset} suggestion={suggestion} />
          </RequirePermission>
        </CardAction>
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
            <div className="text-muted-foreground">
              <p>Not assigned to a {assignTo}.</p>
              {blocker && <p className="text-xs">{blocker}</p>}
            </div>
          </div>
        )}
        {suggestion && <IntuneHolderHint suggestion={suggestion} />}
      </CardContent>
    </Card>
  );
}

// ─── Details ─────────────────────────────────────────────────────────────────

// Links to another system (e.g. Intune) open in a new tab, so this page stays open.
function ExternalAnchor(props: ComponentProps<"a">) {
  return <a target="_blank" rel="noopener noreferrer" {...props} />;
}

// A PC the sync has not linked to an Intune device yet. Once linked, the
// Intune card shows (and syncs) it instead.
function NotInIntuneBadge({ asset }: { asset: AssetDetail }) {
  if (!isNotInIntune(asset)) return null;
  return (
    <Badge
      variant="outline"
      title="Not linked to an Intune device. The sync links it once Intune has a device with its serial, or named after its asset tag."
      className="text-muted-foreground"
    >
      <CloudOff aria-hidden />
      Not in Intune
    </Badge>
  );
}

// A card's icon and title. A synced section (Intune) lets editors click it
// to sync the record now.
function DetailCardHeading({
  assetId,
  section,
}: {
  assetId: number;
  section: DetailSection;
}) {
  const heading = (
    <>
      {section.source && (
        <SourceIcon
          source={section.source}
          syncState={section.syncStatus?.state}
          className="size-4 text-primary"
        />
      )}
      {section.title}
    </>
  );
  if (!section.syncStatus) return heading;

  return (
    <RequirePermission permission="asset:edit" fallback={heading}>
      <IntuneSyncTitle assetId={assetId} syncStatus={section.syncStatus} />
    </RequirePermission>
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

// What the last sync found wrong with the asset, e.g. its serial differs
// from the Intune device named after its tag.
function SectionProblem({ problem }: { problem: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
      <TriangleAlert
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <span>
        <span className="sr-only">Sync problem: </span>
        {problem}
      </span>
    </p>
  );
}

// Under the Intune card's fields: editors can ask the device to check in.
function IntuneCardFooter({ asset }: { asset: AssetDetail }) {
  if (!canRequestIntuneCheckIn(asset)) return null;
  return (
    <RequirePermission permission="asset:edit">
      <IntuneCheckInButton assetId={asset.id} />
    </RequirePermission>
  );
}

function DetailCard({
  assetId,
  section,
  footer,
}: {
  assetId: number;
  section: DetailSection;
  // Actions under the fields.
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DetailCardHeading assetId={assetId} section={section} />
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
      <CardContent className="flex flex-col gap-4">
        {section.problem && <SectionProblem problem={section.problem} />}
        {section.fields.length > 0 && (
          <DetailList
            items={section.fields.map((field) => ({
              label: field.label,
              value: renderFieldValue(field),
              mono: field.mono,
            }))}
          />
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
