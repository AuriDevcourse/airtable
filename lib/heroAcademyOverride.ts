// HERO ACADEMY AND THE FOUNDERS BBQ, Event Room 1, the morning of 26 August.
//
// ─── AN INSERT, NOT A PAIRING AND NOT A SUBSTITUTION ────────────────────────────────────
// The other overrides on this board all start from a Brella row and either fill its gaps
// (lib/overlayEnrich.ts) or replace it (lib/longevityOverride.ts). This one has nothing to start
// from: Brella's Event Room 1 on the 26th carries exactly ONE session, "Beyond Unicorns"
// 13:30-17:30, so the entire morning renders as an empty room. Both of these sessions are
// appended to the feed outright (Auri, 2026-08-24).
//
// THE ATTENDEE APP DOES NOT HAVE THEM. This reaches /brella-program, the pasted embeds and
// /api/program?event=brella. Anyone reading Brella still sees an empty morning, so the two
// sessions want creating in the Brella admin as well — and when they are, DELETE THIS FILE
// rather than leaving both copies to render side by side. wouldDuplicate() below is a guard
// against exactly that, not a licence to leave it in place.
//
// ─── WHY THE ROOM IS DECLARED HERE AND NOT READ FROM AIRTABLE ───────────────────────────
// The Sessions table's `Event Room` cell says "Event Room 1", but the board's rooms come from
// Brella track names via roomAlias(), and the two only happen to agree today. The room, the date
// and the day label are taken from the Brella sessions ALREADY in that room instead, so these
// rows land in the same column the board is already drawing rather than creating a second one
// that merely looks the same.

import type { ProgramSession } from "@/lib/program";
import { toSpeaker } from "@/lib/stagePeople";
import { dayDate } from "@/lib/overlayEnrich";
import { parseSlot } from "@/lib/brellaSections";

/** The Brella room these belong in, matched after roomAlias() has folded the track. */
const ROOM = "Event Room 1";

/** The one day. Written as a date, never Brella's "Day N" — see lib/nassOverride.ts for why. */
const DATE = "26 august";

/** The Sessions table's own day cell, which is all that scopes these rows to the 26th. */
const DAY_CELL = "Day 1";

/**
 * INVITE ONLY, and it has to be declared here.
 *
 * The Sessions table has no field for it — `access` exists on ProgramSession for the Side Events,
 * which come from a different table with an `Event type` cell. The renderer already prints the
 * note for any session carrying it (components/ProgramTimeline.tsx), so the only missing piece is
 * saying which of these two it applies to.
 */
const INVITE_ONLY = new Set(["founders bbq"]);

const fold = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Append the Hero Academy morning to Brella's Event Room 1.
 *
 * An empty source leaves the board exactly as it is, which is the safe failure everywhere else in
 * this repo: a room with one afternoon session beats a room that fails to render.
 */
export function mergeHeroAcademy(
  brella: ProgramSession[],
  hero: ProgramSession[]
): ProgramSession[] {
  if (!hero.length) return brella;

  const inRoom = brella.filter((s) => s.room === ROOM && dayDate(s.day) === DATE);
  // No Brella column for that room and day means no day label to borrow and nothing to sit
  // beside. Better to add nothing than to invent a column.
  if (!inRoom.length) return brella;

  const { day, location } = inRoom[0];

  // A session Brella has since gained at the same start time is Brella's to render, not ours.
  // Cheap insurance against this file outliving its reason to exist.
  const taken = new Set(
    inRoom.map((s) => parseSlot(s.timeSlot)?.start).filter((n): n is number => n !== null)
  );

  const added: ProgramSession[] = [];
  for (const s of hero) {
    if (s.day.trim() !== DAY_CELL) continue;
    const start = parseSlot(s.timeSlot)?.start ?? null;
    if (start !== null && taken.has(start)) continue;

    const mods = s.onStage?.moderators ?? [];
    const spks = s.onStage?.speakers ?? [];
    added.push({
      ...s,
      day,
      room: ROOM,
      timeSlot: s.timeSlot.trim(),
      ...(location ? { location } : {}),
      ...(INVITE_ONLY.has(fold(s.name)) ? { access: "private-invite" as const } : {}),
      speakers: [
        ...mods.map((p, i) => toSpeaker(p, s.id, "Moderator", i)),
        ...spks.map((p, i) => toSpeaker(p, s.id, "Speaker", i)),
      ],
    });
  }

  return added.length ? [...brella, ...added] : brella;
}
