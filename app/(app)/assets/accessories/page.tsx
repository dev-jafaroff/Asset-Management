import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessoryTable } from "@/components/accessories/accessory-table";
import { PageHeader } from "@/components/layout/page-header";
import { ExportButton } from "@/components/shared/export-button";
import { ListPage } from "@/components/shared/list-layout";
import { ListSearch } from "@/components/shared/list-search";
import { RequirePermission } from "@/components/shared/require-permission";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACCESSORIES_EXPORT_PATH,
  getAccessoryPath,
  listAccessories,
  NEW_ACCESSORY_PATH,
} from "@/lib/accessories/queries";
import {
  buildHref,
  getParam,
  SEARCH_PARAM,
  type SearchParams,
} from "@/lib/search-params";

export const metadata: Metadata = { title: "Accessories" };

export default function AccessoriesPage({
  searchParams,
}: PageProps<"/assets/accessories">) {
  return (
    <ListPage>
      <PageHeader
        title="Accessories"
        description="Counted by quantity: keyboards, mice, headsets and more."
        actions={
          <RequirePermission permission="asset:edit">
            <Button
              nativeButton={false}
              render={<Link href={NEW_ACCESSORY_PATH} />}
            >
              <Plus aria-hidden />
              New accessory
            </Button>
          </RequirePermission>
        }
      />
      <Suspense fallback={<AccessoryListFallback />}>
        <AccessoryList searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}

// Reading searchParams makes this render per request, so stock is always fresh.
async function AccessoryList({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = getParam(params, SEARCH_PARAM);
  const accessories = await listAccessories(search);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ListSearch
          label="Search accessories"
          placeholder="Search by name or category"
          className="max-w-sm"
        />
        <ExportButton href={buildHref(ACCESSORIES_EXPORT_PATH, params)} />
      </div>
      {accessories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? `No accessories match “${search}”.` : "No accessories yet."}
        </p>
      ) : (
        <AccessoryTable
          accessories={accessories.map((accessory) => ({
            ...accessory,
            href: getAccessoryPath(accessory.id),
          }))}
        />
      )}
    </div>
  );
}

function AccessoryListFallback() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full max-w-sm" />
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-5" />
        ))}
      </div>
      <span className="sr-only">Loading accessories…</span>
    </div>
  );
}
