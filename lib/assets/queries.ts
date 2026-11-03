import { Prisma } from "@/lib/generated/prisma/client";
import { buildStatusTabs, type StatusTab } from "@/lib/assets/status-filters";
import type { AssetType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const assetListSelect = {
  id: true,
  type: true,
  assetTag: true,
  serial: true,
  name: true,
  imei: true,
  phoneNumber: true,
  operatingSystem: true,
  osVersion: true,
  vmHost: true,
  vCpu: true,
  ramGb: true,
  updatedAt: true,
  status: { select: { id: true, name: true, type: true, color: true } },
  model: { select: { id: true, name: true, manufacturer: true } },
  company: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, displayName: true, email: true } },
} satisfies Prisma.AssetSelect;

export type AssetListItem = Prisma.AssetGetPayload<{
  select: typeof assetListSelect;
}>;

export const ASSET_PAGE_SIZE = 25;

export type AssetListFilter = {
  type?: AssetType;
  // Condition of the selected status tab (see lib/assets/status-filters.ts).
  status?: Prisma.AssetWhereInput;
  // Free text matched against identifiers, model and holder.
  search?: string;
};

function buildSearchWhere(search?: string): Prisma.AssetWhereInput {
  if (!search) return {};
  const contains = { contains: search, mode: "insensitive" as const };
  return {
    OR: [
      { assetTag: contains },
      { serial: contains },
      { name: contains },
      { imei: contains },
      { phoneNumber: contains },
      { model: { name: contains } },
      { model: { manufacturer: contains } },
      { assignedTo: { displayName: contains } },
      { assignedTo: { email: contains } },
      { company: { name: contains } },
    ],
  };
}

function buildWhere(filter: AssetListFilter): Prisma.AssetWhereInput {
  return {
    AND: [
      { type: filter.type },
      filter.status ?? {},
      buildSearchWhere(filter.search),
    ],
  };
}

export async function countAssets(filter: AssetListFilter = {}) {
  return prisma.asset.count({ where: buildWhere(filter) });
}

export async function listStatusLabels() {
  return prisma.statusLabel.findMany({
    select: { id: true, name: true, type: true, color: true },
    orderBy: { id: "asc" },
  });
}

export type StatusTabWithCount = StatusTab & { count: number };

// Every status tab with the number of assets it holds under `filter`.
// Shared by the list tabs and the sidebar "By status" section.
export async function listStatusTabsWithCounts(
  filter: Omit<AssetListFilter, "status"> = {},
): Promise<StatusTabWithCount[]> {
  const tabs = buildStatusTabs(await listStatusLabels());
  const counts = await Promise.all(
    tabs.map((tab) => countAssets({ ...filter, status: tab.where })),
  );
  return tabs.map((tab, index) => ({ ...tab, count: counts[index] }));
}

// `page` is 1-based.
export async function listAssets(
  filter: AssetListFilter = {},
  page = 1,
): Promise<AssetListItem[]> {
  return prisma.asset.findMany({
    where: buildWhere(filter),
    select: assetListSelect,
    orderBy: [{ assetTag: "asc" }, { id: "asc" }],
    skip: (page - 1) * ASSET_PAGE_SIZE,
    take: ASSET_PAGE_SIZE,
  });
}

export async function countAssetsByType(): Promise<Record<AssetType, number>> {
  const groups = await prisma.asset.groupBy({
    by: ["type"],
    _count: { _all: true },
  });

  const counts: Record<AssetType, number> = {
    PC: 0,
    MONITOR: 0,
    PRINTER: 0,
    PHONE: 0,
    VM: 0,
  };
  for (const group of groups) {
    counts[group.type] = group._count._all;
  }
  return counts;
}
