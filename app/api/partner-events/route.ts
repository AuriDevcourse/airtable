import { NextRequest } from "next/server";
import { fetchPartnerEvents } from "@/lib/partnerevents";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// ?kind=side-event | event-room narrows the list; anything else is ignored and serves
// all. Filtering happens after the cache so both variants share one Airtable fetch.
const KINDS = new Set(["side-event", "event-room"]);

const KEY = "partnerevents";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    // KEY is passed so the per-feed cadence overrides in lib/cachePolicy.ts apply — this feed is
    // in NEAR_LIVE_FEEDS. Without it the call gets the default and the override does nothing,
    // silently.
    const all = await cached(KEY, fetchPartnerEvents, feedTtlMs(KEY));
    const kind = req.nextUrl.searchParams.get("kind");
    const events = kind && KINDS.has(kind) ? all.filter((e) => e.kind === kind) : all;
    return feedResponse({ count: events.length, events }, gate, { key: KEY });
  } catch (err) {
    console.error("[/api/partner-events]", err);
    return errorResponse(err, "Something went wrong loading partner events.", gate);
  }
}
