import { NextRequest } from "next/server";
import { fetchTeam, DEPARTMENTS } from "@/lib/team";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { dailyTtlMs } from "@/lib/cachePolicy";

// The team list changes a few times a year, so outside the event window it refreshes ONCE A
// DAY rather than hourly like the speaker feeds (Auri's rule, 2026-07-30). Two layers, both
// set from lib/cachePolicy.ts: the in-memory cache and the CDN's s-maxage. Consequence to
// know about: an Airtable edit can take up to 24h to appear.
//
// Until the end of August 27th the policy shortens both to the event cadence, so a late
// team edit lands within the half hour like everything else; the daily rule comes back on
// its own on the 28th. Either way the refresh button on /team forces a live read now.
export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "team");
  if (!gate.ok) return gate.res;

  // Optional ?department=Marketing etc. Validated against the known allow-list.
  const deptParam = req.nextUrl.searchParams.get("department");
  const department = deptParam && DEPARTMENTS.includes(deptParam) ? deptParam : undefined;

  // ?ids=recA,recB — a HAND-PICKED team, for a page that wants six named people rather than a
  // department. Auri's ask (2026-08-10): the six on the Side Events crew do not share a
  // Department value, so no ?department= can express them.
  //
  // RECORD IDS, NOT NAMES. A name arrives spelled three ways (Schiøtt / Schiott / Schiot),
  // changes when someone marries, and would have to be matched fuzzily on every request. A rec
  // id is stable, opaque and safe to put in a URL that gets pasted into WordPress and forgotten.
  //
  // Validated to the exact Airtable shape and capped, per the input rules: an id list is the one
  // part of this feed a stranger can make arbitrarily long, and an unbounded one is free work.
  // Unknown ids are dropped silently rather than 404ing — a snippet on techbbq.dk must not go
  // blank because one person left the team.
  const idParam = req.nextUrl.searchParams.get("ids");
  const ids = idParam
    ? idParam
        .split(",")
        .map((x) => x.trim())
        .filter((x) => /^rec[A-Za-z0-9]{14}$/.test(x))
        .slice(0, 60)
    : [];

  // A hand-picked list reads the WHOLE team and filters in memory, so it shares the one cache
  // entry every other variant uses. Keying the cache per id combination instead would mint a
  // fresh Airtable read for every distinct selection anyone ever pastes.
  const key = `team:${ids.length ? "all" : department || "all"}`;

  try {
    if (gate.fresh) invalidate(key);

    const all = await cached(key, () => fetchTeam(ids.length ? undefined : department), dailyTtlMs());
    // IN THE ORDER ASKED FOR, not the order Airtable returns. Whoever picks six people is
    // choosing a layout, so the first name should be the first card. This also means the
    // snippet must not shuffle a custom list, which is why /team passes shuffle={false} there.
    const members = ids.length
      ? ids.map((id) => all.find((m) => m.id === id)).filter((m): m is (typeof all)[number] => Boolean(m))
      : all;

    // ?email=0 — the addresses never leave the server.
    //
    // The embed already has an `email` flag, but that only stops it DRAWING them: the JSON
    // still carries every address, one devtools panel away, and a scraper reads JSON before it
    // reads markup. For a card wall whose whole point is "show the team without publishing
    // their inboxes", not sending the field is the only version of that which is true.
    //
    // Stripped AFTER the cache, like every other feed variant here, so both shapes share one
    // Airtable read. Opt-IN to omission, so the existing embeds on techbbq.dk — which do print
    // emails, by product decision — keep working untouched.
    const withEmail = req.nextUrl.searchParams.get("email") !== "0";
    const team = withEmail ? members : members.map(({ email: _drop, ...rest }) => rest);

    return feedResponse(
      {
        count: team.length,
        // "custom" rather than a department name: a consumer reading this JSON should not be
        // told it is looking at Marketing when it asked for six named people.
        department: ids.length ? "custom" : department || "all",
        // Echoed so a snippet that came back short can be diagnosed without guessing: asked 6,
        // got 5, means one of those people is no longer an active team member.
        ...(ids.length ? { requested: ids.length } : {}),
        team,
      },
      gate,
      { daily: true }
    );
  } catch (err) {
    console.error("[/api/team]", err);
    return errorResponse(err, "Something went wrong loading the team.", gate);
  }
}
