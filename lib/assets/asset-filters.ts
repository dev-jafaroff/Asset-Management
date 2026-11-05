import { formatModelName } from "@/lib/assets/format";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AssetType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  getPositiveIntParam,
  type FilterOption,
  type SearchParams,
} from "@/lib/search-params";

type AssetFilterDefinition = {
  // URL param, e.g. ?company=2
  param: string;
  label: string;
  // Dropdown entry that clears the filter.
  allLabel: string;
  where: (id: number) => Prisma.AssetWhereInput;
  // Only values that assets of this type actually use, so no choice leads to an empty list.
  loadOptions: (assets: Prisma.AssetWhereInput) => Promise<FilterOption[]>;
};

// Dropdown filters on asset lists. Adding a filter means adding an entry here.
export const assetFilters = [
  {
    param: "company",
    label: "Company",
    allLabel: "All companies",
    where: (id) => ({ companyId: id }),
    loadOptions: async (assets) => {
      const companies = await prisma.company.findMany({
        where: { assets: { some: assets } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      return companies.map((c) => ({ value: String(c.id), label: c.name }));
    },
  },
  {
    param: "location",
    label: "Location",
    allLabel: "All locations",
    where: (id) => ({ locationId: id }),
    loadOptions: async (assets) => {
      const locations = await prisma.location.findMany({
        where: { assets: { some: assets } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      return locations.map((l) => ({ value: String(l.id), label: l.name }));
    },
  },
  {
    param: "model",
    label: "Model",
    allLabel: "All models",
    where: (id) => ({ modelId: id }),
    loadOptions: async (assets) => {
      const models = await prisma.assetModel.findMany({
        where: { assets: { some: assets } },
        select: { id: true, name: true, manufacturer: true },
        orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
      });
      return models.map((m) => ({
        value: String(m.id),
        label: formatModelName(m) ?? m.name,
      }));
    },
  },
] as const satisfies readonly AssetFilterDefinition[];

export type AssetFilterParam = (typeof assetFilters)[number]["param"];

// Selected ids by param, e.g. { company: 2, model: 5 }.
export type AssetFilterValues = Partial<Record<AssetFilterParam, number>>;

// Invalid ids (e.g. ?company=abc) are ignored rather than failing the page.
export function parseAssetFilters(params: SearchParams): AssetFilterValues {
  const values: AssetFilterValues = {};
  for (const filter of assetFilters) {
    const id = getPositiveIntParam(params, filter.param);
    if (id !== undefined) values[filter.param] = id;
  }
  return values;
}

export function buildAssetFilterWhere(
  values: AssetFilterValues = {},
): Prisma.AssetWhereInput {
  return {
    AND: assetFilters.flatMap((filter) => {
      const id = values[filter.param];
      return id === undefined ? [] : [filter.where(id)];
    }),
  };
}

export type AssetFilterWithOptions = (typeof assetFilters)[number] & {
  options: FilterOption[];
};

// Filters with their dropdown choices for one asset type (all types if omitted).
export async function loadAssetFilterOptions(
  type?: AssetType,
): Promise<AssetFilterWithOptions[]> {
  const assets: Prisma.AssetWhereInput = { type };
  return Promise.all(
    assetFilters.map(async (filter) => ({
      ...filter,
      options: await filter.loadOptions(assets),
    })),
  );
}
