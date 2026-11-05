"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildHref, PAGE_PARAM, type FilterOption } from "@/lib/search-params";

type FilterSelectProps = {
  // URL param the dropdown controls, e.g. "company".
  param: string;
  label: string;
  // First entry, which clears the filter (e.g. "All companies").
  allLabel: string;
  options: FilterOption[];
  // Currently selected value from the URL.
  value?: string;
};

// Dropdown filter for any list whose state lives in the URL. Choosing a value
// keeps the other params and goes back to page 1.
export function FilterSelect({
  param,
  label,
  allLabel,
  options,
  value,
}: FilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // null is the "all" entry.
  const items = [{ value: null, label: allLabel }, ...options];

  function handleChange(next: string | null) {
    router.push(
      buildHref(pathname, Object.fromEntries(searchParams), {
        [param]: next ?? undefined,
        [PAGE_PARAM]: undefined,
      }),
    );
  }

  return (
    <Select
      // Remount when the URL changes (e.g. "Clear filters"), so it shows the current value.
      key={value}
      items={items}
      defaultValue={value ?? null}
      onValueChange={handleChange}
    >
      <SelectTrigger aria-label={label} className="min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value ?? "all"} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
