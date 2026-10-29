"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavGroupProps = {
  label: string;
  icon: ReactNode;
  basePath: string;
  children: ReactNode;
};

export function NavGroup({ label, icon, basePath, children }: NavGroupProps) {
  const pathname = usePathname();
  const isInGroup =
    pathname === basePath || pathname.startsWith(`${basePath}/`);

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
