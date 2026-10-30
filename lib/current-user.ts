import type { Role } from "@/lib/generated/prisma/enums";

export type { Role };

export type CurrentUser = {
  displayName: string;
  email: string;
  role: Role;
};

// TODO(feat/entra-sso): replace with the Auth.js session (auth()).
export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    displayName: "Babek Cafarov",
    email: "babek.cafarov@ei-g.com",
    role: "ADMIN",
  };
}
