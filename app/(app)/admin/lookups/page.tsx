import {
  Boxes,
  Building2,
  CircleDot,
  LayoutGrid,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { saveLookup } from "@/app/(app)/admin/lookups/actions";
import { CategoryIcon } from "@/components/assets/asset-icons";
import { PageHeader } from "@/components/layout/page-header";
import { LookupDialog } from "@/components/lookups/lookup-dialog";
import {
  LookupTable,
  type LookupColumn,
  type LookupForm,
  type LookupRow,
} from "@/components/lookups/lookup-table";
import { ListPage } from "@/components/shared/list-layout";
import { ListSearch } from "@/components/shared/list-search";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/current-user";
import {
  findLookupTab,
  listCategories,
  listCompanies,
  listLocations,
  listLookupTabsWithCounts,
  listModelCategoryOptions,
  listModels,
  listStatuses,
  LOOKUP_TAB_PARAM,
  LOOKUPS_PATH,
  statusTypeLabels,
  statusTypeOptions,
  toLookupTabParam,
  type LookupTabWithCount,
} from "@/lib/lookups/queries";
import { can } from "@/lib/permissions";
import {
  categoryIconOptions,
  statusColorOptions,
  type LookupField,
  type LookupSlug,
} from "@/lib/schemas/lookup";
import {
  buildHref,
  getParam,
  SEARCH_PARAM,
  type SearchParams,
} from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Lookup tables" };

export default function LookupsPage({
  searchParams,
}: PageProps<"/admin/lookups">) {
  return (
    <ListPage>
      <PageHeader
        title="Lookup tables"
        description="Values used in asset forms and filters. Only admins can change them."
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
  // The tabs count whole tables: the search is per table.
  const tabs = await listLookupTabsWithCounts();
  const activeTab = findLookupTab(tabs, getParam(params, LOOKUP_TAB_PARAM));
  const { columns, rows, fields } = await loadLookupTable(
    activeTab.slug,
    search,
  );
  const form: LookupForm = {
    slug: activeTab.slug,
    noun: activeTab.noun,
    fields,
  };
  const tableName = activeTab.label.toLowerCase();

  return (
    <div className="flex min-h-0 flex-col gap-5 md:flex-row">
      <LookupNav tabs={tabs} activeSlug={activeTab.slug} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ListSearch
            label={`Search ${tableName}`}
            placeholder={`Search ${tableName}…`}
            className="max-w-xs"
          />
          <LookupDialog
            noun={form.noun}
            fields={form.fields}
            onSave={saveLookup.bind(null, form.slug, null)}
          />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search
              ? `No ${tableName} match “${search}”.`
              : `No ${tableName} yet.`}
          </p>
        ) : (
          <LookupTable columns={columns} rows={rows} form={form} />
        )}
      </div>
    </div>
  );
}

const lookupTabIcons: Record<LookupSlug, LucideIcon> = {
  statuses: CircleDot,
  models: Boxes,
  categories: LayoutGrid,
  companies: Building2,
  locations: MapPin,
};

// The tables, one under the other; a row on narrow screens.
function LookupNav({
  tabs,
  activeSlug,
}: {
  tabs: LookupTabWithCount[];
  activeSlug: LookupSlug;
}) {
  return (
    <nav
      aria-label="Lookup tables"
      className="flex shrink-0 gap-0.5 overflow-x-auto md:w-52 md:flex-col md:self-start"
    >
      {tabs.map((tab) => {
        const Icon = lookupTabIcons[tab.slug];
        const isActive = tab.slug === activeSlug;

        return (
          <Link
            key={tab.slug}
            // A new table starts without the last one's search.
            href={buildHref(
              LOOKUPS_PATH,
              {},
              { [LOOKUP_TAB_PARAM]: toLookupTabParam(tab.slug) },
            )}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2 rounded-md border border-transparent px-2.5 text-sm transition-colors hover:bg-muted",
              isActive &&
                "border-border bg-card font-semibold text-primary hover:bg-card",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {tab.label}
            <span className="ml-auto pl-3 text-xs font-normal text-muted-foreground tabular-nums">
              {tab.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

const nameField = {
  name: "name",
  label: "Name",
  kind: "text",
} as const satisfies LookupField;

const assetsColumn: LookupColumn = {
  label: "Assets",
  className: "text-right tabular-nums",
};

// The name of a row, as the first thing to read in it.
function RowName({ children }: { children: ReactNode }) {
  return <span className="font-semibold">{children}</span>;
}

// The columns, rows and dialog fields of one tab.
async function loadLookupTable(
  slug: LookupSlug,
  search?: string,
): Promise<{
  columns: LookupColumn[];
  rows: LookupRow[];
  fields: LookupField[];
}> {
  switch (slug) {
    case "statuses":
      return {
        columns: [
          { label: "Color", className: "w-16" },
          { label: "Name" },
          { label: "Type" },
          assetsColumn,
        ],
        fields: [
          { ...nameField, placeholder: "e.g. In repair" },
          {
            name: "type",
            label: "Type",
            kind: "segmented",
            options: statusTypeOptions,
          },
          {
            name: "color",
            label: "Color",
            kind: "color",
            colors: statusColorOptions,
          },
        ],
        rows: (await listStatuses(search)).map((status) => ({
          id: status.id,
          values: {
            name: status.name,
            type: status.type,
            color: status.color,
          },
          cells: [
            <span
              key="color"
              aria-hidden
              className="block size-3.5 rounded-sm bg-(--swatch)"
              style={{ "--swatch": status.color } as CSSProperties}
            />,
            <RowName key="name">{status.name}</RowName>,
            <Badge key="type" variant="outline">
              {statusTypeLabels[status.type]}
            </Badge>,
            status.assetCount,
          ],
        })),
      };
    case "models":
      return {
        columns: [
          { label: "Name" },
          { label: "Manufacturer" },
          { label: "Category" },
          assetsColumn,
        ],
        fields: [
          { ...nameField, placeholder: "e.g. Latitude 5440" },
          {
            name: "manufacturer",
            label: "Manufacturer",
            kind: "text",
            placeholder: "e.g. Dell",
            optional: true,
          },
          {
            name: "categoryId",
            label: "Category",
            kind: "choice",
            choices: await listModelCategoryOptions(),
            placeholder: "Choose a category",
            description: "Accessory categories are left out.",
          },
        ],
        rows: (await listModels(search)).map((model) => ({
          id: model.id,
          values: {
            name: model.name,
            manufacturer: model.manufacturer ?? "",
            categoryId: model.category.id,
          },
          cells: [
            <RowName key="name">{model.name}</RowName>,
            model.manufacturer ?? "—",
            model.category.name,
            model.assetCount,
          ],
        })),
      };
    case "categories":
      return {
        columns: [{ label: "Name" }, { label: "Used by" }],
        fields: [
          { ...nameField, placeholder: "e.g. Laptop or Mouse" },
          {
            name: "icon",
            label: "Icon",
            kind: "icons",
            options: categoryIconOptions,
            description: "Shown next to the category in lists.",
          },
        ],
        rows: (await listCategories(search)).map((category) => ({
          id: category.id,
          values: { name: category.name, icon: category.icon },
          cells: [
            <span key="name" className="flex items-center gap-2">
              <CategoryIcon iconKey={category.icon} />
              <RowName>{category.name}</RowName>
            </span>,
            <span
              key="usage"
              className={cn(!category.usage.inUse && "text-muted-foreground")}
            >
              {category.usage.label}
            </span>,
          ],
        })),
      };
    case "companies":
      return {
        columns: [{ label: "Name" }, assetsColumn],
        fields: [{ ...nameField, placeholder: "e.g. DRL" }],
        rows: (await listCompanies(search)).map((company) => ({
          id: company.id,
          values: { name: company.name },
          cells: [
            <RowName key="name">{company.name}</RowName>,
            company.assetCount,
          ],
        })),
      };
    case "locations":
      return {
        columns: [{ label: "Name" }, assetsColumn],
        fields: [{ ...nameField, placeholder: "e.g. HQ — Floor 2" }],
        rows: (await listLocations(search)).map((location) => ({
          id: location.id,
          values: { name: location.name },
          cells: [
            <RowName key="name">{location.name}</RowName>,
            location.assetCount,
          ],
        })),
      };
  }
}

function LookupListFallback() {
  return (
    <div aria-busy className="flex flex-col gap-5 md:flex-row">
      <div className="flex flex-col gap-1 md:w-52">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-8" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <Skeleton className="h-8 w-full max-w-xs" />
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-5" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading lookup tables…</span>
    </div>
  );
}
