import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/current-user";
import { can, type Permission } from "@/lib/permissions";

type RequirePermissionProps = {
  permission: Permission;
  children: ReactNode;
  // Shown instead to roles that are not allowed (and while the role is
  // read), e.g. a plain badge in place of a button.
  fallback?: ReactNode;
};

// Shows its children (e.g. an "Edit" button) only to roles that are allowed
// to use them. It only hides controls: the Server Action behind each one
// checks the role again.
// The user is read per request, so it streams in without holding back the page.
export function RequirePermission(props: RequirePermissionProps) {
  return (
    <Suspense fallback={props.fallback ?? null}>
      <PermissionGate {...props} />
    </Suspense>
  );
}

async function PermissionGate({
  permission,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const user = await getCurrentUser();
  return can(user.role, permission) ? children : fallback;
}
