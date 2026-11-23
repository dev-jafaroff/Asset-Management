import { AppLogo } from "./app-logo";
import { SidebarNav } from "./sidebar-nav";

export function AppSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-12 shrink-0 items-center border-b border-sidebar-border px-4">
        <AppLogo />
      </div>
      <SidebarNav />
    </aside>
  );
}
