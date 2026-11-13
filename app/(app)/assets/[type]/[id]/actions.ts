"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  assetChangeSelect,
  getAssetChanges,
  getChangedFields,
  recordAssetUpdate,
} from "@/lib/assets/asset-events";
import {
  getEditableAssetFields,
  pickAssetFormData,
  type AssetFormErrors,
} from "@/lib/assets/asset-form";
import { getAssetPath } from "@/lib/assets/asset-types";
import {
  checkInAsset,
  checkOutAsset,
  type AssignmentErrors,
} from "@/lib/assets/checkout";
import {
  checkTakenIdentifiers,
  getAssetSaveConflict,
} from "@/lib/assets/queries";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  assetIdSchema,
  assetNotesSchema,
  checkinSchema,
  checkoutSchema,
  getAssetFormSchema,
  getFirstFieldErrors,
  type AssetFormValues,
  type CheckinValues,
  type CheckoutValues,
} from "@/lib/schemas/asset";

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

// Saves the asset form of an existing asset, writes what changed to its
// history and opens its page. Returns the errors when it cannot be saved.
// The holder is not part of it: that is a checkout or checkin.
export async function updateAsset(
  assetId: unknown,
  values: AssetFormValues,
): Promise<AssetFormErrors> {
  const user = await getCurrentUser();
  if (!can(user.role, "asset:edit")) {
    return { message: "You do not have permission to edit assets." };
  }

  const id = assetIdSchema.safeParse(assetId);
  if (!id.success) return { message: "Unknown asset." };
  const asset = await prisma.asset.findUnique({
    where: { id: id.data },
    select: { type: true, source: true },
  });
  if (!asset) return { message: "This asset no longer exists." };

  // Which fields can change depends on the asset, e.g. Intune owns a PC's name.
  const editable = getEditableAssetFields(asset.type, "edit", asset.source);
  const input = getAssetFormSchema(asset.type, editable).safeParse(values);
  if (!input.success) return { fields: getFirstFieldErrors(input.error) };

  const { statusId, ...data } = pickAssetFormData(input.data, editable);
  // Required for every type, so already checked by the schema.
  if (!statusId) return { fields: { statusId: "Status is required." } };

  const taken = await checkTakenIdentifiers(data, id.data);
  if (taken) return taken;

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.asset.findUniqueOrThrow({
        where: { id: id.data },
        select: assetChangeSelect,
      });
      const after = await tx.asset.update({
        where: { id: id.data },
        data: { ...data, statusId },
        select: assetChangeSelect,
      });
      await recordAssetUpdate(tx, {
        assetId: id.data,
        actorId: user.id,
        changes: getAssetChanges(before, after, editable),
      });
    });
  } catch (error) {
    const conflict = getAssetSaveConflict(error);
    if (conflict) return { message: conflict };
    throw error;
  }

  redirect(getAssetPath(asset.type, id.data));
}

// Checks the asset out from its page; null when done. The page reloads, so
// the Assignment card and the history show the new holder.
export async function submitCheckout(
  assetId: unknown,
  values: CheckoutValues,
): Promise<AssignmentErrors | null> {
  const user = await getCurrentUser();
  if (!can(user.role, "asset:edit")) {
    return { message: "You do not have permission to check out assets." };
  }
  const id = assetIdSchema.safeParse(assetId);
  if (!id.success) return { message: "Unknown asset." };
  const input = checkoutSchema.safeParse(values);
  if (!input.success) return { fields: getFirstFieldErrors(input.error) };

  const refused = await checkOutAsset({
    assetId: id.data,
    actorId: user.id,
    ...input.data,
  });
  if (refused) return { message: refused };
  refresh();
  return null;
}

// Checks the asset in from its page, with the status it gets; null when done.
export async function submitCheckin(
  assetId: unknown,
  values: CheckinValues,
): Promise<AssignmentErrors | null> {
  const user = await getCurrentUser();
  if (!can(user.role, "asset:edit")) {
    return { message: "You do not have permission to check in assets." };
  }
  const id = assetIdSchema.safeParse(assetId);
  if (!id.success) return { message: "Unknown asset." };
  const input = checkinSchema.safeParse(values);
  if (!input.success) return { fields: getFirstFieldErrors(input.error) };

  const refused = await checkInAsset({
    assetId: id.data,
    actorId: user.id,
    ...input.data,
  });
  if (refused) return { message: refused };
  refresh();
  return null;
}
