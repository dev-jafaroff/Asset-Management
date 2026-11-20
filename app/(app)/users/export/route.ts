import type { NextRequest } from "next/server";
import { exportXlsx, type ExportColumn } from "@/lib/export/xlsx";
import { getParam, SEARCH_PARAM } from "@/lib/search-params";
import {
  getUserTab,
  listUsers,
  USER_TAB_PARAM,
  type UserListItem,
} from "@/lib/users/queries";

const userColumns: ExportColumn<UserListItem>[] = [
  { header: "Name", value: (user) => user.displayName },
  { header: "Email", value: (user) => user.email },
  { header: "Department", value: (user) => user.department },
  { header: "Job title", value: (user) => user.jobTitle },
  { header: "Status", value: (user) => (user.isActive ? "Active" : "Left") },
  { header: "Assets", value: (user) => user._count.assignedAssets },
  { header: "Accessories", value: (user) => user.heldAccessories },
];

// The users list as it is shown: its tab and search.
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const tab = getUserTab(getParam(params, USER_TAB_PARAM));
  const search = getParam(params, SEARCH_PARAM);

  return exportXlsx({ name: "users", sheet: "Users" }, async () => ({
    columns: userColumns,
    rows: await listUsers({ tab, search }),
  }));
}
