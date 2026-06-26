// Lightweight per-IP rate limit + response cache.
// In-memory: fine for a single low-traffic read endpoint. If this ever runs on
// many Vercel instances and you need a hard shared limit, swap to Upstash Redis
// (see SECURITY r8). For a public, cached, read-only marketing list this is enough.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60; // 60 req/min per IP

export function rateLimit(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= MAX_PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

// Tiny TTL cache so we don't hit Airtable on every page view (also dodges
// Airtable's 5 req/sec limit).
type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 5 * 60_000;

export async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value as T;
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}
