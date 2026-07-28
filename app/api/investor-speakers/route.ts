import { NextRequest, NextResponse } from "next/server";
import { fetchInvestors, InvestorsError, INVESTOR_EVENTS, InvestorEventKey } from "@/lib/investors";
import { rateLimit, cached } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// The filterByFormula scan of the wide Marketing table can be slow + retries once.
export const maxDuration = 30;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function withCors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.headers.set("Vary", "Origin");
  return res;
}

export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return withCors(res);
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const limit = rateLimit(ip);
  if (!limit.ok) {
    const res = NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    res.headers.set("Retry-After", String(limit.retryAfter));
    return withCors(res);
  }

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
    res.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return withCors(res);
  } catch (err) {
    const status = err instanceof InvestorsError ? err.status : 500;
    const message =
      err instanceof InvestorsError ? err.message : "Something went wrong loading investor speakers.";
    console.error("[/api/investor-speakers]", err);
    return withCors(NextResponse.json({ error: message }, { status }));
  }
}
