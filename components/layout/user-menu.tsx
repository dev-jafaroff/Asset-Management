"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/current-user";

const roleLabels: Record<CurrentUser["role"], string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

// The signed-in person in the header; the menu holds "Sign out".
export function UserMenu({ user }: { user: CurrentUser }) {
  const [isSigningOut, startSignOut] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto gap-2 px-2 py-1"
            aria-label={`Account: ${user.displayName}`}
          >
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-sm font-medium">
                {user.displayName}
              </span>
              <span className="block text-xs text-muted-foreground">
                {roleLabels[user.role]}
              </span>
            </span>
            <UserAvatar name={user.displayName} size="lg" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate font-medium text-foreground">
              {user.displayName}
            </span>
            <span className="truncate font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          onClick={() => startSignOut(() => signOut())}
        >
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Same size as the menu's button, while the person is read.
export function UserMenuFallback() {
  return <div aria-hidden className="h-10 w-10 sm:w-40" />;
}
