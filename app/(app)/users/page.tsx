import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ListPage } from "@/components/shared/list-layout";
import { RequirePermission } from "@/components/shared/require-permission";
import { UserList, UserListFallback } from "@/components/users/user-list";
import { UserSyncButton } from "@/components/users/user-sync-button";

export const metadata: Metadata = { title: "Users" };

// People come from Entra ID (lib/users/user-sync.ts), so there is no
// "New user" here, only a way to sync before the schedule does.
export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <ListPage>
      <PageHeader
        title="Users"
        description="Everyone in the company and what they hold."
        actions={
          <RequirePermission permission="sync:run">
            <UserSyncButton />
          </RequirePermission>
        }
      />
      <Suspense fallback={<UserListFallback />}>
        <UserList searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
