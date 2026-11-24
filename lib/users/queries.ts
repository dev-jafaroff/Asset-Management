import { notFound } from "next/navigation";
import { cache } from "react";
import {
  heldAccessoriesArgs,
  openAssignmentWhere,
  withHeldAccessories,
} from "@/lib/accessories/queries";
import {
  listAssetEvents,
  type AssetEventWithAsset,
} from "@/lib/assets/asset-detail";
import { assetListSelect } from "@/lib/assets/queries";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getParam,
  getPositiveIntParam,
  SEARCH_PARAM,
  type FilterOption,
  type SearchParams,
} from "@/lib/search-params";

export const USERS_PATH = "/users";
// CSV download of the list, with the same params as the list.
export const USERS_EXPORT_PATH = `${USERS_PATH}/export`;

// e.g. "/users/12"
export function getUserPath(id: number): string {
  return `${USERS_PATH}/${id}`;
}

// ─── List ────────────────────────────────────────────────────────────────────

const userListSelect = {
  id: true,
  displayName: true,
  email: true,
  department: true,
  jobTitle: true,
  isActive: true,
  _count: { select: { assignedAssets: true } },
} satisfies Prisma.UserSelect;

// With the number of accessories the person has now.
export type UserListItem = Prisma.UserGetPayload<{
  select: typeof userListSelect;
}> & { heldAccessories: number };

// Has something to give back: an asset, or an accessory not returned yet.
export const holdsItemsWhere = {
  OR: [
    { assignedAssets: { some: {} } },
    { accessories: { some: openAssignmentWhere } },
  ],
} satisfies Prisma.UserWhereInput;

export const USER_TAB_PARAM = "status";

export type UserTab = {
  slug: string;
  label: string;
  where: Prisma.UserWhereInput;
};

// The first tab is the default. "Holding items" is for offboarding: people
// who still have something, whether they left or not.
const userTabs: UserTab[] = [
  { slug: "active", label: "Active", where: { isActive: true } },
  {
    slug: "holding",
    label: "Holding items",
    where: holdsItemsWhere,
  },
  { slug: "left", label: "Left", where: { isActive: false } },
];

// Every word must match the name, email, department or job title, so
// "aysel it" finds Aysel Huseynova from the IT department.
function buildUserSearchWhere(search?: string): Prisma.UserWhereInput {
  const terms = search?.split(/\s+/).filter(Boolean) ?? [];
  return {
    AND: terms.map((term) => {
      const contains = { contains: term, mode: "insensitive" as const };
      return {
        OR: [
          { displayName: contains },
          { email: contains },
          { department: contains },
          { jobTitle: contains },
        ],
      };
    }),
  };
}

// ─── Domain filter ───────────────────────────────────────────────────────────

// The email domain tells the companies apart, e.g. "waverity.ai".
export const USER_DOMAIN_PARAM = "domain";

// Every email domain there is, for the filter.
export async function listUserDomainOptions(): Promise<FilterOption[]> {
  const rows = await prisma.$queryRaw<{ domain: string }[]>`
    SELECT DISTINCT split_part("email", '@', 2) AS "domain"
    FROM "User"
    ORDER BY "domain"
  `;
  return rows.map(({ domain }) => ({ value: domain, label: domain }));
}

function buildUserDomainWhere(domain?: string): Prisma.UserWhereInput {
  return domain
    ? { email: { endsWith: `@${domain}`, mode: "insensitive" } }
    : {};
}

// What narrows the list besides the tab, read from the URL by the page and
// the export alike.
export type UserListFilter = { search?: string; domain?: string };

export function getUserListFilter(params: SearchParams): UserListFilter {
  return {
    search: getParam(params, SEARCH_PARAM),
    domain: getParam(params, USER_DOMAIN_PARAM),
  };
}

function buildUserFilterWhere(filter: UserListFilter): Prisma.UserWhereInput {
  return {
    AND: [
      buildUserSearchWhere(filter.search),
      buildUserDomainWhere(filter.domain),
    ],
  };
}

export type UserTabWithCount = UserTab & { count: number };

// Every tab with the number of people it holds under the search and filter.
export async function listUserTabsWithCounts(
  filter: UserListFilter,
): Promise<UserTabWithCount[]> {
  const filterWhere = buildUserFilterWhere(filter);
  const counts = await Promise.all(
    userTabs.map((tab) =>
      prisma.user.count({ where: { AND: [tab.where, filterWhere] } }),
    ),
  );
  return userTabs.map((tab, index) => ({ ...tab, count: counts[index] }));
}

// The tab of the URL param; anything unknown is the first (Active).
export function findUserTab<T extends UserTab>(tabs: T[], slug?: string): T {
  return tabs.find((tab) => tab.slug === slug) ?? tabs[0];
}

// The tab of the URL param, without counts, e.g. for an export.
export function getUserTab(slug?: string): UserTab {
  return findUserTab(userTabs, slug);
}

// The default tab has no param, so the plain URL stays clean.
export function toUserTabParam(slug: string): string | undefined {
  return slug === userTabs[0].slug ? undefined : slug;
}

// Every matching person, on one page like the asset lists.
export async function listUsers({
  tab,
  ...filter
}: UserListFilter & { tab: UserTab }): Promise<UserListItem[]> {
  const users = await prisma.user.findMany({
    where: { AND: [tab.where, buildUserFilterWhere(filter)] },
    select: userListSelect,
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
  });
  return withHeldAccessories(users);
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function getUserDetailSelect(userId: number) {
  return {
    id: true,
    displayName: true,
    email: true,
    department: true,
    jobTitle: true,
    role: true,
    isActive: true,
    assignedAssets: {
      select: {
        ...assetListSelect,
        // When this person got it: their latest checkout of the asset.
        events: {
          where: { type: "CHECKOUT", targetUserId: userId },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: [{ type: "asc" }, { assetTag: "asc" }, { id: "asc" }],
    },
    accessories: heldAccessoriesArgs,
  } satisfies Prisma.UserSelect;
}

export type UserDetail = NonNullable<Awaited<ReturnType<typeof findUser>>>;
export type UserAsset = UserDetail["assignedAssets"][number];
export type UserAccessory = UserDetail["accessories"][number];

function findUser(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: getUserDetailSelect(id),
  });
}

// Wrapped in cache(), so the page and its metadata share one query per request.
const getUserDetail = cache(findUser);

// The person of a /users/[id] page; an unknown id is a 404.
export async function getRouteUser(route: { id: string }): Promise<UserDetail> {
  const id = getPositiveIntParam(route, "id");
  const user = id === undefined ? null : await getUserDetail(id);
  if (!user) notFound();
  return user;
}

// When the person got the asset; null for records imported without history.
export function getReceivedAt(asset: UserAsset): Date | null {
  return asset.events[0]?.createdAt ?? null;
}

// ─── History ─────────────────────────────────────────────────────────────────

// Everything handed to or taken back from the person, newest first.
export function listUserHistory(
  userId: number,
): Promise<AssetEventWithAsset[]> {
  return listAssetEvents({ targetUserId: userId });
}
