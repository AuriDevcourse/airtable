import { NextRequest, NextResponse } from "next/server";
import { fetchLsStartups, LS_CATEGORIES } from "@/lib/lsstartups";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const CATEGORIES: readonly string[] = LS_CATEGORIES;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    // listKey is "startups". The gate (Confirmation = Selected) lives in the lib, so an
    // unconfirmed applicant cannot be reached from this route under any query string.
    const all = await cached("ls-startups", fetchLsStartups);

    // ?category=Human Health | Planetary Health | Deep Tech narrows the list, so a page can
    // embed one category on its own. Filtered after the cache, like the other feeds, so all
    // four variants share one Airtable fetch. LS Type is a multi-select, so a startup in two
    // categories is returned by both. An unknown value serves everyone, matching ?kind= and
    // ?stage= elsewhere: an empty grid from one typo is worse than showing more.
    const category = req.nextUrl.searchParams.get("category");
    const startups =
      category && CATEGORIES.includes(category)
        ? all.filter((s) => s.categories.includes(category))
        : all;

    const res = NextResponse.json({ count: startups.length, startups }, { status: 200 });
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/ls-startups]", err);
    return errorResponse(err, "Something went wrong loading Life Science startups.");
  }
}
