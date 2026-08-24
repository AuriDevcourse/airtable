// The Longevity Lounge column on the Brella board comes from AIRTABLE, not Brella.
//
// ─── THIS IS A SUBSTITUTION, AND IT IS THE ONLY ONE ─────────────────────────────────────
// Every other programme on this board is a PAIRING: Brella is the source of truth and Airtable
// fills only what Brella leaves empty (lib/overlayEnrich.ts, and the duplicate-sessions bug that
// forced that rule). The Longevity Lounge is the deliberate exception, on Auri's call
// (2026-08-24): One Thirty Labs' run of show, sent as two spreadsheets, is the correct programme
// and Brella's copy of it is out of date.
//
// WHAT BRELLA HAS WRONG, which is why filling gaps was not enough — a pairing cannot fix any of
// these, because Brella is not empty, it disagrees:
//   26 Aug 11:00  "How billionairs die"                    → "Why billionaires die early?"
//   26 Aug 11:35  "When your body says stop..."            → "Understanding the Nervous System"
//   26 Aug 12:15  "The business of longevity..."           → "The health economy..."
//   26 Aug 13:30  "The female factor..."                   → "Hormones are not a side issue..."
//   26 Aug 15:15  Breathwork opens at 15:15                → 15:30
//   27 Aug 12:25  Tine Hertz billed as a third speaker     → she MODERATES
// Brella records NO ROLE on any of its 31 seats here — all blank — so the moderator on the one
// session that has one exists nowhere but the spreadsheet.
//
// THE ATTENDEE APP STILL SHOWS BRELLA'S VERSION. This file fixes the website and the pasted
// embeds; it cannot reach the app. The real fix is correcting those six things in the Brella
// admin, after which this file should go back to being a pairing or be deleted outright.
//
// ─── WHAT IS LOST BY SUBSTITUTING, AND WHY IT IS LOGGED ─────────────────────────────────
// Anyone Brella bills who is not on the spreadsheet disappears from the board. That is the whole
// point of following the sheet, and it is also how a late addition would silently vanish, so
// every such person is named in a warning on each load rather than dropped in silence.
//
// ─── NO BAND ────────────────────────────────────────────────────────────────────────────
// `programme` is deliberately NOT set. These sessions run 09:20-16:45, which clears
// spansMorningToEvening(), so naming a programme would earn the column a dashed whole-day band
// reading "Longevity Lounge" over a column already titled "Longevity Lounge" — the exact
// redundancy Auri had removed from the Diversity Lounge earlier the same day. The lounge's own
// 09:00 opening and its 16:45-18:00 close are not in Brella and are not added here.

import type { ProgramSession } from "@/lib/program";
import { toSpeaker } from "@/lib/stagePeople";
import { dayDate } from "@/lib/overlayEnrich";

/** The Brella track, after lib/brellaprogram.ts strips the "🧘" its admin decorates it with. */
const LONGEVITY_ROOM = "Longevity Lounge";

/**
 * The Sessions table says "Day 1"/"Day 2"; the board works in dates.
 *
 * Kept as DATES rather than Brella's "Day N" label for the reason NASS_DATE carries in
 * lib/nassOverride.ts: Brella's numbering is derived from whichever dates are in the feed, so it
 * shifted once already when a 24 August row appeared. Here the label is not matched at all — it is
 * COPIED off Brella's own sessions for that date, so the timeline groups these with everything
 * else however Brella happens to be numbering the days.
 */
const DATE_OF: Record<string, string> = {
  "Day 1": "26 august",
  "Day 2": "27 august",
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Replace the Brella Longevity Lounge column with the Airtable run of show.
 *
 * MODERATORS FIRST, matching the agenda embed and the other overrides: on the one session that has
 * one, the reader wants to know who is steering before who is talking.
 *
 * An Airtable source that returns nothing leaves Brella's own column exactly as it is. Still the
 * safe failure: Brella's version is out of date, not empty, and a stale column beats no column on
 * a public board.
 */
export function mergeLongevityLounge(
  brella: ProgramSession[],
  longevity: ProgramSession[]
): ProgramSession[] {
  if (!longevity.length) return brella;

  const theirs = brella.filter((s) => s.room === LONGEVITY_ROOM);
  if (!theirs.length) return brella;

  // Day label, location and tags are Brella's to give even when the programme is not: they are
  // facts about the venue and the board's own grouping, not about the line-up.
  const meta = new Map<string, { day: string; location?: string; tags?: string[] }>();
  for (const s of theirs) {
    const d = dayDate(s.day);
    if (!meta.has(d)) meta.set(d, { day: s.day, location: s.location, tags: s.tags });
  }

  const built: ProgramSession[] = [];
  for (const s of longevity) {
    const date = DATE_OF[s.day.trim()];
    const m = date ? meta.get(date) : undefined;
    // A row whose day cell is neither "Day 1" nor "Day 2", or a day Brella does not carry at all,
    // is skipped rather than guessed onto a date.
    if (!m) continue;

    const mods = s.onStage?.moderators ?? [];
    const spks = s.onStage?.speakers ?? [];
    built.push({
      ...s,
      day: m.day,
      room: LONGEVITY_ROOM,
      timeSlot: s.timeSlot.trim(),
      ...(m.location ? { location: m.location } : {}),
      ...(m.tags?.length ? { tags: m.tags } : {}),
      speakers: [
        ...mods.map((p, i) => toSpeaker(p, s.id, "Moderator", i)),
        ...spks.map((p, i) => toSpeaker(p, s.id, "Speaker", i)),
      ],
    });
  }

  if (!built.length) return brella;

  // WHO BRELLA BILLS THAT THE SPREADSHEET DOES NOT. Named on every load, because this is the one
  // way a person genuinely added to the programme after the sheet was written would disappear
  // from the board without anyone noticing. Louise Bjerre (27 August, 10:50) is the standing
  // example as of 2026-08-24.
  const kept = new Set(built.flatMap((s) => (s.speakers ?? []).map((p) => fold(p.name))));
  const dropped = [
    ...new Set(
      theirs
        .flatMap((s) => (s.speakers ?? []).map((p) => p.name))
        .filter((n) => !kept.has(fold(n)))
    ),
  ];
  if (dropped.length) {
    console.warn(
      `[longevityOverride] ${dropped.length} person/people Brella bills in ${LONGEVITY_ROOM} are not on the run of show and are not shown: ${dropped.join(" | ")}`
    );
  }

  return [...brella.filter((s) => s.room !== LONGEVITY_ROOM), ...built];
}
