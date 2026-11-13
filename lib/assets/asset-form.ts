import {
  getAssetTypeConfig,
  type AssignTarget,
} from "@/lib/assets/asset-types";
import type { AssetDetail } from "@/lib/assets/asset-detail";
import type { AssetSource, AssetType } from "@/lib/generated/prisma/enums";
import type { AssetFormData, AssetFormValues } from "@/lib/schemas/asset";

// Every field the asset form can show. Which ones a type shows is decided
// below, so the form, its validation and the save all follow one list.
export type AssetFormField =
  | "assetTag"
  | "name"
  | "serial"
  | "modelId"
  | "statusId"
  | "companyId"
  | "locationId"
  | "assignedToId"
  | "imei"
  | "phoneNumber"
  | "operatingSystem"
  | "vmHost"
  | "vCpu"
  | "ramGb"
  | "purchaseDate"
  | "purchaseCost"
  | "notes";

// Fields chosen from a list: they hold an id (or null); all others hold text.
export const assetListFields = [
  "modelId",
  "statusId",
  "companyId",
  "locationId",
  "assignedToId",
] as const satisfies readonly AssetFormField[];

export type AssetListField = (typeof assetListFields)[number];
export type AssetTextField = Exclude<AssetFormField, AssetListField>;

export function isAssetListField(
  field: AssetFormField,
): field is AssetListField {
  return (assetListFields as readonly AssetFormField[]).includes(field);
}

// What a save returns when it fails; on success it opens the asset instead.
export type AssetFormErrors = {
  // About the whole form, e.g. a missing permission.
  message?: string;
  // Shown under each field.
  fields?: Partial<Record<AssetFormField, string>>;
};

// Also the field names written to the asset history.
export const assetFormFieldLabels: Record<AssetFormField, string> = {
  assetTag: "Asset tag",
  name: "Name",
  serial: "Serial",
  modelId: "Model",
  statusId: "Status",
  companyId: "Company",
  locationId: "Location",
  assignedToId: "User",
  imei: "IMEI",
  phoneNumber: "Phone number",
  operatingSystem: "OS",
  vmHost: "Host",
  vCpu: "vCPU",
  ramGb: "RAM (GB)",
  purchaseDate: "Purchase date",
  purchaseCost: "Purchase cost",
  notes: "Notes",
};

// The field that holds an asset's holder, per its type's assignTo.
export const holderFields: Record<AssignTarget, AssetFormField> = {
  user: "assignedToId",
  company: "companyId",
  location: "locationId",
};

type TypeFormConfig = {
  // Shown next to the model in Details, e.g. the VM's name.
  identity?: AssetFormField[];
  // A card of the type's own fields, e.g. a phone's IMEI and number.
  section?: AssetFormSection;
  // VMs have no serial number.
  hasSerial?: boolean;
  // Defaults to the model: a phone or a monitor is known by it.
  required?: AssetFormField[];
  // A new asset is named after its tag, e.g. workstation PC-00041 is called
  // "PC-00041"; the rare exception is renamed by hand.
  nameFromTag?: boolean;
};

const typeFormConfigs: Record<AssetType, TypeFormConfig> = {
  PC: { identity: ["name"], nameFromTag: true },
  MONITOR: {},
  PRINTER: {},
  PHONE: {
    section: {
      title: "Phone",
      fields: ["imei", "phoneNumber", "operatingSystem"],
    },
  },
  VM: {
    identity: ["name"],
    hasSerial: false,
    // A VM is known by its name; many have no model.
    required: ["name"],
    section: {
      title: "Virtual machine",
      fields: ["operatingSystem", "vmHost", "vCpu", "ramGb"],
    },
  },
  ACCESS_POINT: {},
  CAMERA: {},
  OTHER: {},
};

export type AssetFormSection = {
  title: string;
  description?: string;
  fields: AssetFormField[];
};

// A new asset can be assigned right away; an existing one is checked out or
// in from its page instead, so editing never moves it to another holder.
export type AssetFormMode = "create" | "edit";

// Cards of the form for one type, in display order.
export function getAssetFormSections(
  type: AssetType,
  mode: AssetFormMode,
): AssetFormSection[] {
  const { tagPrefix, assignTo } = getAssetTypeConfig(type);
  const { identity = [], section, hasSerial = true } = typeFormConfigs[type];
  const holderField = holderFields[assignTo];

  const details: AssetFormField[] = [
    ...(tagPrefix ? (["assetTag"] as const) : []),
    ...identity,
    ...(hasSerial ? (["serial"] as const) : []),
    "modelId",
    "statusId",
    // The holder field moves to Assignment, e.g. a VM's company.
    ...(["companyId", "locationId"] as const).filter(
      (field) => field !== holderField,
    ),
  ];

  return [
    { title: "Details", fields: details },
    ...(section ? [section] : []),
    ...(mode === "create"
      ? [
          {
            title: "Assignment",
            description: "Optional: leave it empty to keep the asset in stock.",
            fields: [holderField],
          },
        ]
      : []),
    { title: "Purchase", fields: ["purchaseDate", "purchaseCost"] },
    { title: "Notes", fields: ["notes"] },
  ];
}

// Fields owned by Intune for synced devices (see docs/PLAN.md, field ownership).
const intuneOwnedFields: AssetFormField[] = [
  "name",
  "serial",
  "operatingSystem",
];

// Fields shown in the form but not editable, with the reason shown under each.
export function getLockedAssetFields(
  mode: AssetFormMode,
  source: AssetSource,
): Partial<Record<AssetFormField, string>> {
  const locked: Partial<Record<AssetFormField, string>> = {};
  if (mode === "edit") locked.assetTag = "Printed on the label, so it stays.";
  if (source === "INTUNE") {
    for (const field of intuneOwnedFields)
      locked[field] = "Synced from Intune.";
  }
  return locked;
}

// The fields a save writes: every field the form shows, except locked ones.
export function getEditableAssetFields(
  type: AssetType,
  mode: AssetFormMode,
  source: AssetSource,
): AssetFormField[] {
  const locked = getLockedAssetFields(mode, source);
  return getAssetFormSections(type, mode)
    .flatMap((section) => section.fields)
    .filter((field) => !locked[field]);
}

// Whether a new asset of this type takes its tag as its name.
export function isNamedAfterTag(type: AssetType): boolean {
  return typeFormConfigs[type].nameFromTag ?? false;
}

// Fields the form cannot be saved without.
export function getRequiredAssetFields(type: AssetType): AssetFormField[] {
  const { tagPrefix } = getAssetTypeConfig(type);
  const { required = ["modelId"] } = typeFormConfigs[type];
  return [
    "statusId",
    ...(tagPrefix ? (["assetTag"] as const) : []),
    ...required,
  ];
}

// Only the editable fields: anything else that was sent (e.g. a phone number
// for a PC, or a changed tag) is not saved.
export function pickAssetFormData(
  data: AssetFormData,
  editableFields: AssetFormField[],
): Partial<AssetFormData> {
  const fields = new Set<string>(editableFields);
  return Object.fromEntries(
    Object.entries(data).filter(([field]) => fields.has(field)),
  );
}

// A blank form: inputs hold "" and lists hold null until something is chosen.
export function getEmptyAssetFormValues(): AssetFormValues {
  return {
    assetTag: "",
    name: "",
    serial: "",
    modelId: null,
    statusId: null,
    companyId: null,
    locationId: null,
    assignedToId: null,
    imei: "",
    phoneNumber: "",
    operatingSystem: "",
    vmHost: "",
    vCpu: "",
    ramGb: "",
    purchaseDate: "",
    purchaseCost: "",
    notes: "",
  };
}

// An existing asset as the form holds it: ids for lists, text for inputs.
export function toAssetFormValues(asset: AssetDetail): AssetFormValues {
  const text = (value: string | number | null) =>
    value === null ? "" : String(value);
  return {
    assetTag: text(asset.assetTag),
    name: text(asset.name),
    serial: text(asset.serial),
    modelId: asset.model?.id ?? null,
    statusId: asset.status.id,
    companyId: asset.company?.id ?? null,
    locationId: asset.location?.id ?? null,
    assignedToId: asset.assignedTo?.id ?? null,
    imei: text(asset.imei),
    phoneNumber: text(asset.phoneNumber),
    operatingSystem: text(asset.operatingSystem),
    vmHost: text(asset.vmHost),
    vCpu: text(asset.vCpu),
    ramGb: text(asset.ramGb),
    // A date input takes "2026-03-14"; the column is a plain date (UTC midnight).
    purchaseDate: asset.purchaseDate?.toISOString().slice(0, 10) ?? "",
    purchaseCost: asset.purchaseCost?.toFixed(2) ?? "",
    notes: text(asset.notes),
  };
}

// The form of a new asset: the suggested tag, the default status and, for
// types named after their tag, that tag as the name.
export function getNewAssetFormValues(
  type: AssetType,
  { assetTag, statusId }: { assetTag: string; statusId: number | null },
): AssetFormValues {
  return {
    ...getEmptyAssetFormValues(),
    assetTag,
    statusId,
    name: isNamedAfterTag(type) ? assetTag : "",
  };
}
