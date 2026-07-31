import { NextRequest, NextResponse } from "next/server";
import { fetchEventRoomPresenters } from "@/lib/eventrooms";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const people = await cached("eventrooms", fetchEventRoomPresenters);
    const res = NextResponse.json({ count: people.length, people }, { status: 200 });
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/event-room-presenters]", err);
    return errorResponse(err, "Something went wrong loading event room presenters.");
  }
}
