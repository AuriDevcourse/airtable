"use client";

/**
 * THE PROGRAM TIMELINE, and the vocabulary it shares with the cards around it.
 *
 * Extracted from app/brella-program/page.tsx so /partner-events can render the SAME Event Rooms
 * board instead of a near-copy of it (Auri, 2026-08-10). Three separate near-copies had already
 * grown between those two pages today — the venue line, the artwork override, the title key — and
 * each one drifted. A timeline is far more state than any of those, so it gets one home.
 *
 * Nothing here fetches. It renders whatever `Session[]` it is handed, so the caller decides
 * whether that came from Brella, from Airtable, or from a merge of both.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyBrellaEmbed } from "@/components/CopyBrellaEmbed";
import {
  BREATHWORK_ICON_PATHS,
  BREATHWORK_LABEL,
  HOST_ICON_PATHS,
  OPENING_ICON_PATHS,
  OPENING_LABEL,
  STAGE_ICON_PATHS,
  isBreathwork,
  isOpening,
  sessionColor,
  sessionColor2,
  trackColor,
  trackColor2,
} from "@/lib/brellaTheme";
import {
  BRELLA_SECTIONS as SECTIONS,
  BRELLA_STAGES,
  DAY_START_MIN,
  TIMELINE_COLUMNS,
  columnOf,
  roomProgrammes,
  spansMorningToEvening,
  type ColumnDef,
  weekdayLabel,
  EVENT_DAYS,
  brellaDayLabel as dayLabel,
  brellaDayLong,
  defaultEventDay,
  inBrellaSection,
  isBrellaSection,
  parseSlot,
  sectionKeyOf,
  stageOf,
  type BrellaSection as SectionKey,
} from "@/lib/brellaSections";
export type Speaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  bio: string;
  role?: string;
};

export type Session = {
  id: string;
  name: string;
  day: string; // "Day 3 · 26 August"
  timeSlot: string; // "09:30 - 10:00", or "All day"
  type: string;
  /** Up to three topic tags. `type` is the first of them; this is the set the filter uses. */
  tags?: string[];
  /** "NISS", "Future of Fintech" — the named programme, where the session belongs to one. */
  programme?: string;
  description: string;
  room: string; // the Brella TRACK — "Founders Stage", "Event Room 3", "Side Event Promotion"
  location?: string; // Brella's venue string, e.g. "Hall E"
  speakers?: Speaker[];
  /** Side events only: the partner's event artwork from their ticketing page (lib/eventPages.ts). */
  image?: string | null;
  // Side Events only, and only because that section comes from Airtable (lib/sideEvents.ts).
  // Brella's API sends the words "LINK TO REGISTER" with no URL behind them.
  registerUrl?: string | null;
  // Set by the feed on the Airtable-sourced Side Events, whose `room` is the hosting partner
  // and would be read as a stage track otherwise. inBrellaSection() prefers it over the name.
  section?: SectionKey;
  // "25 August" — what goes where the time goes when a side event has no time yet.
  dateLabel?: string;
  // Side events only. See the note below for why the copy hedges between the two mechanisms.
  access?: "public" | "private-invite";
};

// Airtable's `Event type` has exactly two options, "Public Event" and "Private Event (invite
// only)", so it cannot tell an invitation from an approval queue. The Luma pages behind the
// private ones show "Request to Join · Approval Required" (checked 2026-08-04), so the label is
// stricter than reality, and one private event uses Google RSVP where the mechanism is unknown.
// This copy therefore covers both and claims neither. What matters to a visitor is the same
// either way: you cannot simply turn up.
export const PRIVATE_NOTE = "Private event · you need an invitation or the host's approval to attend";

/**
 * What to print in the time slot. A side event whose partner has not filled in a time shows
 * its DATE rather than "Time TBC": the date is real information, the placeholder is not.
 */
export function timeLabel(s: Session): string {
  return s.timeSlot || s.dateLabel || "Time TBC";
}

/** The custom properties every card/tile sets, so the gradient logic lives in one place. */
function trackVars(room: string): React.CSSProperties {
  const two = trackColor2(room);
  return { "--track": trackColor(room), ...(two ? { "--track2": two } : {}) } as React.CSSProperties;
}

/**
 * The same thing for a SESSION, which may declare its section. Side Events must use it: their
 * `room` is the hosting partner, so the name-matched rules would paint them the orange default
 * instead of red.
 */
export function sessionVars(s: Session): React.CSSProperties {
  const two = sessionColor2(s);
  return { "--track": sessionColor(s), ...(two ? { "--track2": two } : {}) } as React.CSSProperties;
}

// ─── SPEAKER SEARCH ─────────────────────────────────────────────────────────────────────
// Type a speaker's name and every session they are NOT in dims. A filter was the obvious
// alternative and is the wrong tool: on the timeline, removing the other cards collapses the
// columns and the clock stops being readable, so you lose the one thing the view is for. Dimming
// keeps the whole board and its geometry intact and just answers "where is this person today".
//
// Matched on the speaker's name, plus their company and title — searching "Nordea" to find the
// Nordea speaker is the same question asked from the other end, and the data is already on the
// card. The session NAME is deliberately not searched: "opening" would then light up ten cards
// that have no speaker in common, which is not what this box is for.
export function normalise(v: string): string {
  return v
    .toLowerCase()
    // "Jose" should find "José". Strips the accents rather than requiring the visitor to type
    // them, which on a Danish keyboard is a real barrier for the Nordic names in this schedule.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Every term must hit SOMETHING, so "maria nordea" narrows rather than widens — the alternative
 * (any term matches) means adding a word to a search returns more results, which is backwards.
 */
export function matchesSpeaker(s: Session, terms: string[]): boolean {
  if (!terms.length) return true;
  const hay = normalise(
    (s.speakers ?? []).map((p) => `${p.name} ${p.company ?? ""} ${p.title ?? ""}`).join(" ")
  );
  return terms.every((t) => hay.includes(t));
}

/**
 * Does this session carry one of the chosen tags?
 *
 * ANY, not ALL. A session carries at most three tags and they are mostly disjoint — Panel, AI &
 * ML, Investment — so requiring all three would return nothing the moment a second chip is on,
 * which reads as a broken filter. Picking two tags means "show me either".
 */
export function matchesTags(s: Session, tags: string[]): boolean {
  if (!tags.length) return true;
  const own = s.tags ?? [];
  return tags.some((t) => own.includes(t));
}

/** "  Jane   Doe " → ["jane","doe"]. Empty when the box is empty, which means "match all". */
export function searchTerms(q: string): string[] {
  return normalise(q).split(/\s+/).filter(Boolean);
}

/**
 * One person, and everywhere they appear.
 *
 * The search box predicts PEOPLE, not sessions: "Maria" should offer the three Marias to choose
 * between, not thirty cards to read. Each suggestion carries where that person is, because the
 * answer to "when is Maria on" is a day and a stage, and making the visitor pick a name and
 * THEN hunt the board for the highlight is two steps where one will do.
 */
export type SpeakerHit = {
  name: string;
  role: string; // "CTO, Nordea" — whatever of title/company exists
  photo: string | null;
  days: string[]; // the raw Brella day strings they appear on
  stages: string[]; // the timeline columns they appear in
  count: number; // sessions, which is not days x stages
};

/** Suggestions, best first. Capped — this is a hint, not a directory. */
const MAX_SUGGESTIONS = 6;

export function speakerHits(
  all: Session[],
  terms: string[],
  columnSet: ColumnDef[] | undefined
): SpeakerHit[] {
  if (!terms.length) return [];
  const by = new Map<string, SpeakerHit>();
  for (const s of all) {
    for (const p of s.speakers ?? []) {
      if (!p.name) continue;
      const hay = normalise(`${p.name} ${p.company ?? ""} ${p.title ?? ""}`);
      if (!terms.every((t) => hay.includes(t))) continue;
      // Keyed on the NAME, not the id: Brella issues a fresh speaker id per session, so the
      // same person appearing on three panels arrives as three records and would otherwise
      // suggest three identical rows.
      let hit = by.get(p.name);
      if (!hit) {
        hit = {
          name: p.name,
          role: [p.title, p.company].filter(Boolean).join(", "),
          photo: p.photo,
          days: [],
          stages: [],
          count: 0,
        };
        by.set(p.name, hit);
      }
      hit.count++;
      if (!hit.days.includes(s.day)) hit.days.push(s.day);
      const col = columnSet ? columnOf(s.room, columnSet) ?? s.room : s.room;
      if (col && !hit.stages.includes(col)) hit.stages.push(col);
      if (!hit.photo && p.photo) hit.photo = p.photo;
      if (!hit.role) hit.role = [p.title, p.company].filter(Boolean).join(", ");
    }
  }
  return [...by.values()]
    .sort((a, b) => {
      // A name that STARTS with what was typed comes first — typing "and" should offer Anders
      // before it offers someone whose company happens to contain "and".
      const pre = (h: SpeakerHit) => (normalise(h.name).startsWith(terms[0]) ? 0 : 1);
      return pre(a) - pre(b) || a.name.localeCompare(b.name);
    })
    .slice(0, MAX_SUGGESTIONS);
}

// Brella's own day number, used ONLY to order the day groups — it is chronological by
// construction. It is never displayed; brellaDayLabel() supplies the TechBBQ numbering.
export function dayNumber(day: string): number {
  const m = /^Day\s+(\d+)/i.exec(day);
  return m ? Number(m[1]) : 99;
}

// Minutes since midnight, for sorting within a day. "All day" and anything unparseable sort
// LAST rather than to 00:00, where they would otherwise lead the list.
export function startMinutes(slot: string): number {
  const m = /(\d{1,2}):(\d{2})/.exec(slot);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60 + 1;
}

// ─── TIMELINE ───────────────────────────────────────────────────────────────────────────
// Stages are shown as a clock, not a list: one column per stage, one day at a time, so you
// can read across and see what is on at 11:00. That only works if vertical distance means
// time, which is why the cards are absolutely positioned rather than stacked.

// 30 minutes = 90px. Was 72px until the live page showed 18 of 41 cards clipping: a real
// column on techbbq.dk is ~270px wide, so titles wrap onto two lines far more often while the
// card's height still comes from its duration.
const PX_PER_MIN = 3;
const SLOT_MIN = 30; // gridline interval
// Floor for a card's height, so a three-minute session is still readable.
const MIN_CARD_PX = 26;
// BREATHWORK GETS ITS OWN FLOOR, AND IT ALWAYS WINS THE OVERLAP.
//
// A break runs 11:26-11:29, which is nine pixels of axis: too small to carry a label, and under
// the 24px target size WCAG 2.2 asks of anything you can press. So it is floored to 24 and drawn
// ON TOP of its neighbours — a break that is sometimes behind the card next to it and sometimes
// in front of it is the one thing worse than a small break (Auri, 2026-08-05).
//
// Drawing on top would normally hide the next talk's heading, since that talk starts the same
// minute the break ends. It does not, because layOutColumn() below measures the overlap and
// pushes the covered card's text down past it. Nothing ends up underneath anything.
const BREATH_MIN_PX = 24;
// Clear of the band, plus a little air so the heading is not touching it.
const BREATH_CLEARANCE_PX = 3;
// Breathing room either side of every card, so one column's card does not run up against its
// neighbour (Auri, 2026-08-04). With the grid's own 8px channel that makes ~24px between two
// cards. It also separates overlapping sessions sharing a column, which used to touch.
//
// It has to be applied to the CARD. Padding on .bp-tl__col does nothing: the cards are
// absolutely positioned, and an abs-positioned child resolves left/width against the padding
// box, padding included. Measured before and after — padding left the gap at 9px.
const CARD_INSET_PX = 8;

// Brella's roles, reduced to the distinction that matters on a card: who is chairing and who
// is speaking. Panelist, Facilitator and Keynote speaker are all "speaking"; only Moderator
// is not, and calling a moderator a speaker is the thing Auri asked to stop.
export function isModerator(p: { role?: string }): boolean {
  return /moderator/i.test(p.role ?? "");
}

/** "4 speakers · 1 moderator", or "" when there is nobody. */
export function peopleSummary(speakers: Speaker[] | undefined): string {
  if (!speakers?.length) return "";
  const mods = speakers.filter(isModerator).length;
  const talk = speakers.length - mods;
  const bits: string[] = [];
  if (talk) bits.push(`${talk} speaker${talk === 1 ? "" : "s"}`);
  if (mods) bits.push(`${mods} moderator${mods === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

// Icons come from lib/brellaTheme.ts, shared with the embed builder. Inlined SVG rather than
// lucide-react: the embed emits raw HTML strings and cannot render a React component, so the
// glyphs have to exist as plain SVG anyway, and a package would leave the embed with a second
// copy to drift from.
export function StageIcon({ stage }: { stage: string }) {
  const paths = STAGE_ICON_PATHS[stage];
  if (!paths) return null;
  return (
    <svg
      className="bp-tl__icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** "A High-Agency Europe: Founders building tomorrow" -> "A High-Agency Europe: Founders building…" */
function firstWords(text: string, n = 5): string {
  const w = text.trim().split(/\s+/);
  return w.length <= n ? text.trim() : w.slice(0, n).join(" ") + "…";
}

/**
 * Up to two names for the card, speakers before moderators, with "+N" for the rest.
 *
 * Speakers first because a card with room for two names should spend them on who is talking,
 * not on who is chairing. The full list with roles is in the dialog.
 */
function orderedSpeakers(speakers: Speaker[] | undefined): Speaker[] {
  if (!speakers?.length) return [];
  return [...speakers].sort((a, b) => Number(isModerator(a)) - Number(isModerator(b)));
}

/** The little stack of faces on a card. Initials when Brella has no photo. */
function Avatars({
  speakers,
  n = 2,
  className,
}: {
  speakers: Speaker[] | undefined;
  n?: number;
  /** Extra class, so a timeline card can pin the stack to its right edge. */
  className?: string;
}) {
  const all = orderedSpeakers(speakers);
  // SHOW THE MODERATOR, not just the first two speakers.
  //
  // orderedSpeakers puts moderators last, which was right when the card printed two NAMES and
  // should spend them on who is talking. With faces only, it meant the chair was invisible on
  // 45 of the 73 sessions that have one — so the ring below marked nothing. A panel now reads
  // as one speaker plus the chair, which is what the card is trying to say, and the +N chip
  // still carries everyone who did not fit.
  const mods = all.filter(isModerator);
  let people = all.slice(0, n);
  if (mods.length && !people.some(isModerator) && n > 1) {
    people = [...all.filter((p) => !isModerator(p)).slice(0, n - 1), mods[0]];
  }
  // Moderators are ordered last by orderedSpeakers but looked identical to the speakers, so a
  // two-face stack could be showing one of each and read as two speakers. The ring says which
  // is which; the title attribute says it in words, for anyone who cannot see the ring.
  if (!people.length) return null;
  // The card used to end with ", +3" after the names. The names are gone, so the count moves
  // onto the stack — without it a six-person panel and a two-person fireside are the same two
  // circles, which is a worse lie than showing nothing.
  const rest = all.length - people.length;
  return (
    <span className={className ? `bp-tl__faces ${className}` : "bp-tl__faces"} aria-hidden="true">
      {rest > 0 && <span className="bp-tl__face bp-tl__face--more">+{rest}</span>}
      {people.map((p) =>
        p.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={p.id}
            className="bp-tl__face"
            data-mod={isModerator(p) ? "1" : undefined}
            title={isModerator(p) ? `${p.name} — moderator` : p.name}
            src={p.photo}
            alt=""
            loading="lazy"
          />
        ) : (
          <span
            key={p.id}
            className="bp-tl__face bp-tl__face--empty"
            data-mod={isModerator(p) ? "1" : undefined}
            title={isModerator(p) ? `${p.name} — moderator` : p.name}
          >
            {p.name.trim().charAt(0).toUpperCase()}
          </span>
        )
      )}
    </span>
  );
}

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Side-by-side placement for sessions that overlap in the same column.
 *
 * Without this, two sessions running 11:00-11:30 and 11:15-11:45 would be drawn on top of
 * each other and the second would be invisible. Each gets the first lane that is free at its
 * start time, and the column is divided by however many lanes ended up in use.
 */
function withLanes<T extends { start: number; end: number }>(items: T[]) {
  // Lanes are counted per CLUSTER of mutually overlapping sessions, not per column. Counting
  // per column meant one two-minute clash at 10:05 halved the width of every card on that
  // stage for the entire day.
  type Placed = T & { lane: number; lanes: number };
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const n = Math.max(1, laneEnds.length);
    for (const c of cluster) c.lanes = n;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const it of items) {
    // Lanes are decided on the SCHEDULED end, not a padded one. Padding it so a floored-height
    // card could never cover the next one meant a 3-minute Breathwork Break counted as a clash
    // and was banished to a half-width side lane, when it should sit in sequence at full width.
    // A few pixels of overlap under its text is the better trade.
    const drawnEnd = it.end;
    if (it.start >= clusterEnd) flush(); // nothing here overlaps what came before
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(drawnEnd);
    } else {
      laneEnds[lane] = drawnEnd;
    }
    clusterEnd = Math.max(clusterEnd, drawnEnd);
    cluster.push({ ...it, lane, lanes: 1 });
  }
  flush();
  return out;
}

type Placed = Session & { start: number; end: number };
type Lane = Placed & { lane: number; lanes: number };

/**
 * A card's final geometry, once it knows about the cards around it.
 *
 * `breath` and `opening` drive the LOOK and are mutually exclusive (see isOpening). `band` is
 * the union and drives the GEOMETRY — the height floor, the z-index and the clearance below —
 * because a 5-minute opening has exactly the breathwork problem: floored to a height its slot
 * does not pay for, so it lands on the card after it.
 */
type Laid = {
  s: Lane;
  top: number;
  h: number;
  breath: boolean;
  opening: boolean;
  band: boolean;
  padTop: number;
};

/**
 * Geometry for one stage column, in one pass over the cards.
 *
 * It has to be one pass, because a breathwork break and the talk after it are the same minute of
 * the clock: the break is floored to a height its slot does not pay for, is drawn on top, and so
 * lands on the next card's heading. Rather than let it cover the heading, or lose the fight and
 * hide behind the card, the covered card gets padding equal to the overlap and starts its text
 * below the band.
 *
 * Only the TOP edge is handled. A band that fell in the middle of a card could not be cleared by
 * padding, and no break in the schedule does that: every one of them sits between two sessions.
 */
function layOutColumn(placed: Lane[], from: number): Laid[] {
  const laid: Laid[] = placed.map((s) => {
    const breath = isBreathwork(s);
    const opening = isOpening(s);
    const band = breath || opening;
    return {
      s,
      top: (s.start - from) * PX_PER_MIN,
      // A band keeps the full floor. Every other card gives back 4px, which is the gap that
      // separates it from the card below — a band has no gap because it is drawn on top.
      h: band
        ? Math.max(BREATH_MIN_PX, (s.end - s.start) * PX_PER_MIN)
        : Math.max(MIN_CARD_PX, (s.end - s.start) * PX_PER_MIN - 4),
      breath,
      opening,
      band,
      padTop: 0,
    };
  });

  // Horizontal extent as a fraction of the column, which is how the cards are positioned. Two
  // cards in different lanes of the same cluster never touch, so they cannot need clearance.
  const span = (x: Laid): [number, number] => [x.s.lane / x.s.lanes, (x.s.lane + 1) / x.s.lanes];

  for (const band of laid) {
    if (!band.band) continue;
    const [bandLeft, bandRight] = span(band);
    const bandBottom = band.top + band.h;
    for (const other of laid) {
      if (other === band || other.band) continue;
      const [left, right] = span(other);
      if (bandLeft >= right || left >= bandRight) continue; // side by side, never touching
      const coversTop = band.top <= other.top && bandBottom > other.top;
      if (!coversTop) continue;
      other.padTop = Math.max(other.padTop, bandBottom - other.top + BREATH_CLEARANCE_PX);
    }
  }
  return laid;
}

export function StageTimeline({
  columns,
  sessions,
  onOpen,
  terms,
  tags,
  stageMatches,
  columnSet,
  openAt,
}: {
  columns: string[];
  sessions: Session[];
  onOpen: (s: Session) => void;
  /**
   * The section's column DEFINITIONS. Needed because a track name and its column label are not
   * always the same string: "Policy Stage (Rooms 5,6,7)" belongs to the column "Policy Stage".
   * This used to group by stageOf(), which only knows the five stages, so every Event Rooms
   * track resolved to null and only survived by accidentally equalling its own label — and the
   * Policy Stage, which does not, was dropped from the board entirely.
   */
  columnSet: ColumnDef[];
  /** Speaker-search terms. Empty means no search is running and nothing dims. */
  terms: string[];
  /** Chosen topic tags. Empty means no tag filter and nothing dims. */
  tags: string[];
  /** Column → matching sessions, for the marker on the heading. Empty when no search is on. */
  stageMatches: Map<string, number>;
  /**
   * Pin the board to open no later than this minute-of-day. Set for Event Rooms so the
   * whole-day band has room to announce itself above the first session. Omitted elsewhere,
   * where the board still starts at whatever is on first.
   */
  openAt?: number;
}) {
  // "One column" is the FILTERED state — a room was chosen — not a count of what happens to
  // have sessions today. It gates the programme sub-labels in the headings.
  const oneColumn = columns.length === 1;
  /**
   * The sub-label under a column heading: the programmes whose sessions are actually in that
   * column today. Falls back to the room's REGISTERED programmes only when the column is empty
   * — that is the one case where the registration is all there is to say, and it is what lets
   * an empty Event Room 6 still name Deep Tech Event Day.
   */
  const progLabel = (col: string): string => {
    const here = sessions.filter((s) => (columnOf(s.room, columnSet) ?? s.room) === col);
    const live = [...new Set(here.map((s) => s.programme).filter(Boolean))] as string[];
    return (live.length ? live : here.length ? [] : roomProgrammes(col)).join(" · ");
  };
  // Everything with a real clock time goes on the grid; an "All day" entry cannot be placed
  // against a time axis and spans its column instead.
  const timed: Placed[] = [];
  const allDay: Session[] = [];
  for (const s of sessions) {
    const t = parseSlot(s.timeSlot);
    if (t) timed.push({ ...s, ...t });
    else allDay.push(s);
  }

  // Start where the programme starts, not at 09:00 (Auri, 2026-08-04). Life Science opens at
  // 10:45 and the old floor drew an hour and three quarters of empty grid above it, which reads
  // as a broken embed rather than as a morning off. DAY_START_MIN is only the fallback for a
  // column with nothing timed in it at all, so it still has a sane height.
  //
  // EVENT ROOMS OPEN AT 09:00 REGARDLESS (`openAt`, Auri 2026-08-06). Their first session is
  // 09:25-09:30, so the board began flush against it and the whole-day band's own label sat
  // behind the first card — the band read as a tint rather than as "this room is booked all
  // day". Half an hour of grid above the first session gives the label somewhere to be, and
  // shows the 09:00 gridline so the day has a visible beginning.
  //
  // This does NOT undo the 2026-08-04 decision: it is a floor of half an hour on rooms that
  // already start at 09:25, not an hour and three quarters of emptiness on a stage that starts
  // at 10:45. Min, not a replacement, so a room that ever starts at 08:30 still shows 08:30.
  const firstStart = timed.length ? Math.min(...timed.map((s) => s.start)) : DAY_START_MIN;
  const start = openAt != null ? Math.min(firstStart, openAt) : firstStart;
  const end = Math.max(start + 60, ...timed.map((s) => s.end));
  const from = Math.floor(start / SLOT_MIN) * SLOT_MIN;
  const to = Math.ceil(end / SLOT_MIN) * SLOT_MIN;
  const height = (to - from) * PX_PER_MIN;

  const ticks: number[] = [];
  for (let t = from; t <= to; t += SLOT_MIN) ticks.push(t);

  return (
    <div className="bp-tl" style={{ "--cols": columns.length } as React.CSSProperties}>
      <div className="bp-tl__head">
        <span className="bp-tl__gutterHead" />
        {columns.map((c) => {
          // The heading row is the one part of the board that is always on screen: the timeline
          // is tall and, on a narrow viewport, scrolls sideways. A match twenty minutes further
          // down a column you are not looking at is invisible without this.
          const n = stageMatches.get(c) ?? 0;
          return (
            <span
              key={c}
              className="bp-tl__colHead"
              title={n > 0 ? `${c} — ${n} match${n === 1 ? "" : "es"}` : c}
              style={trackVars(c)}
              data-hasmatch={n > 0 ? "1" : undefined}
              // Dimmed in step with its cards, so a column with nothing in it recedes instead
              // of competing with the one that has the answer.
              data-dim={terms.length > 0 && n === 0 ? "1" : undefined}
            >
              <StageIcon stage={c} />
              <span>{c}</span>
              {n > 0 && <span className="bp-tl__colBadge">{n}</span>}
              {/* WHAT RUNS IN THIS ROOM. "Event Room 2" is a place and says nothing; "NISS ·
                  NASS" is what a visitor is actually looking for. Empty for the stages, which
                  are already named after their programme. */}
              {/* Only when a single room is chosen (Auri, 2026-08-06). Across six columns the
                  sub-labels were six lines of small print competing with the room numbers; on
                  one column there is room for it and it is the thing you just asked about. */}
              {oneColumn && progLabel(c) && (
                <span className="bp-tl__colProg">{progLabel(c)}</span>
              )}
            </span>
          );
        })}
      </div>

      <div className="bp-tl__body" style={{ height }}>
        <div className="bp-tl__gutter">
          {ticks.map((t) => (
            <span
              key={t}
              className="bp-tl__tick"
              style={{ top: (t - from) * PX_PER_MIN }}
              // Half-hours get the line but not a label, or the gutter turns into a wall of text.
              data-hour={t % 60 === 0 ? "1" : undefined}
            >
              {t % 60 === 0 ? hhmm(t) : ""}
            </span>
          ))}
        </div>

        {ticks.map((t) => (
          <span
            key={t}
            className="bp-tl__line"
            style={{ top: (t - from) * PX_PER_MIN }}
            data-hour={t % 60 === 0 ? "1" : undefined}
          />
        ))}

        {columns.map((col) => {
          const inCol = (s: Session) => (columnOf(s.room, columnSet) ?? s.room) === col;
          const mine = timed
            .filter(inCol)
            .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
          // ALL-DAY SESSIONS SPAN THE WHOLE COLUMN (Auri, 2026-08-06). A room that is booked
          // all day for one thing — "Board Summit", the Policy Stage — is a different fact from
          // a room with a gap in it, and a chip in a strip above the board said neither. Drawn
          // BEHIND the timed cards rather than as a lane beside them: Event Room 1 runs nine
          // sessions inside its all-day Board Summit, so the two are nested, not competing.
          const alldayHere = allDay.filter(inCol);
          // A PROGRAMME THAT RUNS THE WHOLE DAY, with no umbrella session to say so.
          //
          // NISS occupies Event Room 2 from 09:30 to 17:30 — it has taken the room for the day
          // as surely as Board Summit has taken Room 1 — but Brella has no all-day row for it,
          // only its eleven sessions. So the band is DERIVED: a room with a named programme
          // whose own sessions span morning to evening gets the same dotted band, with those
          // sessions drawn inside it (Auri, 2026-08-06).
          //
          // Skipped when the column already has a real all-day session, or there would be two
          // bands saying the same thing. Not a button: there is no session behind it to open.
          // What is ACTUALLY running here, from the sessions themselves — not every programme
          // registered to the room. Event Room 2 is registered to NISS and NASS, but NASS has no
          // track in Brella and no sessions, and a band reading "NISS · NASS" named a summit
          // that is not on (Auri, 2026-08-06).
          const progs = [...new Set(mine.map((x) => x.programme).filter(Boolean))] as string[];
          const bandSpan =
            mine.length > 1
              ? [Math.min(...mine.map((x) => x.start)), Math.max(...mine.map((x) => x.end))]
              : null;
          const progBand =
            progs.length > 0 &&
            alldayHere.length === 0 &&
            bandSpan !== null &&
            spansMorningToEvening(bandSpan[0], bandSpan[1])
              ? progs.join(" · ")
              : null;
          const laid = layOutColumn(withLanes(mine), from);
          return (
            <div key={col} className="bp-tl__col">
              {progBand && (
                <div
                  className="bp-tl__allDayCard bp-tl__allDayCard--prog"
                  style={{ ...trackVars(col), top: 0, height } as React.CSSProperties}
                  aria-hidden="true"
                >
                  <span className="bp-tl__allDayLabel">All day</span>
                  <span className="bp-tl__allDayTitle">{progBand}</span>
                </div>
              )}
              {alldayHere.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="bp-tl__allDayCard"
                  style={{ ...sessionVars(s), top: 0, height } as React.CSSProperties}
                  data-dim={
                    (terms.length > 0 && !matchesSpeaker(s, terms)) || !matchesTags(s, tags)
                      ? "1"
                      : undefined
                  }
                  title={s.name}
                  onClick={() => onOpen(s)}
                >
                  <span className="bp-tl__allDayLabel">All day</span>
                  <span className="bp-tl__allDayTitle">{s.name}</span>
                </button>
              ))}
              {laid.length === 0 && alldayHere.length === 0 && (
                <p className="bp-tl__empty">
                  {/* An empty ROOM is not the same as an empty stage. A stage with nothing on
                      it has a gap in its day; a room column that is empty usually means the
                      programme has not been handed over yet — Event Room 6 has Deep Tech Event
                      Day coming and no track in Brella (Auri, 2026-08-06). "Nothing scheduled"
                      would read as a decision rather than as work in progress. */}
                  {/^event room/i.test(col)
                    ? "Information coming soon"
                    : /campfire/i.test(col)
                      ? "Program coming soon"
                      : "Nothing scheduled"}
                </p>
              )}
              {laid.map(({ s, top, h, breath, opening, band, padTop }) => {
                // Dimmed, never removed — see the SPEAKER SEARCH note. A card that is dimmed is
                // also taken out of the tab order: tabbing through 40 faded cards to reach the
                // two that matched is worse than not having the search.
                const dim =
                  (terms.length > 0 && !matchesSpeaker(s, terms)) || !matchesTags(s, tags);
                const detail = hasDetail(s);
                // Below ~46px there is only room for one line, so the card drops the time
                // and the speaker count rather than showing three clipped half-lines. A card
                // cleared past a breathwork band has that much less room, so the padding counts
                // against it: otherwise the card claims space for a time it cannot show.
                const usable = h - padTop;
                const compact = usable < 46;
                // Between the two: room for the title and time, not for a row of faces.
                // 78px measured: 2 lines of title (32) + time (14) + faces (16) + padding (12).
                // `tight` used to mean "room for the title and time but not the faces". The
                // faces are pinned to the card's edge now and the names are gone entirely, so
                // there is nothing left for it to hide.

                const style = {
                  ...sessionVars(s),
                  top,
                  height: h,
                  // Inset on the CARD, not as padding on the column: padding cannot move an
                  // absolutely positioned child, which resolves against the padding box.
                  left: `calc(${(s.lane * 100) / s.lanes}% + ${CARD_INSET_PX}px)`,
                  width: `calc(${100 / s.lanes}% - ${CARD_INSET_PX * 2}px)`,
                  // ALWAYS in front. A break is three minutes long and its neighbours are drawn
                  // taller than their slots, so without this it is behind one card and in front
                  // of the next depending on the order they happen to be in the DOM. An opening
                  // is 5 minutes and has the same problem.
                  ...(band ? { zIndex: 3 } : {}),
                  // Cleared past the band above it. Only the top is set, so the stylesheet keeps
                  // the other three sides (including the tighter padding on a compact card).
                  ...(padTop ? { paddingTop: padTop } : {}),
                } as React.CSSProperties;
                const inner = (
                  <>
                    {/* Five words then an ellipsis. The full title is the element's title
                        attribute and the whole session is one click away. */}
                    <span className="bp-tl__cardTitle">
                      {/* Inside the title, not on a line of its own: a break's card is 24px tall
                          because the session is three minutes long, and a second row would push
                          the title out of the box it has. */}
                      {breath && <BreathIcon />}
                      {opening && <OpeningIcon />}
                      {firstWords(s.name)}
                    </span>
                    <span className="bp-tl__cardTime">{s.timeSlot}</span>
                    {/* FACES ONLY — no names on a card (Auri, 2026-08-06). Pinned to the right
                        edge so every card carries them, however short. The names, roles, titles
                        and companies are all in the dialog, which is one click away. */}
                    {s.speakers?.length ? (
                      <Avatars speakers={s.speakers} className="bp-tl__cardFaces" />
                    ) : null}
                  </>
                );
                return detail ? (
                  <button
                    key={s.id}
                    type="button"
                    className="bp-tl__card bp-tl__card--open"
                    style={style}
                    data-compact={compact ? "1" : undefined}
                    data-breathwork={breath ? "1" : undefined}
                    data-opening={opening ? "1" : undefined}
                    data-dim={dim ? "1" : undefined}
                    tabIndex={dim ? -1 : undefined}
                    title={s.name}
                    onClick={() => onOpen(s)}
                    aria-label={`${s.name} — show details`}
                  >
                    {inner}
                  </button>
                ) : (
                  <article
                    key={s.id}
                    className="bp-tl__card"
                    style={style}
                    data-compact={compact ? "1" : undefined}
                    data-breathwork={breath ? "1" : undefined}
                    data-opening={opening ? "1" : undefined}
                    data-dim={dim ? "1" : undefined}
                    title={s.name}
                  >
                    {inner}
                  </article>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PinIcon() {
  // Lucide "map-pin", inlined: this repo has no lucide-react dependency and one icon does
  // not justify adding one.
  return (
    <svg
      className="bp-card__pin"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** Lucide building-2, for "Hosted by <partner>". Paths shared with the embed via brellaTheme. */
export function HostIcon() {
  return (
    <svg
      className="bp-card__pin"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {HOST_ICON_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}


/** Lucide wind, the breathwork mark. Paths shared with the embed via brellaTheme. */
export function BreathIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      className="bp-breath__icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {BREATHWORK_ICON_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** Lucide play, the opening mark. Paths shared with the embed via brellaTheme. */
export function OpeningIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      className="bp-breath__icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {OPENING_ICON_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

// A session is worth opening only if the dialog would show something the card does not:
// the speaker list, a description long enough that the card's 3-line clamp hides part of it,
// or a sign-up page. Making every card clickable would promise detail that half of them do
// not have.
//
// registerUrl counts because the Register button lives ONLY in the dialog (Auri's call): a row
// of pills on every preview card turned the section into a wall of buttons, and a visitor
// should read what the event is before signing up for it.
export function hasDetail(s: Session): boolean {
  return Boolean(s.speakers?.length) || s.description.length > 150 || Boolean(s.registerUrl);
}

/**
 * The violet pill on a breathwork card. It carries the word as well as the icon: the colour
 * alone is a code the visitor has to learn, and a colour-blind visitor never learns it.
 */
export function BreathBadge() {
  return (
    <span className="bp-breath">
      <BreathIcon />
      {BREATHWORK_LABEL}
    </span>
  );
}

/**
 * The same pill for an opening, in the STAGE's colour rather than a colour of its own — the
 * .bp-breath rules are all written against var(--track), which is already the stage's accent by
 * the time it reaches an opening card. Same reason it carries the word and not just the icon.
 */
export function OpeningBadge() {
  return (
    <span className="bp-breath">
      <OpeningIcon />
      {OPENING_LABEL}
    </span>
  );
}

// NO LEGEND ABOVE THE BOARD. There was one, naming the violet and counting the breaks; Auri cut
// it on 2026-08-05. The card says "Breathwork Break" on itself now, which is what the legend was
// standing in for while the card was too small to hold a word. The dialog still has the
// facilitator, so nothing is lost that a visitor cannot reach.

/**
 * The line under the title. For a stage or event room it is a PLACE, so it gets a pin. For a
 * side event `room` is the hosting PARTNER — Airtable has no venue field for these, checked
 * across all 128 columns — and a pin next to a company name claims something untrue, so it
 * reads "Hosted by" with a building icon instead.
 */

/**
 * One person in the dialog: name, job title, company, and their role. The BIO is behind a
 * press — Auri's call, and the right one: several Brella bios run to a full screen each, and
 * six of them stacked buried the session's own description under a wall of text.
 */
function PersonRow({ p }: { p: Speaker }) {
  const [show, setShow] = useState(false);
  const meta = [p.title, p.company].filter(Boolean).join(" · ");
  const photo = p.photo ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img className="bp-person__photo" src={p.photo} alt="" loading="lazy" />
  ) : (
    <span className="bp-person__photo bp-person__photo--empty" aria-hidden="true">
      {p.name.trim().charAt(0).toUpperCase()}
    </span>
  );

  // No bio: a plain row rather than a button that opens nothing.
  if (!p.bio) {
    return (
      <li className="bp-person">
        {photo}
        <div>
          <p className="bp-person__name">
            {p.name}
            {p.role && (
              <span className="bp-person__tag" data-mod={isModerator(p) ? "1" : undefined}>
                {p.role}
              </span>
            )}
          </p>
          {meta && <p className="bp-person__role">{meta}</p>}
        </div>
      </li>
    );
  }

  return (
    <li className="bp-person">
      {photo}
      <div>
        <button
          type="button"
          className="bp-person__toggle"
          aria-expanded={show}
          onClick={() => setShow((v) => !v)}
        >
          <span className="bp-person__name">
            {p.name}
            {p.role && (
              <span className="bp-person__tag" data-mod={isModerator(p) ? "1" : undefined}>
                {p.role}
              </span>
            )}
          </span>
          {meta && <span className="bp-person__role">{meta}</span>}
          <span className="bp-person__more">
            {show ? "Hide bio" : "Read bio"}
            <svg
              className="bp-person__chev"
              data-open={show ? "1" : undefined}
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {show && <p className="bp-person__bio">{p.bio}</p>}
      </div>
    </li>
  );
}


export function SessionDialog({ s, onClose }: { s: Session; onClose: () => void }) {
  // Escape closes, and the page behind is locked so a scroll gesture over the overlay does
  // not silently move the list underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="bp-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bp-dialog-title"
      // Backdrop click closes; the guard stops a click that started inside the panel from
      // bubbling out and closing it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bp-modal" style={sessionVars(s)}>
        <button type="button" className="bp-modal__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Day BEFORE the time, and always shown. A dialog opened from a timeline column
            has no day heading above it, so "10:05 - 10:10" alone left the visitor to work out
            which of the two days they were looking at (Auri, 2026-08-06). */}
        <p className="bp-modal__time">
          <span className="bp-modal__day">{brellaDayLong(s.day)}</span>
          {timeLabel(s)}
        </p>
        {isBreathwork(s) && <BreathBadge />}
        {isOpening(s) && <OpeningBadge />}
        <h2 className="bp-modal__title" id="bp-dialog-title">
          {s.name}
        </h2>
        <p className="bp-modal__meta">
          {/* The stage's own icon when the room is one of the five, so the dialog matches the
              column you clicked from; a building for a side event's host, the generic pin for
              anything that is a real place. */}
          {s.section === "side" ? (
            <HostIcon />
          ) : STAGE_ICON_PATHS[stageOf(s.room) ?? ""] ? (
            <StageIcon stage={stageOf(s.room) as string} />
          ) : (
            <PinIcon />
          )}
          {/* Brella's `location` often repeats the track name verbatim ("Founders Stage ·
              Founders Stage"), so it is only appended when it says something new. A side event
              has no venue in Airtable at all, so its line names the host instead. */}
          {s.section === "side"
            ? [`Hosted by ${s.room}`, s.location].filter(Boolean).join(" · ")
            : [s.room, s.location !== s.room ? s.location : ""].filter(Boolean).join(" · ")}
          {/* Only when there is no tag list to show below. `type` IS the first tag, so printing
              both puts the same word on the screen twice. */}
          {s.type && !s.tags?.length && <span className="bp-modal__topic">{s.type}</span>}
        </p>

        {/* EVERY topic on the session, up to the three it can carry — the meta line above used
            to show only the first, which on a session tagged AI & ML / Panel / Investment threw
            away two thirds of what it is about (Auri, 2026-08-10). */}
        {s.tags && s.tags.length > 0 && (
          <p className="bp-modal__tags">
            {s.tags.map((t) => (
              <span key={t} className="bp-modal__topic">
                {t}
              </span>
            ))}
          </p>
        )}

        {/* Unclamped here — the card shows three lines, this is where the rest lives.
            Brella's Draft.js content arrives newline-separated, so paragraphs are split
            rather than run together. */}
        {s.description && (
          <div className="bp-modal__desc">
            {s.description.split("\n").filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        {/* Above the speaker list on purpose: someone who opened a side event came to sign up,
            and on a phone a CTA under six bios is below the fold. */}
        {s.registerUrl && (
          <p className="bp-modal__cta">
            <a href={s.registerUrl} target="_blank" rel="noopener noreferrer">
              Register for this event
            </a>
          </p>
        )}
        {/* Directly under the button it explains, so nobody presses it expecting a ticket. */}
        {s.access === "private-invite" && <p className="bp-modal__note">{PRIVATE_NOTE}</p>}

        {s.speakers && s.speakers.length > 0 && (
          <>
            <h3 className="bp-modal__heading">{peopleSummary(s.speakers)}</h3>
            <ul className="bp-people">
              {s.speakers.map((p) => (
                <PersonRow key={p.id} p={p} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
