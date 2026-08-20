// The Policy Stage column on the Brella board comes from AIRTABLE, not Brella.
//
// TEMPORARY, AND DELIBERATELY EASY TO DELETE (Auri, 2026-08-07: "overwrite it just for policy
// stage until I tell otherwise"). When Brella's own Policy Stage entry is filled in properly,
// remove the mergePolicyStage() call in app/api/program/route.ts and this file goes with it.
//
// HALFWAY THERE, 2026-08-20. Brella is now the source of truth for this board, so this file no
// longer overwrites anything: it fills the speakers into Brella's own Policy Stage rows and drops
// any Airtable session Brella has no slot for. Watch the [policyOverride] warning in the server log:
// the day it reports 0 dropped and 0 enriched, Brella has the stage in full and this file can go.
//
// ─── WHAT WAS WRONG ─────────────────────────────────────────────────────────────────────
// Brella carries the entire Policy Stage as ONE all-day row — "Policy Stage: Shaping the Future
// of European Startups", 28 speakers attached to it in a single heap. On a timeline that is the
// worst possible shape: a column with one block in it says the stage runs all day and tells a
// visitor nothing about what is on at 11:00 or who is speaking at it.
//
// The real programme exists, in the purpose-built Sessions table (tblSlpTzDi2oVYwqv, view "The
// Policy Stage"): 15 sessions with times, types, descriptions, and speakers and moderators named
// per session. It is already served at /api/program?event=policy and rendered by the agenda
// embed. Only the Brella board could not see it.
//
// SUPERSEDED, 2026-08-20. Brella's own timed rows for this stage now exist, so the Airtable copy no
// longer takes the column: BRELLA IS THE SOURCE OF TRUTH and Airtable fills only what Brella leaves
// empty. The rule is in lib/overlayEnrich.ts. Brella's all-day umbrella row is Brella's own and now
// stays. It never pairs with anything, because an all-day slot has no start time to pair on.
//
// ─── THE DAY IS PINNED HERE, AND IT HAD TO BE ASKED ─────────────────────────────────────
// The Sessions table has NO date column — only `Time Slot` — because it was typed up from a
// single-day PDF. The two available answers disagreed: the agenda embed pasted on techbbq.dk
// says "August 26th", while Brella files the all-day block on 27 August. Auri settled it on
// 2026-08-07: **27 August**, so Brella's placement was right and the embed's heading is the
// thing that is wrong. Fix that in the embed, not here.
//
// Written as a DATE and not as the board's "Day N" string. The label is derived from whichever
// dates are in the Brella feed, so it renumbers itself and matching on it is what produced the
// duplicate sessions in the other two rooms. lib/overlayEnrich.ts reads the date out of the label.
import type { ProgramSession } from "@/lib/program";
import { programmeOf, ROOM_567 } from "@/lib/brellaSections";
import { sessionProgramme } from "@/lib/sessionProgrammes";
// Moved out when the Nordic Africa substitution needed the same mapping. See lib/stagePeople.ts.
import { toSpeaker } from "@/lib/stagePeople";
import { enrichWithOverlay } from "@/lib/overlayEnrich";

/**
 * "Policy Stage", taken from ROOM_ALIASES rather than typed again here.
 *
 * IT IS WHAT PUTS THE ALL-DAY BAND BACK. Brella's all-day row used to be the thing telling the
 * board that this column is a whole-day programme called the Policy Stage; dropping it took the
 * band and the column's sub-label with it (Auri, 2026-08-07: "it misses still to indicate that
 * it's a whole day event and it's like the policy stage").
 *
 * The board already derives that band for exactly this case — NISS holds Event Room 2 all day
 * through eleven sessions and no umbrella row — and the trigger is `programme` being set on the
 * sessions themselves. So the band is EARNED from the real programme rather than restored by
 * putting a fake all-day session back: the sessions span 09:30 to 17:00, which clears the
 * morning-to-evening test, and they carry the name.
 *
 * Sourced from programmeOf() so a rename in ROOM_ALIASES moves this with it. That table already
 * says /policy stage/i lives in ROOM_567, which is the same fact this file depends on.
 */
const POLICY_PROGRAMME = programmeOf("Policy Stage") ?? "Policy Stage";

/** The DATE the Policy Stage runs, never Brella's "Day N". Auri, 2026-08-07. */
export const POLICY_DATE = "27 August";

/**
 * The Policy Stage's own PDF (Auri uploaded it on 2026-08-19), resolved through
 * lib/sessionProgrammes.ts so the URL lives in one file and a re-upload is one edit.
 *
 * STILL ATTACHED HERE, now that Brella's rows are the ones being published: sessionProgramme() is
 * keyed on the session TITLE, and the individual Policy Stage rows are not titled "Policy Stage", so
 * only the umbrella row would ever have matched it. Applied to the whole room, breaks included.
 */
const POLICY_DOC = sessionProgramme(POLICY_PROGRAMME);

/**
 * Fill the gaps in Brella's Policy Stage column from the Airtable programme.
 *
 * BRELLA WINS ON EVERY FACT IT HAS: titles, times, room, location. Airtable supplies the speakers
 * and moderators named per session, which is what Brella heaps onto one umbrella row instead.
 *
 * MODERATORS FIRST, matching the agenda embed: they open the session, and on a panel of four
 * the reader wants to know who is steering before who is talking.
 *
 * A policy source that returns nothing leaves Brella's own sessions alone.
 */
export function mergePolicyStage(
  brella: ProgramSession[],
  policy: ProgramSession[]
): ProgramSession[] {
  if (!policy.length) return brella;

  const overlay: ProgramSession[] = policy.map((s) => {
    const mods = s.onStage?.moderators ?? [];
    const spks = s.onStage?.speakers ?? [];
    return {
      ...s,
      // parseSlot() accepts the en dash the Sessions table uses, so the slot needs no rewriting,
      // only the trailing spaces some cells carry. Read for PAIRING now, not published.
      timeSlot: s.timeSlot.trim(),
      speakers: [
        ...mods.map((p, i) => toSpeaker(p, s.id, "Moderator", i)),
        ...spks.map((p, i) => toSpeaker(p, s.id, "Speaker", i)),
      ],
    };
  });

  const { sessions, unmatched, enriched } = enrichWithOverlay(brella, overlay, {
    // Rooms 5, 6 and 7 are one space and one column. Naming it via the shared constant keeps
    // this and the column definition from drifting apart.
    room: ROOM_567,
    date: POLICY_DATE,
    // Names the column's sub-label AND earns the dotted whole-day band. See POLICY_PROGRAMME.
    programme: POLICY_PROGRAMME,
    ...(POLICY_DOC ? { programmeUrl: POLICY_DOC } : {}),
  });

  // THIS IS THE LINE THAT SAYS WHEN THIS FILE CAN BE DELETED. 0 dropped and 0 enriched means Brella
  // carries the stage in full, with its speakers, and the override has nothing left to add.
  if (unmatched.length) {
    console.warn(
      `[policyOverride] ${unmatched.length} Airtable session(s) have no Brella slot in ${ROOM_567} on ${POLICY_DATE} (enriched ${enriched}), dropped: ${unmatched.join(" | ")}`
    );
  }

  return sessions;
}
