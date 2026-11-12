"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Components reading the same key re-render together when one of them writes.
const listeners = new Set<() => void>();
// Used when storage is blocked (e.g. private mode), so choices last until reload.
const memoryStore = new Map<string, string>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Other tabs: the browser fires "storage" when they write.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string | null) {
  if (value === null) memoryStore.delete(key);
  else memoryStore.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the memory copy above is used instead.
  }
  notify();
}

function parse<T>(
  raw: string | null,
  isValid: (value: unknown) => value is T,
): T | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

export type LocalStorageState<T> = {
  // The stored value, or null when nothing (valid) is stored yet.
  value: T | null;
  setValue: (value: T) => void;
  // Forgets the stored value.
  remove: () => void;
};

// A JSON value kept in this browser's localStorage, e.g. a per-list preference.
// Stored data is never trusted: `isValid` checks its shape (pass a stable
// function), and anything else reads as null. The server and the first client
// render see null, so hydration matches; the stored value follows right after.
export function useLocalStorage<T>(
  key: string,
  isValid: (value: unknown) => value is T,
): LocalStorageState<T> {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const value = useMemo(() => parse(raw, isValid), [raw, isValid]);

  const setValue = useCallback(
    (next: T) => writeRaw(key, JSON.stringify(next)),
    [key],
  );
  const remove = useCallback(() => writeRaw(key, null), [key]);

  return { value, setValue, remove };
}
