import { Suspense } from "react";
import { SearchForm } from "@/components/shared/search-form";
import { ASSETS_PATH } from "@/lib/assets/asset-types";
import { getCurrentUser } from "@/lib/current-user";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu, UserMenuFallback } from "./user-menu";

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:gap-4">
      <MobileNav>
        <SidebarNav />
      </MobileNav>

      <SearchForm
        action={ASSETS_PATH}
        label="Search assets"
        placeholder="Search by tag, serial or name"
        className="max-w-sm"
      />

      <div className="ml-auto">
        <Suspense fallback={<UserMenuFallback />}>
          <SignedInUserMenu />
        </Suspense>
      </div>
    </header>
  );
}

// The person is read per request, so the rest of the header does not wait.
async function SignedInUserMenu() {
  return <UserMenu user={await getCurrentUser()} />;
}
