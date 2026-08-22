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
import { EventPageDetail } from "@/lib/eventPages";
import { baseUrl } from "@/lib/photo";
// Moved to its own module so /partner-events can print the identical second line. It used to
// live here, which is how that page ended up with a near-copy missing the same-as-host rule.
import { venueLabel } from "@/lib/venueLabel";
// Both moved out so /partner-events can resolve the identical banner and title key.
import { artworkOverride, titleKey } from "@/lib/eventArtwork";

function sameEvent(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * The part of a RAW title before its colon, as a titleKey(): "VC Hackathon: Build AI Agents For
 * VCs" → "vc hackathon". Taken from the raw string rather than the key because titleKey() turns
 * the colon into a space and the boundary is gone by then.
 *
 * Empty when there is no colon, or when the stem is shorter than six characters — "Q&A: …" or
 * "Day 2: …" would otherwise match half the programme, which is the opposite of what a
 * tie-breaker is for.
 */
function titleStem(title: string): string {
  const i = (title || "").indexOf(":");
  if (i < 0) return "";
  const stem = titleKey(title.slice(0, i));
  return stem.length >= 6 ? stem : "";
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

// ─── BANNERS TECHBBQ DREW, FOR EVENTS WHOSE TICKETING PAGE PUBLISHES NO ARTWORK ─────────
// Three of the fourteen side events had no thumbnail, and not because of a bug: CTO Connect sells
// through rsvp.withgoogle.com, which publishes no og:image at all, and the other two have no
// scrapeable artwork either. A row of cards where three are text-only reads as a broken page rather
// than as a page missing three images, so Auri drew Luma-style banners for them (2026-08-08).
//
/**
 * Merge the two sources into the program's Side Events section.
 *
 * @param events     every partner event from Airtable (Event Rooms are filtered out here)
 * @param brellaSide Brella's own side sessions, used only to fill gaps Airtable leaves
 */
export function mergeSideEvents(
  events: PartnerEvent[],
  brellaSide: ProgramSession[] = [],
  luma: Map<string, EventPageDetail> = new Map()
): ProgramSession[] {
  const days = dayStrings(events);
  const brella = brellaSide.map((s) => ({
    key: titleKey(s.name),
    stem: titleStem(s.name),
    session: s,
  }));
  const paired = new Set<ProgramSession>();

  /**
   * SECOND PASS, for the same event RENAMED on one side. Brella and Airtable drift apart
   * constantly — the NASS notes already record eight titles that read differently in the two
   * systems — and when they do, the title match below fails and the event renders TWICE: once
   * from Airtable with its artwork, once bare from the unmatched loop at the bottom. That is
   * what put the VC Hackathon on the board twice (2026-08-22), as "Build AI Agents For VCs" in
   * Brella against "Build The Thing VCs Want To Invest In" in Airtable — one event, one venue,
   * one 10:00-15:00 slot on the 24th.
   *
   * THREE SIGNALS, ALL REQUIRED: same day, same start minute, and the same title stem before the
   * colon. Day and time alone are NOT enough and must never be used on their own — among today's
   * side events FOUR pairs of genuinely different events share a day and a start time (Amplify /
   * EUVC Corporate Live, Gateway to DACH / GTM Secret Dinner, Diplomatic Soirée / Unlocking
   * Nordic Private Markets, Capital and Cocktails / CTO Connect). Pairing those would merge two
   * real sessions into one and DELETE the other from the page, which is a far worse failure than
   * showing something twice. The stem is what makes it safe: none of those four pairs share one.
   *
   * Only ever consults sessions nothing has claimed yet, and only fires when exactly ONE
   * candidate qualifies — an ambiguous slot is left alone and shows the double, which is visible
   * and fixable, rather than being resolved by a guess.
   */
  const slotMatch = (e: PartnerEvent) => {
    const stem = titleStem(e.title);
    if (!stem) return undefined;
    const day = (e.date && days.get(e.date)) || "";
    const start = startMinutes(e.timeSlot || "");
    if (!day || start > 24 * 60) return undefined;
    const hits = brella.filter(
      (b) =>
        !paired.has(b.session) &&
        b.stem === stem &&
        b.session.day === day &&
        startMinutes(b.session.timeSlot || "") === start
    );
    return hits.length === 1 ? hits[0] : undefined;
  };

  const sessions: ProgramSession[] = events
    .filter((e) => e.kind === "side-event")
    .map((e) => {
      const key = titleKey(e.title);
      const match = brella.find((b) => sameEvent(key, b.key)) ?? slotMatch(e);
      if (match) paired.add(match.session);
      // BRELLA LISTS SOME EVENTS TWICE, and find() consumes only the first, so the second copy
      // fell through to the unmatched loop below and rendered a SECOND, bare card — no artwork,
      // no register link, `room` reading "Side Events" — beside the real one. That is what put
      // Diplomatic Soirée and The Nordic Paradox on the board twice (2026-08-22); their titles
      // are byte-identical on both sides, so this was never a title-alignment problem.
      //
      // EXACT keys only, deliberately. sameEvent() also matches on substring, and widening the
      // line above to filter() would let one Airtable title swallow every Brella session whose
      // key merely CONTAINS it — silently deleting real sessions, which is a far worse failure
      // than showing one twice. There are no such collisions today; that is luck, not a rule.
      for (const b of brella) if (b.key === key) paired.add(b.session);

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
        // The partner's own artwork from their ticketing page, or a banner TechBBQ drew because
        // the page had none. The partner's own always wins — see ARTWORK_OVERRIDES.
        image: artworkOverride(key) ?? extra.image ?? null,
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
