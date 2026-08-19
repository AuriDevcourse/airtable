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
        // THE HAND-DRAWN BANNER WINS, and only for the handful of titles listed in
        // ARTWORK_OVERRIDES. An entry there is a deliberate choice to show TechBBQ's own banner,
        // so a partner page that later publishes an og:image does not silently replace it —
        // delete the entry when their artwork should take over. This is the `??` order
        // lib/sideEvents.ts already used for Program 2026; this line read the other way round
        // and the two pages printed different artwork for "Unlocking Nordic Private Markets",
        // whose Eventbrite listing gained an og:image after the banner was drawn (2026-08-19).
        const image = artworkOverride(titleKey(e.title)) ?? d?.image;
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
