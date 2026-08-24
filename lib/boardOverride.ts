// The BOARD SUMMIT column on the Brella board comes from AIRTABLE, not Brella.
//
// The third substitution of the same kind, after lib/policyOverride.ts and lib/nassOverride.ts, and
// written against those two rather than inventing a third shape. Read either of them first: the
// reasoning is the same and they say it at length.
//
// ─── WHAT WAS WRONG ─────────────────────────────────────────────────────────────────────
// Brella carries the whole Board Summit as ONE all-day row in Event Room 1 on the 27th, with 31
// people heaped on it and no times. So the column said "this room is busy all day" and nothing else:
// not that Viktor Axelsen is interviewed at 09:45, not that Bianca Bruhn chairs AI in the Boardroom
// at 14:00, and not that the day ends at 16:00 rather than running to close.
//
// The real programme has existed the whole time — 14 sessions hand-typed in the Sessions table, 12
// of them naming a moderator and speakers with faces, served at /api/program?event=board and
// rendered by the agenda embed. Only the Brella board could not see it, which is the same sentence
// that opens policyOverride.ts.
//
// SUPERSEDED, 2026-08-20. Brella now carries all 14 slots in Event Room 1 on the 27th, with times
// and a location, so the premise above no longer holds. This file NO LONGER SUBSTITUTES: Brella is
// the source of truth and the Airtable programme only fills what Brella leaves empty. Left as
// history because it explains where the Airtable copy came from; the rule that replaced it, and the
// duplicate-sessions bug that forced the change, are in lib/overlayEnrich.ts.
//
// ─── WHAT THE SUBSTITUTION COSTS, AND WHY IT IS PAID ────────────────────────────────────
// Dropping the Brella row drops the only thing that carried the PDF link, because the dashed band
// that replaces it is derived rather than real and cannot be pressed. So `programmeUrl` is put on
// EVERY substituted session instead (Auri, 2026-08-17: "if we have speakers and everything, let's
// add it up, but make sure to have also pdf program"). That is better than what it replaces: the
// link used to be reachable only by guessing that an all-day rectangle was pressable.
//
// ─── THE DAY AND THE ROOM ARE PINNED HERE ───────────────────────────────────────────────
// The Sessions table has no date column — it was typed from a document, like the Policy Stage — so
// 27 August is stated below. Brella files its all-day row on the 27th and app/program/page.tsx has
// always headed this agenda "August 27th", so both sources already agreed; nothing had to be asked.
import type { ProgramSession } from "@/lib/program";
import { sessionProgramme } from "@/lib/sessionProgrammes";
import { toSpeaker } from "@/lib/stagePeople";
import { enrichWithOverlay } from "@/lib/overlayEnrich";

/**
 * The DATE the Board Summit runs, never Brella's "Day N".
 *
 * This was `"Day 3 · 27 August"` and that is what broke it: the label is derived from whichever
 * dates are in the Brella feed, so the 27th became "Day 4" the moment a 24 August row appeared, the
 * room-and-day filter below stopped matching, and every session rendered twice. See dayDate() in
 * lib/overlayEnrich.ts.
 */
export const BOARD_DATE = "27 August";

/** Where Brella puts it, and therefore which column these sessions have to land in. */
export const BOARD_ROOM = "Event Room 1";

/**
 * Names the column's sub-label and earns the dotted whole-day band, exactly as the Policy Stage and
 * NASS do. The 14 sessions run 09:00 to 16:00, which clears spansMorningToEvening (start by 11:00,
 * end from 16:00) with nothing to spare at the end — a programme that later stops at 15:50 loses its
 * band, and the band is what tells the column it is one whole-day event.
 */
const BOARD_PROGRAMME = "Board Summit";

/**
 * The PDF, resolved through lib/sessionProgrammes.ts rather than pasted here, so the URL lives in
 * one file and a re-upload is one edit. Keyed on the programme name, which is what that file's
 * /^board summit\b/ entry matches.
 */
const BOARD_DOC = sessionProgramme(BOARD_PROGRAMME);

/**
 * Fill the gaps in Brella's 27 August Event Room 1 column from the Airtable Board Summit.
 *
 * BRELLA WINS ON EVERY FACT IT HAS: the titles, times, room and location on the board are Brella's,
 * so the board and the attendee app can no longer disagree. Airtable supplies the speakers Brella's
 * rows do not name, a description where Brella has none, the programme label and the PDF.
 *
 * MODERATORS FIRST, matching the agenda embed and the other two overrides: they open the session,
 * and on a panel of four the reader wants to know who is steering before who is talking.
 *
 * A board source that returns nothing leaves Brella's own rows alone. Now that Brella has
 * the real programme, is a perfectly good column rather than the fallback it used to be.
 */
export function mergeBoardSummit(
  brella: ProgramSession[],
  board: ProgramSession[]
): ProgramSession[] {
  if (!board.length) return brella;

  const overlay: ProgramSession[] = board.map((s) => {
    const mods = s.onStage?.moderators ?? [];
    const spks = s.onStage?.speakers ?? [];
    return {
      ...s,
      // parseSlot() accepts the en dash the Sessions table uses, and every Board Summit row has one
      // ("09:30 – 09:45"), so the slot needs no rewriting, only the trailing spaces some cells
      // carry. It is read for PAIRING now, not published: the board shows Brella's own slot.
      timeSlot: s.timeSlot.trim(),
      speakers: [
        ...mods.map((p, i) => toSpeaker(p, s.id, "Moderator", i)),
        ...spks.map((p, i) => toSpeaker(p, s.id, "Speaker", i)),
      ],
    };
  });

  const { sessions, unmatched } = enrichWithOverlay(brella, overlay, {
    room: BOARD_ROOM,
    date: BOARD_DATE,
    programme: BOARD_PROGRAMME,
    ...(BOARD_DOC ? { programmeUrl: BOARD_DOC } : {}),
  });

  // A row Brella has no slot for is dropped, and said out loud. Silence here is how the board and
  // the attendee app drifted apart in the first place.
  if (unmatched.length) {
    console.warn(
      `[boardOverride] ${unmatched.length} Airtable session(s) have no Brella slot in ${BOARD_ROOM} on ${BOARD_DATE}, dropped: ${unmatched.join(" | ")}`
    );
  }

  return sessions;
}
