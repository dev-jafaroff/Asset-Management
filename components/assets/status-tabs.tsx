import Link from "next/link";
import type { ReactNode } from "react";
import { StatusDot } from "@/components/assets/status-badge";
import { CountBadge } from "@/components/shared/count-badge";
import { cn } from "@/lib/utils";

export type StatusTabItem = {
  slug: string;
  label: string;
  color: string | null;
  count: number;
  // Built by the caller, so the link can keep the other params (e.g. search).
  href: string;
};

type StatusTabsProps = {
  tabs: StatusTabItem[];
  activeSlug: string;
  // Shown at the right end of the row, right above the table (e.g. the column menu).
  actions?: ReactNode;
};

export function StatusTabs({ tabs, activeSlug, actions }: StatusTabsProps) {
  return (
    <div className="flex items-end">
      <nav
        aria-label="Filter by status"
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden border-b"
      >
        {tabs.map((tab) => {
          const isActive = tab.slug === activeSlug;

          return (
            <Link
              key={tab.slug}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                isActive && "border-primary font-medium text-foreground",
              )}
            >
              {tab.color && <StatusDot color={tab.color} />}
              {tab.label}
              <CountBadge count={tab.count} isActive={isActive} />
            </Link>
          );
        })}
      </nav>
      {/* Own border, so the line under the tabs runs on under the actions. */}
      {actions && (
        <div className="shrink-0 border-b pb-1.5 pl-2">{actions}</div>
      )}
    </div>
  );
}
