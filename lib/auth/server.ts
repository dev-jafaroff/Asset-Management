import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import {
  getRoleFromClaims,
  isAllowedTenant,
  LOGIN_PATH,
  type SignInError,
} from "@/lib/auth/entra";
import { requireEnv } from "@/lib/env";

// A working day. The session is not extended, so a role taken away in Entra,
// or a person removed from Entra, is out by the next day at the latest.
// Signing in again is one redirect while the Microsoft session is open.
const SESSION_SECONDS = 12 * 60 * 60;

// Sign-in with Microsoft Entra ID. Stateless: the session lives in an
// encrypted cookie (BETTER_AUTH_SECRET), there are no auth tables. Our own
// User row is kept in step by getCurrentUser().
export const auth = betterAuth({
  appName: "Asset Management",
  socialProviders: {
    microsoft: {
      clientId: requireEnv("MICROSOFT_CLIENT_ID"),
      clientSecret: requireEnv("MICROSOFT_CLIENT_SECRET"),
      // Any work account; validateUserInfo narrows it to our tenants.
      tenantId: "organizations",
      // The photo would be stored in the session cookie.
      disableProfilePhoto: true,
      // Name, email and role follow Entra on every sign-in.
      overrideUserInfoOnSignIn: true,
      mapProfileToUser: (profile) => ({
        // Accounts without a mailbox have no email claim.
        email: profile.email ?? profile.preferred_username,
        entraObjectId: profile.oid,
        tenantId: profile.tid,
        role: getRoleFromClaims(profile.roles) ?? undefined,
      }),
    },
  },
  user: {
    additionalFields: {
      entraObjectId: { type: "string", required: true },
      tenantId: { type: "string", required: true },
      role: { type: "string", required: true },
    },
    // Runs on every sign-in, with the claims fresh from Entra. A rejected
    // person is sent back to the login page with ?error=<code>.
    validateUserInfo: ({ source }) => {
      const claims = source.oauth?.profile;
      const reject = (error: SignInError) => ({ error });
      if (!isAllowedTenant(claims?.tid)) return reject("tenant_not_allowed");
      if (!getRoleFromClaims(claims?.roles)) return reject("no_role");
    },
  },
  session: {
    expiresIn: SESSION_SECONDS,
    cookieCache: {
      enabled: true,
      strategy: "jwe",
      maxAge: SESSION_SECONDS,
      refreshCache: false,
    },
  },
  // Microsoft's tokens are not needed after sign-in; not kept in a cookie.
  account: { storeAccountCookie: false },
  // Name, email and role come from Entra only: nobody edits them here.
  disabledPaths: ["/update-user"],
  onAPIError: { errorURL: LOGIN_PATH },
  // Lets Server Actions (sign in, sign out) set the auth cookies.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
