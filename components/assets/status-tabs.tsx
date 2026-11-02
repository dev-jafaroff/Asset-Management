import Link from "next/link";
import { StatusDot } from "@/components/assets/status-badge";
import { ALL_STATUS_SLUG } from "@/lib/assets/status-filters";
import { cn } from "@/lib/utils";

export type StatusTabItem = {
  slug: string;
  label: string;
  color: string | null;
  count: number;
};

type StatusTabsProps = {
  tabs: StatusTabItem[];
  activeSlug: string;
  // Page the tabs filter, e.g. "/assets/pcs".
  basePath: string;
};

export function StatusTabs({ tabs, activeSlug, basePath }: StatusTabsProps) {
  return (
    <nav
      aria-label="Filter by status"
      className="flex gap-1 overflow-x-auto border-b"
    >
      {tabs.map((tab) => {
        const isActive = tab.slug === activeSlug;
        const href =
          tab.slug === ALL_STATUS_SLUG
            ? basePath
            : `${basePath}?status=${tab.slug}`;

        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
              isActive && "border-primary font-medium text-foreground",
            )}
          >
            {tab.color && <StatusDot color={tab.color} />}
            {tab.label}
            <span
              className={cn(
                "rounded-full bg-muted px-1.5 text-xs text-muted-foreground",
                isActive && "bg-primary/10 text-primary",
              )}
            >
              {tab.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
