import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getRoleFromClaims, LOGIN_PATH } from "@/lib/auth/entra";
import { auth } from "@/lib/auth/server";
import type { Role } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type { Role };

export type CurrentUser = {
  // User row id, recorded as the actor of history events.
  id: number;
  displayName: string;
  email: string;
  role: Role;
};

const currentUserSelect = {
  id: true,
  displayName: true,
  email: true,
  role: true,
} as const;

// Who signed in, as Entra says.
type EntraPerson = Omit<CurrentUser, "id"> & {
  entraObjectId: string;
  tenantId: string;
};

// The person's User row, created on their first sign-in and kept in step
// with Entra after that (name, email and role change there, not here).
// Usually a single read: it only writes when something changed.
async function syncUserRow({
  entraObjectId,
  tenantId,
  displayName,
  email,
  role,
}: EntraPerson): Promise<CurrentUser> {
  const where = { entraObjectId };
  const fromEntra = { tenantId, displayName, email, role };

  const row = await prisma.user.findUnique({
    where,
    select: { ...currentUserSelect, tenantId: true },
  });
  if (
    row &&
    row.tenantId === tenantId &&
    row.displayName === displayName &&
    row.email === email &&
    row.role === role
  ) {
    return { id: row.id, displayName, email, role };
  }

  return prisma.user.upsert({
    where,
    create: { entraObjectId, ...fromEntra },
    update: fromEntra,
    select: currentUserSelect,
  });
}

// The signed-in person, read once per request. No valid session (or a role
// missing from it) means the login page.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = getRoleFromClaims([session?.user.role]);
  if (!session || !role) redirect(LOGIN_PATH);

  const { user } = session;
  return syncUserRow({
    entraObjectId: user.entraObjectId,
    tenantId: user.tenantId,
    displayName: user.name,
    email: user.email,
    role,
  });
});
