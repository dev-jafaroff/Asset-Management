import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getLegacyAssetPath } from "@/lib/assets/asset-detail";
import { getPositiveIntParam } from "@/lib/search-params";

// The old Snipe-IT QR labels hold https://<old domain>/hardware/<Snipe-IT id>.
// Once that domain points here, a scan opens the migrated asset's page.
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/hardware/[id]">,
) {
  const snipeId = getPositiveIntParam(await ctx.params, "id");
  const path = snipeId === undefined ? null : await getLegacyAssetPath(snipeId);
  if (!path) notFound();
  redirect(path);
}
