// BRELLA IS THE SOURCE OF TRUTH for the Brella board. This file is how the three Airtable
// programmes (Policy Stage, Nordic Africa, Board Summit) are allowed to touch it.
//
// ─── WHAT WENT WRONG, AND WHY IT HAD TO CHANGE ──────────────────────────────────────────
// lib/policyOverride.ts, lib/nassOverride.ts and lib/boardOverride.ts were written when Brella
// held each of those programmes as ONE all-day row with a heap of speakers and no times. The
// Airtable copy was the only place the real sessions existed, so each override SUBSTITUTED:
// drop Brella's rows for that room and day, put the Airtable ones in their place.
//
// Brella has since caught up. Event Room 1 on the 27th now carries all 14 Board Summit slots
// with times and a location, Event Room 2 carries all 21 Nordic Africa slots, and the Policy
// Stage has its own timed rows. The substitution premise is gone, and two things broke with it:
//
//  1. THE DAY MATCH SILENTLY STOPPED MATCHING. The overrides dropped Brella rows whose `day`
//     equalled the literal "Day 3 · 27 August". But that label is DERIVED. lib/brellaprogram.ts
//     numbers whichever dates happen to be in the feed, so once Brella gained a 24 August row
//     the 27th became "Day 4". Nothing matched, nothing was dropped, and every overlaid session
//     rendered TWICE: 30 sessions in Event Room 1 where 16 exist, 42 in Event Room 2 where 21 do.
//     lib/brellaSections.ts already warns about exactly this ("Never surface Brella's number");
//     the overrides were the code that had not been told.
//
//  2. AIRTABLE WAS OUTRANKING BRELLA ON FACTS BRELLA NOW HAS. Titles drifted apart in public
//     ("Check-in" against "Check-in - Networking", "Diplomacy as a Catalyst for Collaboration"
//     against "Africa's Diplomatic Corps & Innovation Diplomacy"), and the board disagreed with
//     the attendee app about when sessions start.
//
// ─── THE RULE NOW ───────────────────────────────────────────────────────────────────────
// Brella decides WHICH sessions exist and what they are called, when they run, and where. The
// Airtable programme is only allowed to FILL WHAT BRELLA LEAVES EMPTY: speakers, a description,
// the PDF, the programme label. It can never add a row, rename one, or move one.
//
// An Airtable session with no Brella counterpart is DROPPED, and its name is returned so the
// caller can log it. That is the honest outcome of "Brella is the source of truth": a session the
// attendee app does not have should not appear on a board that claims to mirror the attendee app.
// The log line is there so the gap gets fixed in Brella rather than papered over here.
import type { ProgramSession } from "@/lib/program";
import { parseSlot } from "@/lib/brellaSections";

/**
 * The DATE out of a day label: "Day 4 · 27 August" becomes "27 august".
 *
 * Matched on the date and never on Brella's "Day N", which counts whichever dates happen to be in
 * the feed and shifts under you when a row is added or deleted. This is the same choice EVENT_DAYS
 * in lib/brellaSections.ts made, and breaking it is what produced the duplicates this file exists
 * to stop.
 *
 * Folded to lower case so a capitalisation change in either source cannot break the match.
 */
export function dayDate(day: string): string {
  return (day || "").replace(/^\s*day\s*\d+\s*[·:\-–]\s*/i, "").trim().toLowerCase();
}

/** The start of a slot in minutes, for pairing an Airtable row with its Brella twin. */
function startOf(slot: string): number | null {
  return parseSlot(slot)?.start ?? null;
}

/** A description cell that is present but says nothing still counts as empty. */
function blank(s: string | undefined): boolean {
  return !s || !s.trim();
}

export type OverlayTarget = {
  /** The room the Brella rows sit in, and therefore the only column this overlay may touch. */
  room: string;
  /**
   * The calendar date the overlay describes, written the way a day label carries it: "27 August".
   * Compared through dayDate(), so Brella's ordinal is irrelevant.
   */
  date: string;
  /** The programme name, which names the column and earns its dotted whole-day band. */
  programme: string;
  /**
   * The programme PDF, put on every session in the room. Absent for a programme with no PDF.
   * Typed off ProgramSession rather than as a string: it is a {url, label} pair, because a run of
   * show, a schedule and a workshop plan are not the same thing to whoever is about to press it.
   */
  programmeUrl?: ProgramSession["programmeUrl"];
};

export type EnrichResult = {
  /** The full programme: every Brella session, some of them now carrying Airtable detail. */
  sessions: ProgramSession[];
  /** Airtable sessions Brella has no slot for. Dropped, and named so the gap is visible. */
  unmatched: string[];
  /** How many Brella sessions actually took something from Airtable. */
  enriched: number;
};

/**
 * Fill the gaps in one room's Brella day from its Airtable programme.
 *
 * Paired on room + date + START TIME. The start is the one field the two sources agree on almost
 * everywhere, because both were typed from the same run of show; titles drift and end times drift,
 * starts do not. Where a start HAS drifted (Brella has Human Judgment in AI at 11:20, Airtable at
 * 11:25) the pair is missed and the Airtable row is dropped rather than guessed at. A five-minute
 * window would pair the wrong two rows in a programme with back-to-back slots.
 *
 * An all-day Brella row never pairs: parseSlot() gives it no start. That is correct. The umbrella
 * row is Brella's own and stays exactly as Brella has it.
 */
export function enrichWithOverlay(
  brella: ProgramSession[],
  overlay: ProgramSession[],
  target: OverlayTarget
): EnrichResult {
  const wantDate = target.date.trim().toLowerCase();
  const inRoom = (s: ProgramSession) =>
    s.room === target.room && dayDate(s.day) === wantDate;

  // Index the Airtable programme by start minute, so each Brella row can ask for its own detail.
  // First row wins on a collision: two Airtable rows sharing a start are already a data problem in
  // that table, and silently merging their speakers would hide it.
  const byStart = new Map<number, ProgramSession>();
  for (const s of overlay) {
    const start = startOf(s.timeSlot);
    if (start === null) continue;
    if (!byStart.has(start)) byStart.set(start, s);
  }

  const paired = new Set<number>();
  let enriched = 0;

  const sessions = brella.map((s) => {
    if (!inRoom(s)) return s;

    const start = startOf(s.timeSlot);
    const from = start === null ? undefined : byStart.get(start);

    // THE PROGRAMME LABEL AND THE PDF ARE APPLIED TO THE WHOLE ROOM, paired or not. They describe
    // the day rather than the session: the breaks belong to the Board Summit as much as the panels
    // do, and a visitor who opens the lunch slot has the same right to the PDF as one who opens a
    // keynote. This is also what earns the column its dotted whole-day band. See the reasoning in
    // lib/policyOverride.ts, which is where that band was worked out.
    const dayLevel: Partial<ProgramSession> = {
      ...(s.programme ? {} : { programme: target.programme }),
      ...(target.programmeUrl && !s.programmeUrl ? { programmeUrl: target.programmeUrl } : {}),
    };

    if (!from) return { ...s, ...dayLevel };
    if (start !== null) paired.add(start);

    // ONLY WHAT BRELLA LEAVES EMPTY. Brella's own name, timeSlot, room, day, type, tags and
    // location are never touched, which is the whole point of this rewrite. A Brella row that
    // already names one speaker keeps its own list rather than being topped up: a partial list from
    // Brella and a full one from Airtable would merge into a list with duplicates and no way to
    // tell which of the two is current.
    const gains: Partial<ProgramSession> = {};
    if (!s.speakers?.length && from.speakers?.length) gains.speakers = from.speakers;
    if (blank(s.description) && !blank(from.description)) gains.description = from.description;

    if (Object.keys(gains).length) enriched++;
    return { ...s, ...dayLevel, ...gains };
  });

  const unmatched = overlay
    .filter((s) => {
      const start = startOf(s.timeSlot);
      return start === null || !paired.has(start);
    })
    .map((s) => `${s.timeSlot.trim()} ${s.name}`);

  return { sessions, unmatched, enriched };
}
