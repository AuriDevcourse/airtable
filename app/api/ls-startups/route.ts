import { NextRequest } from "next/server";
import { fetchLsStartups, LS_CATEGORIES } from "@/lib/lsstartups";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const CATEGORIES: readonly string[] = LS_CATEGORIES;

const KEY = "ls-startups";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    // listKey is "startups". The gate (Confirmation = Selected) lives in the lib, so an
    // unconfirmed applicant cannot be reached from this route under any query string.
    const all = await cached(KEY, fetchLsStartups, feedTtlMs());

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

    return feedResponse({ count: startups.length, startups }, gate);
  } catch (err) {
    console.error("[/api/ls-startups]", err);
    return errorResponse(err, "Something went wrong loading Life Science startups.", gate);
  }
}
