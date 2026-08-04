import { NextRequest } from "next/server";
import { fetchPartners, PARTNER_TIERS } from "@/lib/partners";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const TIERS: readonly string[] = PARTNER_TIERS.map((t) => t.name);

const KEY = "partners";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    const all = await cached(KEY, fetchPartners, feedTtlMs());

    // ?tier=Prime|Main|… narrows to one tier, so a page can embed a single band. Filtered
    // after the cache, like every other feed, so all variants share one Airtable fetch.
    // An unknown value serves everyone, matching ?kind=, ?stage=, ?section= and ?category=.
    const tier = req.nextUrl.searchParams.get("tier");
    const partners = tier && TIERS.includes(tier) ? all.filter((p) => p.tier === tier) : all;

    return feedResponse({ count: partners.length, tiers: PARTNER_TIERS, partners }, gate);
  } catch (err) {
    console.error("[/api/partners]", err);
    return errorResponse(err, "Something went wrong loading partners.");
  }
}
