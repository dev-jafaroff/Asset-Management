import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { buildHref, PAGE_PARAM, type SearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

type ListPaginationProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  pathname: string;
  // Current params, kept on the page links (search, filters, status).
  params: SearchParams;
};

export function getPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function ListPagination({
  page,
  pageCount,
  pageSize,
  total,
  pathname,
  params,
}: ListPaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  // Page 1 has no param, so the default URL stays clean.
  const hrefFor = (target: number) =>
    buildHref(pathname, params, {
      [PAGE_PARAM]: target === 1 ? undefined : target,
    });

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 text-sm text-muted-foreground"
    >
      <p>
        Showing {first}–{last} of {total}
      </p>

      <div className="flex items-center gap-2">
        <PageLink
          label="Previous page"
          href={page > 1 ? hrefFor(page - 1) : undefined}
        >
          <ChevronLeft />
        </PageLink>
        <span>
          Page {page} of {pageCount}
        </span>
        <PageLink
          label="Next page"
          href={page < pageCount ? hrefFor(page + 1) : undefined}
        >
          <ChevronRight />
        </PageLink>
      </div>
    </nav>
  );
}

// Without an href the button is shown disabled (first or last page).
function PageLink({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: ReactNode;
}) {
  const className = buttonVariants({ variant: "outline", size: "icon-sm" });

  if (!href) {
    return (
      <span
        aria-disabled
        aria-label={label}
        className={cn(className, "pointer-events-none opacity-50")}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
