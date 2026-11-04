"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppLogo } from "./app-logo";

export function MobileNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            className="md:hidden"
          />
        }
      >
        <Menu />
      </SheetTrigger>

      <SheetContent side="left" className="gap-0 bg-sidebar">
        <SheetHeader className="h-12 justify-center border-b border-sidebar-border py-0">
          {/* The dialog needs a title for screen readers; the logo is the visible header. */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppLogo />
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
