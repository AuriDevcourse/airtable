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

// TTL cache so we don't hit Airtable on every page view (also dodges Airtable's
// 5 req/sec limit). Refreshes once an hour: a speaker list barely changes, so an
// Airtable edit can take up to TTL_MS to show. Lower TTL_MS if you need it faster.
type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 60 * 60_000; // 1 hour

// Drop a cached entry so the next read re-fetches. Used by the manual sync button:
// without this, a sync would land in Airtable but the grid would keep serving the
// hour-old list, making the button look broken.
export function invalidate(key: string): void {
  cache.delete(key);
}

export async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value as T;
  try {
    const value = await loader();
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  } catch (err) {
    // Airtable/Supabase failed on refresh. Serve the last good value (even if
    // expired) instead of surfacing an error — visitors see slightly stale data
    // rather than "could not load". Only throw if we've never succeeded.
    if (hit) {
      console.error("[cache] loader failed, serving stale value for", key, err);
      return hit.value as T;
    }
    throw err;
  }
}
