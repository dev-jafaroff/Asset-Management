import type { Role } from "@/lib/generated/prisma/enums";

// Who may sign in: people from our own tenants (EIG, Waverity) who were given
// an app role on the Asset Management app in Entra. Plain functions with no
// server imports, so the login page and the proxy can use them too.

export const LOGIN_PATH = "/login";

// Where to go after signing in, e.g. the page of a scanned label:
// /login?next=/hardware/278
export const RETURN_TO_PARAM = "next";

// Only a path of this app, never another site ("//evil.example",
// "/\evil.example", "/\t/evil.example" all lead to one); anything else goes
// home. The URL parser reads the path as a browser would.
const OWN_ORIGIN = "http://app.invalid";

export function getReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  const url = new URL(value, OWN_ORIGIN);
  const path = `${url.pathname}${url.search}`;
  return url.origin === OWN_ORIGIN && !path.startsWith(LOGIN_PATH) ? path : "/";
}

// The app role values in the Entra app registration are the Role names.
// Strongest first, so a person with several roles gets the strongest one.
const rolesByRank: readonly Role[] = ["ADMIN", "EDITOR", "VIEWER"];

// getRoleFromClaims(["VIEWER", "EDITOR"]) → "EDITOR"; no app role → null.
export function getRoleFromClaims(roles: unknown): Role | null {
  if (!Array.isArray(roles)) return null;
  return rolesByRank.find((role) => roles.includes(role)) ?? null;
}

// AUTH_ALLOWED_TENANT_IDS="<EIG tenant id>,<Waverity tenant id>"
function getAllowedTenantIds(): string[] {
  return (process.env.AUTH_ALLOWED_TENANT_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedTenant(tenantId: unknown): boolean {
  return (
    typeof tenantId === "string" &&
    getAllowedTenantIds().includes(tenantId.toLowerCase())
  );
}

// Emails are stored in lower case, so sign-in and user sync find the same
// person however Entra spells the address.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Why a sign-in was turned away, as the login page tells the person.
const signInErrors = {
  tenant_not_allowed: "Your organization does not use this app.",
  no_role:
    "You have no access to this app yet. Ask IT to give you a role on Asset Management.",
} satisfies Record<string, string>;

export type SignInError = keyof typeof signInErrors;

// Anything else Better Auth sends back, e.g. a cancelled Microsoft sign-in.
const DEFAULT_SIGN_IN_ERROR = "Sign-in did not complete. Please try again.";

// The message for the `error` the login page was sent back with, if any.
export function getSignInErrorMessage(error: string | undefined) {
  if (!error) return null;
  return Object.hasOwn(signInErrors, error)
    ? signInErrors[error as SignInError]
    : DEFAULT_SIGN_IN_ERROR;
}
