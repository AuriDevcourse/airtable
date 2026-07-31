import { NextRequest, NextResponse } from "next/server";
import { fetchLifeScience } from "@/lib/lifescience";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    // listKey is "people" to match the shared embed snippet + NISS feeds.
    const people = await cached("lifescience:all", () => fetchLifeScience());
    const res = NextResponse.json({ count: people.length, people }, { status: 200 });
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/life-science]", err);
    return errorResponse(err, "Something went wrong loading Life Science speakers.");
  }
}
