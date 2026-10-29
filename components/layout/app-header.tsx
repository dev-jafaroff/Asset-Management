import Form from "next/form";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CurrentUser } from "@/lib/current-user";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:gap-4">
      <MobileNav>
        <SidebarNav role={user.role} />
      </MobileNav>

      <Form action="/assets" className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          placeholder="Search by tag, serial or name"
          aria-label="Search assets"
          className="pl-8"
        />
      </Form>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-muted-foreground">{user.role}</p>
        </div>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {getInitials(user.displayName)}
        </div>
      </div>
    </header>
  );
}
