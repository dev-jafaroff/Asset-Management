"use client";

import { useEffect, useMemo, useRef } from "react";

export type DebouncedCallback<Args extends unknown[]> = {
  // Schedules a call; each new call restarts the wait.
  run: (...args: Args) => void;
  // Runs a waiting call now (e.g. on Enter).
  flush: () => void;
  // Drops a waiting call.
  cancel: () => void;
};

// Runs `callback` only once calls stop for `delay` ms, e.g. search while typing
// without a request per key press.
// The latest `callback` is always used, so it may read fresh state and props.
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
): DebouncedCallback<Args> {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingArgsRef = useRef<Args | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  });

  // Nothing fires after the component is gone.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useMemo(() => {
    const cancel = () => {
      clearTimeout(timerRef.current);
      pendingArgsRef.current = null;
    };
    const flush = () => {
      const args = pendingArgsRef.current;
      cancel();
      if (args) callbackRef.current(...args);
    };
    const run = (...args: Args) => {
      pendingArgsRef.current = args;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delay);
    };
    return { run, flush, cancel };
  }, [delay]);
}
