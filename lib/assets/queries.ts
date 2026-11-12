import { Prisma } from "@/lib/generated/prisma/client";
import { assetTypeConfigs } from "@/lib/assets/asset-types";
import {
  buildAssetFilterWhere,
  type AssetFilterValues,
} from "@/lib/assets/asset-filters";
import { getAssetDisplayName } from "@/lib/assets/format";
import { buildStatusTabs, type StatusTab } from "@/lib/assets/status-filters";
import type { AssetType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const assetListSelect = {
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
  notes: true,
  updatedAt: true,
  status: { select: { id: true, name: true, type: true, color: true } },
  model: {
    select: {
      id: true,
      name: true,
      manufacturer: true,
      category: { select: { name: true } },
    },
  },
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
  // Dropdown filters (see lib/assets/asset-filters.ts).
  filters?: AssetFilterValues;
};

// Fields one search word is matched against.
function matchSearchTerm(term: string): Prisma.AssetWhereInput {
  const contains = { contains: term, mode: "insensitive" as const };
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

// Every word must match some field, so "apple iphone 15" finds the model
// "iPhone 15" by manufacturer "Apple", although no single field holds the whole text.
function buildSearchWhere(search?: string): Prisma.AssetWhereInput {
  const terms = search?.split(/\s+/).filter(Boolean) ?? [];
  return { AND: terms.map(matchSearchTerm) };
}

function buildWhere(filter: AssetListFilter): Prisma.AssetWhereInput {
  return {
    AND: [
      { type: filter.type },
      filter.status ?? {},
      buildSearchWhere(filter.search),
      buildAssetFilterWhere(filter.filters),
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

  // Start every type at 0, so types without assets are still listed.
  const counts = Object.fromEntries(
    assetTypeConfigs.map((config) => [config.type, 0]),
  ) as Record<AssetType, number>;
  for (const group of groups) {
    counts[group.type] = group._count._all;
  }
  return counts;
}

// Identifiers that must be unique across all assets.
export type UniqueAssetFields = {
  assetTag?: string | null;
  serial?: string | null;
  imei?: string | null;
};

// Which of these identifiers another asset already uses, with that asset's
// name, e.g. { serial: "PC-00007" }. `exceptId` skips the asset being edited.
export async function findTakenIdentifiers(
  values: UniqueAssetFields,
  exceptId?: number,
): Promise<Partial<Record<keyof UniqueAssetFields, string>>> {
  const { assetTag, serial, imei } = values;
  const matches: Prisma.AssetWhereInput[] = [];
  if (assetTag) matches.push({ assetTag });
  if (serial) matches.push({ serial });
  if (imei) matches.push({ imei });
  if (matches.length === 0) return {};

  const owners = await prisma.asset.findMany({
    where: { OR: matches, NOT: exceptId ? { id: exceptId } : undefined },
    select: {
      id: true,
      assetTag: true,
      name: true,
      serial: true,
      imei: true,
      model: assetListSelect.model,
    },
  });

  const taken: Partial<Record<keyof UniqueAssetFields, string>> = {};
  for (const owner of owners) {
    const ownerName = getAssetDisplayName(owner);
    if (assetTag && owner.assetTag === assetTag) taken.assetTag = ownerName;
    if (serial && owner.serial === serial) taken.serial = ownerName;
    if (imei && owner.imei === imei) taken.imei = ownerName;
  }
  return taken;
}
