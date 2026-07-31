import { NextRequest, NextResponse } from "next/server";
import { fetchSpeakers } from "@/lib/airtable";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const speakers = await cached("speakers", fetchSpeakers);
    const res = NextResponse.json(
      { count: speakers.length, speakers },
      { status: 200 }
    );
    // Let Vercel's CDN serve repeat hits without re-running the function.
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/speakers]", err);
    return errorResponse(err, "Something went wrong loading speakers.");
  }
}
