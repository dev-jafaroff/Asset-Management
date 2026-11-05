"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isPathWithin } from "./nav-link";

type NavGroupProps = {
  label: string;
  icon: ReactNode;
  basePath: string;
  children: ReactNode;
};

// Collapsible sidebar group, open while the current page is inside it.
// On pages with an id in the URL the path is only known per request, so the
// group first renders closed and opens once the path streams in.
export function NavGroup(props: NavGroupProps) {
  return (
    <Suspense fallback={<NavGroupMenu {...props} isInGroup={false} />}>
      <ActiveNavGroup {...props} />
    </Suspense>
  );
}

function ActiveNavGroup(props: NavGroupProps) {
  const pathname = usePathname();
  return (
    <NavGroupMenu
      {...props}
      isInGroup={isPathWithin(pathname, props.basePath)}
    />
  );
}

function NavGroupMenu({
  label,
  icon,
  children,
  isInGroup,
}: NavGroupProps & { isInGroup: boolean }) {
  const [isOpen, setIsOpen] = useState(isInGroup);
  const [wasInGroup, setWasInGroup] = useState(isInGroup);

  if (isInGroup !== wasInGroup) {
    setWasInGroup(isInGroup);
    if (isInGroup) setIsOpen(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent [&_svg]:size-4 [&_svg]:shrink-0",
          isInGroup && "font-medium",
        )}
      >
        {icon}
        {label}
        <ChevronRight
          className={cn("ml-auto transition-transform", isOpen && "rotate-90")}
        />
      </button>

      {isOpen && (
        <div className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
          {children}
        </div>
      )}
    </div>
  );
}
