"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { buildHref } from "@/lib/search-params";
import { useRememberedHref } from "./use-remembered-list-urls";
import { cn } from "@/lib/utils";

type SidebarLinkProps = {
  href: string;
  label: string;
  icon?: ReactNode;
  // Shown after the label, e.g. a count.
  trailing?: ReactNode;
  isActive: boolean;
};

// Shared look of every sidebar link; the variants below decide when it is active.
function SidebarLink({
  href,
  label,
  icon,
  trailing,
  isActive,
}: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent [&_svg]:size-4 [&_svg]:shrink-0",
        isActive && "bg-sidebar-accent font-medium text-sidebar-primary",
      )}
    >
      {icon}
      {label}
      {trailing}
    </Link>
  );
}

type NavLinkProps = {
  href: string;
  label: string;
  icon?: ReactNode;
  exact?: boolean;
  // List pages: the link reopens the list as it was left (search, tab, filters).
  rememberState?: boolean;
};

// True on `basePath` itself and on every page below it.
export function isPathWithin(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

// Active when the current path matches (or is below) `href`.
// On pages with an id in the URL (e.g. /assets/pcs/7) the path is only known
// per request, so the link first renders inactive and then streams in.
export function NavLink(props: NavLinkProps) {
  return (
    <Suspense
      fallback={
        <SidebarLink
          href={props.href}
          label={props.label}
          icon={props.icon}
          isActive={false}
        />
      }
    >
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink({
  href,
  label,
  icon,
  exact = false,
  rememberState = false,
}: NavLinkProps) {
  const pathname = usePathname();
  const target = useRememberedHref(href, rememberState);
  const isActive =
    exact || href === "/" ? pathname === href : isPathWithin(pathname, href);

  return (
    <SidebarLink href={target} label={label} icon={icon} isActive={isActive} />
  );
}

type FilterNavLinkProps = {
  pathname: string;
  // Search param the link sets, e.g. status=in-repair.
  param: string;
  value: string;
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
};

// Links to a filtered list; active when that filter is the one in the URL.
// useSearchParams needs a Suspense boundary above it.
export function FilterNavLink({
  pathname: targetPath,
  param,
  value,
  ...linkProps
}: FilterNavLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = pathname === targetPath && searchParams.get(param) === value;

  return (
    <SidebarLink
      href={buildHref(targetPath, {}, { [param]: value })}
      isActive={isActive}
      {...linkProps}
    />
  );
}
