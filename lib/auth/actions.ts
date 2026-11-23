"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/entra";
import { auth } from "@/lib/auth/server";

// Off to Microsoft; back on the home page, or on the login page with
// ?error=<code> when the sign-in is turned away.
export async function signIn() {
  const { url } = await auth.api.signInSocial({
    body: {
      provider: "microsoft",
      callbackURL: "/",
      errorCallbackURL: LOGIN_PATH,
    },
    headers: await headers(),
  });
  if (!url) throw new Error("Microsoft sign-in did not return a URL.");
  redirect(url);
}

// Ends the session here only; the Microsoft session stays open.
export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect(LOGIN_PATH);
}
