import { LogIn, LogOut, Package, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  submitAccessoryAssign,
  submitAccessoryReturn,
} from "@/app/(app)/assets/accessories/actions";
import { AssignAccessoryDialog } from "@/components/accessories/assign-accessory-dialog";
import { ReturnAccessoryDialog } from "@/components/accessories/return-accessory-dialog";
import {
  HistoryCard,
  HistoryFallback,
  TimelineItem,
} from "@/components/assets/asset-history";
import { PageHeader } from "@/components/layout/page-header";
import { DateTime } from "@/components/shared/date-time";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCESSORIES_PATH,
  getEditAccessoryPath,
  getRouteAccessory,
  listAccessoryHistory,
  type AccessoryDetail,
  type AccessoryHistoryEntry,
  type AccessoryStock,
} from "@/lib/accessories/queries";
import { getHolderOptions } from "@/lib/assets/asset-form-options";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { getUserPath } from "@/lib/users/queries";

type AccessoryPageProps = PageProps<"/assets/accessories/[id]">;

export async function generateMetadata({
  params,
}: AccessoryPageProps): Promise<Metadata> {
  const accessory = await getRouteAccessory(await params);
  return { title: accessory.name };
}

// The accessory is read per request, so it streams in after the layout.
export default function AccessoryPage({ params }: AccessoryPageProps) {
  return (
    <div className="max-w-screen-2xl">
      <Suspense fallback={<AccessoryPageFallback />}>
        <AccessoryPageContent params={params} />
      </Suspense>
    </div>
  );
}

const pageGrid = "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]";

function AccessoryPageFallback() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-56" />
      </div>
      <div className={pageGrid}>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <span className="sr-only">Loading accessory…</span>
    </div>
  );
}

async function AccessoryPageContent({
  params,
}: Pick<AccessoryPageProps, "params">) {
  const accessory = await getRouteAccessory(await params);
  const viewer = await getCurrentUser();
  const canEdit = can(viewer.role, "asset:edit");

  return (
    <>
      <PageHeader
        title={accessory.name}
        description={accessory.category.name}
        breadcrumbs={[
          { label: "Accessories", href: ACCESSORIES_PATH },
          { label: accessory.name },
        ]}
        badges={
          accessory.stock.inStock === 0 && (
            <Badge variant="destructive">Out of stock</Badge>
          )
        }
        actions={
          <RequirePermission permission="asset:edit">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={getEditAccessoryPath(accessory.id)} />}
            >
              <Pencil aria-hidden />
              Edit
            </Button>
          </RequirePermission>
        }
      />

      <div className={pageGrid}>
        <div className="flex flex-col gap-4">
          <StockTiles stock={accessory.stock} />
          <HoldersCard accessory={accessory} canEdit={canEdit} />
        </div>
        {/* A long history must not hold back the cards. */}
        <Suspense fallback={<HistoryFallback />}>
          <AccessoryHistory accessoryId={accessory.id} />
        </Suspense>
      </div>
    </>
  );
}

// ─── Stock ───────────────────────────────────────────────────────────────────

function StockTiles({ stock }: { stock: AccessoryStock }) {
  const tiles = [
    { label: "Total", value: stock.total },
    { label: "Assigned", value: stock.assigned },
    { label: "In stock", value: stock.inStock },
  ];

  return (
    <dl className="grid grid-cols-3 gap-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex flex-col gap-1 rounded-xl border bg-card p-4"
        >
          <dt className="text-sm text-muted-foreground">{tile.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Holders ─────────────────────────────────────────────────────────────────

// Who has it now. Editors hand more out here, and take any handout back,
// fully or in part.
async function HoldersCard({
  accessory,
  canEdit,
}: {
  accessory: AccessoryDetail;
  canEdit: boolean;
}) {
  const holders = accessory.assignments;
  // The people list is only loaded when it can be used.
  const users =
    canEdit && accessory.stock.inStock > 0
      ? await getHolderOptions("user")
      : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned to</CardTitle>
        {canEdit && (
          <CardAction>
            <AssignAccessoryDialog
              accessoryName={accessory.name}
              inStock={accessory.stock.inStock}
              users={users}
              onSubmit={submitAccessoryAssign.bind(null, accessory.id)}
            />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {holders.length === 0 ? (
          <p className="text-muted-foreground">Nobody has one right now.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Since</TableHead>
                {canEdit && (
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {holders.map((holder) => (
                <TableRow key={holder.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={holder.user.displayName} size="sm" />
                      <Link
                        href={getUserPath(holder.user.id)}
                        className="font-medium text-primary hover:underline"
                      >
                        {holder.user.displayName}
                      </Link>
                      {!holder.user.isActive && (
                        <Badge variant="secondary">Left</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {holder.quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <DateTime date={holder.assignedAt} />
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <ReturnAccessoryDialog
                        accessoryName={accessory.name}
                        holderName={holder.user.displayName}
                        held={holder.quantity}
                        onSubmit={submitAccessoryReturn.bind(null, holder.id)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────

function PersonLink({
  person,
}: {
  person: { id: number; displayName: string };
}) {
  return (
    <Link
      href={getUserPath(person.id)}
      className="font-medium text-primary hover:underline"
    >
      {person.displayName}
    </Link>
  );
}

// What each kind of entry shows, e.g. "Assigned 2 to Aysel Huseynova".
function getTimelineEntry(entry: AccessoryHistoryEntry) {
  switch (entry.kind) {
    case "assigned":
      return {
        icon: LogOut,
        tone: "bg-primary/10 text-primary",
        title: (
          <>
            <span className="font-medium">Assigned {entry.quantity}</span> to{" "}
            <PersonLink person={entry.user} />
          </>
        ),
      };
    case "returned":
      return {
        icon: LogIn,
        title: (
          <>
            <span className="font-medium">Returned {entry.quantity}</span> from{" "}
            <PersonLink person={entry.user} />
          </>
        ),
      };
    case "stock":
      return {
        icon: Package,
        tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        title:
          entry.from === null ? (
            <span className="font-medium">Added with {entry.to}</span>
          ) : (
            <>
              <span className="font-medium">Total changed</span> {entry.from} →{" "}
              {entry.to}
            </>
          ),
        note: entry.note,
      };
  }
}

// Handouts, returns and stock changes, newest first.
async function AccessoryHistory({ accessoryId }: { accessoryId: number }) {
  const entries = await listAccessoryHistory(accessoryId);

  return (
    <HistoryCard count={entries.length}>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">No history yet.</p>
      ) : (
        <ol>
          {entries.map((entry, index) => (
            <TimelineItem
              key={entry.key}
              {...getTimelineEntry(entry)}
              actor={entry.actor}
              date={entry.date}
              isLast={index === entries.length - 1}
            />
          ))}
        </ol>
      )}
    </HistoryCard>
  );
}
