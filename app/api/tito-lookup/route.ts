import { NextRequest, NextResponse } from "next/server";
import { lookupTito, TitoError, MIN_QUERY_LENGTH } from "@/lib/tito";
import { rateLimit } from "@/lib/rate-limit";

// Attendee lookup for support ("does this person have a ticket, can it be changed").
//
// UNLIKE every other route in this repo, this one is intentionally NOT public:
//   - it is absent from PUBLIC_PATHS in middleware.ts, so the dashboard password applies,
//   - no CORS headers, so no site can fetch it from a browser,
//   - no-store, so nothing lands in a CDN or a browser cache.
// Tito rows contain attendee email addresses. Keep it that way.

export const dynamic = "force-dynamic";
// Every event in TITO_EVENTS is searched in parallel, each with its own 12s budget, so the wall
// clock is one search rather than the sum. Deliberately not a count: this said "Four" while the
// list held four and stayed wrong when the fifth was added.
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const limit = rateLimit(ip);
  if (!limit.ok) {
    const res = NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    res.headers.set("Retry-After", String(limit.retryAfter));
    return res;
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Search for at least ${MIN_QUERY_LENGTH} characters.` },
      { status: 400 }
    );
  }
  // Long enough to hold a full email plus a name, short enough that nobody is posting a
  // payload through the search box.
  if (q.length > 120) {
    return NextResponse.json({ error: "Search term is too long." }, { status: 413 });
  }

  try {
    const result = await lookupTito(q);
    const res = NextResponse.json(
      {
        count: result.matches.length,
        matches: result.matches,
        failedEvents: result.failedEvents,
        truncatedEvents: result.truncatedEvents,
      },
      { status: 200 }
    );
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    const status = err instanceof TitoError ? err.status : 500;
    const message =
      err instanceof TitoError ? err.message : "Something went wrong searching Tito.";
    // No query, no attendee data in the log — just the shape of the failure.
    console.error("[/api/tito-lookup] failed with status", status);
    const res = NextResponse.json({ error: message }, { status });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
