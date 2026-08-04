import { NextRequest, NextResponse } from "next/server";
import { fetchProgram, PROGRAM_SOURCES, ProgramSourceKey } from "@/lib/program";
import { cached, invalidate } from "@/lib/rate-limit";
import { BRELLA_SECTIONS, inBrellaSection, isBrellaSection } from "@/lib/brellaSections";
import { corsPreflight, errorResponse, feedGate, feedResponse, withCors } from "@/lib/apiRoute";
import { feedCacheControl, feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// The ?fresh= live-read this route pioneered now lives in lib/apiRoute.ts (feedGate), because
// every feed page has a refresh button. The rules it enforces — authenticated, separately
// metered, never stored — are documented there.

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

    const all = await cached(`program:${source}`, () => fetchProgram(source), feedTtlMs());

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
      const groups: Record<string, typeof all> = {};
      const counts: Record<string, number> = {};
      for (const { key } of BRELLA_SECTIONS) {
        groups[key] = all.filter((s) => inBrellaSection(s, key));
        counts[key] = groups[key].length;
      }
      const grouped = NextResponse.json(
        { count: all.length, event: source, counts, groups },
        { status: 200 }
      );
      // Same cache rules as the ungrouped path below: an authenticated refresh is never
      // stored and never gets CORS headers, an ordinary read is cacheable.
      if (fresh) {
        grouped.headers.set("Cache-Control", "no-store");
        return grouped;
      }
      grouped.headers.set("Cache-Control", feedCacheControl());
      return withCors(grouped);
    }

    const sessions =
      source === "brella" && isBrellaSection(sectionParam)
        ? all.filter((s) => inBrellaSection(s, sectionParam))
        : all;

    return feedResponse({ count: sessions.length, event: source, sessions }, gate);
  } catch (err) {
    console.error("[/api/program]", err);
    return errorResponse(err, "Something went wrong loading the program.");
  }
}
