import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ListPage } from "@/components/shared/list-layout";
import { UserList, UserListFallback } from "@/components/users/user-list";

export const metadata: Metadata = { title: "Users" };

// People come from Entra ID (lib/users/user-sync.ts), so there is no
// "New user" here; the sync is run from the Azure sync page.
export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <ListPage>
      <PageHeader
        title="Users"
        description="Everyone in the company and what they hold."
      />
      <Suspense fallback={<UserListFallback />}>
        <UserList searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
