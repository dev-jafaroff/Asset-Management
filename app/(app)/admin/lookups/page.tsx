import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessoryIcon } from "@/components/assets/asset-icons";
import { StatusDot } from "@/components/assets/status-badge";
import { StatusTabs } from "@/components/assets/status-tabs";
import { PageHeader } from "@/components/layout/page-header";
import {
  LookupTable,
  type LookupColumn,
  type LookupRow,
} from "@/components/lookups/lookup-table";
import { ListPage } from "@/components/shared/list-layout";
import { ListSearch } from "@/components/shared/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/current-user";
import {
  findLookupTab,
  listCategories,
  listCompanies,
  listLocations,
  listLookupTabsWithCounts,
  listModels,
  listStatuses,
  LOOKUP_TAB_PARAM,
  LOOKUPS_PATH,
  statusTypeLabels,
  toLookupTabParam,
  type LookupSlug,
} from "@/lib/lookups/queries";
import { can } from "@/lib/permissions";
import {
  buildHref,
  getParam,
  SEARCH_PARAM,
  type SearchParams,
} from "@/lib/search-params";

export const metadata: Metadata = { title: "Lookup tables" };

export default function LookupsPage({
  searchParams,
}: PageProps<"/admin/lookups">) {
  return (
    <ListPage>
      <PageHeader
        title="Lookup tables"
        description="The categories, models, companies, locations and statuses assets use."
      />
      <Suspense fallback={<LookupListFallback />}>
        <LookupList searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}

// Reading searchParams makes this render per request, so counts are fresh.
async function LookupList({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Admins only; the sidebar hides the link from everyone else.
  const user = await getCurrentUser();
  if (!can(user.role, "lookup:manage")) notFound();

  const params = await searchParams;
  const search = getParam(params, SEARCH_PARAM);
  const tabs = await listLookupTabsWithCounts(search);
  const activeTab = findLookupTab(tabs, getParam(params, LOOKUP_TAB_PARAM));
  const table = await loadLookupTable(activeTab.slug, search);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <ListSearch
        label="Search this table"
        placeholder="Search by name"
        className="max-w-sm"
      />
      <StatusTabs
        label="Choose a table"
        activeSlug={activeTab.slug}
        tabs={tabs.map((tab) => ({
          slug: tab.slug,
          label: tab.label,
          color: null,
          count: tab.count,
          href: buildHref(LOOKUPS_PATH, params, {
            [LOOKUP_TAB_PARAM]: toLookupTabParam(tab.slug),
          }),
        }))}
      />
      {table.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search
            ? `No ${activeTab.label.toLowerCase()} match “${search}”.`
            : `No ${activeTab.label.toLowerCase()} yet.`}
        </p>
      ) : (
        <LookupTable {...table} />
      )}
    </div>
  );
}

// The columns and rows of one tab.
async function loadLookupTable(
  slug: LookupSlug,
  search?: string,
): Promise<{ columns: LookupColumn[]; rows: LookupRow[] }> {
  switch (slug) {
    case "categories":
      return {
        columns: [{ label: "Name" }],
        rows: (await listCategories(search)).map((category) => ({
          id: category.id,
          usage: category.usage,
          cells: [
            <span key="name" className="flex items-center gap-2">
              {/* Only accessory categories have an icon. */}
              {category.icon && <AccessoryIcon iconKey={category.icon} />}
              {category.name}
            </span>,
          ],
        })),
      };
    case "models":
      return {
        columns: [
          { label: "Name" },
          { label: "Manufacturer" },
          { label: "Category" },
        ],
        rows: (await listModels(search)).map((model) => ({
          id: model.id,
          usage: model.usage,
          cells: [model.name, model.manufacturer ?? "—", model.category.name],
        })),
      };
    case "companies":
      return {
        columns: [{ label: "Name" }],
        rows: (await listCompanies(search)).map((company) => ({
          id: company.id,
          usage: company.usage,
          cells: [company.name],
        })),
      };
    case "locations":
      return {
        columns: [{ label: "Name" }],
        rows: (await listLocations(search)).map((location) => ({
          id: location.id,
          usage: location.usage,
          cells: [location.name],
        })),
      };
    case "statuses":
      return {
        columns: [{ label: "Name" }, { label: "Kind" }],
        rows: (await listStatuses(search)).map((status) => ({
          id: status.id,
          usage: status.usage,
          cells: [
            <span key="name" className="flex items-center gap-2">
              <StatusDot color={status.color} />
              {status.name}
            </span>,
            statusTypeLabels[status.type],
          ],
        })),
      };
  }
}

function LookupListFallback() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full max-w-sm" />
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-5" />
        ))}
      </div>
      <span className="sr-only">Loading lookup tables…</span>
    </div>
  );
}
