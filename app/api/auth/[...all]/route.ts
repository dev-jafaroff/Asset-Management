import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

// Better Auth's endpoints, e.g. the Microsoft callback
// /api/auth/callback/microsoft (the redirect URI in Entra).
export const { GET, POST } = toNextJsHandler(auth);
