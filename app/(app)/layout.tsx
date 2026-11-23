import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { rememberedLists } from "@/components/layout/nav-items";
import { ListStateRecorder } from "@/components/layout/use-remembered-list-urls";

// The shell renders at once; the parts that need the signed-in person (the
// user menu, the Admin section) stream in on their own.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      {/* Mounted once, so desktop and mobile menus share the remembered list state. */}
      <Suspense fallback={null}>
        <ListStateRecorder lists={rememberedLists} />
      </Suspense>
    </div>
  );
}
