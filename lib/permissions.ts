import type { Role } from "@/lib/generated/prisma/enums";

// Everything a role can be allowed to do. VIEWER only reads.
const permissionRoles = {
  "asset:edit": ["ADMIN", "EDITOR"],
  // Categories, models, companies, locations and statuses.
  "lookup:manage": ["ADMIN"],
  // Downloading a list as a file: anyone who can see the list.
  "list:export": ["ADMIN", "EDITOR", "VIEWER"],
  // Starting a sync with Entra ID or Intune by hand ("Sync now").
  "sync:run": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissionRoles;

// Used twice for every write: by the page to show or hide the control, and by
// the Server Action itself, which never trusts the page.
export function can(role: Role, permission: Permission): boolean {
  const allowed: readonly Role[] = permissionRoles[permission];
  return allowed.includes(role);
}
