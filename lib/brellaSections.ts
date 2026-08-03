// How the flat Brella track list is split into the three sections the /brella-program page
// and its embeds show. Pure functions, no env and no imports, so the page (client), the API
// route (server) and the embed builder can all share ONE copy.
//
// They must share it. The page filters client-side because it needs per-section counts for
// the headings, the route filters server-side so an embed can request one section, and a
// second copy of these rules would drift the moment a track is renamed in Brella.

export type BrellaSection = "stages" | "rooms" | "grills" | "side";

export const BRELLA_SECTIONS: { key: BrellaSection; label: string }[] = [
  { key: "stages", label: "Stages" },
  { key: "rooms", label: "Event Rooms" },
  { key: "grills", label: "Grill Sessions" },
  { key: "side", label: "Side Events" },
];

export function isBrellaSection(v: string | null): v is BrellaSection {
  return v === "stages" || v === "rooms" || v === "grills" || v === "side";
}

/**
 * The five stages, in the order TechBBQ lists them.
 *
 * This is an EXPLICIT list rather than whatever tracks happen to carry sessions, for one
 * reason: Campfire Stage is a real Brella track (id 43281) with nothing scheduled on it yet.
 * Derived from the data it would simply not exist, and would then appear without warning the
 * day someone adds a session. Naming it here gives it a column that is visibly empty instead.
 *
 * `match` exists because Brella's track name and the public stage name are not always the same
 * ("Founders Stage" on the signage is "Founder Stage" in Auri's list).
 */
export const BRELLA_STAGES: { label: string; match: RegExp }[] = [
  { label: "BBQ Stage", match: /^bbq stage/i },
  { label: "Tech Stage", match: /^tech stage/i },
  { label: "Campfire Stage", match: /campfire/i },
  { label: "Founder Stage", match: /^founders? stage/i },
  { label: "Life Science x Deep Tech Stage", match: /life science/i },
];

/** The stage a track belongs to, or null when it is not one of the five. */
export function stageOf(room: string): string | null {
  const hit = BRELLA_STAGES.find((s) => s.match.test(room));
  return hit ? hit.label : null;
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

// The Grill Sessions get their own tab (Auri's call). They are roundtables, not stage
// programming, and three tracks of them under Stages drowned the five real stages.
const GRILLS = /grill session/i;

// Future of FinTech runs IN Event Room 1, so it files under Event Rooms. Its own name is kept
// rather than being rewritten to "Event Room 1": that is a separate Brella track with its own
// sessions, and merging the two would hide which is which.
const ROOM_PROGRAMMES = /future of fintech/i;

export function sectionOf(room: string): BrellaSection {
  if (/^side event/i.test(room)) return "side";
  if (GRILLS.test(room)) return "grills";
  // "Event Room 3" and "Rooms 5,6,7" are both room tracks.
  if (/^(event room|rooms?\b)/i.test(room)) return "rooms";
  if (ROOM_SUMMITS.test(room)) return "rooms";
  if (ROOM_PROGRAMMES.test(room)) return "rooms";
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
export const EVENT_DAYS: { date: string; label: string; monthDay: [number, number] }[] = [
  { date: "26 August", label: "DAY 1", monthDay: [7, 26] }, // month is 0-based: 7 = August
  { date: "27 August", label: "DAY 2", monthDay: [7, 27] },
];

/**
 * Which day the program should open on: Day 2 once it is actually the 27th, Day 1 otherwise.
 *
 * `now` is injected rather than read here so this stays a pure function — the caller passes
 * `new Date()`. Never compute "today" at module scope: a value captured once at first render
 * is wrong for anyone who leaves the page open overnight, and on a static build it would be
 * frozen at BUILD time, which is the bug that bit the AI Workshop dashboard.
 */
export function defaultEventDay(now: Date): number {
  const [m, d] = EVENT_DAYS[1].monthDay;
  return now.getMonth() === m && now.getDate() >= d ? 1 : 0;
}

/** "09:30 - 10:00" → {start: 570, end: 600} in minutes. null for "All day" and junk. */
export function parseSlot(slot: string): { start: number; end: number } | null {
  const m = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/.exec(slot || "");
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  let end = Number(m[3]) * 60 + Number(m[4]);
  // A slot that ends before it starts has crossed midnight. Nothing on the stages does, but
  // an unguarded negative height would collapse the card to nothing rather than look wrong.
  if (end <= start) end = start + 30;
  return { start, end };
}

/** The timeline always opens at 09:00, whatever the first session is. Auri's spec. */
export const DAY_START_MIN = 9 * 60;

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
