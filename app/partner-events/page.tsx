"use client";

import { useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { useCachedList } from "@/lib/useCachedList";
import { CopyEventEmbed } from "@/components/CopyEventEmbed";

// One card per partner-hosted event: Side Events in red, Event Rooms in blue.
// Fed by /api/partner-events — see lib/partnerevents.ts for why that lib addresses
// Airtable fields by ID (three columns share the name "Date of Event ").
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

// Second stop of the hover glow, per kind. The speaker cards fade a diagonal
// black -> colour -> lighter-colour -> transparent gradient in (.s-card::after), so these
// keep that shape: a Side Event reuses the site's exact fire pairing (#CE0F2E -> #FA7000),
// and an Event Room mirrors it in blue (#1B6CA8 -> #2BB4E1) the way the Life Science cards
// use cyan -> teal.
const GLOW_SECOND: Record<string, string> = {
  "side-event": "#FA7000",
  "event-room": "#2BB4E1",
};

function EventCard({ ev }: { ev: PartnerEvent }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <article
      className="ev-card"
      style={
        {
          "--kind": ev.color,
          // Solid, NOT rgba: this backs the kind badge, which sits above the hover glow.
          // As a translucent tint the badge's red text vanished into the red glow.
          "--kind-soft": mix(ev.color, 0.18, "#131313"),
          "--kind-panel": lightTint(ev.color, 0.1),
          // Same alphas as .s-card::after: .92 on the first stop, .6 on the second.
          "--glow-a": tint(ev.color, 0.92),
          "--glow-b": tint(GLOW_SECOND[ev.kind] ?? ev.color, 0.6),
        } as React.CSSProperties
      }
    >
      <div className={"ev-card__media" + (ev.logo && !loaded ? " shimmer" : "")}>
        {ev.logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="ev-card__logo"
            src={ev.logo}
            alt={ev.company ? `${ev.company} logo` : ""}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        ) : (
          <span className="ev-card__logo--empty" aria-hidden="true">
            {(ev.company || ev.title).trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="ev-card__body">
        <div className="ev-card__tags">
          <span className="ev-card__kind">{ev.kindLabel}</span>
          {ev.accessLabel && (
            <span
              className={
                "ev-card__access" +
                (ev.accessKind === "private-invite" ? " ev-card__access--private" : "")
              }
            >
              {ev.accessLabel}
            </span>
          )}
          {/* Day and time are ONE wrapping unit. Left as two siblings of the badges they
              broke apart on a three-badge card: the badges filled the line and the time
              dropped underneath, left-aligned, while every two-badge card kept it inline. */}
          <span className="ev-card__when">
            {ev.dateLabel ? (
              <span className="ev-card__date">{ev.dateLabel}</span>
            ) : (
              <span className="ev-card__date ev-card__date--none">Date TBC</span>
            )}
            {/* No "Time TBC" counterpart: most of these have no time yet, and a page of
                italic placeholders reads as missing data rather than as a schedule. The
                gaps panel above already names it. */}
            {ev.timeSlot && <span className="ev-card__time">{ev.timeSlot}</span>}
          </span>
        </div>

        <h3 className="ev-card__title">{ev.title}</h3>
        {ev.company && <p className="ev-card__company">{ev.company}</p>}
        {ev.description && <p className="ev-card__desc">{ev.description}</p>}

        {ev.registerUrl && (
          <div className="ev-card__cta">
            <a href={ev.registerUrl} target="_blank" rel="noopener noreferrer">
              Register
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

export default function PartnerEventsPage() {
  const { data, loading, revalidating, error, updated } = useCachedList<PartnerEvent>(
    "partnerevents",
    "/api/partner-events",
    "events"
  );
  const all = data ?? [];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

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
            <div className="ev-tabs">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  // data-k drives the "All" pill's dark-ink carve-out in globals.css: it has
                  // no --tab-color, so it would otherwise render white text on white.
                  data-k={f.key}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  style={f.color ? ({ "--tab-color": f.color } as React.CSSProperties) : undefined}
                >
                  {f.label} ({counts[f.key]})
                </button>
              ))}
            </div>

            {/* Centered to sit under the centered tabs. */}
            <p className="count-line" style={{ marginTop: 16, textAlign: "center" }}>
              {events.length} event(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            <div className="ev-grid">
              {events.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
