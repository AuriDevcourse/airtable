// The Policy Stage column on the Brella board comes from AIRTABLE, not Brella.
//
// TEMPORARY, AND DELIBERATELY EASY TO DELETE (Auri, 2026-08-07: "overwrite it just for policy
// stage until I tell otherwise"). When Brella's own Policy Stage entry is filled in properly,
// remove the mergePolicyStage() call in app/api/program/route.ts and this file goes with it.
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
// So the column is SUBSTITUTED rather than supplemented: every Brella session in ROOM_567 is
// dropped and the Airtable sessions take their place. Merging the two would leave the all-day
// block sitting behind the real sessions, which is exactly the thing being fixed.
//
// ─── THE DAY IS PINNED HERE, AND IT HAD TO BE ASKED ─────────────────────────────────────
// The Sessions table has NO date column — only `Time Slot` — because it was typed up from a
// single-day PDF. The two available answers disagreed: the agenda embed pasted on techbbq.dk
// says "August 26th", while Brella files the all-day block on 27 August. Auri settled it on
// 2026-08-07: **27 August**, so Brella's placement was right and the embed's heading is the
// thing that is wrong. Fix that in the embed, not here.
//
// Written as the board's own day string rather than a date, because that is what the timeline
// groups on. If the day labels are ever renumbered this constant moves with them.
import type { ProgramPerson, ProgramSession, ProgramSpeaker } from "@/lib/program";
import { ROOM_567 } from "@/lib/brellaSections";

/** The board's day label for the Policy Stage. Auri, 2026-08-07. */
export const POLICY_DAY = "Day 3 · 27 August";

/**
 * One hand-typed person into the shape the board's PersonRow draws.
 *
 * `meta` arrives as "Title, Company" — parsePeople() in lib/program.ts has already taken the
 * name off the front. PersonRow renders title and company as "title · company", so the first
 * comma splits them; a meta with no comma is all title, which is right for "Minister for
 * Taxation" and for a bare company name alike.
 *
 * `bio` is empty because the Sessions table has no bio field. PersonRow already handles that:
 * no bio means a plain row instead of a button that opens nothing.
 */
function toSpeaker(p: ProgramPerson, sessionId: string, role: string, i: number): ProgramSpeaker {
  const comma = p.meta.indexOf(",");
  const title = (comma === -1 ? p.meta : p.meta.slice(0, comma)).trim();
  const company = comma === -1 ? "" : p.meta.slice(comma + 1).trim();
  return {
    // Unique per session, so React keys never collide when one person chairs two panels.
    id: `${sessionId}-${role.toLowerCase()}-${i}`,
    name: p.name,
    title,
    company,
    photo: p.photo,
    bio: "",
    // Drives the badge on the row, and isModerator() styles the moderator's differently.
    role,
  };
}

/**
 * Replace the Brella board's Policy Stage column with the Airtable programme.
 *
 * MODERATORS FIRST, matching the agenda embed: they open the session, and on a panel of four
 * the reader wants to know who is steering before who is talking.
 *
 * A policy source that returns nothing leaves Brella's own sessions alone. That is the safe
 * failure: an all-day block is poor, an empty Policy Stage column is worse, and this runs on
 * every load of a public board.
 */
export function mergePolicyStage(
  brella: ProgramSession[],
  policy: ProgramSession[]
): ProgramSession[] {
  if (!policy.length) return brella;

  const sessions: ProgramSession[] = policy.map((s) => {
    const mods = s.onStage?.moderators ?? [];
    const spks = s.onStage?.speakers ?? [];
    return {
      ...s,
      // Namespaced so an id can never collide with a Brella one ("brella-975878").
      id: `policy-${s.id}`,
      day: POLICY_DAY,
      // Rooms 5, 6 and 7 are one space and one column. Naming it via the shared constant keeps
      // this and the column definition from drifting apart.
      room: ROOM_567,
      // parseSlot() accepts the en dash the Sessions table uses, so the slot needs no rewriting
      // — only the trailing spaces some cells carry.
      timeSlot: s.timeSlot.trim(),
      speakers: [
        ...mods.map((p, i) => toSpeaker(p, s.id, "Moderator", i)),
        ...spks.map((p, i) => toSpeaker(p, s.id, "Speaker", i)),
      ],
    };
  });

  return [...brella.filter((s) => s.room !== ROOM_567), ...sessions];
}
