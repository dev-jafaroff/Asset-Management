import { connection } from "next/server";
import { cache } from "react";
import { StatusDot } from "@/components/assets/status-badge";
import { CountBadge } from "@/components/shared/count-badge";
import { ASSETS_PATH } from "@/lib/assets/asset-types";
import { listStatusTabsWithCounts } from "@/lib/assets/queries";
import { ALL_STATUS_SLUG, STATUS_PARAM } from "@/lib/assets/status-filters";
import { FilterNavLink } from "./nav-link";

// The desktop sidebar and the mobile menu both render this;
// cache() makes them share one set of queries per request.
const getStatusCounts = cache(() => listStatusTabsWithCounts());

// Sidebar "By status" links with live counts across all assets.
// "All" is skipped, since "All assets" is already in the menu.
export async function StatusNav() {
  // Counts are live data, so this is rendered per request, never prerendered.
  await connection();
  const tabs = await getStatusCounts();

  return tabs
    .filter((tab) => tab.slug !== ALL_STATUS_SLUG)
    .map((tab) => (
      <FilterNavLink
        key={tab.slug}
        pathname={ASSETS_PATH}
        param={STATUS_PARAM}
        value={tab.slug}
        label={tab.label}
        icon={
          tab.color && (
            // Same width as the menu icons, so the labels line up.
            <span className="flex size-4 items-center justify-center">
              <StatusDot color={tab.color} />
            </span>
          )
        }
        trailing={<CountBadge count={tab.count} className="ml-auto" />}
      />
    ));
}
