import { refresh } from "next/cache";
import type { z } from "zod";
import type {
  AssetChangeResult,
  AssignmentErrors,
} from "@/lib/assets/checkout";
import { getAssetDisplayName } from "@/lib/assets/format";
import { assetListSelect } from "@/lib/assets/queries";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getFirstFieldErrors } from "@/lib/schemas/asset";

// Shared by the Server Actions that change several assets at once: the
// selection in a list, or everything a person holds on their page.

// One asset a bulk action left as it was, and why,
// e.g. PC-00007, "In repair assets cannot be checked out."
export type SkippedAsset = { assetId: number; name: string; reason: string };

// What a bulk action did, shown above the list once it is done.
export type BulkSummary = { done: number; skipped: SkippedAsset[] };

// The dialog's errors, or what was done once it ran.
export type BulkActionResult =
  { errors: AssignmentErrors } | { summary: BulkSummary };

// Checks the role and the dialog's values; returns who acts and the values,
// or the errors to show.
export async function authorizeBulk<Schema extends z.ZodType>(
  values: unknown,
  schema: Schema,
): Promise<
  | { errors: AssignmentErrors }
  | { actorId: number | null; values: z.output<Schema> }
> {
  const user = await getCurrentUser();
  if (!can(user.role, "asset:edit")) {
    return {
      errors: { message: "You do not have permission to edit assets." },
    };
  }
  const input = schema.safeParse(values);
  if (!input.success) {
    return { errors: { fields: getFirstFieldErrors(input.error) } };
  }
  return { actorId: user.id, values: input.data };
}

// Ends a bulk Server Action: reloads the page when anything changed, so it
// shows the new state.
export function finishBulk(summary: BulkSummary): BulkActionResult {
  if (summary.done > 0) refresh();
  return { summary };
}

// Applies one change (a checkout, checkin, …) to each asset in turn. Each one
// is checked and saved on its own, with its own history entry, so an asset
// that is refused does not hold back the others.
export async function runBulk(
  assetIds: number[],
  change: (assetId: number) => Promise<AssetChangeResult>,
): Promise<BulkSummary> {
  const refusals = new Map<number, string>();
  // One after the other: a page of assets is quick, and the database
  // connections stay free for everyone else.
  for (const assetId of assetIds) {
    const refused = await change(assetId);
    if (refused) refusals.set(assetId, refused);
  }
  return {
    done: assetIds.length - refusals.size,
    skipped: await nameSkippedAssets(refusals),
  };
}

// The refused assets by the name the list shows, in the list's order.
async function nameSkippedAssets(
  refusals: Map<number, string>,
): Promise<SkippedAsset[]> {
  if (refusals.size === 0) return [];
  const assets = await prisma.asset.findMany({
    where: { id: { in: [...refusals.keys()] } },
    select: {
      id: true,
      assetTag: true,
      name: true,
      model: assetListSelect.model,
    },
  });
  const names = new Map(
    assets.map((asset) => [asset.id, getAssetDisplayName(asset)]),
  );
  return [...refusals].map(([assetId, reason]) => ({
    assetId,
    name: names.get(assetId) ?? `#${assetId}`,
    reason,
  }));
}
