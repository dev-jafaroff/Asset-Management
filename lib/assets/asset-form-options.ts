import type { AssignTarget } from "@/lib/assets/asset-types";
import { formatModelName } from "@/lib/assets/format";
import { prisma } from "@/lib/prisma";

// One choice in a form list. The description is shown under the label and
// can be searched too, e.g. a model's category or a person's email.
export type FormOption = {
  value: number;
  label: string;
  description?: string;
};

// ─── Lists ───────────────────────────────────────────────────────────────────

async function listModelOptions(): Promise<FormOption[]> {
  const models = await prisma.assetModel.findMany({
    select: {
      id: true,
      name: true,
      manufacturer: true,
      category: { select: { name: true } },
    },
    orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
  });
  return models.map((model) => ({
    value: model.id,
    label: formatModelName(model) ?? model.name,
    description: model.category.name,
  }));
}

// In the order of the Lookup tables (In stock first), with their type, so a
// default can be picked by what the status means.
async function listStatuses() {
  return prisma.statusLabel.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { id: "asc" },
  });
}

function toStatusOptions(
  statuses: Awaited<ReturnType<typeof listStatuses>>,
): FormOption[] {
  return statuses.map((status) => ({ value: status.id, label: status.name }));
}

async function listCompanyOptions(): Promise<FormOption[]> {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return companies.map((company) => ({
    value: company.id,
    label: company.name,
  }));
}

async function listLocationOptions(): Promise<FormOption[]> {
  const locations = await prisma.location.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return locations.map((location) => ({
    value: location.id,
    label: location.name,
  }));
}

// People who left keep their history, but get nothing new.
async function listUserOptions(): Promise<FormOption[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true, email: true, department: true },
    orderBy: { displayName: "asc" },
  });
  return users.map((user) => ({
    value: user.id,
    label: user.displayName,
    description: [user.email, user.department].filter(Boolean).join(" · "),
  }));
}

// ─── Asset form ──────────────────────────────────────────────────────────────

export type AssetFormOptions = {
  models: FormOption[];
  statuses: FormOption[];
  companies: FormOption[];
  locations: FormOption[];
  users: FormOption[];
  // A new asset starts as the first deployable status, e.g. "In stock".
  defaultStatusId: number | null;
};

// Everything the lists of the asset form offer, loaded in parallel.
export async function getAssetFormOptions(): Promise<AssetFormOptions> {
  const [models, statuses, companies, locations, users] = await Promise.all([
    listModelOptions(),
    listStatuses(),
    listCompanyOptions(),
    listLocationOptions(),
    listUserOptions(),
  ]);
  return {
    models,
    statuses: toStatusOptions(statuses),
    companies,
    locations,
    users,
    defaultStatusId:
      statuses.find((status) => status.type === "DEPLOYABLE")?.id ?? null,
  };
}

// ─── Checkout and checkin ────────────────────────────────────────────────────

const holderOptionLoaders: Record<AssignTarget, () => Promise<FormOption[]>> = {
  user: listUserOptions,
  company: listCompanyOptions,
  location: listLocationOptions,
};

// Who or where an asset can be checked out to, per its type's assignTo.
export function getHolderOptions(
  assignTo: AssignTarget,
): Promise<FormOption[]> {
  return holderOptionLoaders[assignTo]();
}

// A returned asset is used, so it goes to storage rather than back in stock
// (see docs/PLAN.md, Statuses). Matched by name, as statuses are editable.
const RETURNED_STATUS_NAME = "In storage";

export type CheckinOptions = {
  statuses: FormOption[];
  defaultStatusId: number | null;
};

// ─── Bulk actions ────────────────────────────────────────────────────────────

export type BulkActionOptions = CheckinOptions & {
  // Per kind of holder the list's types go to; "All assets" has all three.
  holders: Partial<Record<AssignTarget, FormOption[]>>;
};

// The lists the dialogs above an asset list offer. Statuses serve both the
// checkin and the status change.
export async function getBulkActionOptions(
  assignTargets: readonly AssignTarget[],
): Promise<BulkActionOptions> {
  const [checkin, holderLists] = await Promise.all([
    getCheckinOptions(),
    Promise.all(assignTargets.map((target) => getHolderOptions(target))),
  ]);
  return {
    ...checkin,
    holders: Object.fromEntries(
      assignTargets.map((target, index) => [target, holderLists[index]]),
    ),
  };
}

// Statuses an asset can get when it comes back, "In storage" first chosen.
export async function getCheckinOptions(): Promise<CheckinOptions> {
  const statuses = await listStatuses();
  const returned =
    statuses.find((status) => status.name === RETURNED_STATUS_NAME) ??
    statuses.find((status) => status.type === "DEPLOYABLE");
  return {
    statuses: toStatusOptions(statuses),
    defaultStatusId: returned?.id ?? null,
  };
}
