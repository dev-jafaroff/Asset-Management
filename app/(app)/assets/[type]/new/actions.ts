"use server";

import { redirect } from "next/navigation";
import {
  recordAssetCheckout,
  recordAssetEvent,
} from "@/lib/assets/asset-events";
import {
  getEditableAssetFields,
  pickAssetFormData,
  type AssetFormErrors,
} from "@/lib/assets/asset-form";
import { getAssetPath } from "@/lib/assets/asset-types";
import {
  checkTakenIdentifiers,
  getAssetSaveConflict,
} from "@/lib/assets/queries";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  assetTypeSchema,
  getAssetFormSchema,
  getFirstFieldErrors,
  type AssetFormValues,
} from "@/lib/schemas/asset";

// Saves a new asset, and a checkout when it is assigned right away, then opens
// its page. Returns the errors when it cannot be saved.
// The form validates the same way first; this check is the one that counts.
export async function createAsset(
  type: unknown,
  values: AssetFormValues,
): Promise<AssetFormErrors> {
  const user = await getCurrentUser();
  if (!can(user.role, "asset:edit")) {
    return { message: "You do not have permission to add assets." };
  }

  const assetType = assetTypeSchema.safeParse(type);
  if (!assetType.success) return { message: "Unknown asset type." };

  const editable = getEditableAssetFields(assetType.data, "create", "MANUAL");
  const input = getAssetFormSchema(assetType.data, editable).safeParse(values);
  if (!input.success) return { fields: getFirstFieldErrors(input.error) };

  const { statusId, ...data } = pickAssetFormData(input.data, editable);
  // Required for every type, so already checked by the schema.
  if (!statusId) return { fields: { statusId: "Status is required." } };

  const taken = await checkTakenIdentifiers(data);
  if (taken) return taken;

  let assetId: number;
  try {
    assetId = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: { ...data, type: assetType.data, statusId, source: "MANUAL" },
        select: {
          id: true,
          type: true,
          assignedTo: { select: { id: true, displayName: true, email: true } },
          company: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });
      await recordAssetEvent(tx, {
        assetId: asset.id,
        actorId: user.id,
        type: "CREATED",
      });
      await recordAssetCheckout(tx, { asset, actorId: user.id });
      return asset.id;
    });
  } catch (error) {
    const conflict = getAssetSaveConflict(error);
    if (conflict) return { message: conflict };
    throw error;
  }

  redirect(getAssetPath(assetType.data, assetId));
}
