"use client";

import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRowNavigation } from "@/hooks/use-row-navigation";
import type { UserListItem } from "@/lib/users/queries";

// The link is built on the server, so this file stays free of database code.
export type UserRow = UserListItem & { href: string };

function orDash(value: string | null): string {
  return value ?? "—";
}

// People with their department and how many assets they hold; a row opens
// the person's page.
export function UserTable({ users }: { users: UserRow[] }) {
  const getRowLinkProps = useRowNavigation();

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Job title</TableHead>
            <TableHead className="text-right">Assets</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {users.map((user) => {
            const { href } = user;
            const assetCount = user._count.assignedAssets;

            return (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                {...getRowLinkProps(href)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserAvatar name={user.displayName} />
                    <Link
                      href={href}
                      className="font-medium text-primary hover:underline"
                    >
                      {user.displayName}
                    </Link>
                    {!user.isActive && <Badge variant="secondary">Left</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>{orDash(user.department)}</TableCell>
                <TableCell>{orDash(user.jobTitle)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {assetCount > 0 ? assetCount : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
