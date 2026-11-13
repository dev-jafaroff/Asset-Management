"use server";

import { refresh } from "next/cache";
import type { z } from "zod";
import { runBulk, type BulkSummary } from "@/lib/assets/bulk-actions";
import {
  changeAssetStatus,
  checkInAsset,
  checkOutAsset,
  type AssignmentErrors,
} from "@/lib/assets/checkout";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import {
  assetIdsSchema,
  bulkCheckoutSchema,
  checkinSchema,
  getFirstFieldErrors,
  statusChangeSchema,
  type BulkCheckoutValues,
  type CheckinValues,
  type StatusChangeValues,
} from "@/lib/schemas/asset";

// Actions on the assets selected in a list, on "All assets" and per type.

// The dialog's errors, or what was done once it ran.
export type BulkActionResult =
  { errors: AssignmentErrors } | { summary: BulkSummary };

type BulkInput<T> = {
  assetIds: number[];
  actorId: number | null;
  values: T;
};

// Checks the role, the selection and the dialog's values. The ids come from
// the browser, so they are validated like the rest.
async function parseBulkInput<Schema extends z.ZodType>(
  assetIds: unknown,
  values: unknown,
  schema: Schema,
): Promise<{ errors: AssignmentErrors } | BulkInput<z.output<Schema>>> {
  const user = await getCurrentUser();
  if (!can(user.role, "asset:edit")) {
    return {
      errors: { message: "You do not have permission to edit assets." },
    };
  }
  const ids = assetIdsSchema.safeParse(assetIds);
  if (!ids.success) {
    return { errors: { message: ids.error.issues[0]?.message } };
  }
  const input = schema.safeParse(values);
  if (!input.success) {
    return { errors: { fields: getFirstFieldErrors(input.error) } };
  }
  return { assetIds: ids.data, actorId: user.id, values: input.data };
}

// Reloads the list when anything changed, so rows show their new state.
function summarize(summary: BulkSummary): BulkActionResult {
  if (summary.done > 0) refresh();
  return { summary };
}

// Hands every selected asset to the same person, company or location.
export async function bulkCheckOut(
  assetIds: unknown,
  values: BulkCheckoutValues,
): Promise<BulkActionResult> {
  const input = await parseBulkInput(assetIds, values, bulkCheckoutSchema);
  if ("errors" in input) return input;
  const { actorId } = input;
  return summarize(
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
  const input = await parseBulkInput(assetIds, values, checkinSchema);
  if ("errors" in input) return input;
  const { actorId } = input;
  return summarize(
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
  const input = await parseBulkInput(assetIds, values, statusChangeSchema);
  if ("errors" in input) return input;
  const { actorId } = input;
  return summarize(
    await runBulk(input.assetIds, (assetId) =>
      changeAssetStatus({ assetId, actorId, ...input.values }),
    ),
  );
}
