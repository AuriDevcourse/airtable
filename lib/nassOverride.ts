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
// SUPERSEDED, 2026-08-20. The titles still disagree, but the answer is no longer to let Airtable
// win the whole column: BRELLA IS THE SOURCE OF TRUTH and its title is the one the attendee app
// shows. Airtable now only fills what Brella leaves empty, which for this room is the speakers,
// still the reason this file exists. The rule, and the duplicate-sessions bug that forced the
// change, are in lib/overlayEnrich.ts.
//
// TWO THINGS THAT WERE FIXED BY LETTING AIRTABLE WIN, AND ARE NOW BRELLA'S TO FIX. Brella has no
// 15:35 Investor Reverse Pitch, so that session no longer reaches the board; and Brella carries the
// 16:35 reception TWICE under two names, so the board shows it twice. Both are real Brella data
// problems, and the first is logged by name on every load rather than hidden here.
//
// ─── SCOPED TO ONE DAY, WHICH IS THE WHOLE POINT ────────────────────────────────────────
// Event Room 2 runs TWO summits: Nordic India on the 26th and Nordic Africa on the 27th. NISS is
// still being finalised (its speakers are linked per session in its own table but not yet wired
// through, see progress.md), so this must not touch the 26th. Only sessions on NASS_DATE are
// enriched; Brella's 26 August column is left exactly as it is (Auri, 2026-08-13).
//
// Written as a DATE and not as the board's "Day N" string. The timeline groups on the label, but
// the label is derived from whichever dates are in the feed, so matching on it is what produced the
// duplicates. lib/overlayEnrich.ts takes the date out of the label instead.

import type { ProgramSession } from "@/lib/program";
import { toSpeaker } from "@/lib/stagePeople";
import { enrichWithOverlay } from "@/lib/overlayEnrich";

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
 * The DATE the summit runs, never Brella's "Day N". 27 August, which is what ROOM_DAY_PROGRAMMES
 * in lib/brellaSections.ts already says runs in this room on that date.
 *
 * This was `"Day 3 · 27 August"` and that is what broke it: the 27th became "Day 4" once a
 * 24 August row appeared in Brella, the room-and-day filter stopped matching, and all 21 sessions
 * rendered twice. See dayDate() in lib/overlayEnrich.ts.
 */
export const NASS_DATE = "27 August";

/**
 * Names the column's sub-label and earns the dotted whole-day band, exactly as the Policy Stage
 * does. Kept as the literal that ROOM_DAY_PROGRAMMES uses, so a reader grepping either file finds
 * both. The sessions span 09:00 to 18:05, which clears the morning-to-evening test the band needs.
 */
const NASS_PROGRAMME = "Nordic Africa Startup Summit";

/**
 * Fill the gaps in Brella's 27 August Event Room 2 column from the Airtable NASS programme.
 *
 * BRELLA WINS ON EVERY FACT IT HAS: titles, times, room, location. So the board and the attendee
 * app can no longer print two different names for the same session. Airtable supplies the speakers,
 * which is what Brella's 21 rows in this room still do not name.
 *
 * MODERATORS FIRST, matching the agenda embed: they open the session, and on a panel of four the
 * reader wants to know who is steering before who is talking.
 *
 * A nass source that returns nothing leaves Brella's own sessions alone. Still the safe failure: a
 * column of titles with no speakers beats an empty one, and this runs on every load of a public
 * board.
 */
export function mergeNassStage(
  brella: ProgramSession[],
  nass: ProgramSession[]
): ProgramSession[] {
  if (!nass.length) return brella;

  const overlay: ProgramSession[] = nass
    .filter((s) => !SKIP_ON_BOARD.has(fold(s.name)))
    .map((s) => {
      const mods = s.onStage?.moderators ?? [];
      const spks = s.onStage?.speakers ?? [];
      return {
        ...s,
        // parseSlot() accepts the en dash the Sessions table uses, so the slot needs no rewriting,
        // only the trailing spaces some cells carry. Read for PAIRING now, not published: the board
        // shows Brella's own slot.
        timeSlot: s.timeSlot.trim(),
        speakers: [
          ...mods.map((p, i) => toSpeaker(p, s.id, "Moderator", i)),
          ...spks.map((p, i) => toSpeaker(p, s.id, "Speaker", i)),
        ],
      };
    });

  const { sessions, unmatched } = enrichWithOverlay(brella, overlay, {
    room: NASS_ROOM,
    date: NASS_DATE,
    programme: NASS_PROGRAMME,
  });

  // Named on every load rather than dropped in silence. This is the list of slots Brella is missing
  // (the 15:35 Investor Reverse Pitch among them) and it is meant to be read and fixed in Brella.
  if (unmatched.length) {
    console.warn(
      `[nassOverride] ${unmatched.length} Airtable session(s) have no Brella slot in ${NASS_ROOM} on ${NASS_DATE}, dropped: ${unmatched.join(" | ")}`
    );
  }

  return sessions;
}
