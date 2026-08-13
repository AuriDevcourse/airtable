import { NextRequest, NextResponse } from "next/server";
import { fetchHubSpeakers, HubSpeaker } from "@/lib/hub";
import { fetchNiss, NissPerson } from "@/lib/niss";
import { fetchNass, NassPerson } from "@/lib/nass";
import { fetchEventRoomPresenters, EventRoomPresenter } from "@/lib/eventrooms";
import { fetchFintechSpeakers, FintechSpeaker } from "@/lib/fintechspeakers";
import { fetchInvestors, InvestorSpeaker } from "@/lib/investors";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, feedGate, feedResponse, withCors } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

// Combined feed for the tabbed "All Speakers 2026" embed: one fetch returns all three
// groups so the embed's tab switcher works without extra round-trips.
//   speakers  = the Speaker Hub grid (same as /api/speakers-2026)
//   eventRoom = NISS 2026 + NASS 2026 + Future of Fintech + the partner presenters, tagged per room
//   investors = Pension & Insurance Summit + LP Forum + Investor Day + Nordic Family Office
//               Summit, tagged per event
// Cache keys are shared with the individual routes, so this route serves from the same
// server cache the standalone feeds fill (and vice versa).

export const dynamic = "force-dynamic";
// The hub + wide Marketing-table scans each carry their own timeout + retry.
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

type Tagged<T> = T & { tag?: string };

// Display names for the investor event tags — same short labels the /investors page
// uses, not the long Airtable select strings.
// Where the Future of Fintech session runs. Auri corrected this from Event Room 3 on 2026-08-05, and
// it matches what the CRM now says. One constant rather than a literal in the map below, because the
// number is a fact about the event that has already moved once.
const FINTECH_ROOM = "Event Room 1";

const INVESTOR_TAGS: Record<string, string> = {
  "pension-summit": "Pension & Insurance Summit",
  "lp-forum": "LP Forum",
  "investor-day": "Investor Day",
  // Short on purpose: this string is the card's TAG LINE, and "Nordic Family Office Summit"
  // wraps to two lines there, making those cards taller than the rest of the grid — on this
  // dashboard and inside every pasted embed. The full name stays on the /investors tab and nav.
  "family-office": "Family Office Summit",
};

// The five entries this feed is assembled from. Shared with the standalone routes, which is
// why a live-read here has to drop all five: this route owns no key of its own, so
// invalidating "all-speakers" would clear nothing and the refresh would return the same
// list it just showed.
const SOURCE_KEYS = [
  "speakers-2026",
  "niss:all",
  "nass:all",
  "eventrooms",
  "fintech-speakers",
  "investors:all",
];

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "all-speakers");
  if (!gate.ok) return gate.res;

  if (gate.fresh) for (const key of SOURCE_KEYS) invalidate(key);

  const ttl = feedTtlMs();

  // One failed source shouldn't blank the whole embed: each group degrades to [] on its
  // own (cached() already serves last-good first), and only all-dead is an error.
  const [hubR, nissR, nassR, roomsR, fintechR, invR] = await Promise.allSettled([
    cached("speakers-2026", fetchHubSpeakers, ttl),
    cached("niss:all", () => fetchNiss(), ttl),
    cached("nass:all", () => fetchNass(), ttl),
    cached("eventrooms", fetchEventRoomPresenters, ttl),
    // Same cache key the standalone /api/fintech-speakers fills, so this costs no extra
    // Airtable read. All three roles come back; the route below keeps them all, unlike the
    // standalone feed which defaults to Speaker for the sake of what is already pasted.
    cached("fintech-speakers", fetchFintechSpeakers, ttl),
    // `true` matches what /api/investor-speakers stores under this SHARED key: the list including
    // the rows with no photo. It has to match, or whichever route fills the cache first decides
    // what the other one serves. This route is public — it is what the pasted embed fetches — so
    // the photoless rows are filtered out below, never here.
    cached("investors:all", () => fetchInvestors(undefined, true), ttl),
  ]);

  const val = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);
  for (const [name, r] of [
    ["hub", hubR],
    ["niss", nissR],
    ["nass", nassR],
    ["eventrooms", roomsR],
    ["fintech", fintechR],
    ["investors", invR],
  ] as const) {
    if (r.status === "rejected") console.error("[/api/all-speakers] source failed:", name, r.reason);
  }

  const speakers: Tagged<HubSpeaker>[] = val(hubR);
  // Only actual speakers (Auri's rule): the NISS/NASS feeds also carry Moderators,
  // Team Members, Brand Ambassadors and blank-role rows — none of those are event room
  // speakers. Tags are the ROOM: per the planning sheet NISS (India, day 1) and NASS
  // (Afrika, day 2) both run in Event Room 2; partner presenters get their assigned
  // room or the hosting partner's name until it's known. Same merge lives on the
  // /all-speakers-2026 page. The order here is stable alphabetical — the embed and the
  // page shuffle client-side per load (a server-side shuffle would freeze in the 1h
  // cache).
  const eventRoom: Tagged<NissPerson | NassPerson | EventRoomPresenter | FintechSpeaker>[] = [
    ...val(nissR)
      .filter((p) => p.role === "Speaker")
      .map((p) => ({ ...p, tag: "Event Room 2" })),
    ...val(nassR)
      .filter((p) => p.role === "Speaker")
      .map((p) => ({ ...p, tag: "Event Room 2" })),
    // The tag is where a presenter booked by two partners shows BOTH: the feeds merge them into
    // one person (lib/eventrooms.ts), and this is the line that says where they speak. Rooms are
    // preferred over hosts, since a room number is what a visitor navigates by, but a presenter
    // with only one room assigned of two falls back to naming the partners.
    ...val(roomsR).map((p) => ({
      ...p,
      tag: p.rooms.length === p.hosts.length ? p.rooms.join(" · ") : p.hosts.join(" · "),
    })),
    // FUTURE OF FINTECH, which is an event room session like any other: Flatpay hosts it in
    // Event Room 1 on 27 August (their Partnership Success row says so). It was missing from this
    // tab entirely — 13 of its 15 people appeared nowhere on the page (Auri, 2026-08-05) — because
    // its speakers submit through their own form and never reach the partner presenter table.
    //
    // All three roles are kept here, moderators and the keynote included. This tab is a roster of
    // who is in the room, and dropping the moderators from it is how they went missing in the
    // first place.
    ...val(fintechR).map((p) => ({ ...p, tag: FINTECH_ROOM })),
  ]
    .sort((a, b) => a.name.localeCompare(b.name))
    // ONE PERSON, ONE CARD, the same rule as the investor roster and the presenter merge. Sander
    // Janca-Jensen arrives twice — once as Flatpay's presenter, once as the fintech keynote — and
    // two photos of one man in one tab is the bug that rule exists to prevent. The first row wins
    // the identity (alphabetical, so it is stable) and the tags are unioned, so nothing about
    // where he speaks is lost.
    .reduce<Tagged<NissPerson | NassPerson | EventRoomPresenter | FintechSpeaker>[]>((out, p) => {
      const key = p.name.toLowerCase().replace(/\s+/g, " ").trim();
      const prev = out.find((x) => x.name.toLowerCase().replace(/\s+/g, " ").trim() === key);
      if (!prev) return [...out, p];
      const tags = [...new Set([...(prev.tag ?? "").split(" · "), ...(p.tag ?? "").split(" · ")])]
        .filter(Boolean)
        .join(" · ");
      prev.tag = tags;
      return out;
    }, []);
  // Same for an investor speaking at more than one of the events (Yoram Wijngaarde, LP Forum and the
  // Pension & Insurance Summit): one card, both events named.
  // THE PHOTOLESS ROWS ARE DROPPED HERE, unconditionally. This feed has no ?pending= of its own:
  // it is the one the "All Speakers 2026" embed on techbbq.dk fetches, and a card with no face is
  // not something to publish. /investors is where those people are shown and chased.
  const investors: Tagged<InvestorSpeaker>[] = val(invR)
    .filter((p) => !p.pending)
    .map((p) => ({
      ...p,
      tag: p.events.map((e) => INVESTOR_TAGS[e] ?? e).join(" · ") || p.event,
    }));

  if ([hubR, nissR, nassR, roomsR, invR].every((r) => r.status === "rejected")) {
    return withCors(
      NextResponse.json({ error: "Could not reach any speaker source." }, { status: 502 }),
      gate.origin
    );
  }

  return feedResponse(
    {
      counts: { speakers: speakers.length, eventRoom: eventRoom.length, investors: investors.length },
      groups: { speakers, eventRoom, investors },
    },
    gate
  );
}
