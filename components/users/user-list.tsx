import { StatusTabs } from "@/components/assets/status-tabs";
import {
  getPageCount,
  ListPagination,
} from "@/components/shared/list-pagination";
import { ListSearch } from "@/components/shared/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { UserTable } from "@/components/users/user-table";
import {
  buildHref,
  getPageParam,
  getParam,
  PAGE_PARAM,
  SEARCH_PARAM,
  type SearchParams,
} from "@/lib/search-params";
import {
  findUserTab,
  getUserPath,
  listUsers,
  listUserTabsWithCounts,
  toUserTabParam,
  USER_PAGE_SIZE,
  USER_TAB_PARAM,
  USERS_PATH,
} from "@/lib/users/queries";

// Reading searchParams makes this render per request, so the list is always fresh.
export async function UserList({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = getParam(params, SEARCH_PARAM);

  // Tab counts follow the search, so they show where the matches are.
  const tabs = await listUserTabsWithCounts(search);
  const activeTab = findUserTab(tabs, getParam(params, USER_TAB_PARAM));
  const total = activeTab.count;
  const pageCount = getPageCount(total, USER_PAGE_SIZE);
  // A page past the end (e.g. after a search narrowed the list) shows the last page.
  const page = Math.min(getPageParam(params), pageCount);
  const users = await listUsers({ tab: activeTab, search }, page);

  return (
    <div className="flex flex-col gap-4">
      <ListSearch
        label="Search people"
        placeholder="Search by name, email or department"
        className="max-w-sm"
      />

      <StatusTabs
        activeSlug={activeTab.slug}
        tabs={tabs.map((tab) => ({
          slug: tab.slug,
          label: tab.label,
          color: null,
          count: tab.count,
          href: buildHref(USERS_PATH, params, {
            [USER_TAB_PARAM]: toUserTabParam(tab.slug),
            [PAGE_PARAM]: undefined,
          }),
        }))}
      />

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? `No people match “${search}”.` : "No people here."}
        </p>
      ) : (
        <>
          <UserTable
            users={users.map((user) => ({
              ...user,
              href: getUserPath(user.id),
            }))}
          />
          <ListPagination
            page={page}
            pageCount={pageCount}
            pageSize={USER_PAGE_SIZE}
            total={total}
            pathname={USERS_PATH}
            params={params}
          />
        </>
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
