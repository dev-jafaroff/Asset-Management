import { House, Laptop, RefreshCw, ScanLine, Tags } from "lucide-react";
import type { Role } from "@/lib/current-user";
import { NavLink } from "./nav-link";

export function AppSidebar({ role }: { role: Role }) {
  return (
    <aside className="border-sidebar-border bg-sidebar flex w-56 shrink-0 flex-col border-r">
      <div className="border-sidebar-border flex h-12 shrink-0 items-center border-b px-4 text-sm font-semibold">
        Asset Management
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        <NavLink href="/" label="Home" icon={<House />} />
        <NavLink href="/assets" label="Assets" icon={<Laptop />} />
        <NavLink href="/scan" label="Scan" icon={<ScanLine />} />

        {role === "ADMIN" && (
          <>
            <p className="text-muted-foreground mt-4 mb-1 px-2 text-xs font-medium">
              Admin
            </p>
            <NavLink
              href="/admin/lookups"
              label="Lookup tables"
              icon={<Tags />}
            />
            <NavLink
              href="/admin/sync"
              label="Intune sync"
              icon={<RefreshCw />}
            />
          </>
        )}
      </nav>
    </aside>
  );
}
