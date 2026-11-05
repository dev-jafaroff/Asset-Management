"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { PAGE_PARAM } from "@/lib/search-params";

// Remembers the last search, status tab and filters of each list page for the
// browser tab (sessionStorage), so leaving a list and coming back through the
// sidebar restores it. The page number is not kept: a list reopens on page 1.
// A list can also leave out other params (see forgetParams in nav-items.ts).

const STORAGE_PREFIX = "list-state:";
const listeners = new Set<() => void>();

// Storage can be unavailable (private mode, blocked site data); the app then
// simply forgets list state instead of failing.
function readQuery(pathname: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + pathname);
  } catch {
    return null;
  }
}

function writeQuery(pathname: string, query: string) {
  try {
    if (query) sessionStorage.setItem(STORAGE_PREFIX + pathname, query);
    else sessionStorage.removeItem(STORAGE_PREFIX + pathname);
  } catch {
    return;
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type RememberedList = {
  path: string;
  // Params not kept, on top of the page number.
  forget: readonly string[];
};

// Saves the query of the current page when it is one of `lists`.
// An empty query (e.g. the search was cleared) removes the saved state.
function useRecordListState(lists: readonly RememberedList[]) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const list = lists.find((entry) => entry.path === pathname);
    if (!list) return;
    const query = new URLSearchParams(searchParams);
    for (const param of [PAGE_PARAM, ...list.forget]) query.delete(param);
    writeQuery(pathname, query.toString());
  }, [lists, pathname, searchParams]);
}

// Renders nothing; mount it once under a Suspense boundary,
// because useSearchParams needs one.
export function ListStateRecorder({
  lists,
}: {
  lists: readonly RememberedList[];
}) {
  useRecordListState(lists);
  return null;
}

// `href` plus its remembered query, e.g. "/assets/pcs?q=pc-00006".
// The server and the first client render use the plain href (no storage there),
// then it switches to the remembered one, so hydration stays consistent.
export function useRememberedHref(href: string, enabled: boolean): string {
  const query = useSyncExternalStore(
    subscribe,
    () => (enabled ? readQuery(href) : null),
    () => null,
  );
  return query ? `${href}?${query}` : href;
}
