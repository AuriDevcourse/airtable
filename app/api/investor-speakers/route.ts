import { NextRequest, NextResponse } from "next/server";
import { fetchInvestors, INVESTOR_EVENTS, InvestorEventKey } from "@/lib/investors";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";
// The filterByFormula scan of the wide Marketing table can be slow + retries once.
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Optional ?event=pension-summit | lp-forum. Validated against the known keys.
  const eventParam = req.nextUrl.searchParams.get("event");
  const event =
    eventParam && eventParam in INVESTOR_EVENTS ? (eventParam as InvestorEventKey) : undefined;

  try {
    const people = await cached(`investors:${event || "all"}`, () => fetchInvestors(event));
    const res = NextResponse.json(
      { count: people.length, event: event || "all", people },
      { status: 200 }
    );
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/investor-speakers]", err);
    return errorResponse(err, "Something went wrong loading investor speakers.");
  }
}
