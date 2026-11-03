// Helpers for list pages whose state (search, filters, page) lives in the URL,
// so a filtered view can be shared and the back button works.

export type SearchParams = Record<string, string | string[] | undefined>;

export const SEARCH_PARAM = "q";
export const PAGE_PARAM = "page";

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

// 1-based page number; anything invalid falls back to the first page.
export function getPageParam(params: SearchParams): number {
  const page = Number(getParam(params, PAGE_PARAM));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

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
