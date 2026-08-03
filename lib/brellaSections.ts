// How the flat Brella track list is split into the three sections the /brella-program page
// and its embeds show. Pure functions, no env and no imports, so the page (client), the API
// route (server) and the embed builder can all share ONE copy.
//
// They must share it. The page filters client-side because it needs per-section counts for
// the headings, the route filters server-side so an embed can request one section, and a
// second copy of these rules would drift the moment a track is renamed in Brella.

export type BrellaSection = "stages" | "rooms" | "side";

export const BRELLA_SECTIONS: { key: BrellaSection; label: string }[] = [
  { key: "stages", label: "Stages" },
  { key: "rooms", label: "Event Rooms" },
  { key: "side", label: "Side Events" },
];

export function isBrellaSection(v: string | null): v is BrellaSection {
  return v === "stages" || v === "rooms" || v === "side";
}

/**
 * Which section a Brella track belongs to.
 *
 * Brella has no grouping of its own — `room` is one flat list of track names — so the split
 * is derived from the names. Anything that is neither an event room nor the side-event track
 * is a stage, and that default is deliberate: a track added in Brella tomorrow shows up under
 * Stages rather than disappearing from the page entirely.
 */
// Named summits that run INSIDE an event room. Brella gives them their own track rather than
// filing them under "Event Room N", so on the name alone they would default to Stages — which
// is wrong: Auri's call is that these are event rooms, not stage programming. Nordic Africa has
// no track in Brella yet (only Nordic India does); it is matched now so it lands in the right
// section the day it appears rather than quietly showing up under Stages.
const ROOM_SUMMITS = /nordic\s+(india|africa)|(india|africa)\s+summit/i;

export function sectionOf(room: string): BrellaSection {
  if (/^side event/i.test(room)) return "side";
  // "Event Room 3" and "Rooms 5,6,7" are both room tracks.
  if (/^(event room|rooms?\b)/i.test(room)) return "rooms";
  if (ROOM_SUMMITS.test(room)) return "rooms";
  return "stages";
}

// Auri: Stages is the conference floor, which runs 26-27 August only. Brella's timeslots also
// cover the 24th and 25th (a leftover test row, plus the Day 0 side events), and those are not
// stage programming.
//
// Matched on the DATE, not on Brella's "Day N" numbering: that numbering is derived from
// whichever dates happen to exist in the feed, so deleting the 24 August test row would
// silently renumber every other day. The date does not move.
//
// THE EVENT DAYS. 26 August is Day 1 and 27 August is Day 2 — that is the numbering TechBBQ
// uses and the one on the signage. Brella's own "Day N" is NOT that: it numbers whichever
// dates happen to exist in the feed, so its Day 1 was 24 August until someone deleted a test
// row mid-build, after which every day silently shifted by one. Never surface Brella's number.
export const EVENT_DAYS: { date: string; label: string }[] = [
  { date: "26 August", label: "DAY 1" },
  { date: "27 August", label: "DAY 2" },
];

export function isStageDay(day: string): boolean {
  return EVENT_DAYS.some((d) => day.includes(d.date));
}

/**
 * Brella's "Day 3 · 27 August" → "DAY 2, 27 AUG", using the event-day numbering above.
 *
 * A date that is not an event day (the 25th, which carries Day 0 side events) gets the date
 * with NO day number: inventing a "Day 0" would put a label on the signage that nobody uses,
 * and reusing Brella's number would contradict the two real days sitting right below it.
 */
export function brellaDayLabel(day: string): string {
  const known = EVENT_DAYS.find((d) => day.includes(d.date));
  const m = /(\d+)\s+(\w{3})/.exec(day); // "27 August" → "27", "Aug"
  const date = m ? `${m[1]} ${m[2].toUpperCase()}` : day.toUpperCase();
  return known ? `${known.label}, ${date}` : date;
}

/**
 * Does this session belong in `section`?
 *
 * Only Stages gets the date restriction. Side Events genuinely run on the 25th and must keep
 * showing, which is why the rule lives here rather than being applied to the whole feed.
 */
export function inBrellaSection(
  s: { room: string; day: string },
  section: BrellaSection
): boolean {
  if (sectionOf(s.room) !== section) return false;
  return section !== "stages" || isStageDay(s.day);
}
