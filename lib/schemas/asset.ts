import { z } from "zod";
import {
  assetFormFieldLabels,
  getRequiredAssetFields,
  type AssetFormField,
} from "@/lib/assets/asset-form";
import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import { AssetType } from "@/lib/generated/prisma/enums";

export const ASSET_NOTES_MAX_LENGTH = 2000;

export const assetIdSchema = z.number().int().positive();

export const assetTypeSchema = z.enum(AssetType);

// Notes as typed in the form: trimmed, and empty clears them (stored as null).
// Browsers send textarea line breaks as "\r\n"; they are stored as "\n", and
// counted that way too, so the limit matches the counter in the form.
const notesSchema = z
  .string({ error: "Notes must be text." })
  .overwrite((notes) => notes.replace(/\r\n?/g, "\n"))
  .trim()
  .max(
    ASSET_NOTES_MAX_LENGTH,
    `Notes can be at most ${ASSET_NOTES_MAX_LENGTH} characters.`,
  )
  .transform((notes) => notes || null);

export const assetNotesSchema = z.object({
  assetId: assetIdSchema,
  notes: notesSchema,
});

export type AssetNotesInput = z.infer<typeof assetNotesSchema>;

// ─── Asset form ──────────────────────────────────────────────────────────────

// Text inputs give "" when empty; it is stored as null.
function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `Use at most ${maxLength} characters.`)
    .transform((text) => text || null);
}

// Same, for text that must match a pattern when it is filled in.
function optionalPattern(maxLength: number, pattern: RegExp, message: string) {
  return z
    .string()
    .trim()
    .max(maxLength, `Use at most ${maxLength} characters.`)
    .refine((text) => text === "" || pattern.test(text), message)
    .transform((text) => text || null);
}

// Number inputs also give text; "" means not set.
function optionalWholeNumber(max: number) {
  return z
    .string()
    .trim()
    .refine(
      (text) => text === "" || (/^\d+$/.test(text) && Number(text) >= 1),
      "Enter a whole number.",
    )
    .transform((text) => (text === "" ? null : Number(text)))
    .refine((value) => value === null || value <= max, `At most ${max}.`);
}

// Chosen from a list; null when nothing is chosen.
const optionalId = z.number().int().positive().nullable();

// "2026-03-14" from a date input, stored as that day.
const purchaseDateSchema = z
  .string()
  .trim()
  .refine(
    (text) => text === "" || !Number.isNaN(Date.parse(text)),
    "Enter a valid date.",
  )
  .transform((text) => (text === "" ? null : new Date(text)))
  .refine(
    (date) => date === null || date <= new Date(),
    "The purchase date cannot be in the future.",
  );

// Values as the form holds them: text inputs give strings, lists give ids.
export const assetFormSchema = z.object({
  assetTag: z
    .string()
    .trim()
    .toUpperCase()
    .max(32, "Use at most 32 characters.")
    .transform((tag) => tag || null),
  name: optionalText(100),
  serial: optionalText(100),
  modelId: optionalId,
  statusId: optionalId,
  companyId: optionalId,
  locationId: optionalId,
  assignedToId: optionalId,
  // Spaces are allowed while typing, e.g. "35 209900 176148 1".
  imei: z
    .string()
    .overwrite((imei) => imei.replace(/\s/g, ""))
    .refine(
      (imei) => imei === "" || /^\d{15}$/.test(imei),
      "An IMEI has 15 digits.",
    )
    .transform((imei) => imei || null),
  phoneNumber: optionalPattern(
    30,
    /^\+?[\d\s()-]{5,}$/,
    "Use digits, spaces and an optional leading +.",
  ),
  operatingSystem: optionalText(100),
  vmHost: optionalText(100),
  vCpu: optionalWholeNumber(256),
  ramGb: optionalWholeNumber(4096),
  purchaseDate: purchaseDateSchema,
  // Up to 99,999,999.99; kept as text, so no cents are lost on the way to the database.
  purchaseCost: optionalPattern(
    11,
    /^\d{1,8}(\.\d{1,2})?$/,
    "Enter an amount, e.g. 1480 or 1480.50.",
  ),
  notes: notesSchema,
});

export type AssetFormValues = z.input<typeof assetFormSchema>;
export type AssetFormData = z.output<typeof assetFormSchema>;

// The form schema with the rules of one type: its required fields, and its
// tag prefix (a PC's tag starts with "PC-"). Used by the form and the action.
// Only editable fields get these rules, so a locked value that does not follow
// them (e.g. an old Snipe-IT tag) never blocks a save.
export function getAssetFormSchema(
  type: AssetType,
  editableFields: AssetFormField[],
) {
  const { tagPrefix } = getAssetTypeConfig(type);
  const editable = new Set(editableFields);
  const required = getRequiredAssetFields(type).filter((field) =>
    editable.has(field),
  );
  // The prefix the tag must start with, when the tag can be changed.
  const requiredPrefix = editable.has("assetTag") ? tagPrefix : null;

  return assetFormSchema.superRefine((data, ctx) => {
    for (const field of required) {
      if (data[field] === null) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${assetFormFieldLabels[field]} is required.`,
        });
      }
    }
    if (
      requiredPrefix &&
      data.assetTag &&
      !data.assetTag.startsWith(requiredPrefix)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["assetTag"],
        message: `The tag must start with ${requiredPrefix}`,
      });
    }
  });
}

// The first problem of each field, as a form shows it under the field.
export function getFirstFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const [field] = issue.path;
    if (typeof field === "string") errors[field] ??= issue.message;
  }
  return errors;
}
