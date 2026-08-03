import { NextRequest, NextResponse } from "next/server";
import { fetchLifeScience, PUBLISHED_STAGES } from "@/lib/lifescience";
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
    const all = await cached("lifescience:all", () => fetchLifeScience());

    // ?stage=<exact Airtable option> narrows the list to one stage, so techbbq.dk can embed
    // just the Deep Tech Event Day speakers on that event's own page. Filtered AFTER the
    // cache, exactly like /api/partner-events?kind=, so every variant shares one Airtable
    // fetch instead of each warming its own entry.
    //
    // An unknown value is IGNORED and serves everyone, matching ?kind=. The alternative,
    // returning an empty list, turns one typo in a WordPress snippet into a speaker grid
    // that silently shows nobody — a page that quietly went blank is worse than one showing
    // more than intended, and both are visible to whoever pasted it.
    const stage = req.nextUrl.searchParams.get("stage");
    const people =
      stage && PUBLISHED_STAGES.includes(stage) ? all.filter((p) => p.tag === stage) : all;

    const res = NextResponse.json({ count: people.length, people }, { status: 200 });
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/life-science]", err);
    return errorResponse(err, "Something went wrong loading Life Science speakers.");
  }
}
