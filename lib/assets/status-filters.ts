import { assetTypeConfigs, type AssignTarget } from "@/lib/assets/asset-types";
import { ASSIGNED_STATUS } from "@/lib/assets/format";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { StatusType } from "@/lib/generated/prisma/enums";

export const STATUS_PARAM = "status";
export const ALL_STATUS_SLUG = "all";

export type StatusTab = {
  slug: string;
  label: string;
  color: string | null;
  where: Prisma.AssetWhereInput;
};

type StatusLabelRef = {
  id: number;
  name: string;
  type: StatusType;
  color: string;
};

const holderSetWhere: Record<AssignTarget, Prisma.AssetWhereInput> = {
  user: { assignedToId: { not: null } },
  company: { companyId: { not: null } },
  location: { locationId: { not: null } },
};

// Database version of isAssetAssigned() in lib/assets/format.ts:
// each type counts as assigned when its assignTo target is set.
const assignedWhere: Prisma.AssetWhereInput = {
  OR: assetTypeConfigs.map((config) => ({
    type: config.type,
    ...holderSetWhere[config.assignTo],
  })),
};

// "In repair" → "in-repair"
export function toStatusSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Tabs follow the status labels in the database, so a status added in
// Lookup tables gets its own tab automatically.
export function buildStatusTabs(statuses: StatusLabelRef[]): StatusTab[] {
  return [
    { slug: ALL_STATUS_SLUG, label: "All", color: null, where: {} },
    {
      slug: toStatusSlug(ASSIGNED_STATUS.label),
      label: ASSIGNED_STATUS.label,
      color: ASSIGNED_STATUS.color,
      where: { AND: [{ status: { type: "DEPLOYABLE" } }, assignedWhere] },
    },
    ...statuses.map((status) => ({
      slug: toStatusSlug(status.name),
      label: status.name,
      color: status.color,
      // Assigned deployable assets show under "Assigned", not under their label.
      where:
        status.type === "DEPLOYABLE"
          ? { AND: [{ statusId: status.id }, { NOT: assignedWhere }] }
          : { statusId: status.id },
    })),
  ];
}

// Value of the ?status= param for a tab; "All" is the default, so it has none.
export function toStatusParam(slug: string): string | undefined {
  return slug === ALL_STATUS_SLUG ? undefined : slug;
}

// Unknown or missing slugs fall back to "All".
export function findStatusTab<T extends StatusTab>(
  tabs: T[],
  slug?: string,
): T {
  return tabs.find((tab) => tab.slug === slug) ?? tabs[0];
}
