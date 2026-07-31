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

// Feed cache headers. The marketing lists barely change, so the CDN serves repeat hits
// and revalidates in the background rather than making a visitor wait on Airtable.
export const FEED_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";
export const DAILY_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=86400";

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
