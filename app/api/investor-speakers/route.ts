import { NextRequest } from "next/server";
import { fetchInvestors, INVESTOR_EVENTS, InvestorEventKey } from "@/lib/investors";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";
// The filterByFormula scan of the wide Marketing table can be slow + retries once.
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "investor-speakers");
  if (!gate.ok) return gate.res;

  // Optional ?event=pension-summit | lp-forum. Validated against the known keys.
  const eventParam = req.nextUrl.searchParams.get("event");
  const event =
    eventParam && eventParam in INVESTOR_EVENTS ? (eventParam as InvestorEventKey) : undefined;

  const key = `investors:${event || "all"}`;

  try {
    if (gate.fresh) invalidate(key);

    const people = await cached(key, () => fetchInvestors(event), feedTtlMs());
    return feedResponse({ count: people.length, event: event || "all", people }, gate);
  } catch (err) {
    console.error("[/api/investor-speakers]", err);
    return errorResponse(err, "Something went wrong loading investor speakers.");
  }
}
