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
export type ColumnDef = { label: string; match: RegExp };

export const BRELLA_STAGES: ColumnDef[] = [
  { label: "BBQ Stage", match: /^bbq stage/i },
  { label: "Founder Stage", match: /^founders? stage/i },
  { label: "Tech Stage", match: /^tech stage/i },
  { label: "Campfire Stage", match: /campfire/i },
  { label: "Life Science x Deep Tech Stage", match: /life science/i },
];

// THE EVENT ROOMS, on a clock like the stages (Auri, 2026-08-06).
//
// They were a card list, which reads as "a pile of things happening in rooms" and loses the one
// fact a visitor needs: a room is a PLACE, and at 14:00 exactly one thing is on in it. On a
// timeline the shape of the day is the information — Event Room 2 runs eleven short talks
// back-to-back while Event Room 3 is one five-hour block, and you can see that without reading
// a single time.
//
// Explicit, like BRELLA_STAGES and for the same reason: a room with nothing scheduled should
// show as a visibly empty column rather than silently not exist. Rooms 3 and 4 carry one
// session each today and would otherwise appear and disappear day to day.
//
// The Policy Stage is a room despite its name — it IS Rooms 5, 6 and 7 knocked together — so it
// gets a column here rather than on the stages board, where it matched no stage regex and was
// being dropped from the timeline entirely.
/** Rooms 5, 6 and 7 are booked as one space and signed as one. Named once, used twice. */
export const ROOM_567 = "Event Room 5,6,7";

export const BRELLA_ROOMS: ColumnDef[] = [
  { label: "Event Room 1", match: /^event room 1\b/i },
  { label: "Event Room 2", match: /^event room 2\b/i },
  { label: "Event Room 3", match: /^event room 3\b/i },
  { label: "Event Room 4", match: /^event room 4\b/i },
  // The lookahead matters: without it this also swallows "Event Room 5,6,7", which columnOf
  // resolves first-match-wins — so the combined space would land in the Room 5 column and its
  // own column would sit permanently empty.
  { label: "Event Room 5", match: /^event room 5\b(?!\s*,)/i },
  // Real this year and not in Brella yet — Deep Tech Event Day is going in here (Auri,
  // 2026-08-06). Declared now so it shows as an empty column with "Information coming soon"
  // rather than appearing out of nowhere the day the track is created.
  { label: "Event Room 6", match: /^event room 6\b/i },
  { label: ROOM_567, match: /policy stage|rooms?\s*5\s*,?\s*6\s*,?\s*7|^event room 5\s*,/i },
];

// The Grill Sessions, in signage order rather than alphabetical. They run on a clock in
// parallel exactly like the stages, so they get the same timeline treatment.
export const BRELLA_GRILLS: ColumnDef[] = [
  { label: "Green Grill Session", match: /green grill/i },
  { label: "Blue Grill Session", match: /blue grill/i },
  { label: "Orange Grill Session", match: /orange grill/i },
];

/** Which column of `set` a track belongs to, or null when it is in none of them. */
export function columnOf(room: string, set: ColumnDef[]): string | null {
  const hit = set.find((s) => s.match.test(room));
  return hit ? hit.label : null;
}

/** The stage a track belongs to, or null when it is not one of the five. */
export function stageOf(room: string): string | null {
  return columnOf(room, BRELLA_STAGES);
}

/** The sections drawn as a timeline, and the columns each one uses. */
export const TIMELINE_COLUMNS: Partial<Record<BrellaSection, ColumnDef[]>> = {
  stages: BRELLA_STAGES,
  rooms: BRELLA_ROOMS,
  grills: BRELLA_GRILLS,
};

/** "Life Science x Deep Tech Stage" → "life-science-x-deep-tech-stage". */
export function columnSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find one timeline column by label or slug, and say which section it lives in.
 *
 * For the single-column embeds: /api/embed?kind=brella&stage=life-science has to resolve to the
 * Life Science column without the caller having to spell out "Life Science x Deep Tech Stage"
 * and url-encode it. A PREFIX match on the slug is deliberate — "life-science" should find the
 * column whose full slug is much longer, because that is what a human will type.
 *
 * Returns null rather than guessing when nothing matches, so a typo yields a 400 instead of a
 * snippet quietly showing the wrong stage.
 */
export function findTimelineColumn(
  q: string | null | undefined
): { section: BrellaSection; column: ColumnDef } | null {
  if (!q) return null;
  const want = columnSlug(q);
  if (!want) return null;
  for (const key of Object.keys(TIMELINE_COLUMNS) as BrellaSection[]) {
    for (const column of TIMELINE_COLUMNS[key] ?? []) {
      const slug = columnSlug(column.label);
      if (slug === want || slug.startsWith(want)) return { section: key, column };
    }
  }
  return null;
}

// Brella's day strings carry no year ("25 August"), and a weekday cannot be derived without
// one. The event year is a fixed fact about this deployment, unlike "today", which must never
// be a constant.
export const EVENT_YEAR = 2026;

/** "Day 1 · 25 August" → "TUE 25 AUG", for the Side Events day picker. */
export function weekdayLabel(day: string): string {
  const m = /(\d{1,2})\s+([A-Za-z]+)/.exec(day);
  if (!m) return day.toUpperCase();
  const month = new Date(`${m[2]} 1, ${EVENT_YEAR}`).getMonth();
  const d = new Date(EVENT_YEAR, month, Number(m[1]));
  const wd = d.toLocaleDateString("en-GB", { weekday: "short" });
  return `${wd.toUpperCase()} ${m[1]} ${m[2].slice(0, 3).toUpperCase()}`;
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
/**
 * Brella track name → the room it actually runs in.
 *
 * Brella gives a named programme its own track even when it occupies one of the numbered
 * event rooms, so the Event Rooms tab ended up listing both "Event Room 1" and "Future of
 * FinTech" as if they were different places. Auri's call: fold them into the room, so the tab
 * lists rooms and nothing else.
 *
 * Applied in lib/brellaprogram.ts as the session is built, so every consumer — page, API
 * route and embed — sees the same room name and cannot disagree about it.
 */
// BOTH SUMMITS RUN IN EVENT ROOM 2 (Auri, 2026-08-04). Nordic India was mapped to Event Room 4
// here, which was simply the wrong room — Brella's own track is called "Nordic India Startup
// Summit" and carries no room number, so this table is the only thing that decides, and nothing
// upstream contradicts it. It also brings the program in line with /api/all-speakers, which has
// tagged both summits as Event Room 2 all along.
//
// The two do not collide: India runs 26 August, Africa 27 August, so Event Room 2 lists twelve
// sessions across two days rather than two things at once. Event Room 4 keeps the one session
// that is genuinely in it.
//
// Nordic Africa has no track of its own in Brella yet — its sessions already sit on the "Event
// Room 2" track — so its rule is future-proofing: the day someone gives it a named track, it
// lands in the right room instead of defaulting to Stages.
// ONE TABLE, TWO JOBS. It decides which room a named programme runs in AND supplies the
// programme labels printed under that room's column heading.
//
// Folding the programme into the room was right — the tab lists PLACES, and "Future of
// Fintech" is not a place — but on its own it threw away the more interesting half of the
// fact. A visitor looking at Event Room 2 wants to know it is NISS and NASS in there; the
// room number alone tells them nothing (Auri, 2026-08-06). So the label survives the fold.
//
// Keeping both in one table is the point: a programme cannot move room without its label
// moving with it, which is exactly the drift that put Future of Fintech in Event Room 1.
const ROOM_ALIASES: { re: RegExp; room: string; programme: string }[] = [
  // Event Room 3, corrected 2026-08-06 — it was filed under Event Room 1, which is wrong.
  { re: /future of fintech/i, room: "Event Room 3", programme: "Future of Fintech" },
  { re: /nordic\s+india|india\s+summit|\bniss\b/i, room: "Event Room 2", programme: "Nordic India Startup Summit" },
  { re: /nordic\s+africa|africa\s+summit|\bnass\b/i, room: "Event Room 2", programme: "Nordic Africa Startup Summit" },
  // Rooms 5, 6 and 7 opened up are ONE space with one name, not three rooms — so the column
  // is called after the space and the Policy Stage is the programme running in it.
  { re: /policy stage/i, room: ROOM_567, programme: "Policy Stage" },
  // Not in Brella yet. Matched now so it lands in Room 6 with its label the day it appears,
  // rather than defaulting to Stages — the same future-proofing Nordic Africa has. Specific
  // enough not to catch "Life Science x Deep Tech Stage".
  { re: /deep tech event day/i, room: "Event Room 6", programme: "Deep Tech Event Day" },
];

export function roomAlias(room: string): string {
  for (const a of ROOM_ALIASES) if (a.re.test(room)) return a.room;
  return room;
}

/**
 * The programme a Brella TRACK belongs to, or null when the track is just a room.
 *
 * This is what the label should come from, not the room. roomProgrammes() below lists every
 * programme REGISTERED to a room, which is a different question: Event Room 2 is registered to
 * both NISS and NASS, but NASS has no track in Brella and no sessions, so a heading built from
 * the registration said "NISS · NASS" for a room where only NISS is running (Auri, 2026-08-06).
 * Carried on the session by lib/brellaprogram.ts so the page can name what is actually there.
 */
// A PROGRAMME WITH NO TRACK OF ITS OWN, identified by the room and the day instead.
//
// Nordic Africa Startup Summit takes Event Room 2 on the 27th, but Brella has no NASS track —
// its sessions sit on the plain "Event Room 2" track, indistinguishable from any other booking
// in that room. Nothing in the session can say which summit it belongs to, so the room and the
// date have to (Auri, 2026-08-06).
//
// Matched on the DATE, never on Brella's "Day N": that numbering is derived from whichever
// dates exist in the feed and shifted by one the last time a test row was deleted.
//
// Delete an entry the day its programme gets a real track — programmeOf() wins over this, so a
// stale entry would be harmless but misleading.
const ROOM_DAY_PROGRAMMES: { room: string; date: string; programme: string }[] = [
  { room: "Event Room 2", date: "27 August", programme: "Nordic Africa Startup Summit" },
];

/** The programme running in a room on a given day, when only the room and date can say. */
export function dayProgrammeOf(room: string, day: string): string | null {
  const hit = ROOM_DAY_PROGRAMMES.find((r) => r.room === room && day.includes(r.date));
  return hit ? hit.programme : null;
}

export function programmeOf(track: string): string | null {
  for (const a of ROOM_ALIASES) if (a.re.test(track)) return a.programme;
  return null;
}

/**
 * Every programme REGISTERED to a room, whether or not it has sessions.
 *
 * Only for the case where nothing is scheduled yet and the registration is all there is — an
 * empty Event Room 6 can still say Deep Tech Event Day is coming. Anywhere sessions exist,
 * prefer the programmes those sessions actually carry.
 */
export function roomProgrammes(roomLabel: string): string[] {
  return ROOM_ALIASES.filter((a) => a.room === roomLabel).map((a) => a.programme);
}

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
  // "Policy Stage (Rooms 5,6,7)" is named a stage and is not one — it is three event rooms
  // opened up. It matched no BRELLA_STAGES regex, so under "stages" it was filtered off the
  // timeline and appeared nowhere at all. Checked BEFORE the stages fallback below.
  if (/policy stage/i.test(room)) return "rooms";
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

// ─── MORNING TO EVENING ─────────────────────────────────────────────────────────────────
// A booking that opens in the morning and is still going in the evening has taken the room for
// the day (Auri, 2026-08-06). Both ends, not a duration: Nordic IPO runs 12:30-17:30 to the
// close but starts after lunch, and calling an afternoon workshop "all day" overstates it.
//
// Here rather than in lib/brellaprogram.ts because BOTH sides need it. The feed applies it to a
// single session to decide its timeSlot; the page applies it to a room's whole day, to decide
// whether its named programme gets a band. brellaprogram imports these.
export const MORNING_BY_MIN = 11 * 60;
export const EVENING_FROM_MIN = 16 * 60;

/** Did this span open in the morning and run into the evening? */
export function spansMorningToEvening(startMin: number, endMin: number): boolean {
  return startMin <= MORNING_BY_MIN && endMin >= EVENING_FROM_MIN;
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
/**
 * The long form, for the dialog: "Day 1 (26 August)".
 *
 * brellaDayLabel() is the compact SHOUTED version the tabs and day headings use ("DAY 1, 26
 * AUG"); a dialog is reading material and gets the month spelled out in sentence case. Both
 * derive the number from EVENT_DAYS, so neither can drift from TechBBQ's numbering — and
 * neither ever surfaces Brella's own "Day N", which counts whatever dates happen to be in the
 * feed and shifted by one mid-build when a test row was deleted.
 *
 * Falls back to the raw Brella string with its "Day N · " prefix stripped, so a session on an
 * unlisted date (the 25 August side events) still prints something true.
 */
export function brellaDayLong(day: string): string {
  const known = EVENT_DAYS.find((d) => day.includes(d.date));
  if (known) {
    // "DAY 1" → "Day 1". The constant is upper-case because that is how the tabs want it.
    const n = known.label.replace(/^DAY\s*/i, "");
    return `Day ${n} (${known.date})`;
  }
  return day.replace(/^Day\s+\d+\s*·\s*/i, "").trim() || day;
}

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
 *
 * `s.section`, when present, WINS over the name test. The Side Events now come from Airtable
 * (lib/sideEvents.ts) where `room` is the hosting partner — "Rockstart", "Google" — and
 * sectionOf() would read those as stage tracks and drop them into the timeline. A session that
 * knows its own section says so instead of being guessed at from a string.
 */
export function inBrellaSection(
  s: { room: string; day: string; section?: BrellaSection },
  section: BrellaSection
): boolean {
  if (sectionKeyOf(s) !== section) return false;
  return section !== "stages" || isStageDay(s.day);
}

/**
 * Which section a SESSION belongs to: what it declares, or the track name as a fallback.
 *
 * Use this rather than sectionOf(s.room) whenever a session object is in hand. Reading the
 * name directly is what left the Airtable-sourced Side Events counted under Stages while
 * inBrellaSection refused to show them there, so the Side Events heading read 0.
 */
export function sectionKeyOf(s: { room: string; section?: BrellaSection }): BrellaSection {
  return s.section ?? sectionOf(s.room);
}
