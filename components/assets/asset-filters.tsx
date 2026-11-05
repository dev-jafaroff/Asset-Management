import Link from "next/link";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  assetFilters,
  loadAssetFilterOptions,
  type AssetFilterValues,
} from "@/lib/assets/asset-filters";
import type { AssetType } from "@/lib/generated/prisma/enums";
import {
  buildHref,
  PAGE_PARAM,
  type ParamUpdates,
  type SearchParams,
} from "@/lib/search-params";

type AssetFiltersProps = {
  type?: AssetType;
  values: AssetFilterValues;
  basePath: string;
  params: SearchParams;
};

// Removes every filter but keeps the search and the status tab.
const clearFilters: ParamUpdates = Object.fromEntries([
  ...assetFilters.map((filter) => [filter.param, undefined]),
  [PAGE_PARAM, undefined],
]);

export async function AssetFilters({
  type,
  values,
  basePath,
  params,
}: AssetFiltersProps) {
  const filters = await loadAssetFilterOptions(type);
  const hasActiveFilter = Object.keys(values).length > 0;

  return (
    <>
      {filters
        // A filter with nothing to choose (e.g. models for VMs) is hidden.
        .filter((filter) => filter.options.length > 0)
        .map((filter) => (
          <FilterSelect
            key={filter.param}
            param={filter.param}
            label={filter.label}
            allLabel={filter.allLabel}
            options={filter.options}
            value={values[filter.param]?.toString()}
          />
        ))}

      {hasActiveFilter && (
        <Link
          href={buildHref(basePath, params, clearFilters)}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear filters
        </Link>
      )}
    </>
  );
}
