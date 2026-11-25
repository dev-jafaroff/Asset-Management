import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, RETURN_TO_PARAM } from "@/lib/auth/entra";
import { auth } from "@/lib/auth/server";

// Nothing in the app is served without a valid session. The session is read
// from its encrypted cookie, so this costs no database query. Pages and
// Server Actions still ask getCurrentUser() for the person and their role.
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new Response("Sign in first.", { status: 401 });
  }
  // Back to the same page after signing in, e.g. a scanned label.
  const login = new URL(LOGIN_PATH, request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") {
    login.searchParams.set(RETURN_TO_PARAM, `${pathname}${search}`);
  }
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login page, Better Auth's own endpoints, the health
  // check, the scheduled jobs (they check CRON_SECRET themselves), Next's
  // files and the files in public/ (anything with a dot).
  matcher: ["/((?!login|api/auth|api/health|api/cron|_next/|.*\\..*).*)"],
};
