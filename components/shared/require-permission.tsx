import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/current-user";
import { can, type Permission } from "@/lib/permissions";

type RequirePermissionProps = {
  permission: Permission;
  children: ReactNode;
};

// Shows its children (e.g. an "Edit" button) only to roles that are allowed
// to use them. It only hides controls: the Server Action behind each one
// checks the role again.
// The user is read per request, so it streams in without holding back the page.
export function RequirePermission(props: RequirePermissionProps) {
  return (
    <Suspense fallback={null}>
      <PermissionGate {...props} />
    </Suspense>
  );
}

async function PermissionGate({
  permission,
  children,
}: RequirePermissionProps) {
  const user = await getCurrentUser();
  return can(user.role, permission) ? children : null;
}
