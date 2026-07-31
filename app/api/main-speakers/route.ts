import { NextRequest, NextResponse } from "next/server";
import { fetchMainPageSpeakers } from "@/lib/mainpage";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";
// Headroom for the Airtable fetch's 10s timeout + one retry (see lib/mainpage.ts).
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const speakers = await cached("main-speakers", fetchMainPageSpeakers);
    const res = NextResponse.json(
      { count: speakers.length, speakers },
      { status: 200 }
    );
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/main-speakers]", err);
    return errorResponse(err, "Something went wrong loading main-page speakers.");
  }
}
