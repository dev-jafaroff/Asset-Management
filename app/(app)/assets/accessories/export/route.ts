import type { NextRequest } from "next/server";
import {
  listAccessories,
  type AccessoryListItem,
} from "@/lib/accessories/queries";
import { exportCsv, type CsvColumn } from "@/lib/export/csv";
import { getParam, SEARCH_PARAM } from "@/lib/search-params";

const accessoryColumns: CsvColumn<AccessoryListItem>[] = [
  { header: "Name", value: (accessory) => accessory.name },
  { header: "Category", value: (accessory) => accessory.category.name },
  { header: "Total", value: (accessory) => accessory.stock.total },
  { header: "Assigned", value: (accessory) => accessory.stock.assigned },
  { header: "In stock", value: (accessory) => accessory.stock.inStock },
];

// The accessories list as it is shown: with its search.
export async function GET(request: NextRequest) {
  const search = getParam(
    Object.fromEntries(request.nextUrl.searchParams),
    SEARCH_PARAM,
  );

  return exportCsv("accessories", async () => ({
    columns: accessoryColumns,
    rows: await listAccessories(search),
  }));
}
