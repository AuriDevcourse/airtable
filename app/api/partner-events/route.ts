import { NextRequest, NextResponse } from "next/server";
import { fetchPartnerEvents } from "@/lib/partnerevents";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// ?kind=side-event | event-room narrows the list; anything else is ignored and serves
// all. Filtering happens after the cache so both variants share one Airtable fetch.
const KINDS = new Set(["side-event", "event-room"]);

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const all = await cached("partnerevents", fetchPartnerEvents);
    const kind = req.nextUrl.searchParams.get("kind");
    const events = kind && KINDS.has(kind) ? all.filter((e) => e.kind === kind) : all;
    const res = NextResponse.json({ count: events.length, events }, { status: 200 });
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/partner-events]", err);
    return errorResponse(err, "Something went wrong loading partner events.");
  }
}
