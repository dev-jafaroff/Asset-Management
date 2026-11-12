"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  recordAssetCheckout,
  recordAssetEvent,
} from "@/lib/assets/asset-events";
import {
  pickAssetFormData,
  type AssetFormErrors,
} from "@/lib/assets/asset-form";
import { getAssetPath } from "@/lib/assets/asset-types";
import { findTakenIdentifiers } from "@/lib/assets/queries";
import { getCurrentUser } from "@/lib/current-user";
import { Prisma } from "@/lib/generated/prisma/client";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  assetTypeSchema,
  getAssetFormSchema,
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

  const input = getAssetFormSchema(assetType.data).safeParse(values);
  if (!input.success) {
    // The first problem of each field, as the form shows it.
    const { fieldErrors } = z.flattenError(input.error);
    return {
      fields: Object.fromEntries(
        Object.entries(fieldErrors).map(([field, messages]) => [
          field,
          messages?.[0],
        ]),
      ),
    };
  }

  const data = pickAssetFormData(assetType.data, input.data);
  const { statusId } = data;
  // Required for every type, so already checked by the schema.
  if (!statusId) return { fields: { statusId: "Status is required." } };

  const taken = await findTakenIdentifiers(data);
  if (Object.keys(taken).length > 0) {
    return {
      fields: Object.fromEntries(
        Object.entries(taken).map(([field, owner]) => [
          field,
          `Already used by ${owner}.`,
        ]),
      ),
    };
  }

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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Someone saved the same tag, serial or IMEI a moment ago.
      if (error.code === "P2002") {
        return {
          message:
            "Another asset was just saved with the same tag, serial or IMEI. Check them and save again.",
        };
      }
      // A chosen model, status, company, location or person was just removed.
      if (error.code === "P2003") {
        return {
          message: "One of the chosen items no longer exists. Reload the page.",
        };
      }
    }
    throw error;
  }

  redirect(getAssetPath(assetType.data, assetId));
}
