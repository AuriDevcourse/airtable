import { NextRequest, NextResponse } from "next/server";
import { fetchHubSpeakers, HubSpeaker } from "@/lib/hub";
import { fetchNiss, NissPerson } from "@/lib/niss";
import { fetchNass, NassPerson } from "@/lib/nass";
import { fetchEventRoomPresenters, EventRoomPresenter } from "@/lib/eventrooms";
import { fetchInvestors, InvestorSpeaker } from "@/lib/investors";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, feedGate, feedResponse, withCors } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

// Combined feed for the tabbed "All Speakers 2026" embed: one fetch returns all three
// groups so the embed's tab switcher works without extra round-trips.
//   speakers  = the Speaker Hub grid (same as /api/speakers-2026)
//   eventRoom = NISS 2026 + NASS 2026 merged (Team Members excluded), tagged per event
//   investors = Pension & Insurance Summit + LP Forum + Investor Day, tagged per event
// Cache keys are shared with the individual routes, so this route serves from the same
// server cache the standalone feeds fill (and vice versa).

export const dynamic = "force-dynamic";
// The hub + wide Marketing-table scans each carry their own timeout + retry.
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

type Tagged<T> = T & { tag?: string };

// Display names for the investor event tags — same short labels the /investors page
// uses, not the long Airtable select strings.
const INVESTOR_TAGS: Record<string, string> = {
  "pension-summit": "Pension & Insurance Summit",
  "lp-forum": "LP Forum",
  "investor-day": "Investor Day",
};

// The five entries this feed is assembled from. Shared with the standalone routes, which is
// why a live-read here has to drop all five: this route owns no key of its own, so
// invalidating "all-speakers" would clear nothing and the refresh would return the same
// list it just showed.
const SOURCE_KEYS = ["speakers-2026", "niss:all", "nass:all", "eventrooms", "investors:all"];

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "all-speakers");
  if (!gate.ok) return gate.res;

  if (gate.fresh) for (const key of SOURCE_KEYS) invalidate(key);

  const ttl = feedTtlMs();

  // One failed source shouldn't blank the whole embed: each group degrades to [] on its
  // own (cached() already serves last-good first), and only all-dead is an error.
  const [hubR, nissR, nassR, roomsR, invR] = await Promise.allSettled([
    cached("speakers-2026", fetchHubSpeakers, ttl),
    cached("niss:all", () => fetchNiss(), ttl),
    cached("nass:all", () => fetchNass(), ttl),
    cached("eventrooms", fetchEventRoomPresenters, ttl),
    cached("investors:all", () => fetchInvestors(), ttl),
  ]);

  const val = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);
  for (const [name, r] of [
    ["hub", hubR],
    ["niss", nissR],
    ["nass", nassR],
    ["eventrooms", roomsR],
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
  const eventRoom: Tagged<NissPerson | NassPerson | EventRoomPresenter>[] = [
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
  ].sort((a, b) => a.name.localeCompare(b.name));
  // Same for an investor speaking at two of the three events (Yoram Wijngaarde, LP Forum and the
  // Pension & Insurance Summit): one card, both events named.
  const investors: Tagged<InvestorSpeaker>[] = val(invR).map((p) => ({
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
