// Helpers for URL params: record ids and list state (search, filters, tab).
// List state lives in the URL, so a filtered view can be shared and Back works.

export type SearchParams = Record<string, string | string[] | undefined>;

export const SEARCH_PARAM = "q";

// Returns a single trimmed value; empty or repeated params count as missing.
export function getParam(
  params: SearchParams,
  key: string,
): string | undefined {
  const value = params[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Positive whole number (a page or a record id); anything else counts as missing.
export function getPositiveIntParam(
  params: SearchParams,
  key: string,
): number | undefined {
  const value = Number(getParam(params, key));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

// One choice in a filter dropdown; the value is what goes in the URL.
export type FilterOption = {
  value: string;
  label: string;
};

// Values to change in a link; undefined removes the param.
export type ParamUpdates = Record<string, string | number | undefined>;

// Builds a link to `pathname` that keeps the current params and applies `updates`.
export function buildHref(
  pathname: string,
  params: SearchParams,
  updates: ParamUpdates = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && !(key in updates)) query.set(key, value);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) query.set(key, String(value));
  }

  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
