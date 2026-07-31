// Lightweight per-IP rate limit + response cache.
// In-memory: fine for a single low-traffic read endpoint. If this ever runs on
// many Vercel instances and you need a hard shared limit, swap to Upstash Redis
// (see SECURITY r8). For a public, cached, read-only marketing list this is enough.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60; // 60 req/min per IP

// Expired buckets are dead weight keyed by client IP, and nothing used to remove them —
// on a long-lived instance the map grew with every distinct visitor. Sweeping on write is
// enough: the map is only ever touched from rateLimit(), and the scan is bounded by how
// many IPs were seen in the last minute.
const SWEEP_EVERY_MS = 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [ip, b] of buckets) {
    if (now > b.resetAt) buckets.delete(ip);
  }
}

export function rateLimit(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);
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
// 5 req/sec limit). Refreshes once an hour by default: a speaker list barely changes, so an
// Airtable edit can take up to TTL_MS to show. Lower TTL_MS if you need it faster.
type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 60 * 60_000; // 1 hour

// For feeds that should refresh once a day rather than hourly. Pass as cached()'s third
// argument — used by /api/team, where the staff list changes a few times a year.
export const DAY_MS = 24 * 60 * 60_000;

// In-flight loaders, so N concurrent misses on the same key run the loader ONCE and all
// await the same promise. Without this, a cold cache plus a burst of traffic fired one
// Airtable scan per request — and /api/all-speakers fans out to five sources at once, so
// it was the easiest way to trip Airtable's 5 req/sec limit.
const inFlight = new Map<string, Promise<unknown>>();

// After a loader throws with nothing cached to fall back on, don't let every subsequent
// request retry immediately — that turns an upstream outage into a hammering loop. Short
// enough that a blip still recovers within seconds.
type Failure = { error: unknown; until: number };
const failures = new Map<string, Failure>();
const FAILURE_TTL_MS = 10_000;

// Drop a cached entry so the next read re-fetches. Used by the manual sync button:
// without this, a sync would land in Airtable but the grid would keep serving the
// hour-old list, making the button look broken.
export function invalidate(key: string): void {
  cache.delete(key);
  failures.delete(key);
}

// ttlMs is per call, so one feed can refresh on a different schedule from the rest without
// changing the default for everything.
export async function cached<T>(key: string, loader: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value as T;

  // Someone else is already refreshing this key — wait on their result instead of
  // starting a second identical fetch.
  const pending = inFlight.get(key);
  if (pending) {
    try {
      return (await pending) as T;
    } catch (err) {
      if (hit) return hit.value as T; // stale beats an error, same rule as below
      throw err;
    }
  }

  // Cold key that just failed: replay the error rather than re-hitting a dead upstream.
  if (!hit) {
    const failed = failures.get(key);
    if (failed && Date.now() < failed.until) throw failed.error;
  }

  const run = (async () => {
    const value = await loader();
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    failures.delete(key);
    return value;
  })();
  inFlight.set(key, run);

  try {
    return await run;
  } catch (err) {
    // Airtable/Supabase failed on refresh. Serve the last good value (even if
    // expired) instead of surfacing an error — visitors see slightly stale data
    // rather than "could not load". Only throw if we've never succeeded.
    if (hit) {
      console.error("[cache] loader failed, serving stale value for", key, err);
      return hit.value as T;
    }
    failures.set(key, { error: err, until: Date.now() + FAILURE_TTL_MS });
    throw err;
  } finally {
    inFlight.delete(key);
  }
}
