"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  label: string;
  icon: ReactNode;
};

export function NavLink({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "text-sidebar-foreground hover:bg-sidebar-accent flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        isActive && "bg-sidebar-accent text-sidebar-primary font-medium",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
