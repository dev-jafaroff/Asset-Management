import { z } from "zod";
import { requireEnv } from "@/lib/env";

// Microsoft Graph as the app itself (client credentials), for jobs that run
// without anyone signed in: the user sync and, later, the Intune sync. Uses
// the sign-in app registration; its Application permissions decide what
// may be read, per tenant, once that tenant's admin has consented.

const GRAPH_URL = "https://graph.microsoft.com/v1.0";
// Graph itself, with every Application permission the app was granted.
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
// Throttled or briefly unavailable: wait (as long as Graph asks) and retry.
const RETRY_STATUSES = new Set([429, 503, 504]);
const MAX_ATTEMPTS = 4;
// A token is renewed this long before it expires.
const TOKEN_MARGIN_MS = 5 * 60 * 1000;

export class GraphError extends Error {
  name = "GraphError";
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

const errorResponseSchema = z.object({
  // Token endpoint
  error_description: z.string().optional(),
  // Graph
  error: z.union([z.string(), z.object({ message: z.string() })]).optional(),
});

// The useful part of an error body, e.g. "Insufficient privileges to
// complete the operation." Token errors are cut at their first line, before
// trace and correlation ids.
async function readErrorMessage(response: Response): Promise<string> {
  const body = errorResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  const { error, error_description } = body.success ? body.data : {};
  const message =
    error_description ?? (typeof error === "object" ? error.message : error);
  return message?.split(/\r?\n/)[0] ?? `HTTP ${response.status}`;
}

type Token = { value: string; expiresAt: number };

// One token per tenant, reused until shortly before it expires (about 1 h).
const tokens = new Map<string, Token>();

async function getAppToken(tenantId: string): Promise<string> {
  const cached = tokens.get(tenantId);
  if (cached && cached.expiresAt - TOKEN_MARGIN_MS > Date.now()) {
    return cached.value;
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: requireEnv("MICROSOFT_CLIENT_ID"),
        client_secret: requireEnv("MICROSOFT_CLIENT_SECRET"),
        scope: GRAPH_SCOPE,
        grant_type: "client_credentials",
      }),
    },
  );
  if (!response.ok) {
    throw new GraphError(
      `No Graph access to tenant ${tenantId}: ${await readErrorMessage(response)}`,
    );
  }

  const body = tokenResponseSchema.parse(await response.json());
  tokens.set(tenantId, {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  });
  return body.access_token;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graph's Retry-After in seconds, or else 1 s, 2 s, 4 s…
function getRetryDelayMs(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : 2 ** attempt * 1000;
}

// One GET of a Graph path ("/users?…") or of a full nextLink URL.
async function graphGet(tenantId: string, pathOrUrl: string): Promise<unknown> {
  const url = pathOrUrl.startsWith("https://")
    ? pathOrUrl
    : `${GRAPH_URL}${pathOrUrl}`;

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${await getAppToken(tenantId)}` },
    });
    if (response.ok) return response.json();

    if (RETRY_STATUSES.has(response.status) && attempt + 1 < MAX_ATTEMPTS) {
      await wait(getRetryDelayMs(response, attempt));
      continue;
    }
    throw new GraphError(
      `Graph refused ${new URL(url).pathname}: ${await readErrorMessage(response)}`,
    );
  }
}

const pageSchema = z.object({
  value: z.array(z.unknown()),
  "@odata.nextLink": z.string().optional(),
});

// Every item of a Graph list, page after page. The items are not checked
// here: the caller parses them with its own schema.
export async function graphGetAll(
  tenantId: string,
  path: string,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let next: string | undefined = path;
  while (next) {
    const page = pageSchema.parse(await graphGet(tenantId, next));
    items.push(...page.value);
    next = page["@odata.nextLink"];
  }
  return items;
}
