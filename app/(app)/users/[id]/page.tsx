import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { checkInAllFromUser } from "@/app/(app)/users/[id]/actions";
import { History, HistoryFallback } from "@/components/assets/asset-history";
import { AssetTypeIcon } from "@/components/assets/asset-icons";
import { StatusBadge } from "@/components/assets/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { CopyButton } from "@/components/shared/copy-button";
import { DateTime } from "@/components/shared/date-time";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAssetsCard } from "@/components/users/user-assets-card";
import { getCheckinOptions } from "@/lib/assets/asset-form-options";
import { getAssetPath, getAssetTypeConfig } from "@/lib/assets/asset-types";
import {
  formatModelName,
  getAssetDisplayName,
  getAssetDisplayStatus,
} from "@/lib/assets/format";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import {
  getReceivedAt,
  getRouteUser,
  listUserHistory,
  USERS_PATH,
  type UserAsset,
  type UserDetail,
} from "@/lib/users/queries";

type UserPageProps = PageProps<"/users/[id]">;

export async function generateMetadata({
  params,
}: UserPageProps): Promise<Metadata> {
  const user = await getRouteUser(await params);
  return { title: user.displayName };
}

// The person is read per request, so the page streams in after the layout.
export default function UserPage({ params }: UserPageProps) {
  return (
    <div className="max-w-screen-2xl">
      <Suspense fallback={<UserPageFallback />}>
        <UserPageContent params={params} />
      </Suspense>
    </div>
  );
}

function UserPageFallback() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <span className="sr-only">Loading person…</span>
    </div>
  );
}

async function UserPageContent({ params }: Pick<UserPageProps, "params">) {
  const user = await getRouteUser(await params);
  const viewer = await getCurrentUser();
  const description = [user.jobTitle, user.department]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={user.displayName}
        description={description || undefined}
        breadcrumbs={[
          { label: "Users", href: USERS_PATH },
          { label: user.displayName },
        ]}
        badges={
          <>
            <CopyButton value={user.email} label="email" className="-ml-2" />
            {!user.isActive && <Badge variant="secondary">Left</Badge>}
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <UserAssets user={user} canEdit={can(viewer.role, "asset:edit")} />
        {/* A long history must not hold back the assets. */}
        <Suspense fallback={<HistoryFallback />}>
          <UserHistory userId={user.id} />
        </Suspense>
      </div>
    </>
  );
}

// ─── Assets ──────────────────────────────────────────────────────────────────

async function UserAssets({
  user,
  canEdit,
}: {
  user: UserDetail;
  canEdit: boolean;
}) {
  const assets = user.assignedAssets;
  // The dialog's statuses are only loaded when it can be used.
  const checkin =
    canEdit && assets.length > 0 ? await getCheckinOptions() : null;

  return (
    <UserAssetsCard
      count={assets.length}
      checkIn={
        checkin && {
          userName: user.displayName,
          ...checkin,
          onSubmit: checkInAllFromUser.bind(null, user.id),
        }
      }
    >
      {assets.length === 0 ? (
        <p className="text-muted-foreground">
          {user.displayName} holds no assets.
        </p>
      ) : (
        <UserAssetTable assets={assets} />
      )}
    </UserAssetsCard>
  );
}

function UserAssetTable({ assets }: { assets: UserAsset[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Serial</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Since</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const receivedAt = getReceivedAt(asset);

          return (
            <TableRow key={asset.id}>
              <TableCell>
                <Link
                  href={getAssetPath(asset.type, asset.id)}
                  className="flex w-fit items-center gap-2 font-medium text-primary hover:underline"
                >
                  <AssetTypeIcon type={asset.type} />
                  {getAssetDisplayName(asset)}
                </Link>
              </TableCell>
              <TableCell>
                {getAssetTypeConfig(asset.type).singularLabel}
              </TableCell>
              <TableCell>{formatModelName(asset.model) ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">
                {asset.serial ?? "—"}
              </TableCell>
              <TableCell>
                <StatusBadge status={getAssetDisplayStatus(asset)} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {receivedAt ? <DateTime date={receivedAt} /> : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────

// Every checkout to and checkin from the person, with the asset it was about.
async function UserHistory({ userId }: { userId: number }) {
  const events = await listUserHistory(userId);

  return (
    <History
      events={events}
      subject={(event) => (
        <Link
          href={getAssetPath(event.asset.type, event.asset.id)}
          className="font-medium text-primary hover:underline"
        >
          {getAssetDisplayName(event.asset)}
        </Link>
      )}
    />
  );
}
