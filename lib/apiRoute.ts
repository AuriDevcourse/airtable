// Shared plumbing for the public feed routes.
//
// All 13 feed routes repeated the same three blocks verbatim: the ALLOWED_ORIGIN + CORS
// header setter, the OPTIONS preflight handler, and the x-forwarded-for IP dance for the
// rate limiter. Copies drift — one route was already spelling the CORS setup slightly
// differently — so they live here once.
//
// Note the deliberate absentee: /api/tito-lookup does NOT use any of this. That route
// returns attendee PII, is gated by the dashboard password, and must never grow CORS
// headers. Keep it that way.

import { NextRequest, NextResponse } from "next/server";
import { isDashboardRequest } from "@/lib/dashboardAuth";
import { dailyCacheControl, feedCacheControl } from "@/lib/cachePolicy";
import { rateLimit } from "@/lib/rate-limit";

// Which sites may fetch these feeds. COMMA-SEPARATED, because the wall now has to work on two
// hosts at once: techbbq.dk and the new site at staging.techbbq.dk. It used to be a single value,
// so the staging page's fetch was refused and the wall rendered "Could not load the partners"
// while the logos (which are <img> and need no CORS) loaded fine — a confusing half-working page.
//
//   ALLOWED_ORIGIN=https://techbbq.dk,https://staging.techbbq.dk
//
// "*" is still honoured, for local dev and as the fallback when the variable is unset.
const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Kept for lib/apiSnippet.ts, which documents the policy in the generated snippet. The FIRST
// entry is the canonical site.
export const ALLOWED_ORIGIN = ALLOWED_ORIGINS[0] ?? "*";

/**
 * The value to send back for a given request Origin.
 *
 * Echoes the caller's origin ONLY on an exact match against the list. That distinction is the
 * whole security of this function: reflecting an unmatched Origin would allow every site on the
 * internet while looking like an allow-list. An unmatched caller gets the canonical origin
 * instead, which its browser then refuses — a refusal, not a silent allow.
 */
function originHeader(requestOrigin?: string | null): string {
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  const o = (requestOrigin || "").trim().replace(/\/+$/, "");
  return o && ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGIN;
}

/**
 * Tag a response for cross-origin reads.
 *
 * `requestOrigin` comes from the caller's Origin header. Omitting it falls back to the canonical
 * site, which is exactly the old single-origin behaviour — so a call site that has no request to
 * hand still behaves as it always did rather than failing open.
 *
 * `Vary: Origin` is not optional once there is more than one allowed value: without it a CDN
 * would cache the header it computed for techbbq.dk and hand it to staging, or the reverse.
 */
export function withCors(res: NextResponse, requestOrigin?: string | null): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", originHeader(requestOrigin));
  res.headers.set("Vary", "Origin");
  return res;
}

/** The shared OPTIONS preflight. Re-export from a route as `export const OPTIONS = corsPreflight`. */
// `req` is REQUIRED, not optional. Next.js always passes the request to a route handler, and
// typing it as optional makes the generated route types reject the export outright.
export function corsPreflight(req: NextRequest): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return withCors(res, req.headers.get("origin"));
}

/** Best-effort client IP for the rate limiter. Behind Vercel, x-forwarded-for is set. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** The 429 body + Retry-After, already CORS-tagged. */
export function tooManyRequests(retryAfter: number, requestOrigin?: string | null): NextResponse {
  const res = NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429 }
  );
  res.headers.set("Retry-After", String(retryAfter));
  return withCors(res, requestOrigin);
}

// Feed cache headers now come from lib/cachePolicy.ts, which shortens every cadence to
// ~30 minutes until the end of August 27th and then reverts on its own. They used to be two
// constants here; a constant cannot answer "what is the cadence right now".

// ---------------------------------------------------------------------------
// The ?fresh= bypass, shared by every feed route.
//
// It started on /api/program as the dashboard's "Refresh from Airtable" button and is now
// on every page, so the check lives here once. What it has to do, and why:
//
//   * Skip BOTH caches. Dropping the server's in-memory entry alone changes nothing on the
//     deployed site, because up there the CDN is what answers a visitor. Only a URL the CDN
//     has never seen reaches the function at all, which is why the button sends a different
//     `fresh` value on every press.
//   * Stay authenticated. The feeds themselves are public because the Elementor embeds
//     fetch them cross-origin, but an open bypass would be an unauthenticated route that
//     hits Airtable on every single call — SECURITY r5, and the exact shape of the most
//     common vulnerability in this account's projects. The dashboard already sits behind
//     Basic auth and the browser attaches those credentials to same-origin fetches, so the
//     page needs no new secret.
//   * Be metered separately. A cached read is nearly free; a bypass is an Airtable scan.
// ---------------------------------------------------------------------------

const FRESH_MAX_PER_WINDOW = 10; // per IP per minute, against 60 for ordinary cached reads

// `origin` rides along on the gate because every feed route calls feedGate() first and then hands
// the gate to feedResponse()/errorResponse(). That is the one path guaranteed to have the request,
// so it is how the caller's Origin reaches the CORS header without threading `req` through
// twenty call sites.
export type FeedGate =
  | { ok: false; res: NextResponse } // rate limited or not authorized — return this as-is
  | { ok: true; fresh: boolean; origin: string | null };

/**
 * Rate-limit the request and decide whether it is an authenticated live-read.
 *
 * `bucket` namespaces the bypass counter per feed, so hammering the refresh button on one
 * page cannot use up another page's allowance.
 */
export function feedGate(req: NextRequest, bucket: string): FeedGate {
  const ip = clientIp(req);
  const origin = req.headers.get("origin");
  const fresh = req.nextUrl.searchParams.get("fresh");

  const limit = fresh
    ? rateLimit(ip, { bucket: `${bucket}-fresh:`, max: FRESH_MAX_PER_WINDOW })
    : rateLimit(ip);
  if (!limit.ok) return { ok: false, res: tooManyRequests(limit.retryAfter, origin) };

  if (fresh && !isDashboardRequest(req.headers.get("authorization"))) {
    // Deliberately 401 rather than quietly serving the cached copy: a bypass that silently
    // does nothing is worse than one that says no. No CORS headers — this is a same-origin
    // dashboard action, not a feed for techbbq.dk.
    const res = NextResponse.json({ error: "Not authorized." }, { status: 401 });
    res.headers.set("Cache-Control", "no-store");
    return { ok: false, res };
  }

  return { ok: true, fresh: Boolean(fresh), origin };
}

/**
 * The success response for a feed, with the caching rules applied.
 *
 * A live-read is never stored and never gets CORS headers: it is authenticated, so letting
 * the CDN keep a copy would mean answering the next press — or a public visitor — from it.
 * An ordinary read is cacheable and CORS-tagged for the WordPress embeds.
 */
export function feedResponse(
  body: unknown,
  gate: { fresh: boolean; origin?: string | null },
  // `key` is the feed's cache key. It exists so a feed on the hourly override (see
  // HOURLY_FEEDS in lib/cachePolicy.ts) sends the matching s-maxage — otherwise the in-memory
  // TTL and the CDN would disagree and the CDN would win, which is the one that visitors see.
  opts?: { daily?: boolean; key?: string }
): NextResponse {
  const res = NextResponse.json(body, { status: 200 });
  if (gate.fresh) {
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  res.headers.set(
    "Cache-Control",
    opts?.daily ? dailyCacheControl() : feedCacheControl(opts?.key)
  );
  return withCors(res, gate.origin);
}

/**
 * Map a thrown error to a response. The feed libs each define their own Error subclass
 * carrying a `status`; anything else is an unexpected bug and becomes a generic 500 so no
 * internal detail reaches the browser (the full error is logged by the caller).
 */
export function errorResponse(
  err: unknown,
  fallbackMessage: string,
  // Pass the gate so a failure on a NON-canonical origin still reaches the page as a readable
  // message. Without it the browser blocks the response and the embed reports a bare network
  // error, which is the least helpful thing to see on the host you are still setting up.
  gate?: { origin?: string | null }
): NextResponse {
  const carried = err instanceof Error ? (err as Error & { status?: unknown }).status : undefined;
  const status = typeof carried === "number" ? carried : 500;
  // Only a lib's own deliberate message is echoed. An unexpected 500 gets the generic
  // fallback so a stack-trace message can never reach the browser.
  const message = err instanceof Error && status !== 500 ? err.message : fallbackMessage;
  return withCors(NextResponse.json({ error: message }, { status }), gate?.origin);
}
