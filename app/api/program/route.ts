import { NextRequest, NextResponse } from "next/server";
import { fetchProgram, PROGRAM_SOURCES, ProgramSourceKey } from "@/lib/program";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Optional ?event=techbbq|niss — validated against the known sources.
  const eventParam = req.nextUrl.searchParams.get("event");
  const source: ProgramSourceKey =
    eventParam && eventParam in PROGRAM_SOURCES ? (eventParam as ProgramSourceKey) : "techbbq";

  try {
    const sessions = await cached(`program:${source}`, () => fetchProgram(source));
    const res = NextResponse.json(
      { count: sessions.length, event: source, sessions },
      { status: 200 }
    );
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/program]", err);
    return errorResponse(err, "Something went wrong loading the program.");
  }
}
