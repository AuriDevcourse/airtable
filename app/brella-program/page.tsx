"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyBrellaEmbed } from "@/components/CopyBrellaEmbed";
import {
  HOST_ICON_PATHS,
  STAGE_ICON_PATHS,
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
  weekdayLabel,
  EVENT_DAYS,
  brellaDayLabel as dayLabel,
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

function shortNames(speakers: Speaker[] | undefined, n = 2): string {
  const ordered = orderedSpeakers(speakers);
  if (!ordered.length) return "";
  const shown = ordered.slice(0, n).map((p) => p.name);
  const rest = ordered.length - shown.length;
  return shown.join(", ") + (rest > 0 ? ` +${rest}` : "");
}

/** The little stack of faces on a card. Initials when Brella has no photo. */
function Avatars({ speakers, n = 2 }: { speakers: Speaker[] | undefined; n?: number }) {
  const people = orderedSpeakers(speakers).slice(0, n);
  if (!people.length) return null;
  return (
    <span className="bp-tl__faces" aria-hidden="true">
      {people.map((p) =>
        p.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={p.id} className="bp-tl__face" src={p.photo} alt="" loading="lazy" />
        ) : (
          <span key={p.id} className="bp-tl__face bp-tl__face--empty">
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

function StageTimeline({
  columns,
  sessions,
  onOpen,
}: {
  columns: string[];
  sessions: Session[];
  onOpen: (s: Session) => void;
}) {
  // Everything with a real clock time goes on the grid; "All day" entries cannot be placed
  // against a time axis and get a strip of their own above it.
  const timed: Placed[] = [];
  const allDay: Session[] = [];
  for (const s of sessions) {
    const t = parseSlot(s.timeSlot);
    if (t) timed.push({ ...s, ...t });
    else allDay.push(s);
  }

  // Always open at 09:00 even when the first session is later, so the two days line up and
  // the morning gap is visible rather than cropped away.
  const start = Math.min(DAY_START_MIN, ...timed.map((s) => s.start));
  const end = Math.max(start + 60, ...timed.map((s) => s.end));
  const from = Math.floor(start / SLOT_MIN) * SLOT_MIN;
  const to = Math.ceil(end / SLOT_MIN) * SLOT_MIN;
  const height = (to - from) * PX_PER_MIN;

  const ticks: number[] = [];
  for (let t = from; t <= to; t += SLOT_MIN) ticks.push(t);

  return (
    <div className="bp-tl" style={{ "--cols": columns.length } as React.CSSProperties}>
      {allDay.length > 0 && (
        <div className="bp-tl__allday">
          <span className="bp-tl__alldayLabel">All day</span>
          <div>
            {allDay.map((s) => (
              <button
                key={s.id}
                type="button"
                className="bp-tl__chipCard"
                style={sessionVars(s)}
                onClick={() => onOpen(s)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bp-tl__head">
        <span className="bp-tl__gutterHead" />
        {columns.map((c) => (
          <span key={c} className="bp-tl__colHead" title={c} style={trackVars(c)}>
            <StageIcon stage={c} />
            <span>{c}</span>
          </span>
        ))}
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
          const mine = timed
            .filter((s) => (stageOf(s.room) ?? s.room) === col)
            .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
          const placed = withLanes(mine);
          return (
            <div key={col} className="bp-tl__col">
              {placed.length === 0 && (
                <p className="bp-tl__empty">
                  {/campfire/i.test(col) ? "Program coming soon" : "Nothing scheduled"}
                </p>
              )}
              {placed.map((s) => {
                const detail = hasDetail(s);
                const h = Math.max(MIN_CARD_PX, (s.end - s.start) * PX_PER_MIN - 4);
                // Below ~46px there is only room for one line, so the card drops the time
                // and the speaker count rather than showing three clipped half-lines.
                const compact = h < 46;
                // Between the two: room for the title and time, not for a row of faces.
                // 78px measured: 2 lines of title (32) + time (14) + faces (16) + padding (12).
                const tight = !compact && h < 78;
                const style = {
                  ...sessionVars(s),
                  top: (s.start - from) * PX_PER_MIN,
                  height: h,
                  left: `${(s.lane * 100) / s.lanes}%`,
                  width: `${100 / s.lanes}%`,
                } as React.CSSProperties;
                const names = shortNames(s.speakers);
                const inner = (
                  <>
                    {/* Five words then an ellipsis. The full title is the element's title
                        attribute and the whole session is one click away. */}
                    <span className="bp-tl__cardTitle">{firstWords(s.name)}</span>
                    <span className="bp-tl__cardTime">{s.timeSlot}</span>
                    {names && (
                      <span className="bp-tl__cardMeta">
                        <Avatars speakers={s.speakers} />
                        <span className="bp-tl__cardNames">{names}</span>
                      </span>
                    )}
                  </>
                );
                return detail ? (
                  <button
                    key={s.id}
                    type="button"
                    className="bp-tl__card bp-tl__card--open"
                    style={style}
                    data-compact={compact ? "1" : undefined}
                    data-tight={tight ? "1" : undefined}
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
                    data-tight={tight ? "1" : undefined}
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

function SessionCard({ s, onOpen }: { s: Session; onOpen: (s: Session) => void }) {
  const detail = hasDetail(s);
  const body = (
    <>
      <p className="bp-card__time">{timeLabel(s)}</p>
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
      <article className="bp-card" style={style}>
        {body}
      </article>
    );
  }
  return (
    <button
      type="button"
      className="bp-card bp-card--open"
      style={style}
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
            {p.role && <span className="bp-person__tag">{p.role}</span>}
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
            {p.role && <span className="bp-person__tag">{p.role}</span>}
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

        <p className="bp-modal__time">{timeLabel(s)}</p>
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
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              All four sections in one snippet. Copy from the deployed dashboard, not localhost.
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
                    {section === "grills" ? "All grills" : "All stages"}
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
                    >
                      <span className="bp-days__n">{d.label}</span>
                      <span className="bp-days__date">{d.date}</span>
                    </button>
                  ))}
                </div>
                </div>

                <p className="count-line">
                  {timelineSessions.length} session(s).
                  {revalidating && <span className="reval"> · checking for updates…</span>}
                  {updated && <span className="reval"> · updated</span>}
                </p>

                <StageTimeline
                  columns={timelineColumns}
                  sessions={timelineSessions}
                  onOpen={setOpen}
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
                          <SessionCard key={s.id} s={s} onOpen={setOpen} />
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
