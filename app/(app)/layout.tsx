import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { rememberedLists } from "@/components/layout/nav-items";
import { ListStateRecorder } from "@/components/layout/use-remembered-list-urls";
import { getCurrentUser } from "@/lib/current-user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex h-screen">
      <AppSidebar role={user.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      {/* Mounted once, so desktop and mobile menus share the remembered list state. */}
      <Suspense fallback={null}>
        <ListStateRecorder lists={rememberedLists} />
      </Suspense>
    </div>
  );
}
