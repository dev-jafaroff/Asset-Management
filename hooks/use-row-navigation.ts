"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

// Clicks on these are their own, e.g. a link, a button or a row checkbox.
const CONTROL_SELECTOR =
  "a, button, input, select, textarea, [role='checkbox']";

// Lets a whole table row open its record, like the link in it: Ctrl/⌘ + click
// or a middle click opens a new tab. The row's link stays the way in for the
// keyboard and screen readers. Clicks on other controls, or while text is
// selected (e.g. copying a serial), are left alone.
export function useRowNavigation() {
  const router = useRouter();

  function shouldIgnore(event: MouseEvent<HTMLElement>): boolean {
    const target = event.target as Element;
    return (
      target.closest(CONTROL_SELECTOR) !== null ||
      Boolean(window.getSelection()?.toString())
    );
  }

  // Spread on the row: <TableRow {...getRowLinkProps(href)}>.
  return (href: string) => ({
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (shouldIgnore(event)) return;
      if (event.ctrlKey || event.metaKey) window.open(href, "_blank");
      else router.push(href);
    },
    onAuxClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (event.button !== 1 || shouldIgnore(event)) return;
      window.open(href, "_blank");
    },
  });
}
