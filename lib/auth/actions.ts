"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getReturnPath, LOGIN_PATH, RETURN_TO_PARAM } from "@/lib/auth/entra";
import { auth } from "@/lib/auth/server";

// Off to Microsoft; back on the page asked for before signing in (the form's
// ?next=, home by default), or on the login page with ?error=<code> when the
// sign-in is turned away.
export async function signIn(formData: FormData) {
  const { url } = await auth.api.signInSocial({
    body: {
      provider: "microsoft",
      callbackURL: getReturnPath(formData.get(RETURN_TO_PARAM)),
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
