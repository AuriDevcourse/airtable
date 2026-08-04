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

// Which site may fetch these feeds. Set to the WordPress origin in prod; "*" only as a
// local-dev fallback.
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

export function withCors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.headers.set("Vary", "Origin");
  return res;
}

/** The shared OPTIONS preflight. Re-export from a route as `export const OPTIONS = corsPreflight`. */
export function corsPreflight(): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return withCors(res);
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
export function tooManyRequests(retryAfter: number): NextResponse {
  const res = NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429 }
  );
  res.headers.set("Retry-After", String(retryAfter));
  return withCors(res);
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

export type FeedGate =
  | { ok: false; res: NextResponse } // rate limited or not authorized — return this as-is
  | { ok: true; fresh: boolean };

/**
 * Rate-limit the request and decide whether it is an authenticated live-read.
 *
 * `bucket` namespaces the bypass counter per feed, so hammering the refresh button on one
 * page cannot use up another page's allowance.
 */
export function feedGate(req: NextRequest, bucket: string): FeedGate {
  const ip = clientIp(req);
  const fresh = req.nextUrl.searchParams.get("fresh");

  const limit = fresh
    ? rateLimit(ip, { bucket: `${bucket}-fresh:`, max: FRESH_MAX_PER_WINDOW })
    : rateLimit(ip);
  if (!limit.ok) return { ok: false, res: tooManyRequests(limit.retryAfter) };

  if (fresh && !isDashboardRequest(req.headers.get("authorization"))) {
    // Deliberately 401 rather than quietly serving the cached copy: a bypass that silently
    // does nothing is worse than one that says no. No CORS headers — this is a same-origin
    // dashboard action, not a feed for techbbq.dk.
    const res = NextResponse.json({ error: "Not authorized." }, { status: 401 });
    res.headers.set("Cache-Control", "no-store");
    return { ok: false, res };
  }

  return { ok: true, fresh: Boolean(fresh) };
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
  gate: { fresh: boolean },
  opts?: { daily?: boolean }
): NextResponse {
  const res = NextResponse.json(body, { status: 200 });
  if (gate.fresh) {
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  res.headers.set("Cache-Control", opts?.daily ? dailyCacheControl() : feedCacheControl());
  return withCors(res);
}

/**
 * Map a thrown error to a response. The feed libs each define their own Error subclass
 * carrying a `status`; anything else is an unexpected bug and becomes a generic 500 so no
 * internal detail reaches the browser (the full error is logged by the caller).
 */
export function errorResponse(err: unknown, fallbackMessage: string): NextResponse {
  const carried = err instanceof Error ? (err as Error & { status?: unknown }).status : undefined;
  const status = typeof carried === "number" ? carried : 500;
  // Only a lib's own deliberate message is echoed. An unexpected 500 gets the generic
  // fallback so a stack-trace message can never reach the browser.
  const message = err instanceof Error && status !== 500 ? err.message : fallbackMessage;
  return withCors(NextResponse.json({ error: message }, { status }));
}
