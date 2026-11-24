import { StatusTabs } from "@/components/assets/status-tabs";
import { ExportButton } from "@/components/shared/export-button";
import { FilterSelect } from "@/components/shared/filter-select";
import { ListSearch } from "@/components/shared/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { UserTable } from "@/components/users/user-table";
import { buildHref, getParam, type SearchParams } from "@/lib/search-params";
import {
  findUserTab,
  getUserListFilter,
  getUserPath,
  listUserDomainOptions,
  listUsers,
  listUserTabsWithCounts,
  toUserTabParam,
  USER_DOMAIN_PARAM,
  USER_TAB_PARAM,
  USERS_EXPORT_PATH,
  USERS_PATH,
} from "@/lib/users/queries";

// Reading searchParams makes this render per request, so the list is always fresh.
export async function UserList({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filter = getUserListFilter(params);

  // Tab counts follow the search and filter, so they show where the matches are.
  const [tabs, domains] = await Promise.all([
    listUserTabsWithCounts(filter),
    listUserDomainOptions(),
  ]);
  const activeTab = findUserTab(tabs, getParam(params, USER_TAB_PARAM));
  const users = await listUsers({ ...filter, tab: activeTab });

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ListSearch
          label="Search people"
          placeholder="Search by name, email or department"
          className="max-w-sm"
        />
        <FilterSelect
          param={USER_DOMAIN_PARAM}
          label="Email domain"
          allLabel="All domains"
          options={domains}
          value={filter.domain}
        />
      </div>

      <StatusTabs
        activeSlug={activeTab.slug}
        actions={<ExportButton href={buildHref(USERS_EXPORT_PATH, params)} />}
        tabs={tabs.map((tab) => ({
          slug: tab.slug,
          label: tab.label,
          color: null,
          count: tab.count,
          href: buildHref(USERS_PATH, params, {
            [USER_TAB_PARAM]: toUserTabParam(tab.slug),
          }),
        }))}
      />

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filter.search
            ? `No people match “${filter.search}”.`
            : "No people here."}
        </p>
      ) : (
        <UserTable
          users={users.map((user) => ({
            ...user,
            href: getUserPath(user.id),
          }))}
        />
      )}
    </div>
  );
}

const FALLBACK_ROWS = 8;

// Outline of the search, tabs and table while the list loads.
export function UserListFallback() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full max-w-sm" />
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        {Array.from({ length: FALLBACK_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-5" />
        ))}
      </div>
      <span className="sr-only">Loading people…</span>
    </div>
  );
}
