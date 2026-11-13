"use server";

import type { z } from "zod";
import {
  authorizeBulk,
  finishBulk,
  runBulk,
  type BulkActionResult,
} from "@/lib/assets/bulk-actions";
import {
  changeAssetStatus,
  checkInAsset,
  checkOutAsset,
} from "@/lib/assets/checkout";
import {
  assetIdsSchema,
  bulkCheckoutSchema,
  checkinSchema,
  statusChangeSchema,
  type BulkCheckoutValues,
  type CheckinValues,
  type StatusChangeValues,
} from "@/lib/schemas/asset";

// Actions on the assets selected in a list, on "All assets" and per type.

// Checks the role, the dialog's values and the selection. The ids come from
// the browser, so they are validated like the rest.
async function parseSelection<Schema extends z.ZodType>(
  assetIds: unknown,
  values: unknown,
  schema: Schema,
) {
  const input = await authorizeBulk(values, schema);
  if ("errors" in input) return input;
  const ids = assetIdsSchema.safeParse(assetIds);
  if (!ids.success) {
    return { errors: { message: ids.error.issues[0]?.message } };
  }
  return { ...input, assetIds: ids.data };
}

// Hands every selected asset to the same person, company or location.
export async function bulkCheckOut(
  assetIds: unknown,
  values: BulkCheckoutValues,
): Promise<BulkActionResult> {
  const input = await parseSelection(assetIds, values, bulkCheckoutSchema);
  if ("errors" in input) return input;
  const { actorId } = input;
  return finishBulk(
    await runBulk(input.assetIds, (assetId) =>
      checkOutAsset({ assetId, actorId, ...input.values }),
    ),
  );
}

// Takes every selected asset back, with the same status.
export async function bulkCheckIn(
  assetIds: unknown,
  values: CheckinValues,
): Promise<BulkActionResult> {
  const input = await parseSelection(assetIds, values, checkinSchema);
  if ("errors" in input) return input;
  const { actorId } = input;
  return finishBulk(
    await runBulk(input.assetIds, (assetId) =>
      checkInAsset({ assetId, actorId, ...input.values }),
    ),
  );
}

// Gives every selected asset the same status, e.g. "In repair".
export async function bulkChangeStatus(
  assetIds: unknown,
  values: StatusChangeValues,
): Promise<BulkActionResult> {
  const input = await parseSelection(assetIds, values, statusChangeSchema);
  if ("errors" in input) return input;
  const { actorId } = input;
  return finishBulk(
    await runBulk(input.assetIds, (assetId) =>
      changeAssetStatus({ assetId, actorId, ...input.values }),
    ),
  );
}
