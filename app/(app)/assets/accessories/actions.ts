"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  assignAccessory,
  returnAccessory,
  returnAllAccessories,
} from "@/lib/accessories/assignments";
import { getAccessoryPath } from "@/lib/accessories/queries";
import { createAccessory, updateAccessory } from "@/lib/accessories/stock";
import type { AssignmentErrors } from "@/lib/assets/checkout";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import {
  accessoryAssignmentIdSchema,
  accessoryFormSchema,
  accessoryIdSchema,
  assignAccessorySchema,
  returnAccessorySchema,
  type AccessoryFormValues,
  type AssignAccessoryValues,
  type ReturnAccessoryValues,
} from "@/lib/schemas/accessory";
import { getFirstFieldErrors } from "@/lib/schemas/asset";
import { userIdSchema } from "@/lib/schemas/user";

const NO_PERMISSION: AssignmentErrors = {
  message: "You do not have permission to edit accessories.",
};

// The acting user, or null when they may not edit.
async function getEditor() {
  const user = await getCurrentUser();
  return can(user.role, "asset:edit") ? user : null;
}

// Adds an accessory and opens its page; returns the errors otherwise.
export async function submitNewAccessory(
  values: AccessoryFormValues,
): Promise<AssignmentErrors> {
  const editor = await getEditor();
  if (!editor) return NO_PERMISSION;
  const input = accessoryFormSchema.safeParse(values);
  if (!input.success) return { fields: getFirstFieldErrors(input.error) };

  const created = await createAccessory({
    data: input.data,
    actorId: editor.id,
  });
  if ("errors" in created) return created.errors;
  redirect(getAccessoryPath(created.id));
}

// Saves the form of an existing accessory and opens its page.
// `accessoryId` is bound by the page, but still validated like the rest.
export async function submitAccessoryEdit(
  accessoryId: unknown,
  values: AccessoryFormValues,
): Promise<AssignmentErrors> {
  const editor = await getEditor();
  if (!editor) return NO_PERMISSION;
  const id = accessoryIdSchema.safeParse(accessoryId);
  if (!id.success) return { message: "Unknown accessory." };
  const input = accessoryFormSchema.safeParse(values);
  if (!input.success) return { fields: getFirstFieldErrors(input.error) };

  const saved = await updateAccessory({
    accessoryId: id.data,
    data: input.data,
    actorId: editor.id,
  });
  if ("errors" in saved) return saved.errors;
  redirect(getAccessoryPath(id.data));
}

// Hands some out from the accessory's page; null when done.
export async function submitAccessoryAssign(
  accessoryId: unknown,
  values: AssignAccessoryValues,
): Promise<AssignmentErrors | null> {
  const editor = await getEditor();
  if (!editor) return NO_PERMISSION;
  const id = accessoryIdSchema.safeParse(accessoryId);
  if (!id.success) return { message: "Unknown accessory." };
  const input = assignAccessorySchema.safeParse(values);
  if (!input.success) return { fields: getFirstFieldErrors(input.error) };

  const refused = await assignAccessory({
    accessoryId: id.data,
    actorId: editor.id,
    ...input.data,
  });
  if (refused) return { message: refused };
  refresh();
  return null;
}

// Takes some or all of one handout back; null when done.
export async function submitAccessoryReturn(
  assignmentId: unknown,
  values: ReturnAccessoryValues,
): Promise<AssignmentErrors | null> {
  const editor = await getEditor();
  if (!editor) return NO_PERMISSION;
  const id = accessoryAssignmentIdSchema.safeParse(assignmentId);
  if (!id.success) return { message: "Unknown handout." };
  const input = returnAccessorySchema.safeParse(values);
  if (!input.success) return { fields: getFirstFieldErrors(input.error) };

  const refused = await returnAccessory({
    assignmentId: id.data,
    actorId: editor.id,
    ...input.data,
  });
  if (refused) return { message: refused };
  refresh();
  return null;
}

// Takes back every accessory the person has, from their page; null when
// done. `userId` is bound by the page, but still validated.
export async function submitReturnAllAccessories(
  userId: unknown,
): Promise<AssignmentErrors | null> {
  const editor = await getEditor();
  if (!editor) return NO_PERMISSION;
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { message: "Unknown person." };

  const returned = await returnAllAccessories({
    userId: id.data,
    actorId: editor.id,
  });
  if (returned === 0) return { message: "They have no accessories left." };
  refresh();
  return null;
}
