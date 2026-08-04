// The Side Events section of the program: AIRTABLE for the list, BRELLA for the clock.
//
// WHY A MERGE AND NOT A SWITCH. Each source is missing something the other has, measured
// 2026-08-04 against the live data:
//
//   Airtable (Partnership Success, "2026 Side event and event room info")
//     has  · all 10 events, a real sign-up URL on 9 of them, the date, the public/private
//            badge, the hosting partner, a description on all 10
//     lacks· the TIME. `Time slot` is empty on every single side event row. The
//            partnerships team fills it for Event Rooms and not for these.
//
//   Brella
//     has  · the time on its 6 events
//     lacks· 4 of the 10 events entirely (SF PR afterwork, Beyond Unicorns, CTO Connect,
//            Sweden@TechBBQ VIP Reception), and any usable link. Its API returns the
//            description as plain text ending in the WORDS "LINK TO REGISTER" with no URL
//            anywhere in the payload — the hyperlink lives in Brella's editor and does not
//            survive the API. That is why techbbq.dk showed dead "LINK TO REGISTER" text.
//
// So Airtable is the spine (it is where the team actually works, and it is the only source
// that knows all 10 events) and Brella fills the time in. Taking either alone is a visible
// regression: Airtable alone drops every time off the live page, Brella alone keeps the four
// missing events invisible and every link dead.
//
// Event Rooms deliberately stay on Brella. That section is 24 session-level entries with
// speakers inside Event Rooms 1-4, while this Airtable view holds 8 whole-day room bookings.
// Different grain, and the session detail is the part a visitor needs.
//
// The output is ProgramSession, so the dashboard page, the dialog and the pasted embed keep
// working on the shape they already know, plus registerUrl.

import { PartnerEvent } from "@/lib/partnerevents";
import { ProgramSession } from "@/lib/program";
import { LumaDetail } from "@/lib/lumaEvents";

/**
 * Titles do not match exactly across the two systems, so compare them loosely: lowercase,
 * punctuation and accents out, one containing the other counts as a match. That is what
 * pairs Brella's "The Next Generation of Finance: CFO Round Table Dinner" with Airtable's
 * "CFO Round Table Dinner". Verified: all 6 Brella side events pair this way.
 */
function titleKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameEvent(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Brella's descriptions end with a dangling "LINK TO REGISTER" (sometimes preceded by a
 * "Register here:" style lead-in) because the URL was stripped from the anchor. Once a real
 * Register button is rendered, that text is a dead end pointing at nothing, so it goes.
 * Only used on the fallback path — Airtable's own copy has all 10 descriptions.
 */
function stripDeadRegisterLine(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*(register\s*(here)?\s*:?\s*)?link to register\s*:?\s*$/i.test(line))
    .join("\n")
    .trim();
}

/** "2026-08-25" → "25 August". UTC, because a date-only cell formatted west of UTC moves back a day. */
function dateWords(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** "2026-08-25" → "Day 1 · 25 August", the shape Brella emits and both consumers parse. */
function dayStrings(events: PartnerEvent[]): Map<string, string> {
  const dates = [...new Set(events.map((e) => e.date).filter((d): d is string => Boolean(d)))].sort();
  const out = new Map<string, string>();
  dates.forEach((iso, i) => {
    out.set(iso, `Day ${i + 1} · ${dateWords(iso)}`);
  });
  return out;
}

/**
 * The venue line, or undefined when there is nothing worth printing.
 *
 * A host who runs the event at their own office puts their own name in Luma's location, so the
 * card would read "Hosted by Rockstart" and then "Rockstart · København" underneath. When the
 * venue only repeats the host, the city carries the line on its own.
 */
function venueLabel(venue: string | undefined, city: string | undefined, company: string): string | undefined {
  const sameAsHost = venue && company && titleKey(venue) === titleKey(company);
  return [sameAsHost ? "" : venue, city].filter(Boolean).join(" · ") || undefined;
}

// Sorts "09:30-11:00" and "09:00 - 11:00" alike; anything unreadable goes last within its day
// rather than to midnight, so a timeless event does not lead the list.
function startMinutes(slot: string): number {
  const m = /(\d{1,2})[:.](\d{2})/.exec(slot || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60 + 1;
}

function dayRank(day: string): number {
  const m = /^Day\s+(\d+)/i.exec(day || "");
  return m ? Number(m[1]) : 99;
}

/**
 * Merge the two sources into the program's Side Events section.
 *
 * @param events     every partner event from Airtable (Event Rooms are filtered out here)
 * @param brellaSide Brella's own side sessions, used only to fill gaps Airtable leaves
 */
export function mergeSideEvents(
  events: PartnerEvent[],
  brellaSide: ProgramSession[] = [],
  luma: Map<string, LumaDetail> = new Map()
): ProgramSession[] {
  const days = dayStrings(events);
  const brella = brellaSide.map((s) => ({ key: titleKey(s.name), session: s }));
  const paired = new Set<ProgramSession>();

  const sessions: ProgramSession[] = events
    .filter((e) => e.kind === "side-event")
    .map((e) => {
      const key = titleKey(e.title);
      const match = brella.find((b) => sameEvent(key, b.key));
      if (match) paired.add(match.session);

      // The partner's own Luma page, when they sell through Luma. It is the only source that
      // has the VENUE, and it is the last resort for a time.
      const extra = (e.registerUrl && luma.get(e.registerUrl)) || {};

      return {
        id: e.id,
        // Airtable's title wins: it is the name the partner submitted, and Brella sometimes
        // carries a longer marketing variant of the same session.
        name: e.title,
        day: (e.date && days.get(e.date)) || match?.session.day || "",
        // The whole reason for the merge. Airtable first because that is what the team
        // maintains, then Brella, then the partner's Luma page as a last resort. Luma is LAST
        // on purpose: it is the partner's own listing and can disagree with what TechBBQ
        // scheduled, so it fills a gap and never overrides an answer we already have.
        timeSlot: e.timeSlot || match?.session.timeSlot || extra.timeSlot || "",
        // Shown in the time's place when there is no time. Auri's call (2026-08-04): the date
        // alone is honest and useful, "Time TBC" is neither. Partners will get a time field on
        // the form; until they fill it, this is what a visitor sees.
        dateLabel: e.date ? dateWords(e.date) : undefined,
        // Just the kind. Public/private used to be fused into this string, which made the
        // dialog's badge read "Side Event · Private · invite only" and forced any consumer
        // wanting the access rule to parse prose. It has its own field now.
        type: e.kindLabel,
        access: e.accessKind ?? undefined,
        description: e.description || stripDeadRegisterLine(match?.session.description || ""),
        // "room" for a side event is the hosting partner: these run at the partner's own
        // venue, not in a Bella Center room.
        room: e.company || "Side Event",
        // The actual place, when Luma knows it: "Matrikel1", "Højbro Pl. 10 · København". The
        // city alone is still worth showing — it tells a visitor the event is in town.
        // Undefined rather than the company name: `location` means WHERE, and repeating the
        // host there is what put a map pin next to "Rockstart" in the first place.
        location: venueLabel(extra.venue, extra.city, e.company),
        // Airtable's view carries no speaker link, so keep Brella's if it had any.
        speakers: match?.session.speakers ?? [],
        registerUrl: e.registerUrl,
        // Declared, not guessed. `room` here is the hosting partner, and sectionOf() reads an
        // unrecognised track name as a stage — without this the side events would land in the
        // Stages timeline on both the page and the embed.
        section: "side" as const,
      };
    });

  // A Brella side event with no Airtable row is kept rather than dropped. None exist today,
  // but silently losing a session because a partner never filled the form is the wrong
  // failure: it would disappear from techbbq.dk with nothing to explain why.
  //
  // It is LOUD, though. The realistic cause is not a missing row but a title that stopped
  // matching after someone edited it on one side, and the visible symptom of that is the same
  // event appearing TWICE on the live page. A line in the Vercel logs is how that gets caught
  // during event week instead of by a visitor.
  for (const { session } of brella) {
    if (paired.has(session)) continue;
    console.warn(
      `[sideEvents] Brella side event "${session.name}" (${session.day}, ${session.timeSlot}) ` +
        `matched no Airtable row — shown as-is, with no register link. If this event IS in ` +
        `Airtable under a different title, it is now listed twice; align the titles to fix.`
    );
    sessions.push({
      ...session,
      description: stripDeadRegisterLine(session.description || ""),
      registerUrl: null,
      section: "side" as const,
    });
  }

  return sessions.sort(
    (a, b) =>
      dayRank(a.day) - dayRank(b.day) ||
      a.day.localeCompare(b.day) ||
      startMinutes(a.timeSlot) - startMinutes(b.timeSlot) ||
      a.name.localeCompare(b.name)
  );
}
