import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

/**
 * The sync store: one record per secret token, holding the full backup
 * envelope plus a revision counter for optimistic concurrency. The token (a
 * 144-bit secret from the user's sync link) is the only credential — it is
 * hashed before use as a storage key so the raw secret never sits in Redis.
 *
 * Backed by Upstash Redis (the Vercel Marketplace KV integration injects the
 * env vars). Without those vars, dev falls back to an in-process map so the
 * whole flow works locally; production without them returns 503.
 */

type Stored = {
  rev: number;
  envelope: unknown;
  updatedAt: string;
};

type Store = {
  get(key: string): Promise<Stored | null>;
  set(key: string, value: Stored): Promise<void>;
  del(key: string): Promise<void>;
};

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

// Survives HMR in dev; a serverless instance in prod would lose it, hence the 503 there.
const devStore = ((globalThis as Record<string, unknown>).__yogaSyncDevStore ??=
  new Map<string, Stored>()) as Map<string, Stored>;

function getStore(): Store | null {
  if (REDIS_URL && REDIS_TOKEN) {
    const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
    return {
      get: async (key) => (await redis.get<Stored>(key)) ?? null,
      set: async (key, value) => void (await redis.set(key, value)),
      del: async (key) => void (await redis.del(key)),
    };
  }
  if (process.env.NODE_ENV !== "production") {
    return {
      get: async (key) => devStore.get(key) ?? null,
      set: async (key, value) => void devStore.set(key, value),
      del: async (key) => void devStore.delete(key),
    };
  }
  return null;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
// Generous for one teacher's library (typically well under 1 MB) while keeping
// a lid on abuse of the unauthenticated-beyond-token endpoint.
const MAX_ENVELOPE_BYTES = 2_000_000;

function keyFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!TOKEN_PATTERN.test(token)) return null;
  return `yoga-sync:${createHash("sha256").update(token).digest("hex")}`;
}

export async function GET(request: Request) {
  const store = getStore();
  if (!store) return Response.json({ error: "sync not configured" }, { status: 503 });
  const key = keyFromRequest(request);
  if (!key) return Response.json({ error: "missing or invalid token" }, { status: 401 });

  const stored = await store.get(key);
  if (!stored) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ rev: stored.rev, envelope: stored.envelope });
}

export async function PUT(request: Request) {
  const store = getStore();
  if (!store) return Response.json({ error: "sync not configured" }, { status: 503 });
  const key = keyFromRequest(request);
  if (!key) return Response.json({ error: "missing or invalid token" }, { status: 401 });

  const text = await request.text();
  if (text.length > MAX_ENVELOPE_BYTES) {
    return Response.json({ error: "library too large to sync" }, { status: 413 });
  }
  let body: { baseRev?: unknown; envelope?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const { baseRev, envelope } = body;
  if (
    typeof baseRev !== "number" ||
    typeof envelope !== "object" ||
    envelope === null ||
    !Array.isArray((envelope as { sequences?: unknown }).sequences)
  ) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  // Optimistic concurrency: a push built against a stale revision gets the
  // newer copy back to merge with. (Read-then-write isn't atomic here; for a
  // single user's occasional near-simultaneous saves, the 409 path plus
  // client-side record merge already makes lost updates a non-event.)
  const current = await store.get(key);
  if (current && current.rev !== baseRev) {
    return Response.json({ rev: current.rev, envelope: current.envelope }, { status: 409 });
  }
  const next: Stored = {
    rev: (current?.rev ?? 0) + 1,
    envelope,
    updatedAt: new Date().toISOString(),
  };
  await store.set(key, next);
  return Response.json({ rev: next.rev });
}

export async function DELETE(request: Request) {
  const store = getStore();
  if (!store) return Response.json({ error: "sync not configured" }, { status: 503 });
  const key = keyFromRequest(request);
  if (!key) return Response.json({ error: "missing or invalid token" }, { status: 401 });

  await store.del(key);
  return new Response(null, { status: 204 });
}
