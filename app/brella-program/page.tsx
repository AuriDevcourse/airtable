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
import {
  HostIcon,
  PRIVATE_NOTE,
  PinIcon,
  Session,
  Speaker,
  SpeakerHit,
  StageIcon,
  StageTimeline,
  dayNumber,
  isModerator,
  matchesSpeaker,
  matchesTags,
  normalise,
  peopleSummary,
  searchTerms,
  sessionVars,
  speakerHits,
  startMinutes,
  timeLabel,
  BreathIcon,
  OpeningIcon,
  hasDetail,
  BreathBadge,
  OpeningBadge,
  SessionDialog,
} from "@/components/ProgramTimeline";

// The live Brella schedule, laid out the way Auri's mock does it: three big section
// headings (Stages / Event Rooms / Side Events), a pill per track inside the section, then
// the sessions as cards grouped under a day heading.
//
// Read-only view over /api/program?event=brella — the same feed the /program page's Brella
// tab uses. Nothing here writes; the key behind that feed can create and delete sessions in
// the live attendee app, which is why lib/brellaprogram.ts is GET-only.

/** Where the chosen board is remembered between visits. Versioned so a future rename of the
 *  section keys cannot resurrect a value this build does not understand. */
const SECTION_KEY = "bp-section-v1";

/**
 * Topic-tag filter: type a tag, it completes it, Add pins it. Up to three.
 *
 * A type-to-complete box rather than the row of every tag it used to be. The event defines 45
 * topics once the room and hall labels are stripped, and 45 chips is a wall to read through
 * when you already know you want "FinTech". Typing three letters beats scanning.
 *
 * Dims rather than removes, like the speaker search above it and for the same reason: pulling
 * cards out collapses the columns and the clock stops lining up across rooms, which is the only
 * thing a timeline is for.
 *
 * Three at once, matching the three a session can carry. The cap is enforced in addTag; here it
 * only has to SHOW that it is in force, or an input that silently refuses reads as broken.
 *
 * Suggestions carry their session count and are drawn from what is actually on screen, so the
 * list never offers a topic that would dim everything.
 */
function TagSearch({
  counts,
  chosen,
  onAdd,
  onRemove,
  onClear,
  matches,
  speakerHint,
}: {
  counts: [string, number][];
  chosen: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
  onClear: () => void;
  matches: number;
  /** The speaker box's own line, rendered here so both hints sit together. */
  speakerHint?: string;
}) {
  const [draft, setDraft] = useState("");
  const [hi, setHi] = useState(0);
  const full = chosen.length >= 3;

  const suggestions = useMemo(() => {
    const q = normalise(draft);
    return counts
      .filter(([t]) => !chosen.includes(t))
      .filter(([t]) => !q || normalise(t).includes(q))
      .slice(0, 8);
  }, [counts, chosen, draft]);

  const quick = useMemo(() => counts.filter(([t]) => !chosen.includes(t)).slice(0, 6), [counts, chosen]);

  // Keep the highlight inside the list as it shrinks under the typing.
  useEffect(() => {
    setHi((h) => (h < suggestions.length ? h : 0));
  }, [suggestions.length]);

  const commit = useCallback(
    (t?: string) => {
      const pick = t ?? suggestions[hi]?.[0];
      if (!pick || full) return;
      onAdd(pick);
      setDraft("");
      setHi(0);
    },
    [suggestions, hi, full, onAdd]
  );

  return (
    <div className="bp-tags">
      {chosen.length > 0 && (
        <div className="bp-tags__row" role="group" aria-label="Chosen topics">
          {chosen.map((t) => (
            <button
              key={t}
              type="button"
              className="bp-tags__chip"
              aria-pressed
              onClick={() => onRemove(t)}
              title="Remove this topic"
            >
              {t}
              <span className="bp-tags__x" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
          <button type="button" className="bp-tags__clear" onClick={onClear}>
            Clear
          </button>
        </div>
      )}

      <div className="bp-tagbox">
        <input
          className="bp-tagbox__input"
          type="text"
          role="combobox"
          aria-expanded={suggestions.length > 0 && draft.length > 0}
          aria-controls="bp-tag-suggestions"
          aria-label="Filter by topic"
          placeholder={full ? "Three topics is the maximum" : "Filter by topic, e.g. FinTech"}
          value={draft}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          className="bp-tagbox__add"
          disabled={full || !suggestions.length}
          onClick={() => commit()}
        >
          Add
        </button>

        {draft.length > 0 && !full && (
          <ul className="bp-tagbox__list" id="bp-tag-suggestions" role="listbox">
            {suggestions.length === 0 ? (
              <li className="bp-tagbox__none">No topic matches “{draft}”</li>
            ) : (
              suggestions.map(([t, n], i) => (
                <li key={t}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === hi}
                    className={i === hi ? "is-hi" : undefined}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => commit(t)}
                  >
                    <span>{t}</span>
                    <span className="bp-tags__n">{n}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* The busiest topics on this board, one click away. `counts` arrives sorted by session
          count, so this is just the head of it. Six because that is one comfortable line; more
          and it becomes the wall of chips the type-ahead replaced. */}
      {!full && quick.length > 0 && (
        <div className="bp-tags__quick">
          <span className="bp-tags__quicklabel">Popular</span>
          {quick.map(([t, n]) => (
            <button key={t} type="button" className="bp-tags__chip" onClick={() => onAdd(t)}>
              {t}
              <span className="bp-tags__n">{n}</span>
            </button>
          ))}
        </div>
      )}

      {speakerHint && (
        <p className="bp-tags__hint" aria-live="polite">
          {speakerHint}
        </p>
      )}

      {/* Empty until something is chosen, and hidden by `:empty` in CSS. Kept in the DOM rather
          than conditionally rendered so the live region exists before it has anything to say —
          a region that mounts already-full is not reliably announced. */}
      <p className="bp-tags__hint" aria-live="polite">
        {chosen.length === 0
          ? ""
          : `${matches} session(s) carry ${chosen.length === 1 ? "this topic" : "any of these topics"} · ${chosen.length} of 3 · everything else is dimmed`}
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
/**
 * The line under the speaker box. Lifted out of the component because the timeline view now
 * renders it down with the topic hint instead (Auri, 2026-08-10) — two hint lines stacked in
 * two different places read as two unrelated controls.
 */
function speakerHintText(active: boolean, matches: number): string {
  // Nothing at rest (Auri, 2026-08-10): the standing instruction was clutter under a box that
  // already has a placeholder saying the same thing. The line earns its space only once it is
  // reporting a real result.
  if (!active) return "";
  return matches > 0
    ? `${matches} session${matches === 1 ? "" : "s"} here · everything else dimmed`
    : "Nothing on this day — the highlighted tab has them";
}

function SpeakerSearch({
  q,
  setQ,
  matches,
  hits,
  onPick,
  showHint = true,
}: {
  q: string;
  setQ: (v: string) => void;
  matches: number;
  /** False where the parent renders the hint itself, next to the topic hint. */
  showHint?: boolean;
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
      {showHint && (
        <p className="bp-search__hint" aria-live="polite">
          {speakerHintText(active, matches)}
        </p>
      )}
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
      {/* THE PARTNER'S OWN ARTWORK, above everything, because that is the first thing a side
          event is recognised by (Auri, 2026-08-07: "they usually have a visual to represent
          it"). Only side events have one — see `image` in lib/program.ts.

          `alt=""` on purpose: the title is right underneath in text, so describing the poster
          again would make a screen reader read the event twice. The image is decoration here.

          Errors HIDE the figure rather than leaving a broken-image glyph. These are third-party
          CDNs and a partner can replace or unpublish their page at any time, so a picture that
          stops resolving must cost nothing more than the space it used. */}
      {s.image && (
        <figure className="bp-card__thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.currentTarget.closest("figure") as HTMLElement | null)?.style.setProperty(
                "display",
                "none"
              );
            }}
          />
        </figure>
      )}
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
  // Picking a column also drops any chosen topics. The topic filter is hidden on a single
  // column, so a tag left on from the whole-board view would go on dimming cards with nothing
  // on screen to say why or to turn it off.
  const changeStage = useCallback((s: string) => {
    setStage(s);
    setTags([]);
  }, []);
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
    // Remember which board you were on. Refreshing while reading Grill Sessions used to drop
    // you back on Stages (Auri, 2026-08-10), which is the wrong answer every time: a refresh
    // means "show me this again", not "start over".
    try {
      window.localStorage.setItem(SECTION_KEY, k);
    } catch {
      // Private mode or a full quota. Losing the memory is not worth breaking the click.
    }
  }, []);

  // Restore it on load. In an effect rather than the useState initialiser because this
  // component is still server-rendered: reading localStorage up there would either be undefined
  // on the server or produce a hydration mismatch. The one-frame flash of Stages is the price.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(SECTION_KEY);
    } catch {
      saved = null;
    }
    // Validated against the real list: a stale or hand-edited value must not put the page into
    // a section that no longer exists.
    if (saved && saved !== "stages" && isBrellaSection(saved)) setSection(saved);
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

  // WHICH DAYS THE CHOSEN COLUMN ACTUALLY RUNS ON. Only meaningful once one column is picked:
  // the whole-board view always spans both days. Deep Tech Event Day is Event Room 6 on 26
  // August and nothing else, so a DAY 2 tab there is a tab onto an empty board (Auri,
  // 2026-08-11). Derived from the data, so a room that gains a second day gets its tab back
  // without an edit here.
  const columnDays = useMemo(() => {
    const every = EVENT_DAYS.map((_, i) => i);
    if (!columnSet || !stage) return every;
    const has = every.filter((i) =>
      all.some(
        (s) =>
          inBrellaSection(s, section) &&
          s.day.includes(EVENT_DAYS[i].date) &&
          (columnOf(s.room, columnSet) ?? s.room) === stage
      )
    );
    // A column with nothing on it at all keeps both tabs rather than showing none: an empty
    // board with a day on it reads as "nothing scheduled", an empty board with no day reads
    // as broken.
    return has.length ? has : every;
  }, [all, section, columnSet, stage]);

  // Follow the column onto a day it actually runs. Without this, picking Event Room 6 on the
  // 27th leaves dayIdx on DAY 2, whose tab has just disappeared, and the board goes blank.
  useEffect(() => {
    if (!columnDays.includes(dayIdx)) setDayIdx(columnDays[0]);
  }, [columnDays, dayIdx]);

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

  // Three at once, matching the three a session can carry. A fourth would be a filter that can
  // only ever return nothing once the tags are disjoint.
  const addTag = useCallback((t: string) => {
    setTags((cur) => (cur.includes(t) || cur.length >= 3 ? cur : [...cur, t]));
  }, []);
  const removeTag = useCallback((t: string) => {
    setTags((cur) => cur.filter((x) => x !== t));
  }, []);

  // How many of the sessions on screen the chosen tags actually keep lit. Reported to the
  // visitor, because a filter that dimmed everything looks identical to a filter that is broken.
  const tagMatchCount = useMemo(
    () => (tags.length ? timelineSessions.filter((s) => matchesTags(s, tags)).length : timelineSessions.length),
    [timelineSessions, tags]
  );

  // The topic filter, and with it the speaker box's hint line, which is rendered inside it.
  const showTags = tagCounts.length > 0 && !stage;

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
                // The programme, when the column has one. "Copy embed (Event Room 6)" is the
                // right snippet under a name nobody uses — the page it is going on is about
                // Deep Tech Event Day, and that is what has to be on the button (Auri,
                // 2026-08-11). Room number kept alongside it: it is what the pill above says.
                label={`Copy embed (${[stage, ...roomProgrammes(stage)].join(" · ")})`}
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
                  <button role="tab" aria-selected={stage === ""} onClick={() => changeStage("")}>
                    {section === "grills"
                      ? "All Grill Sessions"
                      : section === "rooms"
                        ? "All rooms"
                        : "All stages"}
                  </button>
                  {(columnSet ?? []).map((c) => (
                    <button
                      key={c.label}
                      role="tab"
                      aria-selected={stage === c.label}
                      onClick={() => changeStage(c.label)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="seg bp-days" role="tablist" aria-label="Event day">
                  {columnDays.map((i) => EVENT_DAYS[i]).map((d, n) => {
                    const i = columnDays[n];
                    return (
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
                    );
                  })}
                </div>
                </div>

                <SpeakerSearch
                  q={q}
                  setQ={setQ}
                  matches={timelineMatches}
                  hits={hits}
                  onPick={pickSpeaker}
                  // The hint moves down to the topic block below. Kept here only when there is
                  // no topic block to move it into, which is Side Events: it carries no tags.
                  showHint={!showTags}
                />

                {/* TAG FILTER. On every board that has tags, not just Event Rooms as before
                    (Auri, 2026-08-10). The old row-of-every-chip was too heavy for the stages
                    board; a type-to-complete box is not, and "show me the FinTech sessions"
                    is a fair question to ask of any of them.

                    GONE ONCE ONE COLUMN IS CHOSEN (Auri, 2026-08-11). Topics are how you choose
                    BETWEEN rooms; on a single room running a single programme they filter a list
                    short enough to read straight through, and they crowd out the two facts the
                    board exists to state — which room, and which day. This mirrors the embed,
                    where a single-column snippet drops them for the same reason. */}
                {showTags && (
                  <TagSearch
                    counts={tagCounts}
                    chosen={tags}
                    onAdd={addTag}
                    onRemove={removeTag}
                    onClear={() => setTags([])}
                    matches={tagMatchCount}
                    speakerHint={speakerHintText(q.trim().length > 0, timelineMatches)}
                  />
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
                  openAt={section === "rooms" ? DAY_START_MIN : undefined}
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
