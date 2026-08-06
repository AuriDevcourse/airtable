"use client";

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
  type ColumnDef,
  weekdayLabel,
  EVENT_DAYS,
  brellaDayLabel as dayLabel,
  brellaDayLong,
  defaultEventDay,
  inBrellaSection,
  parseSlot,
  sectionKeyOf,
  stageOf,
  type BrellaSection as SectionKey,
} from "@/lib/brellaSections";

// The live Brella schedule, laid out the way Auri's mock does it: three big section
// headings (Stages / Event Rooms / Side Events), a pill per track inside the section, then
// the sessions as cards grouped under a day heading.
//
// Read-only view over /api/program?event=brella — the same feed the /program page's Brella
// tab uses. Nothing here writes; the key behind that feed can create and delete sessions in
// the live attendee app, which is why lib/brellaprogram.ts is GET-only.
type Speaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  bio: string;
  role?: string;
};

type Session = {
  id: string;
  name: string;
  day: string; // "Day 3 · 26 August"
  timeSlot: string; // "09:30 - 10:00", or "All day"
  type: string;
  /** Up to three topic tags. `type` is the first of them; this is the set the filter uses. */
  tags?: string[];
  description: string;
  room: string; // the Brella TRACK — "Founders Stage", "Event Room 3", "Side Event Promotion"
  location?: string; // Brella's venue string, e.g. "Hall E"
  speakers?: Speaker[];
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
const PRIVATE_NOTE = "Private event · you need an invitation or the host's approval to attend";

/**
 * What to print in the time slot. A side event whose partner has not filled in a time shows
 * its DATE rather than "Time TBC": the date is real information, the placeholder is not.
 */
function timeLabel(s: Session): string {
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
function sessionVars(s: Session): React.CSSProperties {
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
function normalise(v: string): string {
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
function matchesSpeaker(s: Session, terms: string[]): boolean {
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
function matchesTags(s: Session, tags: string[]): boolean {
  if (!tags.length) return true;
  const own = s.tags ?? [];
  return tags.some((t) => own.includes(t));
}

/** "  Jane   Doe " → ["jane","doe"]. Empty when the box is empty, which means "match all". */
function searchTerms(q: string): string[] {
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
type SpeakerHit = {
  name: string;
  role: string; // "CTO, Nordea" — whatever of title/company exists
  photo: string | null;
  days: string[]; // the raw Brella day strings they appear on
  stages: string[]; // the timeline columns they appear in
  count: number; // sessions, which is not days x stages
};

/** Suggestions, best first. Capped — this is a hint, not a directory. */
const MAX_SUGGESTIONS = 6;

function speakerHits(
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
function dayNumber(day: string): number {
  const m = /^Day\s+(\d+)/i.exec(day);
  return m ? Number(m[1]) : 99;
}

// Minutes since midnight, for sorting within a day. "All day" and anything unparseable sort
// LAST rather than to 00:00, where they would otherwise lead the list.
function startMinutes(slot: string): number {
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
function isModerator(p: { role?: string }): boolean {
  return /moderator/i.test(p.role ?? "");
}

/** "4 speakers · 1 moderator", or "" when there is nobody. */
function peopleSummary(speakers: Speaker[] | undefined): string {
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
function StageIcon({ stage }: { stage: string }) {
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

function StageTimeline({
  columns,
  sessions,
  onOpen,
  terms,
  tags,
  stageMatches,
  columnSet,
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
}) {
  // "One column" is the FILTERED state — a room was chosen — not a count of what happens to
  // have sessions today. It gates the programme sub-labels in the headings.
  const oneColumn = columns.length === 1;
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
  const start = timed.length ? Math.min(...timed.map((s) => s.start)) : DAY_START_MIN;
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
              {oneColumn && roomProgrammes(c).length > 0 && (
                <span className="bp-tl__colProg">{roomProgrammes(c).join(" · ")}</span>
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
          const laid = layOutColumn(withLanes(mine), from);
          return (
            <div key={col} className="bp-tl__col">
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
                  {/campfire/i.test(col) ? "Program coming soon" : "Nothing scheduled"}
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

function PinIcon() {
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
function HostIcon() {
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
function BreathIcon({ size = 12 }: { size?: number }) {
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


/**
 * Topic-tag chips for the Event Rooms board.
 *
 * Dims rather than removes, like the speaker search above it and for the same reason: pulling
 * cards out collapses the columns and the clock stops lining up across rooms, which is the only
 * thing a timeline is for.
 *
 * Three at once, matching the three a session can carry. The cap is enforced in toggleTag; here
 * it only has to SHOW that it is in force, or a chip that silently refuses to turn on reads as
 * broken.
 */
function TagFilter({
  counts,
  chosen,
  onToggle,
  onClear,
}: {
  counts: [string, number][];
  chosen: string[];
  onToggle: (t: string) => void;
  onClear: () => void;
}) {
  const full = chosen.length >= 3;
  return (
    <div className="bp-tags">
      <div className="bp-tags__row" role="group" aria-label="Filter by topic">
        {counts.map(([t, n]) => {
          const on = chosen.includes(t);
          return (
            <button
              key={t}
              type="button"
              className="bp-tags__chip"
              aria-pressed={on}
              // Disabled only once three are on AND this is not one of them, so the cap never
              // stops you turning a chosen tag back off.
              disabled={!on && full}
              onClick={() => onToggle(t)}
            >
              {t}
              <span className="bp-tags__n">{n}</span>
            </button>
          );
        })}
        {chosen.length > 0 && (
          <button type="button" className="bp-tags__clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <p className="bp-tags__hint" aria-live="polite">
        {chosen.length === 0
          ? "Filter by topic · pick up to three"
          : full
            ? "Three topics is the maximum · everything else is dimmed"
            : `${chosen.length} of 3 topics · everything else is dimmed`}
      </p>
    </div>
  );
}

/**
 * The speaker search box.
 *
 * It reports its own match count rather than leaving the visitor to scan for what is still
 * bright: a search that finds nothing looks exactly like a search that dimmed everything by
 * mistake, and on a board of 40 cards those are impossible to tell apart by eye.
 */
function SpeakerSearch({
  q,
  setQ,
  matches,
  hits,
  onPick,
}: {
  q: string;
  setQ: (v: string) => void;
  matches: number;
  /** Predicted people for what has been typed so far. */
  hits: SpeakerHit[];
  /** Picking a suggestion commits that exact name — see the note on the list. */
  onPick: (h: SpeakerHit) => void;
}) {
  const active = q.trim().length > 0;
  // Hidden once the box holds exactly one suggestion's name: at that point the visitor has
  // already chosen and a list repeating their choice back is just covering the board.
  const showList =
    active && hits.length > 0 && !(hits.length === 1 && hits[0].name.toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="bp-search">
      <div className="bp-search__box">
        <SearchIcon />
        <input
          type="search"
          // `search` gives iOS the right keyboard; the explicit button below is for everyone
          // else, since Firefox and Safari desktop show no native clear affordance.
          className="bp-search__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by speaker, company or title…"
          aria-label="Search sessions by speaker"
          autoComplete="off"
          spellCheck={false}
        />
        {active && (
          <button
            type="button"
            className="bp-search__clear"
            onClick={() => setQ("")}
            aria-label="Clear search"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* A REAL LIST, not a <datalist>. The native one can only show plain strings, and the
          useful part of a suggestion here is where the person actually IS — "Day 2 · Founders
          Stage" is the answer to the question being asked, and a bare name is not. */}
      {showList && (
        <ul className="bp-sugg">
          {hits.map((h) => (
            <li key={h.name}>
              <button type="button" className="bp-sugg__row" onClick={() => onPick(h)}>
                {h.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img className="bp-sugg__face" src={h.photo} alt="" loading="lazy" />
                ) : (
                  <span className="bp-sugg__face bp-sugg__face--empty">
                    {h.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="bp-sugg__text">
                  <span className="bp-sugg__name">{h.name}</span>
                  {h.role && <span className="bp-sugg__role">{h.role}</span>}
                </span>
                <span className="bp-sugg__where">
                  {h.days.map((d) => dayLabel(d).split(",")[0]).join(" + ")}
                  {h.stages.length === 1 && <span className="bp-sugg__stage">{h.stages[0]}</span>}
                  {h.stages.length > 1 && (
                    <span className="bp-sugg__stage">{h.stages.length} stages</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* aria-live, so the count reaches a screen reader: the dimming itself is invisible to
          one, and without this the box would silently do nothing. */}
      <p className="bp-search__hint" aria-live="polite">
        {active
          ? matches > 0
            ? `${matches} session${matches === 1 ? "" : "s"} here · everything else dimmed`
            : "Nothing on this day — the highlighted tab has them"
          : "Type a name to spotlight that speaker's sessions"}
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="bp-search__icon"
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Lucide play, the opening mark. Paths shared with the embed via brellaTheme. */
function OpeningIcon({ size = 12 }: { size?: number }) {
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

/**
 * The violet pill on a breathwork card. It carries the word as well as the icon: the colour
 * alone is a code the visitor has to learn, and a colour-blind visitor never learns it.
 */
function BreathBadge() {
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
function OpeningBadge() {
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

// A session is worth opening only if the dialog would show something the card does not:
// the speaker list, a description long enough that the card's 3-line clamp hides part of it,
// or a sign-up page. Making every card clickable would promise detail that half of them do
// not have.
//
// registerUrl counts because the Register button lives ONLY in the dialog (Auri's call): a row
// of pills on every preview card turned the section into a wall of buttons, and a visitor
// should read what the event is before signing up for it.
function hasDetail(s: Session): boolean {
  return Boolean(s.speakers?.length) || s.description.length > 150 || Boolean(s.registerUrl);
}

/**
 * The line under the title. For a stage or event room it is a PLACE, so it gets a pin. For a
 * side event `room` is the hosting PARTNER — Airtable has no venue field for these, checked
 * across all 128 columns — and a pin next to a company name claims something untrue, so it
 * reads "Hosted by" with a building icon instead.
 */
function VenueLine({ s }: { s: Session }) {
  const hosted = s.section === "side";
  if (!hosted) {
    return s.room ? (
      <p className="bp-card__room">
        <PinIcon />
        {s.room}
      </p>
    ) : null;
  }
  // A side event gets up to two lines, because they answer different questions: who is running
  // it, and where it actually is. The venue comes from the partner's Luma page (lib/
  // lumaEvents.ts) and is absent for the private events and the non-Luma ticketing, so the
  // second line only appears when there is something true to put in it.
  return (
    <>
      {s.room && (
        <p className="bp-card__room">
          <HostIcon />
          {`Hosted by ${s.room}`}
        </p>
      )}
      {s.location && (
        <p className="bp-card__room">
          <PinIcon />
          {s.location}
        </p>
      )}
    </>
  );
}

function SessionCard({
  s,
  onOpen,
  terms = [],
}: {
  s: Session;
  onOpen: (s: Session) => void;
  terms?: string[];
}) {
  const dim = terms.length > 0 && !matchesSpeaker(s, terms);
  const detail = hasDetail(s);
  const breath = isBreathwork(s);
  const opening = isOpening(s);
  const body = (
    <>
      <p className="bp-card__time">{timeLabel(s)}</p>
      {/* Above the title, where a kicker goes: it says what KIND of thing this is, which is
          the question the violet is answering. */}
      {breath && <BreathBadge />}
      {opening && <OpeningBadge />}
      <h3 className="bp-card__title">{s.name}</h3>
      <VenueLine s={s} />
      {s.description && <p className="bp-card__desc">{s.description}</p>}
      {peopleSummary(s.speakers) && (
        <p className="bp-card__speakers">{peopleSummary(s.speakers)}</p>
      )}
      {/* Last line on the card, Auri's placement: it is a caveat, not a headline. */}
      {s.access === "private-invite" && <p className="bp-card__note">{PRIVATE_NOTE}</p>}
    </>
  );
  const style = sessionVars(s);

  // A real <button> when it opens something, a plain <article> when it doesn't — rather than
  // a div with onClick. That is what makes it keyboard-reachable and announced as pressable.
  if (!detail) {
    return (
      <article
        className="bp-card"
        style={style}
        data-breathwork={breath ? "1" : undefined}
        data-opening={opening ? "1" : undefined}
        data-dim={dim ? "1" : undefined}
      >
        {body}
      </article>
    );
  }
  return (
    <button
      type="button"
      className="bp-card bp-card--open"
      style={style}
      data-breathwork={breath ? "1" : undefined}
      data-opening={opening ? "1" : undefined}
      data-dim={dim ? "1" : undefined}
      tabIndex={dim ? -1 : undefined}
      onClick={() => onOpen(s)}
      aria-label={`${s.name} — show details`}
    >
      {body}
    </button>
  );
}

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

function SessionDialog({ s, onClose }: { s: Session; onClose: () => void }) {
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
          {s.type && <span className="bp-modal__topic">{s.type}</span>}
        </p>

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

export default function BrellaProgramPage() {
  // This page reads Brella, not Airtable, so the refresh button forces a live Brella call.
  const { url, refresh } = useFreshUrl("/api/program?event=brella");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<Session>("brellaprogram", url, "sessions");
  const all = useMemo(() => data ?? [], [data]);

  const [section, setSection] = useState<SectionKey>("stages");
  const [open, setOpen] = useState<Session | null>(null);
  const close = useCallback(() => setOpen(null), []);
  // "" is the All pill. Reset whenever the section changes, since a track from the previous
  // section would filter the new one down to nothing.
  const [track, setTrack] = useState("");
  // The speaker search box. Kept OUT of the `days`/`timelineSessions` memos on purpose: this
  // dims cards, it does not remove them, so the layout must not depend on it.
  const [q, setQ] = useState("");
  // Event Rooms is filtered by TAG as well as by room. Reset whenever the section changes, so a
  // tag chosen under Event Rooms cannot quietly hide half of Stages.
  const [tags, setTags] = useState<string[]>([]);
  // Which stage column set to show. "" = all five.
  const [stage, setStage] = useState("");
  // Side Events is filtered by day rather than by track. Declared up here with the other
  // state because the `days` memo below reads it.
  const [sideDay, setSideDay] = useState("");

  // Switching section changes how tall the page is. Scrolled down, a shorter section makes the
  // browser clamp scrollTop and the whole view lurches. This pins the masthead: its distance
  // from the top of the viewport is measured before the switch and restored after layout, so
  // the thing you just clicked stays exactly where your eye already was.
  const barRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<number | null>(null);
  const changeSection = useCallback((k: SectionKey) => {
    anchor.current = barRef.current?.getBoundingClientRect().top ?? null;
    setSection(k);
    setTrack("");
    setStage("");
    setTags([]);
  }, []);
  // useLayoutEffect, not useEffect: this has to run before the browser paints, or the jump is
  // visible for a frame and then corrected, which looks worse than not correcting it.
  useLayoutEffect(() => {
    if (anchor.current == null || !barRef.current) return;
    const delta = barRef.current.getBoundingClientRect().top - anchor.current;
    anchor.current = null;
    if (delta) window.scrollBy(0, delta);
  }, [section]);

  // Restoring the scroll only works if the page is still tall enough to scroll there. Side
  // Events is a third the height of the timeline, so switching to it from deep in the page
  // let the browser clamp scrollTop and the view lurched ~390px despite the anchor. The
  // results area keeps a floor equal to the TALLEST section seen this visit, so the document
  // never shrinks under the scroll position. It only ever grows, so it cannot oscillate.
  const resultsRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(0);
  useLayoutEffect(() => {
    const h = resultsRef.current?.offsetHeight ?? 0;
    setFloor((f) => (h > f ? h : f));
  });
  // Day 1 unless it is actually the 27th. Set in an effect, not in useState's initialiser:
  // the initial render must match on server and client or React logs a hydration mismatch,
  // and the correct day depends on the visitor's clock.
  const [dayIdx, setDayIdx] = useState(0);
  useEffect(() => setDayIdx(defaultEventDay(new Date())), []);

  const inSection = useMemo(
    () =>
      all.filter((s) => inBrellaSection(s, section)),
    [all, section]
  );

  // Built from the data, so an empty track never gets a pill. Alphabetical apart from the
  // Grill tracks, which read better in their signage order.
  const tracks = useMemo(() => {
    const GRILL = ["Green Grill Session", "Blue Grill Session", "Orange Grill Session"];
    const seen = [...new Set(inSection.map((s) => s.room).filter(Boolean))];
    return seen.sort((a, b) => {
      const ga = GRILL.indexOf(a);
      const gb = GRILL.indexOf(b);
      if (ga !== -1 || gb !== -1) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [inSection]);

  // Same 26-27 rule as inSection, so a heading is never disabled while its section has rows
  // (or enabled while it has none).
  const counts = useMemo(() => {
    const c: Record<SectionKey, number> = { stages: 0, rooms: 0, grills: 0, side: 0 };
    for (const s of all) {
      // sectionKeyOf, not sectionOf(s.room): a side event's `room` is the hosting partner and
      // reads as a stage track, so counting by name alone left this heading on 0.
      const k = sectionKeyOf(s);
      if (inBrellaSection(s, k)) c[k]++;
    }
    return c;
  }, [all]);

  // Day → sessions, in day order, each day sorted by start time.
  const days = useMemo(() => {
    let visible = track ? inSection.filter((s) => s.room === track) : inSection;
    // Side Events is filtered by DAY, not by track: it has one track and three dates.
    if (section === "side" && sideDay) visible = visible.filter((s) => s.day === sideDay);
    const byDay = new Map<string, Session[]>();
    for (const s of visible) {
      const list = byDay.get(s.day);
      if (list) list.push(s);
      else byDay.set(s.day, [s]);
    }
    return [...byDay.entries()]
      .sort((a, b) => dayNumber(a[0]) - dayNumber(b[0]))
      .map(([day, list]) => ({
        day,
        sessions: list.sort(
          (a, b) => startMinutes(a.timeSlot) - startMinutes(b.timeSlot) || a.name.localeCompare(b.name)
        ),
      }));
  }, [inSection, track, section, sideDay]);

  const shown = days.reduce((n, d) => n + d.sessions.length, 0);

  // ── Timeline sections (Stages, Grill Sessions) ──
  // Columns come from the CANONICAL list, not from the data, so Campfire Stage keeps its
  // column while it is still empty. Selecting one narrows to a single column.
  const columnSet = TIMELINE_COLUMNS[section];
  const isTimeline = Boolean(columnSet);
  const timelineColumns = useMemo(
    () => (!columnSet ? [] : stage ? [stage] : columnSet.map((c) => c.label)),
    [columnSet, stage]
  );

  const timelineSessions = useMemo(() => {
    if (!columnSet) return [];
    const date = EVENT_DAYS[dayIdx].date;
    return all.filter(
      (s) =>
        inBrellaSection(s, section) &&
        s.day.includes(date) &&
        timelineColumns.includes(columnOf(s.room, columnSet) ?? s.room)
    );
  }, [all, dayIdx, section, columnSet, timelineColumns]);

  // The tags actually present on what is showing, with counts — never a fixed vocabulary. A
  // filter offering "Quantum Computing" on a day with no quantum session is a dead end, and
  // Brella's tag list is edited by marketing without warning.
  const tagCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const s of timelineSessions) for (const t of s.tags ?? []) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [timelineSessions]);

  const toggleTag = useCallback((t: string) => {
    setTags((cur) =>
      cur.includes(t)
        ? cur.filter((x) => x !== t)
        : // Three at once, matching the three a session can carry. A fourth would be a filter
          // that can only ever return nothing once the tags are disjoint.
          cur.length >= 3
          ? cur
          : [...cur, t]
    );
  }, []);

  const terms = useMemo(() => searchTerms(q), [q]);
  // Counted over what is CURRENTLY ON SCREEN, so "0 sessions" is answerable: the speaker is
  // real but is on the other day, or in a section you are not looking at. Counting across the
  // whole feed would report a match the visitor cannot see, which is worse than reporting none.
  const timelineMatches = useMemo(
    () => (terms.length ? timelineSessions.filter((s) => matchesSpeaker(s, terms)).length : 0),
    [timelineSessions, terms]
  );
  const listMatches = useMemo(
    () =>
      terms.length
        ? days.reduce((n, d) => n + d.sessions.filter((s) => matchesSpeaker(s, terms)).length, 0)
        : 0,
    [days, terms]
  );
  const hits = useMemo(() => speakerHits(all, terms, columnSet), [all, terms, columnSet]);

  // WHERE ELSE THE MATCHES ARE. A search only dims the day you are looking at, so a speaker who
  // is on the other day looks like a speaker who does not exist. These two drive the markers on
  // the day tabs and the stage headings, which is what turns "nothing here" into "over there".
  const dayMatches = useMemo(
    () =>
      EVENT_DAYS.map((d) =>
        terms.length
          ? all.filter(
              (s) => inBrellaSection(s, section) && s.day.includes(d.date) && matchesSpeaker(s, terms)
            ).length
          : 0
      ),
    [all, section, terms]
  );

  // Keyed by COLUMN, so a stage whose matching session is below the fold — or off to the side on
  // a narrow screen, where the timeline scrolls horizontally — still announces itself in the
  // header row that is always visible.
  const stageMatches = useMemo(() => {
    const m = new Map<string, number>();
    if (!terms.length || !columnSet) return m;
    for (const s of timelineSessions) {
      if (!matchesSpeaker(s, terms) || !matchesTags(s, tags)) continue;
      const col = columnOf(s.room, columnSet) ?? s.room;
      m.set(col, (m.get(col) ?? 0) + 1);
    }
    return m;
  }, [timelineSessions, terms, tags, columnSet]);

  /**
   * Picking a suggestion commits the name AND takes you to them: if none of their sessions are
   * on the day you are looking at, the day switches. Choosing a person and then being shown an
   * empty board is the one outcome the suggestion list exists to prevent.
   */
  const pickSpeaker = useCallback(
    (h: SpeakerHit) => {
      setQ(h.name);
      const here = EVENT_DAYS[dayIdx]?.date;
      if (here && !h.days.some((d) => d.includes(here))) {
        const target = EVENT_DAYS.findIndex((d) => h.days.some((hd) => hd.includes(d.date)));
        if (target >= 0) setDayIdx(target);
      }
    },
    [dayIdx]
  );

  // ── Side Events ──
  // Day chips instead of a track filter: there is only one track ("Side Event Promotion"), so
  // filtering by it was meaningless, while the events genuinely span 25-27 August.
  const sideDays = useMemo(() => {
    if (section !== "side") return [];
    const seen = [...new Set(inSection.map((s) => s.day))];
    return seen.sort((a, b) => dayNumber(a) - dayNumber(b));
  }, [inSection, section]);
  // Opens on ALL — sideDay "" — so the section reads as one list running down the page, the way
  // Event Rooms does with its "All" pill (Auri, 2026-08-04). The day chips narrow it from
  // there. No effect is needed to settle on a day any more: "" is a valid, and now the default,
  // state, and a day that disappears from the data simply stops matching.
  useEffect(() => {
    if (section === "side" && sideDay && !sideDays.includes(sideDay)) setSideDay("");
  }, [section, sideDays, sideDay]);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Brella · TechBBQ 2026 attendee app</p>
          <h1>
            Program <span className="text-tbbq-gradient">2026</span>
          </h1>
          <p className="lede">
            Live from Brella, the schedule the attendee app actually shows ·{" "}
            <strong>read-only</strong> · served as JSON at <code>/api/program?event=brella</code>.
          </p>

          {/* ONE snippet for the whole program. It fetches ?section=all, draws its own
              Stages / Event Rooms / Grill Sessions / Side Events masthead and switches
              between them client-side, so a WordPress page needs a single HTML widget
              rather than four. */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <CopyBrellaEmbed section="all" label="Copy embed (whole program)" />
            {/* ONE STAGE ON ITS OWN, for a page that is about that stage and nothing else — the
                Life Science page does not want a five-column board with four columns its readers
                did not come for (Auri, 2026-08-04). It follows the column picker below rather
                than being its own dropdown: pick Life Science, press this, paste. `key` so the
                button's "Copied" state cannot survive a switch and claim the previous stage's
                snippet was copied. */}
            {stage && (
              <CopyBrellaEmbed
                key={stage}
                section={section}
                stage={stage}
                label={`Copy embed (${stage})`}
              />
            )}
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              {stage
                ? `Two snippets: the whole program, or just ${stage} as its own timeline. Copy from the deployed dashboard, not localhost.`
                : "All four sections in one snippet. Pick a column below to also copy that stage on its own. Copy from the deployed dashboard, not localhost."}
            </span>
          </div>

          {/* The live schedule, so this is the one to press after a room or time moves. */}
          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey="brellaprogram"
              source="Brella"
            />
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {error && !data ? (
          <div className="notice">
            <strong>Could not load.</strong>
            <p>{error}</p>
          </div>
        ) : loading ? (
          <p className="count-line">Loading…</p>
        ) : (
          <>
            {/* The three big headings from the mock. Real buttons, not styled text: this is
                the primary control on the page and it has to be tabbable and announced. */}
            <div className="bp-sections" role="tablist" aria-label="Program section" ref={barRef}>
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  role="tab"
                  type="button"
                  aria-selected={section === s.key}
                  disabled={counts[s.key] === 0}
                  onClick={() => changeSection(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Stages is a timeline; every other section stays a card list, because only the
                stages run in parallel against a clock. */}
            <div ref={resultsRef} style={floor ? { minHeight: floor } : undefined}>
            {isTimeline ? (
              <>
                <div className="bp-controls">
                <div className="seg bp-tracks bp-tracks--center" role="tablist" aria-label="Filter by column">
                  <button role="tab" aria-selected={stage === ""} onClick={() => setStage("")}>
                    {section === "grills"
                      ? "All grills"
                      : section === "rooms"
                        ? "All rooms"
                        : "All stages"}
                  </button>
                  {(columnSet ?? []).map((c) => (
                    <button
                      key={c.label}
                      role="tab"
                      aria-selected={stage === c.label}
                      onClick={() => setStage(c.label)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="seg bp-days" role="tablist" aria-label="Event day">
                  {EVENT_DAYS.map((d, i) => (
                    <button
                      key={d.date}
                      role="tab"
                      aria-selected={dayIdx === i}
                      onClick={() => setDayIdx(i)}
                      // Marked when the search has matches on this day and you are not on it —
                      // the whole point is to say "they are over here", so the tab you are
                      // already looking at never lights up.
                      data-hasmatch={dayMatches[i] > 0 && dayIdx !== i ? "1" : undefined}
                    >
                      <span className="bp-days__n">{d.label}</span>
                      <span className="bp-days__date">{d.date}</span>
                      {dayMatches[i] > 0 && dayIdx !== i && (
                        <span className="bp-days__badge">{dayMatches[i]}</span>
                      )}
                    </button>
                  ))}
                </div>
                </div>

                <SpeakerSearch
                  q={q}
                  setQ={setQ}
                  matches={timelineMatches}
                  hits={hits}
                  onPick={pickSpeaker}
                />

                {/* TAG FILTER. Only where the tags are worth filtering by: the stages board is
                    five named programmes and the tag adds little, while a room is a place and
                    the tag is the only thing that says what kind of session is in it. */}
                {section === "rooms" && tagCounts.length > 0 && (
                  <TagFilter counts={tagCounts} chosen={tags} onToggle={toggleTag} onClear={() => setTags([])} />
                )}

                <p className="count-line">
                  {timelineSessions.length} session(s).
                  {revalidating && <span className="reval"> · checking for updates…</span>}
                  {updated && <span className="reval"> · updated</span>}
                </p>

                <StageTimeline
                  columns={timelineColumns}
                  sessions={timelineSessions}
                  onOpen={setOpen}
                  terms={terms}
                  tags={tags}
                  stageMatches={stageMatches}
                  columnSet={columnSet ?? []}
                />
              </>
            ) : (
              <>
                {/* Rendered even for a single-track section. Hiding it removed a whole row
                    from the page, so switching to Side Events shunted everything below it
                    upwards — the jumping Auri reported. */}
                <div className="bp-controls">
                  {section === "side" ? (
                    /* One track and three dates, so "All / Side Event Promotion" filtered
                       nothing. Days are the useful axis here, with an All that lists every day
                       down the page the way the track filters do elsewhere. */
                    <div className="seg bp-days" role="tablist" aria-label="Event day">
                      <button role="tab" aria-selected={sideDay === ""} onClick={() => setSideDay("")}>
                        <span className="bp-days__n">ALL</span>
                        <span className="bp-days__date">{inSection.length} events</span>
                      </button>
                      {sideDays.map((d) => (
                        <button
                          key={d}
                          role="tab"
                          aria-selected={sideDay === d}
                          onClick={() => setSideDay(d)}
                        >
                          <span className="bp-days__n">{weekdayLabel(d).split(" ")[0]}</span>
                          <span className="bp-days__date">
                            {weekdayLabel(d).split(" ").slice(1).join(" ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="seg bp-tracks bp-tracks--center" role="tablist" aria-label="Filter by track">
                      <button role="tab" aria-selected={track === ""} onClick={() => setTrack("")}>
                        All
                      </button>
                      {tracks.map((t) => (
                        <button
                          key={t}
                          role="tab"
                          aria-selected={track === t}
                          onClick={() => setTrack(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <SpeakerSearch q={q} setQ={setQ} matches={listMatches} hits={hits} onPick={pickSpeaker} />

                <p className="count-line">
                  {shown} session(s).
                  {revalidating && <span className="reval"> · checking for updates…</span>}
                  {updated && <span className="reval"> · updated</span>}
                </p>

                {days.length === 0 ? (
                  <p className="count-line">Nothing scheduled here yet.</p>
                ) : (
                  days.map(({ day, sessions }) => (
                    <section key={day} className="bp-day">
                      <h2 className="bp-day__label">{dayLabel(day)}</h2>
                      <div className="bp-grid">
                        {sessions.map((s) => (
                          <SessionCard key={s.id} s={s} onOpen={setOpen} terms={terms} />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </>
            )}
            </div>
          </>
        )}
      </div>

      {open && <SessionDialog s={open} onClose={close} />}
    </main>
  );
}
