import { NextRequest, NextResponse } from "next/server";
import { fetchHubSpeakers } from "@/lib/hub";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";
// Headroom for the hierarchy fetch's 10s timeout + one retry (see lib/hierarchy.ts).
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const speakers = await cached("speakers-2026", fetchHubSpeakers);
    const res = NextResponse.json(
      { count: speakers.length, speakers },
      { status: 200 }
    );
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/speakers-2026]", err);
    return errorResponse(err, "Something went wrong loading 2026 speakers.");
  }
}
