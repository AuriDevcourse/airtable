// How often the feeds refresh, in one place.
//
// TechBBQ 2026 runs August 26th and 27th. In the run-up and across those two days the
// Airtable tables and the Brella schedule are being edited constantly, and an hour-old
// program on techbbq.dk is wrong in a way visitors notice. So until the end of August 27th
// every feed runs on a ~30 minute cadence; from August 28th it falls back to the calm
// cadences the rest of the year uses (hourly feeds, daily team list).
//
// The switch is a clock comparison, not a deploy: nobody has to remember to undo this on
// the 28th. Read fresh on every call — a module-level `Date.now()` would freeze at cold
// start and a long-lived Vercel instance would then serve the event cadence forever.
//
// Two layers have to agree, which is why they live together here:
//   memory TTL  · the per-instance cache in lib/rate-limit.ts, what a function call sees
//   s-maxage    · the Vercel CDN, what a visitor actually gets
// The memory TTL is deliberately a lot shorter than s-maxage. Only a CDN revalidation
// reaches the function at all, so when one does it should read Airtable rather than answer
// from a copy that is nearly as old as the one the CDN just gave up on. Otherwise the two
// TTLs stack and 30 + 30 minutes of staleness reach a visitor.

/** End of the fast window: 2026-08-28 00:00 Copenhagen (CEST = UTC+2). */
const FAST_UNTIL_MS = Date.parse("2026-08-27T22:00:00Z");

/** Are we still in the event window? */
export function inFastWindow(now: number = Date.now()): boolean {
  return now < FAST_UNTIL_MS;
}

const FAST_TTL_MS = 10 * 60_000; // 10 min in memory, against a 30 min CDN window
const CALM_TTL_MS = 60 * 60_000; // 1 hour, the old default
const CALM_DAILY_TTL_MS = 24 * 60 * 60_000; // the team list's own cadence

// Fresh for 30 min, then servable stale for another hour while it refetches. The stale
// window is short ON PURPOSE during the event: the calm setting below allows a full day of
// staleness on a feed nobody has requested, which is the right trade in February and the
// wrong one the morning of the 26th. The warmer workflow keeps a visitor from ever landing
// on the stale side, and if the warmer breaks, the worst case is one visitor waiting a
// couple of seconds on Airtable instead of seeing yesterday's program.
const FAST_CACHE_CONTROL = "public, s-maxage=1800, stale-while-revalidate=3600";
const CALM_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";
const CALM_DAILY_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=86400";

/** In-memory TTL for an ordinary feed. */
export function feedTtlMs(): number {
  return inFastWindow() ? FAST_TTL_MS : CALM_TTL_MS;
}

/**
 * In-memory TTL for the once-a-day feeds (/api/team). Daily is Auri's standing rule for the
 * staff list and it comes back on the 28th; during the event a late team edit should still
 * land within the half hour like everything else.
 */
export function dailyTtlMs(): number {
  return inFastWindow() ? FAST_TTL_MS : CALM_DAILY_TTL_MS;
}

/** CDN Cache-Control for an ordinary feed. */
export function feedCacheControl(): string {
  return inFastWindow() ? FAST_CACHE_CONTROL : CALM_CACHE_CONTROL;
}

/** CDN Cache-Control for the once-a-day feeds. */
export function dailyCacheControl(): string {
  return inFastWindow() ? FAST_CACHE_CONTROL : CALM_DAILY_CACHE_CONTROL;
}

/**
 * How long techbbq.dk can lag behind an Airtable edit, in plain words. The refresh button
 * prints it, so the dashboard never promises a cadence that is no longer in force.
 * Client-safe: it reads the clock and the constant above, no env, no server state.
 */
export function cadenceLabel(): string {
  return inFastWindow() ? "within 30 minutes" : "within the hour";
}
