import { z } from "zod";
import { eventNoteSchema, requiredChoice } from "@/lib/schemas/asset";

export const ACCESSORY_NAME_MAX_LENGTH = 100;
// Far above any real stock; stops typos like 1000000.
export const ACCESSORY_QUANTITY_MAX = 10000;

export const accessoryIdSchema = z.number().int().positive();
export const accessoryAssignmentIdSchema = z.number().int().positive();

// A count typed in a number input, which gives text, e.g. "3".
function quantitySchema(min: number) {
  return z
    .string()
    .trim()
    .refine((text) => /^\d+$/.test(text), "Enter a whole number.")
    .transform(Number)
    .refine((value) => value >= min, `Enter at least ${min}.`)
    .refine(
      (value) => value <= ACCESSORY_QUANTITY_MAX,
      `Enter at most ${ACCESSORY_QUANTITY_MAX}.`,
    );
}

// New and edit form. The note goes with the stock change, e.g. "10 more
// bought for the new office".
export const accessoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(
      ACCESSORY_NAME_MAX_LENGTH,
      `Use at most ${ACCESSORY_NAME_MAX_LENGTH} characters.`,
    ),
  categoryId: requiredChoice("Choose a category."),
  totalQuantity: quantitySchema(0),
  note: eventNoteSchema,
});

export const assignAccessorySchema = z.object({
  userId: requiredChoice("Choose who gets it."),
  quantity: quantitySchema(1),
});

// How many of one assignment come back; the rest stays with the person.
export const returnAccessorySchema = z.object({
  quantity: quantitySchema(1),
});

export type AccessoryFormValues = z.input<typeof accessoryFormSchema>;
export type AccessoryFormData = z.output<typeof accessoryFormSchema>;
export type AssignAccessoryValues = z.input<typeof assignAccessorySchema>;
export type ReturnAccessoryValues = z.input<typeof returnAccessorySchema>;

// e.g. "1 is handed out", "12 are handed out"; used by the form and the server.
export function describeHandedOut(count: number): string {
  return `${count} ${count === 1 ? "is" : "are"} handed out`;
}
