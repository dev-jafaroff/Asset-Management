import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

// Public liveness/readiness probe (also used by the App Service health check).
export async function GET() {
  // Always evaluate at request time; never prerender a health check.
  await connection();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "up" });
  } catch {
    return Response.json(
      { status: "error", database: "down" },
      { status: 503 },
    );
  }
}
