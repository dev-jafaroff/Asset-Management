import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { UserList, UserListFallback } from "@/components/users/user-list";

export const metadata: Metadata = { title: "Users" };

// People come from Entra ID, so there is no "New user" here.
export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone in the company and what they hold."
      />
      <Suspense fallback={<UserListFallback />}>
        <UserList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
