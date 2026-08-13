// The Nordic Africa Startup Summit column on the Brella board comes from AIRTABLE, not Brella.
//
// ─── WHAT WAS WRONG ─────────────────────────────────────────────────────────────────────
// Brella has 21 rows for Event Room 2 on the 27th and NOT ONE of them names a speaker. The
// summit's real programme is maintained in Airtable — 22 sessions in the Sessions table
// (`Name of the Event = "Nordic Africa Startup Summit"`), 17 of them with speakers and a
// moderator named per session, 52 seats, 44 of them with a face — and it is already served at
// /api/program?event=nass and drawn by the agenda embed. Only the Brella board could not see it,
// so a visitor reading the board got a day of session titles with nobody on stage.
//
// SUBSTITUTED rather than supplemented, for the same reason as the Policy Stage: the two sources
// disagree on titles ("Africa's Diplomatic Corps & Innovation Diplomacy" in Brella against
// "Diplomacy as a Catalyst for Collaboration in Innovation" in Airtable), Brella is missing the
// 15:35 Investor Reverse Pitch entirely and carries the 16:35 reception twice. Merging would print
// every session twice under two names. Airtable is the copy the NASS team edits, so it wins whole.
//
// ─── SCOPED TO ONE DAY, WHICH IS THE WHOLE POINT ────────────────────────────────────────
// Event Room 2 runs TWO summits: Nordic India on the 26th and Nordic Africa on the 27th. NISS is
// still being finalised (its speakers are linked per session in its own table but not yet wired
// through — see progress.md), so this must not touch the 26th. Only sessions whose day matches
// NASS_DAY are replaced; Brella's Day 2 column is left exactly as it is (Auri, 2026-08-13).
//
// Written as the board's own day string rather than a date, because that is what the timeline
// groups on — the same choice lib/policyOverride.ts made and for the same reason.

import type { ProgramSession } from "@/lib/program";
import { toSpeaker } from "@/lib/stagePeople";

/** The room the summit takes. Brella files these sessions on the plain "Event Room 2" track. */
const NASS_ROOM = "Event Room 2";

/**
 * Airtable rows that must NOT reach the Brella board.
 *
 * "Registration, Coffee & Small Talk" (09:00–09:20) exists in Airtable and NOT in Brella, whose
 * Event Room 2 day starts at 09:25 with the welcome. Because this column is substituted wholesale,
 * that row appeared on the board as a session the attendee app does not have — so the board and the
 * app disagreed about when the day starts (Auri, 2026-08-13).
 *
 * DROPPED FROM THE BOARD ONLY. The Airtable row stays, so the agenda embed on techbbq.dk still
 * tells people when to turn up for coffee — which is exactly the audience that needs it. Delete the
 * row instead if it should disappear everywhere.
 *
 * Matched on the folded name, so trailing spaces or a case change in the cell cannot slip it back in.
 */
const SKIP_ON_BOARD = new Set(["registration coffee small talk"]);

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The board's day label for the summit. 27 August, which is what ROOM_DAY_PROGRAMMES in
 * lib/brellaSections.ts already says runs in this room on that date.
 */
export const NASS_DAY = "Day 3 · 27 August";

/**
 * Names the column's sub-label and earns the dotted whole-day band, exactly as the Policy Stage
 * does. Kept as the literal that ROOM_DAY_PROGRAMMES uses, so a reader grepping either file finds
 * both. The sessions span 09:00 to 18:05, which clears the morning-to-evening test the band needs.
 */
const NASS_PROGRAMME = "Nordic Africa Startup Summit";

/**
 * Replace the Brella board's 27 August Event Room 2 column with the Airtable NASS programme.
 *
 * MODERATORS FIRST, matching the agenda embed: they open the session, and on a panel of four the
 * reader wants to know who is steering before who is talking.
 *
 * A nass source that returns nothing leaves Brella's own sessions alone. That is the safe failure
 * — a column of titles with no speakers still beats an empty column, and this runs on every load
 * of a public board.
 */
export function mergeNassStage(
  brella: ProgramSession[],
  nass: ProgramSession[]
): ProgramSession[] {
  if (!nass.length) return brella;

  const sessions: ProgramSession[] = nass
    .filter((s) => !SKIP_ON_BOARD.has(fold(s.name)))
    .map((s) => {
      const mods = s.onStage?.moderators ?? [];
      const spks = s.onStage?.speakers ?? [];
      return {
        ...s,
        // Namespaced so an id can never collide with a Brella one ("brella-975878") or a policy one.
        id: `nass-${s.id}`,
        day: NASS_DAY,
        room: NASS_ROOM,
        programme: NASS_PROGRAMME,
        // parseSlot() accepts the en dash the Sessions table uses, so the slot needs no rewriting —
        // only the trailing spaces some cells carry.
        timeSlot: s.timeSlot.trim(),
        speakers: [
          ...mods.map((p, i) => toSpeaker(p, s.id, "Moderator", i)),
          ...spks.map((p, i) => toSpeaker(p, s.id, "Speaker", i)),
        ],
      };
    });

  // ONLY this room on THIS day is dropped. Nordic India keeps Event Room 2 on the 26th, and every
  // other room on the 27th is untouched.
  return [
    ...brella.filter((s) => !(s.room === NASS_ROOM && s.day === NASS_DAY)),
    ...sessions,
  ];
}
