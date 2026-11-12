import {
  getAssetTypeConfig,
  type AssignTarget,
} from "@/lib/assets/asset-types";
import type { AssetType } from "@/lib/generated/prisma/enums";
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
};

const typeFormConfigs: Record<AssetType, TypeFormConfig> = {
  PC: { identity: ["name"] },
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

// Cards of the form for one type, in display order.
export function getAssetFormSections(type: AssetType): AssetFormSection[] {
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
    {
      title: "Assignment",
      description: "Optional: leave it empty to keep the asset in stock.",
      fields: [holderField],
    },
    { title: "Purchase", fields: ["purchaseDate", "purchaseCost"] },
    { title: "Notes", fields: ["notes"] },
  ];
}

// Every field the form of this type shows; the save ignores all others.
export function getAssetFormFields(type: AssetType): AssetFormField[] {
  return getAssetFormSections(type).flatMap((section) => section.fields);
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

// Only the fields the type's form shows: anything else that was sent (e.g. a
// phone number for a PC) is not saved.
export function pickAssetFormData(
  type: AssetType,
  data: AssetFormData,
): Partial<AssetFormData> {
  const fields = new Set<string>(getAssetFormFields(type));
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
