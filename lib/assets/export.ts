import {
  assetFormFieldLabels,
  getAssetFormSections,
  type AssetFormField,
} from "@/lib/assets/asset-form";
import { assetTypeConfigs, getAssetTypeConfig } from "@/lib/assets/asset-types";
import { getAssetDisplayStatus, joinOsName } from "@/lib/assets/format";
import {
  listAssetsForExport,
  type AssetExportItem,
  type AssetListFilter,
} from "@/lib/assets/queries";
import type { ExportColumn, ExportTable } from "@/lib/export/xlsx";
import type { AssetType } from "@/lib/generated/prisma/enums";

type AssetExportColumn = ExportColumn<AssetExportItem> & {
  // Exported for the types whose form has this field, e.g. IMEI for phones,
  // and for any other type when an asset has a value in it, e.g. the OS of
  // a PC synced from Intune. Columns without one are always exported.
  field?: AssetFormField;
};

// Same label as in the form, e.g. "Serial".
function fieldColumn(
  field: AssetFormField,
  value: AssetExportColumn["value"],
): AssetExportColumn {
  return { header: assetFormFieldLabels[field], field, value };
}

// Every column an export can have, in file order: the type's fields
// (hidden list columns too), then when the asset was added and changed.
const assetExportColumns: AssetExportColumn[] = [
  fieldColumn("assetTag", (asset) => asset.assetTag),
  fieldColumn("name", (asset) => asset.name),
  {
    header: "Category",
    field: "modelId",
    value: (asset) => asset.model?.category.name,
  },
  {
    header: "Manufacturer",
    field: "modelId",
    value: (asset) => asset.model?.manufacturer,
  },
  fieldColumn("modelId", (asset) => asset.model?.name),
  fieldColumn("serial", (asset) => asset.serial),
  fieldColumn("imei", (asset) => asset.imei),
  fieldColumn("phoneNumber", (asset) => asset.phoneNumber),
  fieldColumn("operatingSystem", (asset) => asset.operatingSystem),
  {
    header: "OS version",
    field: "operatingSystem",
    value: (asset) => asset.osVersion,
  },
  {
    header: "Second OS (dual boot)",
    field: "operatingSystem",
    value: (asset) =>
      joinOsName(asset.secondaryOperatingSystem, asset.secondaryOsVersion),
  },
  fieldColumn("vmHost", (asset) => asset.vmHost),
  fieldColumn("vCpu", (asset) => asset.vCpu),
  fieldColumn("ramGb", (asset) => asset.ramGb),
  // As the list shows it: "Assigned" when a deployable asset is handed out.
  { header: "Status", value: (asset) => getAssetDisplayStatus(asset).label },
  fieldColumn("assignedToId", (asset) => asset.assignedTo?.displayName),
  {
    header: "User email",
    field: "assignedToId",
    value: (asset) => asset.assignedTo?.email,
  },
  fieldColumn("companyId", (asset) => asset.company?.name),
  fieldColumn("locationId", (asset) => asset.location?.name),
  {
    ...fieldColumn("purchaseDate", (asset) => asset.purchaseDate),
    format: "date",
  },
  {
    ...fieldColumn("purchaseCost", (asset) => asset.purchaseCost?.toNumber()),
    format: "money",
  },
  fieldColumn("notes", (asset) => asset.notes),
  { header: "Added", value: (asset) => asset.createdAt, format: "dateTime" },
  {
    header: "Last changed",
    value: (asset) => asset.updatedAt,
    format: "dateTime",
  },
];

const typeColumn: AssetExportColumn = {
  header: "Type",
  value: (asset) => getAssetTypeConfig(asset.type).singularLabel,
};

// The fields the forms of these types show.
function getFormFields(types: AssetType[]): Set<AssetFormField> {
  return new Set(
    types.flatMap((type) =>
      getAssetFormSections(type, "create").flatMap((section) => section.fields),
    ),
  );
}

// The columns for these assets: the fields of their types, with a Type
// column when the file mixes types. A list without rows gets the columns
// of its type, or of every type.
function getAssetExportColumns(
  assets: AssetExportItem[],
  listType?: AssetType,
): AssetExportColumn[] {
  const rowTypes = [...new Set(assets.map((asset) => asset.type))];
  const types =
    rowTypes.length > 0
      ? rowTypes
      : listType
        ? [listType]
        : assetTypeConfigs.map((config) => config.type);
  const fields = getFormFields(types);

  const columns = assetExportColumns.filter(
    (column) =>
      column.field === undefined ||
      fields.has(column.field) ||
      assets.some((asset) => {
        const value = column.value(asset);
        return value !== null && value !== undefined && value !== "";
      }),
  );
  return types.length > 1 ? [typeColumn, ...columns] : columns;
}

// The assets of an export, with their columns.
export async function loadAssetExport(
  filter: AssetListFilter,
): Promise<ExportTable<AssetExportItem>> {
  const assets = await listAssetsForExport(filter);
  return {
    columns: getAssetExportColumns(assets, filter.type),
    rows: assets,
  };
}
