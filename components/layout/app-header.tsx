import { SearchForm } from "@/components/shared/search-form";
import { ASSETS_PATH } from "@/lib/assets/asset-types";
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

      <SearchForm
        action={ASSETS_PATH}
        label="Search assets"
        placeholder="Search by tag, serial or name"
        className="max-w-sm"
      />

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
