import { formatModelName } from "@/lib/assets/format";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AssetType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  getParam,
  type FilterOption,
  type SearchParams,
} from "@/lib/search-params";

type AssetFilterDefinition = {
  // URL param, e.g. ?company=2
  param: string;
  label: string;
  // Dropdown entry that clears the filter.
  allLabel: string;
  // The condition for a value from the URL; undefined for a value that is
  // not valid (e.g. ?company=abc), which is ignored rather than failing the
  // page.
  where: (value: string) => Prisma.AssetWhereInput | undefined;
  // Only values that assets of this type actually use, so no choice leads to an empty list.
  loadOptions: (assets: Prisma.AssetWhereInput) => Promise<FilterOption[]>;
};

// A filter whose values are ids, e.g. ?company=2.
function whereId(
  where: (id: number) => Prisma.AssetWhereInput,
): (value: string) => Prisma.AssetWhereInput | undefined {
  return (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? where(id) : undefined;
  };
}

// Systems as the OS filter groups them. A device is in a group when its OS,
// or a dual-boot PC's second one, contains one of the words: Intune's
// "Linux (ubuntu)", or "Ubuntu 22.04" typed for a VM.
const osFamilies = [
  { value: "windows", label: "Windows", words: ["Windows"] },
  { value: "macos", label: "macOS", words: ["macOS", "Mac OS"] },
  { value: "linux", label: "Linux", words: ["Linux", "Ubuntu", "Debian"] },
] as const;

type OsFamily = (typeof osFamilies)[number];

function whereOsFamily(family: OsFamily): Prisma.AssetWhereInput {
  return {
    OR: family.words.flatMap((word) => [
      { operatingSystem: { contains: word, mode: "insensitive" as const } },
      {
        secondaryOperatingSystem: {
          contains: word,
          mode: "insensitive" as const,
        },
      },
    ]),
  };
}

// Dropdown filters on asset lists. Adding a filter means adding an entry here.
export const assetFilters = [
  {
    param: "company",
    label: "Company",
    allLabel: "All companies",
    where: whereId((id) => ({ companyId: id })),
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
    where: whereId((id) => ({ locationId: id })),
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
    where: whereId((id) => ({ modelId: id })),
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
  {
    param: "os",
    label: "OS",
    allLabel: "All systems",
    where: (value) => {
      const family = osFamilies.find((family) => family.value === value);
      return family ? whereOsFamily(family) : undefined;
    },
    // Every system for types that have one (PCs, VMs, phones), even one no
    // device runs yet (e.g. macOS before the first Mac); none for the rest.
    loadOptions: async (assets) => {
      const withOs = await prisma.asset.count({
        where: { AND: [assets, { operatingSystem: { not: null } }] },
      });
      return withOs > 0
        ? osFamilies.map(({ value, label }) => ({ value, label }))
        : [];
    },
  },
] as const satisfies readonly AssetFilterDefinition[];

export type AssetFilterParam = (typeof assetFilters)[number]["param"];

// Selected values by param, e.g. { company: "2", os: "linux" }.
export type AssetFilterValues = Partial<Record<AssetFilterParam, string>>;

// Values a filter does not know (e.g. ?company=abc) are ignored rather than
// failing the page.
export function parseAssetFilters(params: SearchParams): AssetFilterValues {
  const values: AssetFilterValues = {};
  for (const filter of assetFilters) {
    const value = getParam(params, filter.param);
    if (value !== undefined && filter.where(value)) {
      values[filter.param] = value;
    }
  }
  return values;
}

export function buildAssetFilterWhere(
  values: AssetFilterValues = {},
): Prisma.AssetWhereInput {
  return {
    AND: assetFilters.flatMap((filter) => {
      const value = values[filter.param];
      const where = value === undefined ? undefined : filter.where(value);
      return where ? [where] : [];
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
