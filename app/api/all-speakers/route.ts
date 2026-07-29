import { NextRequest, NextResponse } from "next/server";
import { fetchHubSpeakers, HubSpeaker } from "@/lib/hub";
import { fetchNiss, NissPerson } from "@/lib/niss";
import { fetchNass, NassPerson } from "@/lib/nass";
import { fetchEventRoomPresenters, EventRoomPresenter } from "@/lib/eventrooms";
import { fetchInvestors, InvestorSpeaker } from "@/lib/investors";
import { rateLimit, cached } from "@/lib/rate-limit";

// Combined feed for the tabbed "All Speakers 2026" embed: one fetch returns all three
// groups so the embed's tab switcher works without extra round-trips.
//   speakers  = the Speaker Hub grid (same as /api/speakers-2026)
//   eventRoom = NISS 2026 + NASS 2026 merged (Team Members excluded), tagged per event
//   investors = Pension & Insurance Summit + LP Forum + Investor Day, tagged per event
// Cache keys are shared with the individual routes, so this route serves from the same
// 1h server cache the standalone feeds fill (and vice versa).

export const dynamic = "force-dynamic";
// The hub + wide Marketing-table scans each carry their own timeout + retry.
export const maxDuration = 30;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function withCors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.headers.set("Vary", "Origin");
  return res;
}

export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return withCors(res);
}

type Tagged<T> = T & { tag?: string };

// Display names for the investor event tags — same short labels the /investors page
// uses, not the long Airtable select strings.
const INVESTOR_TAGS: Record<string, string> = {
  "pension-summit": "Pension & Insurance Summit",
  "lp-forum": "LP Forum",
  "investor-day": "Investor Day",
};

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const limit = rateLimit(ip);
  if (!limit.ok) {
    const res = NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    res.headers.set("Retry-After", String(limit.retryAfter));
    return withCors(res);
  }

  // One failed source shouldn't blank the whole embed: each group degrades to [] on its
  // own (cached() already serves last-good first), and only all-dead is an error.
  const [hubR, nissR, nassR, roomsR, invR] = await Promise.allSettled([
    cached("speakers-2026", fetchHubSpeakers),
    cached("niss:all", () => fetchNiss()),
    cached("nass:all", () => fetchNass()),
    cached("eventrooms", fetchEventRoomPresenters),
    cached("investors:all", () => fetchInvestors()),
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
  // speakers. Partner event room presenters (Partnership Success form) are tagged with
  // the hosting partner's name. Same merge lives on the /all-speakers-2026 page.
  const eventRoom: Tagged<NissPerson | NassPerson | EventRoomPresenter>[] = [
    ...val(nissR)
      .filter((p) => p.role === "Speaker")
      .map((p) => ({ ...p, tag: "NISS 2026" })),
    ...val(nassR)
      .filter((p) => p.role === "Speaker")
      .map((p) => ({ ...p, tag: "NASS 2026" })),
    ...val(roomsR).map((p) => ({ ...p, tag: p.host })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const investors: Tagged<InvestorSpeaker>[] = val(invR).map((p) => ({
    ...p,
    tag: INVESTOR_TAGS[p.event] ?? p.event,
  }));

  if ([hubR, nissR, nassR, roomsR, invR].every((r) => r.status === "rejected")) {
    return withCors(
      NextResponse.json({ error: "Could not reach any speaker source." }, { status: 502 })
    );
  }

  const res = NextResponse.json(
    {
      counts: { speakers: speakers.length, eventRoom: eventRoom.length, investors: investors.length },
      groups: { speakers, eventRoom, investors },
    },
    { status: 200 }
  );
  res.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return withCors(res);
}
