import { NextRequest, NextResponse } from "next/server";
import { fetchProgram, ProgramSession, PROGRAM_SOURCES, ProgramSourceKey } from "@/lib/program";
import { cached, invalidate } from "@/lib/rate-limit";
import { BRELLA_SECTIONS, inBrellaSection, isBrellaSection } from "@/lib/brellaSections";
import { fetchPartnerEvents } from "@/lib/partnerevents";
import { mergeSideEvents } from "@/lib/sideEvents";
import { mergePolicyStage } from "@/lib/policyOverride";
import { fetchLumaDetails, LumaDetail } from "@/lib/lumaEvents";
import { corsPreflight, errorResponse, feedGate, feedResponse, withCors } from "@/lib/apiRoute";
import { feedCacheControl, feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// The ?fresh= live-read this route pioneered now lives in lib/apiRoute.ts (feedGate), because
// every feed page has a refresh button. The rules it enforces — authenticated, separately
// metered, never stored — are documented there.

// Side event venues are read off the partners' Luma pages, and a venue does not move. Six
// hours keeps that lookup to a handful of requests a day against someone else's site, and it
// deliberately does NOT follow the feed's 30-minute cadence. `?fresh=` still drops it, so the
// dashboard's Refresh button re-reads Luma when a partner has just changed something.
const LUMA_TTL_MS = 6 * 60 * 60_000;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "program");
  if (!gate.ok) return gate.res;
  const fresh = gate.fresh;

  // Optional ?event=techbbq|niss — validated against the known sources.
  const eventParam = req.nextUrl.searchParams.get("event");
  const source: ProgramSourceKey =
    eventParam && eventParam in PROGRAM_SOURCES ? (eventParam as ProgramSourceKey) : "techbbq";

  try {
    // Drop this instance's entry first, so the read below really goes to Airtable AND the
    // refreshed value is what ordinary cached reads on this instance serve next.
    if (fresh) invalidate(`program:${source}`);
    // The Brella program's Side Events come from Airtable, so a live read has to drop that
    // entry too or the refresh button would report no change on the one section a partner is
    // most likely to have just edited.
    if (fresh && source === "brella") {
      invalidate("partnerevents");
      invalidate("luma:side-events");
      // The Policy Stage column is Airtable too (lib/policyOverride.ts). Without this the
      // refresh button would report no change on the one column somebody has just edited.
      invalidate("program:policy");
    }

    const all = await cached(`program:${source}`, () => fetchProgram(source), feedTtlMs());

    // SIDE EVENTS ARE A MERGE, not pure Brella. Airtable carries all 10 events and the real
    // sign-up links; Brella carries the times, which no Airtable row has. Neither source
    // alone can render this section correctly — see lib/sideEvents.ts for the measurements.
    // The cache key is the one /api/partner-events already fills, so this costs no extra
    // Airtable read.
    //
    // A failure here falls back to Brella's own side sessions rather than blanking the
    // section: six events without links still beats an empty tab on techbbq.dk.
    // The substitution happens ONCE, here, so every variant of this endpoint agrees about what
    // the Side Events are: ?section=all, ?section=side and the plain feed the dashboard page
    // slices client-side. Doing it per-variant is how the page ended up still showing Brella's
    // six while the grouped embed showed all ten.
    let sessionsAll: ProgramSession[] = all;
    if (source === "brella") {
      try {
        const partnerEvents = await cached("partnerevents", fetchPartnerEvents, feedTtlMs());

        // The venue comes from each partner's own Luma page — Airtable has no field for it.
        // Cached for SIX HOURS rather than on the feed cadence: a venue does not move, and this
        // reaches out to a third-party site, so a handful of lookups a day is the polite
        // amount. An empty map is a fine answer; the cards simply show no venue line.
        let luma = new Map<string, LumaDetail>();
        try {
          luma = await cached(
            "luma:side-events",
            () => fetchLumaDetails(partnerEvents.map((e) => e.registerUrl)),
            LUMA_TTL_MS
          );
        } catch (err) {
          console.error("[/api/program] Luma lookup failed, continuing without venues", err);
        }

        const merged = mergeSideEvents(
          partnerEvents,
          all.filter((s) => inBrellaSection(s, "side")),
          luma
        );
        sessionsAll = [...all.filter((s) => !inBrellaSection(s, "side")), ...merged];
      } catch (err) {
        console.error("[/api/program] side events unavailable, falling back to Brella", err);
      }

      // THE POLICY STAGE IS THE SECOND MERGE, and a substitution rather than a pairing.
      //
      // Brella holds the whole stage as one all-day row with 28 speakers heaped on it, which on
      // a timeline claims the day and says nothing about it. The real 15 sessions live in
      // Airtable and are already served at ?event=policy. See lib/policyOverride.ts — including
      // why it is temporary and how to remove it.
      //
      // Done HERE, beside the side events, for the reason written above them: every variant of
      // this endpoint must agree about what the programme is, or the page and the embed drift.
      // Its own try/catch, so a failing Policy read cannot take the side events down with it.
      try {
        const policy = await cached("program:policy", () => fetchProgram("policy"), feedTtlMs());
        sessionsAll = mergePolicyStage(sessionsAll, policy);
      } catch (err) {
        console.error("[/api/program] policy stage unavailable, leaving Brella's own", err);
      }
    }

    // ?section=stages|rooms|side narrows the BRELLA feed to one of the three groups the
    // /brella-program page shows, so a WordPress page can embed just the Side Events.
    // Filtered after the cache, like the other feeds' filters, so all four variants share
    // one Brella call. Ignored for the Airtable sources: their tracks are not Brella track
    // names, so sectionOf() would be answering a question their data cannot be asked.
    // An unknown value serves everything, matching ?kind= and ?stage= elsewhere.
    const sectionParam = req.nextUrl.searchParams.get("section");

    // ?section=all groups every section in ONE response, for the embed that carries the whole
    // program with its own section switcher. Grouping server-side matters: it keeps the rules
    // for what belongs where in lib/brellaSections.ts. The alternative — shipping the section
    // regexes into the snippet — puts a second copy on techbbq.dk that can never be corrected
    // once pasted.
    if (source === "brella" && sectionParam === "all") {
      const groups: Record<string, ProgramSession[]> = {};
      const counts: Record<string, number> = {};
      for (const { key } of BRELLA_SECTIONS) {
        groups[key] = sessionsAll.filter((s) => inBrellaSection(s, key));
        counts[key] = groups[key].length;
      }
      const grouped = NextResponse.json(
        { count: sessionsAll.length, event: source, counts, groups },
        { status: 200 }
      );
      // Same cache rules as the ungrouped path below: an authenticated refresh is never
      // stored and never gets CORS headers, an ordinary read is cacheable.
      if (fresh) {
        grouped.headers.set("Cache-Control", "no-store");
        return grouped;
      }
      grouped.headers.set("Cache-Control", feedCacheControl());
      return withCors(grouped, gate.origin);
    }

    const sessions =
      source === "brella" && isBrellaSection(sectionParam)
        ? sessionsAll.filter((s) => inBrellaSection(s, sectionParam))
        : sessionsAll;

    return feedResponse({ count: sessions.length, event: source, sessions }, gate);
  } catch (err) {
    console.error("[/api/program]", err);
    return errorResponse(err, "Something went wrong loading the program.", gate);
  }
}
