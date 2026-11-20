import type { NextRequest } from "next/server";
import {
  ASSET_EXPORT_ID_FIELD,
  ASSET_EXPORT_TYPE_PARAM,
  getAssetTypeBySlug,
} from "@/lib/assets/asset-types";
import { loadAssetExport } from "@/lib/assets/export";
import { listStatusLabels, parseAssetListParams } from "@/lib/assets/queries";
import { buildStatusTabs, findStatusTab } from "@/lib/assets/status-filters";
import { exportCsv } from "@/lib/export/csv";
import { getParam } from "@/lib/search-params";

// An asset list as it is shown: ?type=pcs (none on "All assets") and the
// list's own params, i.e. the status tab, search and filters.
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const typeSlug = getParam(params, ASSET_EXPORT_TYPE_PARAM);
  const config = typeSlug ? getAssetTypeBySlug(typeSlug) : undefined;
  if (typeSlug && !config) {
    return new Response("Unknown asset type.", { status: 404 });
  }

  const { search, filters, statusSlug } = parseAssetListParams(params);
  return exportCsv(config?.slug ?? "assets", async () => {
    const tabs = buildStatusTabs(await listStatusLabels());
    return loadAssetExport({
      type: config?.type,
      search,
      filters,
      status: findStatusTab(tabs, statusSlug).where,
    });
  });
}

// The rows selected in a list. They come as a form, since a long selection
// would not fit in a link.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const ids = form
    .getAll(ASSET_EXPORT_ID_FIELD)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  return exportCsv("assets", () => loadAssetExport({ ids }));
}
