import { NextRequest } from "next/server";
import { fetchPartnerEvents } from "@/lib/partnerevents";
import { fetchEventPageDetails } from "@/lib/eventPages";
import { artworkOverride, titleKey } from "@/lib/eventArtwork";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// ?kind=side-event | event-room narrows the list; anything else is ignored and serves
// all. Filtering happens after the cache so both variants share one Airtable fetch.
const KINDS = new Set(["side-event", "event-room"]);

const KEY = "partnerevents";

// The og:image / venue lookup reaches out to each partner's Luma or Eventbrite page, so it gets
// its own SIX HOUR cache rather than this feed's one-minute cadence: a poster does not change,
// and a near-live feed hitting third-party sites every minute is rude. Same key and TTL as
// /api/program uses for the identical lookup, so the two share one warm entry.
const PAGE_KEY = "luma:side-events";
const PAGE_TTL_MS = 6 * 60 * 60_000;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    // KEY is passed so the per-feed cadence overrides in lib/cachePolicy.ts apply — this feed is
    // in NEAR_LIVE_FEEDS. Without it the call gets the default and the override does nothing,
    // silently.
    const all = await cached(KEY, fetchPartnerEvents, feedTtlMs(KEY));

    // Artwork is a NICE-TO-HAVE: a failure here must not take the feed down with it, so the
    // whole thing is wrapped and an empty map is a perfectly good answer — the cards fall back
    // to the company logo, which is what they showed before this existed.
    let withArt = all;
    try {
      if (gate.fresh) invalidate(PAGE_KEY);
      const pages = await cached(
        PAGE_KEY,
        () => fetchEventPageDetails(all.map((e) => e.registerUrl)),
        PAGE_TTL_MS
      );
      withArt = all.map((e) => {
        const d = e.registerUrl ? pages.get(e.registerUrl) : undefined;
        // THE PARTNER'S OWN ARTWORK WINS. The hand-drawn banner is a stand-in for the three side
        // events that publish none, and it carries whatever date and venue were true the day it
        // was drawn — so the moment a partner publishes a real og:image, theirs takes over. Same
        // `??` order Program 2026 uses, from the same module, so the two cannot disagree.
        const image = d?.image ?? artworkOverride(titleKey(e.title));
        return { ...e, image: image ?? null, venue: d?.venue ?? null, city: d?.city ?? null };
      });
    } catch (err) {
      // Even with the scrape down, the hand-drawn banners are local and still resolvable, so
      // fall back to those rather than all the way to logos.
      console.error("[/api/partner-events] artwork lookup failed, using local banners only", err);
      withArt = all.map((e) => ({ ...e, image: artworkOverride(titleKey(e.title)) }));
    }

    const kind = req.nextUrl.searchParams.get("kind");
    const events = kind && KINDS.has(kind) ? withArt.filter((e) => e.kind === kind) : withArt;
    return feedResponse({ count: events.length, events }, gate, { key: KEY });
  } catch (err) {
    console.error("[/api/partner-events]", err);
    return errorResponse(err, "Something went wrong loading partner events.", gate);
  }
}
