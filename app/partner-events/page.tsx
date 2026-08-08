"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEventEmbed } from "@/components/CopyEventEmbed";

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

const FILTERS = [
  { key: "all", label: "All events", color: null },
  { key: "side-event", label: "Side Events", color: "#CE0F2E" },
  { key: "event-room", label: "Event Rooms", color: "#1B6CA8" },
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
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
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
// Opening badges — that is the slot on this card that answers "what kind of thing is this".
function KindBadge({ ev }: { ev: PartnerEvent }) {
  return <span className="bp-kind">{ev.kindLabel}</span>;
}

function PartnerLogo({ ev }: { ev: PartnerEvent }) {
  const [loaded, setLoaded] = useState(false);
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
      <KindBadge ev={ev} />
      <h3 className="bp-card__title">{ev.title}</h3>
      {ev.company && (
        <p className="bp-card__room">
          <HostIcon />
          Hosted by {ev.company}
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
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<PartnerEvent>("partnerevents", url, "events");
  const all = data ?? [];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  // "" is the ALL tab, which lists every day down the page — the same shape as the Side Events
  // day tabs on /brella-program.
  const [day, setDay] = useState("");
  const [open, setOpen] = useState<PartnerEvent | null>(null);

  // Filtered client-side so switching kinds never refetches — the whole list is 15 rows,
  // and /api/partner-events?kind=… exists for consumers that want it server-side.
  const events = useMemo(
    () => (filter === "all" ? all : all.filter((e) => e.kind === filter)),
    [all, filter]
  );

  const counts = useMemo(
    () => ({
      all: all.length,
      "side-event": all.filter((e) => e.kind === "side-event").length,
      "event-room": all.filter((e) => e.kind === "event-room").length,
    }),
    [all]
  );

  // Every date present in the CURRENT kind filter, so switching to Side Events cannot leave a tab
  // selected that now holds nothing.
  const dayKeys = useMemo(() => {
    const keys = new Set(events.map((e) => e.date ?? NO_DATE));
    return [...keys].sort();
  }, [events]);

  // The days actually rendered, each with its events sorted by start time.
  const days = useMemo(() => {
    const wanted = day && dayKeys.includes(day) ? [day] : dayKeys;
    return wanted.map((k) => ({
      key: k,
      events: events
        .filter((e) => (e.date ?? NO_DATE) === k)
        .sort((a, b) => startMinutes(a.timeSlot) - startMinutes(b.timeSlot)),
    }));
  }, [events, dayKeys, day]);

  const shown = days.reduce((n, d) => n + d.events.length, 0);

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
            {/* Two rows of tabs inside one control block, the Program 2026 arrangement: WHAT
                (kind) above WHEN (day). Both are `.seg`, so they are the same control as the
                track and day switchers on that page rather than a second tab style. */}
            <div className="bp-controls">
              <div className="seg bp-tracks bp-tracks--center" role="tablist" aria-label="Filter by kind">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    role="tab"
                    aria-selected={filter === f.key}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label} ({counts[f.key]})
                  </button>
                ))}
              </div>

              <div className="seg bp-days" role="tablist" aria-label="Event day">
                <button role="tab" aria-selected={day === ""} onClick={() => setDay("")}>
                  <span className="bp-days__n">ALL</span>
                  <span className="bp-days__date">{events.length} events</span>
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

            <p className="count-line" style={{ textAlign: "center" }}>
              {shown} event(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {days.length === 0 ? (
              <p className="count-line">Nothing scheduled here yet.</p>
            ) : (
              days.map((d) => (
                <section key={d.key} className="bp-day">
                  <h2 className="bp-day__label">
                    {d.key === NO_DATE ? "Date still to be confirmed" : dayLabel(d.key)}
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
    </main>
  );
}
