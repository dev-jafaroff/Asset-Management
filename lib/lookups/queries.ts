import type { FormOption } from "@/lib/assets/asset-form-options";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { StatusType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { lookupSlugs, type LookupSlug } from "@/lib/schemas/lookup";
import { formatCount } from "@/lib/utils";

// The admin page of the small tables that assets point to: categories,
// models, companies, locations and statuses.

export const LOOKUPS_PATH = "/admin/lookups";
export const LOOKUP_TAB_PARAM = "table";

// `noun` names one row, e.g. "New category".
type LookupTab = { slug: LookupSlug; label: string; noun: string };

const lookupTabLabels: Record<LookupSlug, Omit<LookupTab, "slug">> = {
  statuses: { label: "Statuses", noun: "status" },
  models: { label: "Models", noun: "model" },
  categories: { label: "Categories", noun: "category" },
  companies: { label: "Companies", noun: "company" },
  locations: { label: "Locations", noun: "location" },
};

// In the order of lookupSlugs; the first tab is the default.
const lookupTabs: LookupTab[] = lookupSlugs.map((slug) => ({
  slug,
  ...lookupTabLabels[slug],
}));

// What each type of status means for an asset, e.g. "Deployable".
export const statusTypeLabels: Record<StatusType, string> = {
  DEPLOYABLE: "Deployable",
  PENDING: "Pending",
  UNDEPLOYABLE: "Undeployable",
  ARCHIVED: "Archived",
};

// The types a status dialog offers, in the order above.
export const statusTypeOptions = Object.entries(statusTypeLabels).map(
  ([value, label]) => ({ value, label }),
);

function searchTerms(search?: string) {
  return (search?.split(/\s+/).filter(Boolean) ?? []).map((term) => ({
    contains: term,
    mode: "insensitive" as const,
  }));
}

// Every word must be in the name, e.g. "floor 2" finds "HQ — Floor 2".
function nameWhere(search?: string) {
  return { AND: searchTerms(search).map((name) => ({ name })) };
}

// Models also match their manufacturer, so "dell 5440" finds Dell Latitude 5440.
function modelWhere(search?: string): Prisma.AssetModelWhereInput {
  return {
    AND: searchTerms(search).map((term) => ({
      OR: [{ name: term }, { manufacturer: term }],
    })),
  };
}

// e.g. "12 assets", "Not used". `inUse` rows cannot be deleted.
export type LookupUsage = { inUse: boolean; label: string };

function describeUsage(
  ...counts: [count: number, singular: string, plural?: string][]
): LookupUsage {
  const used = counts.filter(([count]) => count > 0);
  return {
    inUse: used.length > 0,
    label:
      used.length === 0
        ? "Not used"
        : used
            .map(([count, singular, plural]) =>
              formatCount(count, singular, plural),
            )
            .join(", "),
  };
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

export type LookupTabWithCount = LookupTab & { count: number };

// Every tab with the number of rows that match the search.
export async function listLookupTabsWithCounts(
  search?: string,
): Promise<LookupTabWithCount[]> {
  const where = nameWhere(search);
  const [categories, models, companies, locations, statuses] =
    await Promise.all([
      prisma.category.count({ where }),
      prisma.assetModel.count({ where: modelWhere(search) }),
      prisma.company.count({ where }),
      prisma.location.count({ where }),
      prisma.statusLabel.count({ where }),
    ]);
  const counts: Record<LookupSlug, number> = {
    categories,
    models,
    companies,
    locations,
    statuses,
  };
  return lookupTabs.map((tab) => ({ ...tab, count: counts[tab.slug] }));
}

// The tab of the URL param; anything unknown is the first (Categories).
export function findLookupTab<T extends LookupTab>(
  tabs: T[],
  slug?: string,
): T {
  return tabs.find((tab) => tab.slug === slug) ?? tabs[0];
}

// The default tab has no param, so the plain URL stays clean.
export function toLookupTabParam(slug: string): string | undefined {
  return slug === lookupTabs[0].slug ? undefined : slug;
}

// ─── Lists ───────────────────────────────────────────────────────────────────

// A category holds either asset models (Laptop) or accessories (Mouse).
export async function listCategories(search?: string) {
  const categories = await prisma.category.findMany({
    where: nameWhere(search),
    select: {
      id: true,
      name: true,
      icon: true,
      _count: { select: { models: true, accessories: true } },
    },
    orderBy: { name: "asc" },
  });
  return categories.map(({ _count, ...category }) => ({
    ...category,
    usage: describeUsage(
      [_count.models, "model"],
      [_count.accessories, "accessory", "accessories"],
    ),
  }));
}

export async function listModels(search?: string) {
  const models = await prisma.assetModel.findMany({
    where: modelWhere(search),
    select: {
      id: true,
      name: true,
      manufacturer: true,
      category: { select: { id: true, name: true } },
      _count: { select: { assets: true } },
    },
    orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
  });
  return models.map(({ _count, ...model }) => ({
    ...model,
    assetCount: _count.assets,
    usage: describeUsage([_count.assets, "asset"]),
  }));
}

export async function listCompanies(search?: string) {
  const companies = await prisma.company.findMany({
    where: nameWhere(search),
    select: { id: true, name: true, _count: { select: { assets: true } } },
    orderBy: { name: "asc" },
  });
  return companies.map(({ _count, ...company }) => ({
    ...company,
    assetCount: _count.assets,
    usage: describeUsage([_count.assets, "asset"]),
  }));
}

export async function listLocations(search?: string) {
  const locations = await prisma.location.findMany({
    where: nameWhere(search),
    select: { id: true, name: true, _count: { select: { assets: true } } },
    orderBy: { name: "asc" },
  });
  return locations.map(({ _count, ...location }) => ({
    ...location,
    assetCount: _count.assets,
    usage: describeUsage([_count.assets, "asset"]),
  }));
}

// In the order the asset lists show their status tabs.
export async function listStatuses(search?: string) {
  const statuses = await prisma.statusLabel.findMany({
    where: nameWhere(search),
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      _count: { select: { assets: true } },
    },
    orderBy: { id: "asc" },
  });
  return statuses.map(({ _count, ...status }) => ({
    ...status,
    assetCount: _count.assets,
    usage: describeUsage([_count.assets, "asset"]),
  }));
}

// ─── Dialog options ──────────────────────────────────────────────────────────

// Categories a model can be in: those without accessories, e.g. Laptop.
export async function listModelCategoryOptions(): Promise<FormOption[]> {
  const categories = await prisma.category.findMany({
    where: { accessories: { none: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));
}
