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
// So the column is SUBSTITUTED, not supplemented: Brella's all-day row is dropped and the Airtable
// sessions take its place. Merging them would leave the all-day block sitting behind the real
// sessions with its own 31-face pile-up — the exact thing being fixed, and the reason the Policy
// Stage does it this way.
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

/** The board's day label for the Board Summit. */
export const BOARD_DAY = "Day 3 · 27 August";

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
 * Replace the Brella board's 27 August Event Room 1 column with the Airtable Board Summit.
 *
 * MODERATORS FIRST, matching the agenda embed and the other two overrides: they open the session,
 * and on a panel of four the reader wants to know who is steering before who is talking.
 *
 * A board source that returns nothing leaves Brella's own row alone. Same safe failure as its two
 * siblings: an all-day block with 31 faces is poor, an empty Event Room 1 is worse, and this runs on
 * every load of a public board.
 */
export function mergeBoardSummit(
  brella: ProgramSession[],
  board: ProgramSession[]
): ProgramSession[] {
  if (!board.length) return brella;

  const sessions: ProgramSession[] = board.map((s) => {
    const mods = s.onStage?.moderators ?? [];
    const spks = s.onStage?.speakers ?? [];
    return {
      ...s,
      // Namespaced so an id can never collide with a Brella one ("brella-975697"), a policy one or
      // a nass one.
      id: `board-${s.id}`,
      day: BOARD_DAY,
      room: BOARD_ROOM,
      programme: BOARD_PROGRAMME,
      // parseSlot() accepts the en dash the Sessions table uses — every Board Summit row has one
      // ("09:30 – 09:45") — so the slot needs no rewriting, only the trailing spaces some cells
      // carry.
      timeSlot: s.timeSlot.trim(),
      speakers: [
        ...mods.map((p, i) => toSpeaker(p, s.id, "Moderator", i)),
        ...spks.map((p, i) => toSpeaker(p, s.id, "Speaker", i)),
      ],
      // On every session, including Check-in and the Networking Break. They are part of the day the
      // document describes, and a visitor who opens the break to find out how long it is has the
      // same right to the programme as one who opens a panel.
      ...(BOARD_DOC ? { programmeUrl: BOARD_DOC } : {}),
    };
  });

  // ONLY this room on THIS day is dropped. Beyond Unicorns holds Event Room 1 on the 26th and keeps
  // its own all-day row, its 17 speakers and its own PDF.
  return [
    ...brella.filter((s) => !(s.room === BOARD_ROOM && s.day === BOARD_DAY)),
    ...sessions,
  ];
}
