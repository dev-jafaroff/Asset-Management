import {
  type ColumnDef,
  createColumnHelper,
  tableFeatures,
} from "@tanstack/react-table";
import { StatusBadge } from "@/components/assets/status-badge";
import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import {
  formatModelName,
  getAssetDisplayName,
  getAssetDisplayStatus,
  getAssetHolder,
} from "@/lib/assets/format";
import type { AssetListItem } from "@/lib/assets/queries";
import type { AssetType } from "@/lib/generated/prisma/enums";

// Core features only for now; sorting, selection and visibility are added per step.
export const assetTableFeatures = tableFeatures({});

type AssetColumn = ColumnDef<typeof assetTableFeatures, AssetListItem>;

const column = createColumnHelper<typeof assetTableFeatures, AssetListItem>();

function orDash(value: string | number | null): string | number {
  return value ?? "—";
}

// ─── Shared columns ──────────────────────────────────────────────────────────

const assetTag = column.accessor("assetTag", {
  header: "Asset tag",
  cell: (info) => (
    <span className="font-medium text-primary">{orDash(info.getValue())}</span>
  ),
});

const displayName = column.accessor((asset) => getAssetDisplayName(asset), {
  id: "asset",
  header: "Asset",
  cell: (info) => (
    <span className="font-medium text-primary">{info.getValue()}</span>
  ),
});

const name = column.accessor("name", {
  header: "Name",
  cell: (info) => orDash(info.getValue()),
});

const assetType = column.accessor("type", {
  header: "Type",
  cell: (info) => getAssetTypeConfig(info.getValue()).singularLabel,
});

const model = column.accessor((asset) => formatModelName(asset.model), {
  id: "model",
  header: "Model",
  cell: (info) => orDash(info.getValue()),
});

// What the device is, e.g. "Card reader" on the mixed "Other" list.
const category = column.accessor(
  (asset) => asset.model?.category.name ?? null,
  {
    id: "category",
    header: "Category",
    cell: (info) => orDash(info.getValue()),
  },
);

const serial = column.accessor("serial", {
  header: "Serial",
  cell: (info) => (
    <span className="font-mono text-xs">{orDash(info.getValue())}</span>
  ),
});

const status = column.accessor((asset) => getAssetDisplayStatus(asset), {
  id: "status",
  header: "Status",
  cell: (info) => <StatusBadge status={info.getValue()} />,
});

const assignedTo = column.accessor((asset) => getAssetHolder(asset), {
  id: "assignedTo",
  header: "Assigned to",
  cell: (info) => orDash(info.getValue()),
});

const company = column.accessor((asset) => asset.company?.name ?? null, {
  id: "company",
  header: "Company",
  cell: (info) => orDash(info.getValue()),
});

const location = column.accessor((asset) => asset.location?.name ?? null, {
  id: "location",
  header: "Location",
  cell: (info) => (
    <span className="text-muted-foreground">{orDash(info.getValue())}</span>
  ),
});

// One line, cut off with "…"; the full text is shown on hover and on the detail page.
const notes = column.accessor("notes", {
  header: "Notes",
  cell: (info) => {
    const value = info.getValue();
    return value ? (
      <span
        title={value}
        className="block max-w-64 truncate text-muted-foreground"
      >
        {value}
      </span>
    ) : (
      "—"
    );
  },
});

// ─── Type-specific columns ───────────────────────────────────────────────────

const operatingSystem = column.accessor(
  (asset) =>
    [asset.operatingSystem, asset.osVersion].filter(Boolean).join(" ") || null,
  {
    id: "operatingSystem",
    header: "OS",
    cell: (info) => (
      <span className="text-muted-foreground">{orDash(info.getValue())}</span>
    ),
  },
);

const imei = column.accessor("imei", {
  header: "IMEI",
  cell: (info) => (
    <span className="font-mono text-xs">{orDash(info.getValue())}</span>
  ),
});

const phoneNumber = column.accessor("phoneNumber", {
  header: "Phone number",
  cell: (info) => (
    <span className="font-mono text-xs">{orDash(info.getValue())}</span>
  ),
});

const vmHost = column.accessor("vmHost", {
  header: "Host",
  cell: (info) => orDash(info.getValue()),
});

const vCpu = column.accessor("vCpu", {
  header: "vCPU",
  cell: (info) => orDash(info.getValue()),
});

const ramGb = column.accessor("ramGb", {
  header: "RAM",
  cell: (info) => {
    const value = info.getValue();
    return value === null ? "—" : `${value} GB`;
  },
});

// VMs are assigned to a company, so the holder column is labeled accordingly.
const assignedCompany = column.accessor((asset) => getAssetHolder(asset), {
  id: "assignedCompany",
  header: "Assigned company",
  cell: (info) => orDash(info.getValue()),
});

// ─── Column sets ─────────────────────────────────────────────────────────────

const columnsByType: Record<AssetType, AssetColumn[]> = {
  PC: column.columns([
    assetTag,
    name,
    model,
    status,
    assignedTo,
    company,
    location,
    operatingSystem,
    notes,
  ]),
  MONITOR: column.columns([
    assetTag,
    model,
    serial,
    status,
    assignedTo,
    company,
    location,
    notes,
  ]),
  PRINTER: column.columns([
    assetTag,
    model,
    serial,
    status,
    assignedTo,
    company,
    location,
    notes,
  ]),
  PHONE: column.columns([
    model,
    imei,
    phoneNumber,
    status,
    assignedTo,
    company,
    operatingSystem,
    notes,
  ]),
  VM: column.columns([
    name,
    operatingSystem,
    vmHost,
    vCpu,
    ramGb,
    status,
    assignedCompany,
    notes,
  ]),
  // Installed at a location, so there is no "Assigned to" column.
  ACCESS_POINT: column.columns([
    assetTag,
    model,
    serial,
    status,
    location,
    company,
    notes,
  ]),
  CAMERA: column.columns([
    assetTag,
    model,
    serial,
    status,
    location,
    company,
    notes,
  ]),
  OTHER: column.columns([
    assetTag,
    category,
    model,
    serial,
    status,
    location,
    company,
    notes,
  ]),
};

const allAssetColumns: AssetColumn[] = column.columns([
  displayName,
  assetType,
  model,
  status,
  assignedTo,
  company,
  notes,
]);

export function getAssetColumns(type?: AssetType): AssetColumn[] {
  return type ? columnsByType[type] : allAssetColumns;
}
