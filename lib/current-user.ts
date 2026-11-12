import type { Role } from "@/lib/generated/prisma/enums";

export type { Role };

export type CurrentUser = {
  // User row id, recorded as the actor of history events. Null for the mock
  // user, who has no row; events are then saved without an actor.
  id: number | null;
  displayName: string;
  email: string;
  role: Role;
};

// TODO(feat/entra-sso): replace with the Auth.js session (auth()).
export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    id: null,
    displayName: "Babek Cafarov",
    email: "babek.cafarov@ei-g.com",
    role: "ADMIN",
  };
}
