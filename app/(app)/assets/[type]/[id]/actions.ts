"use server";

import { refresh } from "next/cache";
import { getChangedFields, recordAssetUpdate } from "@/lib/assets/asset-events";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { assetNotesSchema } from "@/lib/schemas/asset";

export type NotesFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

function fail(message: string): NotesFormState {
  return { status: "error", message };
}

// Saves an asset's notes and writes the change to its history.
// `assetId` is bound by the page, but it still comes from the browser, so it
// is validated like the rest of the input.
export async function updateAssetNotes(
  assetId: number,
  _previous: NotesFormState,
  formData: FormData,
): Promise<NotesFormState> {
  const user = await getCurrentUser();
  if (!can(user.role, "asset:edit")) {
    return fail("You do not have permission to edit assets.");
  }

  const input = assetNotesSchema.safeParse({
    assetId,
    notes: formData.get("notes"),
  });
  if (!input.success) {
    return fail(input.error.issues[0]?.message ?? "These notes are not valid.");
  }
  const { notes } = input.data;
  const id = input.data.assetId;

  const outcome = await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id },
      select: { notes: true },
    });
    if (!asset) return "missing";

    const changes = getChangedFields([
      { field: "Notes", from: asset.notes, to: notes },
    ]);
    if (changes.length === 0) return "unchanged";

    await tx.asset.update({
      where: { id },
      data: { notes },
    });
    await recordAssetUpdate(tx, {
      assetId: id,
      actorId: user.id,
      changes,
    });
    return "saved";
  });

  if (outcome === "missing") return fail("This asset no longer exists.");
  // Reload the page data, so the notes and the new history entry show up.
  if (outcome === "saved") refresh();
  return { status: "saved" };
}
