"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { useCachedList } from "@/lib/useCachedList";
import { CopyBrellaEmbed } from "@/components/CopyBrellaEmbed";
import {
  BRELLA_SECTIONS as SECTIONS,
  brellaDayLabel as dayLabel,
  inBrellaSection,
  sectionOf,
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
};

// Track → accent colour for the card's left bar. The Grill tracks are literally named after
// their colour, so those are matched by name rather than assigned from a rotation: an
// "Orange Grill Session" card with a green bar would be actively wrong on site signage.
// Everything else falls back to the house fire red.
const TRACK_COLORS: [RegExp, string][] = [
  [/green grill/i, "#5CBC8B"],
  [/blue grill/i, "#1B6CA8"],
  [/orange grill/i, "#FA7000"],
  [/founders stage/i, "#CE0F2E"],
  [/india/i, "#2BB4E1"],
  [/^event room|^rooms?\b/i, "#1B6CA8"],
  [/^side event/i, "#CE0F2E"],
];

function trackColor(room: string): string {
  for (const [re, color] of TRACK_COLORS) if (re.test(room)) return color;
  return "#FA7000";
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

// A session is worth opening only if the dialog would show something the card does not:
// the speaker list, or a description long enough that the card's 3-line clamp hides part of
// it. Making every card clickable would promise detail that half of them do not have.
function hasDetail(s: Session): boolean {
  return Boolean(s.speakers?.length) || s.description.length > 150;
}

function SessionCard({ s, onOpen }: { s: Session; onOpen: (s: Session) => void }) {
  const detail = hasDetail(s);
  const speakerCount = s.speakers?.length ?? 0;
  const body = (
    <>
      <p className="bp-card__time">{s.timeSlot || "Time TBC"}</p>
      <h3 className="bp-card__title">{s.name}</h3>
      {s.room && (
        <p className="bp-card__room">
          <PinIcon />
          {s.room}
        </p>
      )}
      {s.description && <p className="bp-card__desc">{s.description}</p>}
      {speakerCount > 0 && (
        <p className="bp-card__speakers">
          {speakerCount} speaker{speakerCount === 1 ? "" : "s"}
        </p>
      )}
    </>
  );
  const style = { "--track": trackColor(s.room) } as React.CSSProperties;

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
      <div className="bp-modal" style={{ "--track": trackColor(s.room) } as React.CSSProperties}>
        <button type="button" className="bp-modal__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <p className="bp-modal__time">{s.timeSlot || "Time TBC"}</p>
        <h2 className="bp-modal__title" id="bp-dialog-title">
          {s.name}
        </h2>
        <p className="bp-modal__meta">
          <PinIcon />
          {/* Brella's `location` often repeats the track name verbatim ("Founders Stage ·
              Founders Stage"), so it is only appended when it says something new. */}
          {[s.room, s.location !== s.room ? s.location : ""].filter(Boolean).join(" · ")}
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

        {s.speakers && s.speakers.length > 0 && (
          <>
            <h3 className="bp-modal__heading">Speakers</h3>
            <ul className="bp-people">
              {s.speakers.map((p) => (
                <li key={p.id} className="bp-person">
                  {p.photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="bp-person__photo" src={p.photo} alt="" loading="lazy" />
                  ) : (
                    <span className="bp-person__photo bp-person__photo--empty" aria-hidden="true">
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="bp-person__name">{p.name}</p>
                    {(p.title || p.company) && (
                      <p className="bp-person__role">
                        {[p.title, p.company].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {p.bio && <p className="bp-person__bio">{p.bio}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export default function BrellaProgramPage() {
  const { data, loading, revalidating, error, updated } = useCachedList<Session>(
    "brellaprogram",
    "/api/program?event=brella",
    "sessions"
  );
  const all = useMemo(() => data ?? [], [data]);

  const [section, setSection] = useState<SectionKey>("stages");
  const [open, setOpen] = useState<Session | null>(null);
  const close = useCallback(() => setOpen(null), []);
  // "" is the All pill. Reset whenever the section changes, since a track from the previous
  // section would filter the new one down to nothing.
  const [track, setTrack] = useState("");

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
    const c: Record<SectionKey, number> = { stages: 0, rooms: 0, side: 0 };
    for (const s of all) {
      const k = sectionOf(s.room);
      if (inBrellaSection(s, k)) c[k]++;
    }
    return c;
  }, [all]);

  // Day → sessions, in day order, each day sorted by start time.
  const days = useMemo(() => {
    const visible = track ? inSection.filter((s) => s.room === track) : inSection;
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
  }, [inSection, track]);

  const shown = days.reduce((n, d) => n + d.sessions.length, 0);

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

          {/* One button per section, because a WordPress page shows one of these at a time.
              The snippet bakes in the section, so the embed needs no section switcher. */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {SECTIONS.map((sec) => (
              <CopyBrellaEmbed
                key={sec.key}
                section={sec.key}
                label={`Copy embed (${sec.label})`}
              />
            ))}
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copy from the deployed dashboard, not localhost.
            </span>
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
            <div className="bp-sections" role="tablist" aria-label="Program section">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  role="tab"
                  type="button"
                  aria-selected={section === s.key}
                  disabled={counts[s.key] === 0}
                  onClick={() => {
                    setSection(s.key);
                    setTrack("");
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {tracks.length > 1 && (
              <div className="seg bp-tracks" role="tablist" aria-label="Filter by track">
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

      {open && <SessionDialog s={open} onClose={close} />}
    </main>
  );
}
