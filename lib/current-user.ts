import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  getRoleFromClaims,
  LOGIN_PATH,
  normalizeEmail,
} from "@/lib/auth/entra";
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

// The person's User row, usually made by the user sync before they ever sign
// in, and kept in step with Entra (name, email and role change there, not
// here). Usually a single read: it only writes when something changed.
async function syncUserRow({
  entraObjectId,
  tenantId,
  displayName,
  email,
  role,
}: EntraPerson): Promise<CurrentUser> {
  // Found by the Entra object id, or else by email: Waverity people are
  // synced as guests of the EIG tenant, whose object id differs from the one
  // they sign in with from their own tenant. Their row keeps the synced id.
  const rows = await prisma.user.findMany({
    where: { OR: [{ entraObjectId }, { email }] },
    select: { ...currentUserSelect, entraObjectId: true },
  });
  const row =
    rows.find((match) => match.entraObjectId === entraObjectId) ?? rows[0];

  if (!row) {
    // Not synced (yet). Upsert, as two first requests can arrive at once.
    return prisma.user.upsert({
      where: { entraObjectId },
      create: { entraObjectId, tenantId, displayName, email, role },
      update: {},
      select: currentUserSelect,
    });
  }

  const fromEntra = { displayName, email, role };
  if (
    row.displayName === displayName &&
    row.email === email &&
    row.role === role
  ) {
    return { id: row.id, ...fromEntra };
  }
  return prisma.user.update({
    where: { id: row.id },
    data: fromEntra,
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
    email: normalizeEmail(user.email),
    role,
  });
});
