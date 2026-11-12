import { formatModelName } from "@/lib/assets/format";
import { prisma } from "@/lib/prisma";

// One choice in a form list. The description is shown under the label and
// can be searched too, e.g. a model's category or a person's email.
export type FormOption = {
  value: number;
  label: string;
  description?: string;
};

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
    prisma.assetModel.findMany({
      select: {
        id: true,
        name: true,
        manufacturer: true,
        category: { select: { name: true } },
      },
      orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
    }),
    prisma.statusLabel.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { id: "asc" },
    }),
    prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // People who left keep their history, but get nothing new.
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, email: true, department: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return {
    models: models.map((model) => ({
      value: model.id,
      label: formatModelName(model) ?? model.name,
      description: model.category.name,
    })),
    statuses: statuses.map((status) => ({
      value: status.id,
      label: status.name,
    })),
    companies: companies.map((company) => ({
      value: company.id,
      label: company.name,
    })),
    locations: locations.map((location) => ({
      value: location.id,
      label: location.name,
    })),
    users: users.map((user) => ({
      value: user.id,
      label: user.displayName,
      description: [user.email, user.department].filter(Boolean).join(" · "),
    })),
    defaultStatusId:
      statuses.find((status) => status.type === "DEPLOYABLE")?.id ?? null,
  };
}
