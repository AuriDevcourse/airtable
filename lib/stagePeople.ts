// One hand-typed Airtable person into the shape the Brella board's PersonRow draws.
//
// Shared by the two stage substitutions that put an Airtable programme onto the board:
// lib/policyOverride.ts (Policy Stage, Rooms 5-6-7) and lib/nassOverride.ts (Nordic Africa
// Startup Summit, Event Room 2 on the 27th). It lived inside the policy one until the second
// caller arrived; two copies of this would drift the moment either summit's cells are formatted
// differently.

import type { ProgramPerson, ProgramSpeaker } from "@/lib/program";

/**
 * `meta` arrives as "Title, Company" — parsePeople() in lib/program.ts has already taken the name
 * off the front. PersonRow renders title and company as "title · company", so the FIRST comma
 * splits them; a meta with no comma is all title, which is right for "Minister for Taxation" and
 * for a bare company name alike.
 *
 * `bio` is empty because neither Sessions nor the presenter form has a bio field. PersonRow
 * already handles that: no bio means a plain row instead of a button that opens nothing.
 */
export function toSpeaker(
  p: ProgramPerson,
  sessionId: string,
  role: string,
  i: number
): ProgramSpeaker {
  // SPLIT ON " at ", FALLING BACK TO THE FIRST COMMA.
  //
  // Every person line in the Sessions table now reads "Title at Company" (Auri, 2026-08-13), so the
  // word is the boundary and the comma no longer is. Splitting on the comma cut real titles in
  // half — "Minister of Communications, Innovation and Digital Economy at Federal Republic of
  // Nigeria" became a man whose job was "Minister of Communications" at a company called
  // "Innovation and Digital Economy at Federal Republic of Nigeria".
  //
  // The comma fallback stays for anything not yet converted, and for a line that carries only one
  // field. " at " with spaces on both sides, so Attorney-at-Law survives intact.
  const at = p.meta.indexOf(" at ");
  const cut = at === -1 ? p.meta.indexOf(",") : at;
  const skip = at === -1 ? 1 : 4;
  const title = (cut === -1 ? p.meta : p.meta.slice(0, cut)).trim();
  const company = cut === -1 ? "" : p.meta.slice(cut + skip).trim();
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
