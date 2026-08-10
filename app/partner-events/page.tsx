"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEventEmbed } from "@/components/CopyEventEmbed";
import { venueLabel } from "@/lib/venueLabel";
// The Event Rooms board is Program 2026's OWN timeline, not a lookalike. Extracted to
// components/ProgramTimeline.tsx so both pages mount the same component (Auri, 2026-08-10).
import { StageTimeline, SessionDialog, type Session } from "@/components/ProgramTimeline";
import {
  EVENT_DAYS,
  TIMELINE_COLUMNS,
  columnOf,
  inBrellaSection,
  brellaDayLabel,
} from "@/lib/brellaSections";

// One card per partner-hosted event: Side Events in red, Event Rooms in blue.
// Fed by /api/partner-events — see lib/partnerevents.ts for why that lib addresses
// Airtable fields by ID (three columns share the name "Date of Event ").
//
// ─── IT LOOKS LIKE PROGRAM 2026 ON PURPOSE ──────────────────────────────────────────────
// Auri, 2026-08-08: make this look the same as Program 2026. It was a wall of logo cards with
// its own `.ev-*` styling; these are SESSIONS, the same kind of thing /brella-program lists, and
// two schedules in one dashboard that look nothing alike is the thing that made "Side Events &
// Event Rooms" and "Program 2026" read as unrelated products.
//
// So this page now reuses the `.bp-*` classes from /brella-program RATHER THAN COPYING THEM:
// day tabs (`.seg.bp-days`), one `.bp-day` block per date, a `.bp-grid` of `.bp-card`s, and a
// click-to-open `.bp-modal`. Restyling a card in globals.css now moves both pages, which is the
// point — the `.ev-*` block is what let them drift apart.
//
// Three things deliberately kept from the old design, all of them hard-won:
//   1. The kind colour still drives the card (red Side Event, blue Event Room). It feeds
//      `--track`, the variable `.bp-card` already uses for its spine.
//   2. The logo sits on a LIGHT panel (`.bp-card__thumb--logo`). Partner logos are mostly
//      dark-on-transparent PNGs and vanish on the dark wash `.bp-card__thumb` uses for the
//      Brella posters. That was found the hard way; see lightTint() below.
//   3. Register lives ONLY in the dialog, matching Program 2026 — a pill on every card turned
//      the section into a wall of buttons (Auri, 2026-08-04).
//
// NOT changed: the WordPress embed (lib/eventEmbedSnippet.ts) still draws the old card wall. The
// dashboard and the embed are now two different designs — see progress.md before assuming that
// is a bug to fix rather than a decision to make.
type PartnerEvent = {
  id: string;
  title: string;
  company: string;
  kind: "side-event" | "event-room";
  kindLabel: string;
  color: string;
  date: string | null;
  dateLabel: string | null;
  timeSlot: string | null;
  accessKind: "public" | "private-invite" | null;
  accessLabel: string | null;
  description: string | null;
  registerUrl: string | null;
  logo: string | null;
  image?: string | null;
  venue?: string | null;
  city?: string | null;
};

// The kind colour drives the spine, badge and button. Computed here rather than with CSS
// color-mix() so it renders identically in older Safari.
function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Blend `amount` of the kind colour into a solid base, returning an OPAQUE rgb().
// Opacity matters: a translucent tint sits over whatever is behind it, and the hover glow
// is behind these — a red-on-translucent-red badge disappeared entirely once the red glow
// lit up underneath it. Solid colours are immune.
function mix(hex: string, amount: number, base: string): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const b = parseInt(base.replace("#", ""), 16);
  const ch = (shift: number) =>
    Math.round((((b >> shift) & 255) * (1 - amount)) + (((c >> shift) & 255) * amount));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

// The logo panel is a LIGHT tint of the kind colour, not a dark one. Partner logos are
// almost all dark-on-transparent PNGs (Rockstart, advores, OMR Reviews were invisible on
// a dark red panel), so the block is mixed toward white instead — still legibly red or
// blue, but the logos actually read. Caveat: a partner who uploads a WHITE logo will
// vanish on it; that is a swap in Airtable, not a code fix.
function lightTint(hex: string, amount: number): string {
  return mix(hex, amount, "#ffffff");
}

// TWO tabs, no "All events" (Auri, 2026-08-10). The mixed view was the reason the cards needed a
// "Side Event" / "Event Room" badge at all, and the reason a day block could hold two different
// layouts. With the kinds always separated, each tab shows one thing one way.
//
// `dot` is which side the kind's colour sits on: red to the LEFT of Side Events, blue to the RIGHT
// of Event Rooms, so the two markers land on the outer edges of the pair rather than pointing at
// each other.
const FILTERS = [
  { key: "side-event", label: "Side Events", color: "#CE0F2E", dot: "left" },
  { key: "event-room", label: "Event Rooms", color: "#1B6CA8", dot: "right" },
] as const;

// Same sentence as /brella-program, character for character. Two pages telling a visitor the same
// rule in two different wordings is how "private" starts meaning two things.
const PRIVATE_NOTE =
  "Private event · you need an invitation or the host's approval to attend";

// "09:30-11:30" → 570, for sorting a day's cards by when they start. The feed has already
// normalised this string (lib/partnerevents.ts parseTimeSlot), so anything unparseable here is
// absent rather than malformed — those sort last, which is where an unscheduled event belongs.
function startMinutes(slot: string | null): number {
  if (!slot) return Number.MAX_SAFE_INTEGER;
  const m = /^(\d{2}):(\d{2})/.exec(slot);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
}

// "2026-08-26" → "Wednesday 26 August", the day heading. UTC for the same reason the feed
// formats in UTC: these are date-only cells, and a zone west of UTC renders them a day early.
// "25 AUG", the same short form Program 2026 prints above each day block. It used to read
// "TUESDAY 25 AUGUST", which was the loudest line on the page and made the two schedules look
// like different products (Auri, 2026-08-10).
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(d)
    .toUpperCase();
}

// The two lines inside a day tab: "WED" over "26 Aug".
function tabLabel(iso: string): { n: string; date: string } {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return { n: "TBC", date: "" };
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(d);
  return { n: f({ weekday: "short" }).toUpperCase(), date: f({ day: "numeric", month: "short" }) };
}

// The bucket for events whose partner never filled in a date. A real key rather than null so it
// can be a tab and a heading like any other day, and sorted last by the "z" prefix.
const NO_DATE = "zzz-no-date";

// Second stop of the hover glow, per kind. The speaker cards fade a diagonal
// black -> colour -> lighter-colour -> transparent gradient in (.s-card::after), so these
// keep that shape: a Side Event reuses the site's exact fire pairing (#CE0F2E -> #FA7000),
// and an Event Room mirrors it in blue (#1B6CA8 -> #2BB4E1) the way the Life Science cards
// use cyan -> teal.
const GLOW_SECOND: Record<string, string> = {
  "side-event": "#FA7000",
  "event-room": "#2BB4E1",
};

// The kind colour, handed to the shared `.bp-card` / `.bp-modal` styles the same way
// /brella-program hands over a track colour.
function kindVars(ev: PartnerEvent): React.CSSProperties {
  return {
    "--track": ev.color,
    // The logo panel. Mixed toward WHITE, not toward the card, because partner logos are almost
    // all dark-on-transparent PNGs — Rockstart, advores and OMR Reviews were invisible on a dark
    // panel. A partner who uploads a white logo will vanish on it; that is a swap in Airtable.
    "--kind-panel": lightTint(ev.color, 0.1),
    // Backs the kind badge. Solid rgb, not rgba: as a tint it disappeared into the hover glow.
    "--kind-soft": mix(ev.color, 0.18, "#131313"),
    "--glow-a": tint(ev.color, 0.92),
    "--glow-b": tint(GLOW_SECOND[ev.kind] ?? ev.color, 0.6),
  } as React.CSSProperties;
}

// The kind is a kicker above the title, exactly where Program 2026 puts its Breathwork and
// The "Side Event" / "Event Room" badge. Off the CARDS since the mixed tab went away
// (Auri, 2026-08-10): with one kind per tab it only repeated the heading above it, and Program
// 2026's cards carry no such badge. Kept in the DIALOG, which is a standalone context — once it is
// open over the page, nothing else on screen says which kind you are looking at.
function KindBadge({ ev }: { ev: PartnerEvent }) {
  return <span className="bp-kind">{ev.kindLabel}</span>;
}

/**
 * The card's picture. THE EVENT'S OWN ARTWORK WHERE IT EXISTS, the company logo where it does not.
 *
 * Program 2026 has always shown the poster a partner made for their event, scraped from og:image
 * on the registration page (lib/eventPages.ts). This page only ever had the Airtable company
 * logo, and that single difference is what still made the two look like different products even
 * once they shared a card (Auri, 2026-08-10).
 *
 * The two need OPPOSITE backgrounds, which is why this is one component and not two:
 *   artwork  full-bleed on the dark wash `.bp-card__thumb` uses on Program 2026
 *   logo     contained on a LIGHT panel, because partner logos are mostly dark-on-transparent
 *            PNGs that vanish on a dark ground. Hard-won; see lightTint() above.
 *
 * A logo is only reached for when there is no artwork, so Event Rooms (no register link, nothing
 * to scrape) look exactly as they did before.
 */
function PartnerLogo({ ev }: { ev: PartnerEvent }) {
  const [loaded, setLoaded] = useState(false);
  const art = ev.image || null;
  if (art) {
    return (
      <figure className={"bp-card__thumb" + (loaded ? "" : " shimmer")}>
        {/* eslint-disable-next-line @next/next/no-img-element */
        }
        <img
          src={art}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          // A partner can change or unpublish their page at any time. On a broken poster the
          // figure is emptied rather than left showing a browser's torn-image icon.
          onError={(e) => {
            setLoaded(true);
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </figure>
    );
  }
  return (
    <figure className={"bp-card__thumb bp-card__thumb--logo" + (ev.logo && !loaded ? " shimmer" : "")}>
      {ev.logo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={ev.logo}
          alt={ev.company ? `${ev.company} logo` : ""}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      ) : (
        <span className="bp-card__initial" aria-hidden="true">
          {(ev.company || ev.title).trim().charAt(0).toUpperCase()}
        </span>
      )}
    </figure>
  );
}

// A card is a BUTTON when there is something behind it and a plain article when there is not —
// the same rule as SessionCard in /brella-program, and the reason it is keyboard-reachable.
// Only the 6 Side Events carry a description or a register link; the 13 Event Rooms open nothing,
// so they must not look pressable.
function hasDetail(ev: PartnerEvent): boolean {
  return Boolean(ev.description || ev.registerUrl);
}

function EventCard({ ev, onOpen }: { ev: PartnerEvent; onOpen: (ev: PartnerEvent) => void }) {
  const body = (
    <>
      <PartnerLogo ev={ev} />
      {/* Time first, in the card's own time slot. "Time TBC" is not printed: most of these have
          no time yet and a grid of italic placeholders reads as broken data rather than as a
          schedule. The gaps panel above already names the ones that are missing. */}
      <p className="bp-card__time">{ev.timeSlot ?? ev.dateLabel ?? "Date TBC"}</p>
      <h3 className="bp-card__title">{ev.title}</h3>
      {ev.company && (
        <p className="bp-card__room">
          <HostIcon />
          Hosted by {ev.company}
        </p>
      )}
      {/* WHERE it is, on its own line under WHO runs it — the two answer different questions, so
          Program 2026 gives them a line each and this now matches. Comes from the same
          registration-page lookup as the artwork, so it is present on the Luma events and absent
          on the Event Rooms; the line only renders when there is something true to put in it.
          Airtable has no address column at all, which is why it cannot come from there. */}
      {venueLabel(ev.venue, ev.city, ev.company) && (
        <p className="bp-card__room">
          <PinIcon />
          {venueLabel(ev.venue, ev.city, ev.company)}
        </p>
      )}
      {ev.description && <p className="bp-card__desc">{ev.description}</p>}
      {/* Last line, Auri's placement: a condition of attending, not a headline. */}
      {ev.accessKind === "private-invite" && <p className="bp-card__note">{PRIVATE_NOTE}</p>}
    </>
  );

  if (!hasDetail(ev)) {
    return (
      <article className="bp-card" style={kindVars(ev)}>
        {body}
      </article>
    );
  }
  return (
    <button
      type="button"
      className="bp-card bp-card--open"
      style={kindVars(ev)}
      onClick={() => onOpen(ev)}
      aria-label={`${ev.title} — show details`}
    >
      {body}
    </button>
  );
}

// Lucide "map-pin", inlined the same way Program 2026 does it — this repo has no lucide-react
// and one icon does not justify adding it.
function PinIcon() {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// Lucide "building-2": the host is a company, not a venue. Same icon Program 2026 uses on a
// side event's host line.
function HostIcon() {
  return (
    <svg
      className="bp-card__pin"
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
    </svg>
  );
}

// The magnifier from Program 2026's search box, same size and stroke.
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

/**
 * Search across host, title and description.
 *
 * No speaker suggestions like Program 2026's box, because these events carry no speakers — the
 * useful thing to type here is a partner's name. It FILTERS rather than dims: this is a grid of
 * cards with no clock to keep aligned, so removing what does not match is the honest answer and
 * the layout simply reflows.
 */
function EventSearch({ q, setQ, matches }: { q: string; setQ: (v: string) => void; matches: number }) {
  const active = q.trim().length > 0;
  return (
    <div className="bp-search">
      <div className="bp-search__box">
        <SearchIcon />
        <input
          type="search"
          className="bp-search__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by host, title or description…"
          aria-label="Search events"
          autoComplete="off"
          spellCheck={false}
        />
        {active && (
          <button type="button" className="bp-search__clear" onClick={() => setQ("")} aria-label="Clear search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {/* Empty at rest and hidden by :empty, the same rule Program 2026 uses. */}
      <p className="bp-search__hint" aria-live="polite">
        {active ? (matches > 0 ? `${matches} event${matches === 1 ? "" : "s"} match` : "No event matches that") : ""}
      </p>
    </div>
  );
}

function EventDialog({ ev, onClose }: { ev: PartnerEvent; onClose: () => void }) {
  // Escape closes, and the page behind is locked so a scroll over the overlay does not silently
  // move the list underneath. Same as SessionDialog in /brella-program.
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
      aria-labelledby="ev-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bp-modal" style={kindVars(ev)}>
        <button type="button" className="bp-modal__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Day before the time, always shown: a dialog has no day heading above it. */}
        <p className="bp-modal__time">
          <span className="bp-modal__day">{ev.dateLabel ?? "Date TBC"}</span>
          {ev.timeSlot ?? "Time TBC"}
        </p>
        <KindBadge ev={ev} />
        <h2 className="bp-modal__title" id="ev-dialog-title">
          {ev.title}
        </h2>
        {ev.company && (
          <p className="bp-modal__meta">
            <HostIcon />
            Hosted by {ev.company}
          </p>
        )}

        {/* Unclamped here — the card shows three lines, this is where the rest lives. */}
        {ev.description && (
          <div className="bp-modal__desc">
            {ev.description
              .split("\n")
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
        )}

        {ev.registerUrl && (
          <p className="bp-modal__cta">
            <a href={ev.registerUrl} target="_blank" rel="noopener noreferrer">
              Register for this event
            </a>
          </p>
        )}
        {/* Directly under the button it explains, so nobody presses it expecting a ticket. */}
        {ev.accessKind === "private-invite" && <p className="bp-modal__note">{PRIVATE_NOTE}</p>}
      </div>
    </div>
  );
}

export default function PartnerEventsPage() {
  const { url, refresh } = useFreshUrl("/api/partner-events");
  // AND the Brella programme, for the Event Rooms board only.
  //
  // WHY A SECOND SOURCE ON AN AIRTABLE PAGE. Program 2026's Event Rooms is a timeline with a
  // column per room, and Airtable cannot fill those columns: of 16 event-room rows, 2 carry a
  // Location and the two disagree in format. Brella has every one of them on a proper
  // `Event Room N` track, so the board is read from there. Auri's call, after being shown the
  // alternative of filling that column (2026-08-10).
  //
  // Side Events stay on Airtable, which is the source that knows all of them and carries the
  // sign-up links. So this page reads Airtable for one tab and Brella for the other, on purpose.
  const brella = useCachedList<Session>("brellaprogram", "/api/program?event=brella", "sessions");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<PartnerEvent>("partnerevents", url, "events");
  const all = data ?? [];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("side-event");
  // "" is the ALL tab, which lists every day down the page — the same shape as the Side Events
  // day tabs on /brella-program.
  const [day, setDay] = useState("");
  const [open, setOpen] = useState<PartnerEvent | null>(null);
  const [q, setQ] = useState("");
  // Which day the Event Rooms board shows. Its own state, because that board is a timeline
  // against a clock and can only ever draw ONE day — unlike the Side Events cards, whose "ALL"
  // tab lists every day down the page.
  const [roomDay, setRoomDay] = useState(0);
  const [openSession, setOpenSession] = useState<Session | null>(null);

  // Filtered client-side so switching kinds never refetches — the whole list is 15 rows,
  // and /api/partner-events?kind=… exists for consumers that want it server-side.
  const events = useMemo(
    () => all.filter((e) => e.kind === filter),
    [all, filter]
  );

  // Host, title and description, accent-folded so "Erhvervshus" is found by typing "erhvervshus"
  // and Danish spelling is not a trap. Applied AFTER the kind filter and BEFORE the day split,
  // so a search that empties a day removes that day's heading with it rather than leaving a bare
  // date above nothing.
  const searched = useMemo(() => {
    const needle = q.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!needle) return events;
    return events.filter((e) =>
      [e.title, e.company, e.description, e.kindLabel]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(needle)
    );
  }, [events, q]);

  const counts = useMemo(
    () => ({
      "side-event": all.filter((e) => e.kind === "side-event").length,
      "event-room": all.filter((e) => e.kind === "event-room").length,
    }),
    [all]
  );

  // Every date present in the CURRENT kind filter, so switching to Side Events cannot leave a tab
  // selected that now holds nothing.
  const dayKeys = useMemo(() => {
    const keys = new Set(searched.map((e) => e.date ?? NO_DATE));
    return [...keys].sort();
  }, [searched]);

  // The days actually rendered, each with its events sorted by start time.
  const days = useMemo(() => {
    const wanted = day && dayKeys.includes(day) ? [day] : dayKeys;
    return wanted.map((k) => ({
      key: k,
      events: searched
        .filter((e) => (e.date ?? NO_DATE) === k)
        .sort((a, b) => startMinutes(a.timeSlot) - startMinutes(b.timeSlot)),
    }));
  }, [searched, dayKeys, day]);

  const shown = days.reduce((n, d) => n + d.events.length, 0);

  // ── the Event Rooms board, straight from Brella ───────────────────────────────────────────
  const roomColumns = TIMELINE_COLUMNS.rooms ?? [];
  const roomSessions = useMemo(() => {
    const date = EVENT_DAYS[roomDay]?.date;
    if (!date) return [];
    return (brella.data ?? []).filter(
      (s) => inBrellaSection(s, "rooms") && s.day.includes(date)
    );
  }, [brella.data, roomDay]);

  // Column → how many sessions the search lit up, for the marker on each heading. Empty when
  // nothing is typed, which is what tells the timeline not to dim anything.
  const roomMatches = useMemo(() => {
    const m = new Map<string, number>();
    const needle = q.trim().toLowerCase();
    if (!needle) return m;
    for (const s of roomSessions) {
      const hay = [s.name, s.room, s.description, ...(s.speakers ?? []).map((p) => p.name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) continue;
      const col = columnOf(s.room, roomColumns) ?? s.room;
      m.set(col, (m.get(col) ?? 0) + 1);
    }
    return m;
  }, [roomSessions, q, roomColumns]);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-2.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">
            Partnership Success · Airtable “2026 Side event and event room info”
          </p>
          <h1>
            Side Events &amp; <span className="text-tbbq-gradient">Event Rooms</span>
          </h1>
          <p className="lede">
            Live from Airtable · <span style={{ color: "#CE0F2E" }}>red = Side Event</span>,{" "}
            <span style={{ color: "#1B6CA8" }}>blue = Event Room</span> · served as JSON at{" "}
            <code>/api/partner-events</code> (add <code>?kind=side-event</code> or{" "}
            <code>?kind=event-room</code>).
          </p>

          {/* Three snippets: the combined grid with its own centered tabs, plus one per
              kind for pages that only want Side Events or only Event Rooms (those pass
              kindTabs={false} — a single-kind list has nothing to filter). */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <CopyEventEmbed path="/api/partner-events" label="Copy embed (all + tabs)" />
            <CopyEventEmbed
              path="/api/partner-events?kind=side-event"
              kindTabs={false}
              label="Copy embed (Side Events)"
            />
            <CopyEventEmbed
              path="/api/partner-events?kind=event-room"
              kindTabs={false}
              label="Copy embed (Event Rooms)"
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copy from the deployed dashboard, not localhost.
            </span>
          </div>

          {/* Side events change late and often, so this is the page most likely to need a
              read that does not wait for the next cycle. */}
          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey="partnerevents"
            />
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {/* Source-data gaps, for the TechBBQ team. Deliberately NOT in the embed snippet —
            this is an internal note about Airtable, not something a techbbq.dk visitor
            should read. Each line names the exact field so it is actionable. */}
        <section className="ev-gaps" aria-label="Missing source data">
          <h2>Still missing in Airtable</h2>
          <ul>
            <li>
              <strong>Start / end times</strong> — filled on the 8 Event Rooms scheduled in the
              planning sheet&rsquo;s <em>Event Rooms</em> tab, still empty on every Side Event.
              Type them into <code>Time slot</code> as <code>09:30-17:30</code> and the card
              picks them up; a value that cannot be read is dropped rather than shown, so check
              the card after editing.
            </li>
            <li>
              <strong>Venue address</strong> — <em>no such column exists</em> in the table&rsquo;s
              128 fields. One has to be created before addresses can show.
            </li>
            <li>
              <strong>Category labels</strong> — <code>Key Topics/Industries</code> already has
              the right options and 57 rows filled elsewhere, but zero on these events.
            </li>
            <li>
              <strong>Private vs invitation-only</strong> — cannot be separated.{" "}
              <code>Event type</code> offers only <em>Public Event</em> and{" "}
              <em>Private Event (invite only)</em>, so those two states are fused into one. A
              third option would split them.
            </li>
            <li>
              <strong>Description + Register link</strong> — present on the 6 Side Events only,
              never on the 13 Event Rooms, so those cards show no blurb and no button.
            </li>
            <li>
              <strong>1 event has no date</strong> (shown as <em>Date TBC</em>), and{" "}
              <strong>1 has no logo</strong> (falls back to a company initial).
            </li>
          </ul>
          <p className="ev-gaps__foot">
            Everything above appears automatically once the source is filled in — except the
            address, which needs a new column, and the three-way access split, which needs a
            third select option. Also: 3 untitled rows and 1 duplicate submission are filtered
            out, so 19 rows in the view become 15 events.
          </p>
        </section>

        {error && !data ? (
          <div className="notice">
            <strong>Could not load.</strong>
            <p>{error}</p>
          </div>
        ) : loading ? (
          <p className="count-line">Loading…</p>
        ) : (
          <>
            {/* WHAT you are looking at, as the page's masthead control — the same `.bp-sections`
                headings Program 2026 uses for Stages / Event Rooms / Grill Sessions / Side
                Events. These were small `.seg` pills, which is what still made the two schedules
                read as different products even after they shared a card (Auri, 2026-08-10).
                The count rides along as a small superscript so nothing is lost to the restyle. */}
            <div className="bp-sections" role="tablist" aria-label="Filter by kind">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  type="button"
                  aria-selected={filter === f.key}
                  disabled={counts[f.key] === 0}
                  onClick={() => setFilter(f.key)}
                  title={`${counts[f.key]} ${f.label.toLowerCase()}`}
                >
                  {/* The kind's colour, as a dot. Decorative — the word beside it already says
                      which kind this is, so it must not be announced twice. */}
                  {f.dot === "left" && (
                    <span className="bp-sections__dot" style={{ background: f.color }} aria-hidden="true" />
                  )}
                  {f.label}
                  {f.dot === "right" && (
                    <span className="bp-sections__dot" style={{ background: f.color }} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>

            {/* DAY PILLS. The Event Rooms board draws one day at a time against a clock, so it
                gets the two-day switcher Program 2026 uses. Side Events keeps its own ALL + per-day
                tabs, which can list every day down the page because it is a card grid. */}
            {filter === "event-room" ? (
              <div className="bp-controls">
                <div className="seg bp-days" role="tablist" aria-label="Programme day">
                  {EVENT_DAYS.map((d, i) => (
                    <button
                      key={d.date}
                      role="tab"
                      aria-selected={roomDay === i}
                      onClick={() => setRoomDay(i)}
                    >
                      <span className="bp-days__n">DAY {i + 1}</span>
                      <span className="bp-days__date">{d.date}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
            <div className="bp-controls">
              <div className="seg bp-days" role="tablist" aria-label="Event day">
                <button role="tab" aria-selected={day === ""} onClick={() => setDay("")}>
                  <span className="bp-days__n">ALL</span>
                  <span className="bp-days__date">{searched.length} events</span>
                </button>
                {dayKeys.map((k) => {
                  const t = tabLabel(k);
                  return (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={day === k}
                      onClick={() => setDay(k)}
                    >
                      <span className="bp-days__n">{k === NO_DATE ? "TBC" : t.n}</span>
                      <span className="bp-days__date">
                        {k === NO_DATE ? "no date" : t.date}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            <EventSearch
              q={q}
              setQ={setQ}
              matches={filter === "event-room" ? [...roomMatches.values()].reduce((a, b) => a + b, 0) : shown}
            />

            <p className="count-line" style={{ textAlign: "center" }}>
              {shown} event(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {filter === "event-room" ? (
              roomSessions.length === 0 ? (
                <p className="count-line">Nothing on this day yet.</p>
              ) : (
                <StageTimeline
                  columns={roomColumns.map((c) => c.label)}
                  columnSet={roomColumns}
                  sessions={roomSessions}
                  onOpen={setOpenSession}
                  terms={q.trim() ? [q.trim().toLowerCase()] : []}
                  tags={[]}
                  stageMatches={roomMatches}
                  // Room boards open early enough for the whole-day band to announce itself
                  // above the first session, same as Program 2026 passes.
                  openAt={9 * 60}
                />
              )
            ) : days.length === 0 ? (
              <p className="count-line">
                {q.trim() ? "No event matches that search." : "Nothing scheduled here yet."}
              </p>
            ) : (
              days.map((d) => (
                <section key={d.key} className="bp-day">
                  <h2 className="bp-day__label">
                    {d.key === NO_DATE ? "DATE TBC" : dayLabel(d.key)}
                  </h2>
                  <div className="bp-grid">
                    {d.events.map((ev) => (
                      <EventCard key={ev.id} ev={ev} onOpen={setOpen} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {open && <EventDialog ev={open} onClose={() => setOpen(null)} />}
      {/* The Brella board's own dialog, the same one Program 2026 opens — a room session has
          speakers and a description this page has no Airtable row for. */}
      {openSession && <SessionDialog s={openSession} onClose={() => setOpenSession(null)} />}
    </main>
  );
}
