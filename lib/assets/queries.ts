import { Prisma } from "@/lib/generated/prisma/client";
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

export type AssetListFilter = {
  type?: AssetType;
};

function buildWhere(filter: AssetListFilter): Prisma.AssetWhereInput {
  return {
    type: filter.type,
  };
}

export async function listAssets(
  filter: AssetListFilter = {},
): Promise<AssetListItem[]> {
  return prisma.asset.findMany({
    where: buildWhere(filter),
    select: assetListSelect,
    orderBy: [{ assetTag: "asc" }, { id: "asc" }],
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
