import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signIn } from "@/lib/auth/actions";
import {
  getReturnPath,
  getRoleFromClaims,
  getSignInErrorMessage,
  RETURN_TO_PARAM,
} from "@/lib/auth/entra";
import { auth } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in" };

// Outside the app layout. The only way in is the Microsoft work account.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-4 text-center">
          <AppLogo className="justify-center" />
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Use your work Microsoft account.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense fallback={<SignInForm disabled />}>
            <SignIn searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

// The sign-in, with why the last one was turned away (?error=<code>) and
// where to go after it (?next=<path>). Someone already signed in goes
// straight there.
async function SignIn({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { error, [RETURN_TO_PARAM]: next } = await searchParams;
  const returnPath = getReturnPath(next);

  const session = await auth.api.getSession({ headers: await headers() });
  if (session && getRoleFromClaims([session.user.role])) redirect(returnPath);

  const message = getSignInErrorMessage(
    typeof error === "string" ? error : undefined,
  );

  return (
    <>
      {message && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {message}
        </p>
      )}
      <SignInForm returnPath={returnPath} />
    </>
  );
}

// Disabled until the page knows where to return to.
function SignInForm({
  returnPath,
  disabled,
}: {
  returnPath?: string;
  disabled?: boolean;
}) {
  return (
    <form action={signIn}>
      {returnPath && (
        <input type="hidden" name={RETURN_TO_PARAM} value={returnPath} />
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled}>
        <MicrosoftLogo />
        Sign in with Microsoft
      </Button>
    </form>
  );
}

// The four squares Microsoft asks sign-in buttons to show.
function MicrosoftLogo() {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className="size-4">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
