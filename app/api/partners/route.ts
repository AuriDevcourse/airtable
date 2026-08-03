import { NextRequest, NextResponse } from "next/server";
import { fetchPartners, PARTNER_TIERS } from "@/lib/partners";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const TIERS: readonly string[] = PARTNER_TIERS.map((t) => t.name);

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const all = await cached("partners", fetchPartners);

    // ?tier=Prime|Main|… narrows to one tier, so a page can embed a single band. Filtered
    // after the cache, like every other feed, so all variants share one Airtable fetch.
    // An unknown value serves everyone, matching ?kind=, ?stage=, ?section= and ?category=.
    const tier = req.nextUrl.searchParams.get("tier");
    const partners = tier && TIERS.includes(tier) ? all.filter((p) => p.tier === tier) : all;

    const res = NextResponse.json(
      { count: partners.length, tiers: PARTNER_TIERS, partners },
      { status: 200 }
    );
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/partners]", err);
    return errorResponse(err, "Something went wrong loading partners.");
  }
}
