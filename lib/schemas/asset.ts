import { z } from "zod";

export const ASSET_NOTES_MAX_LENGTH = 2000;

export const assetIdSchema = z.number().int().positive();

// Notes as typed in the form: trimmed, and empty clears them (stored as null).
// Browsers send textarea line breaks as "\r\n"; they are stored as "\n", and
// counted that way too, so the limit matches the counter in the form.
export const assetNotesSchema = z.object({
  assetId: assetIdSchema,
  notes: z
    .string({ error: "Notes must be text." })
    .overwrite((notes) => notes.replace(/\r\n?/g, "\n"))
    .trim()
    .max(
      ASSET_NOTES_MAX_LENGTH,
      `Notes can be at most ${ASSET_NOTES_MAX_LENGTH} characters.`,
    )
    .transform((notes) => notes || null),
});

export type AssetNotesInput = z.infer<typeof assetNotesSchema>;
