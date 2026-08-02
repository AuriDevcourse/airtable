import { NextRequest, NextResponse } from "next/server";
import { fetchProgram, PROGRAM_SOURCES, ProgramSourceKey } from "@/lib/program";
import { rateLimit, cached, invalidate } from "@/lib/rate-limit";
import { isDashboardRequest } from "@/lib/dashboardAuth";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// ?fresh= skips the hour-long cache and reads Airtable live. It exists for the dashboard's
// "Refresh from Airtable" button, which has to work on the DEPLOYED site: up there the CDN
// is what serves a visitor, so dropping one serverless instance's in-memory cache would
// change nothing. Only a URL the CDN has never seen reaches the function at all, which is
// why the button sends a different `fresh` value on every press.
//
// It must stay authenticated. /api/program itself is public because the Elementor embeds
// fetch it cross-origin, but an open bypass would be an unauthenticated route that hits a
// third-party API on every call — SECURITY r5, and the exact shape of Auri's most common
// vulnerability. The dashboard already sits behind Basic auth and the browser attaches those
// credentials to same-origin fetches, so no new secret has to live in the page.
const FRESH_MAX_PER_WINDOW = 10; // per IP per minute, against 60 for ordinary cached reads

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const fresh = req.nextUrl.searchParams.get("fresh");

  const limit = fresh
    ? rateLimit(ip, { bucket: "program-fresh:", max: FRESH_MAX_PER_WINDOW })
    : rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Optional ?event=techbbq|niss — validated against the known sources.
  const eventParam = req.nextUrl.searchParams.get("event");
  const source: ProgramSourceKey =
    eventParam && eventParam in PROGRAM_SOURCES ? (eventParam as ProgramSourceKey) : "techbbq";

  if (fresh && !isDashboardRequest(req.headers.get("authorization"))) {
    // Deliberately 401 rather than quietly serving the cached copy: a bypass that silently
    // does nothing is worse than one that says no. No CORS headers here — this is a
    // same-origin dashboard action, not a feed for techbbq.dk.
    const res = NextResponse.json({ error: "Not authorized." }, { status: 401 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  try {
    // Drop this instance's entry first, so the read below really goes to Airtable AND the
    // refreshed value is what ordinary cached reads on this instance serve next.
    if (fresh) invalidate(`program:${source}`);

    const sessions = await cached(`program:${source}`, () => fetchProgram(source));
    const res = NextResponse.json(
      { count: sessions.length, event: source, sessions },
      { status: 200 }
    );

    if (fresh) {
      // Never let the CDN store an authenticated response, and never let it answer the next
      // press from a copy of this one.
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/program]", err);
    return errorResponse(err, "Something went wrong loading the program.");
  }
}
