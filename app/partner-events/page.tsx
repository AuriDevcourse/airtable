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

// The logo panel is a LIGHT tint of the kind colour, not a dark one. Partner logos are
// almost all dark-on-transparent PNGs (Rockstart, advores, OMR Reviews were invisible on
// a dark red panel), so the block is mixed toward white instead — still legibly red or
// blue, but the logos actually read. Caveat: a partner who uploads a WHITE logo will
// vanish on it; that is a swap in Airtable, not a code fix.
function lightTint(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const mix = (c: number) => Math.round(255 * (1 - amount) + c * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const FILTERS = [
  { key: "all", label: "All events", color: null },
  { key: "side-event", label: "Side Events", color: "#CE0F2E" },
  { key: "event-room", label: "Event Rooms", color: "#1B6CA8" },
] as const;

function EventCard({ ev }: { ev: PartnerEvent }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <article
      className="ev-card"
      style={
        {
          "--kind": ev.color,
          // Badge/pill background stays a dark tint (it sits on the card, not behind a
          // logo); only the logo panel goes light.
          "--kind-soft": tint(ev.color, 0.14),
          "--kind-panel": lightTint(ev.color, 0.1),
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
          {ev.dateLabel ? (
            <span className="ev-card__date">{ev.dateLabel}</span>
          ) : (
            <span className="ev-card__date ev-card__date--none">Date TBC</span>
          )}
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
