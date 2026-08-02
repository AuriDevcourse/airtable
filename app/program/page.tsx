"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList } from "@/lib/useCachedList";
import { buildAgendaSnippet } from "@/lib/agendaSnippet";

type Session = {
  id: string;
  name: string;
  day: string;
  timeSlot: string;
  type: string;
  description: string;
  room: string;
};

// One tab per event program. brella reads the live TechBBQ 2026 schedule out of the Brella
// attendee app (30 sessions, the real one); techbbq reads the purpose-built Program 2026
// Airtable table; niss/fintech read the program views the teams fill inside their own
// tables. heading/note bake a fixed date line + ticket notice into that event's embed.
type EventKey = "brella" | "techbbq" | "niss" | "fintech";
const EVENTS: {
  key: EventKey;
  label: string;
  heading?: string;
  note?: string;
  theme?: "orange" | "blue";
  icons?: boolean;
  bigOpening?: boolean;
}[] = [
  { key: "brella", label: "TechBBQ 2026 (Brella)", heading: "August 26th & 27th" },
  { key: "techbbq", label: "TechBBQ 2026 (Airtable)" },
  {
    key: "niss",
    label: "NISS 2026",
    heading: "August 26th",
    note: "Access to the program on 26th of August is for the holders of TechBBQ tickets only",
  },
  // Fintech's design (Auri's mock): blue palette on #111827, no title icons, and
  // every title the same size (no oversized Opening).
  { key: "fintech", label: "Future of Fintech", theme: "blue", icons: false, bigOpening: false },
];

// The agenda has its own snippet builder, so it gets its own copy button rather than
// the speakers CopyEmbed. Same behavior: fresh uid per copy, __ORIGIN__ → live URL.
function CopyAgendaEmbed({
  path,
  heading,
  note,
  theme,
  icons,
  bigOpening,
}: {
  path: string;
  heading?: string;
  note?: string;
  theme?: "orange" | "blue";
  icons?: boolean;
  bigOpening?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const uid = "tbbq-" + Math.random().toString(36).slice(2, 8);
    const code = buildAgendaSnippet({ uid, path, heading, note, theme, icons, bigOpening }).replace(/__ORIGIN__/g, window.location.origin);
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button type="button" className="copy-embed" onClick={copy}>
      {copied ? "Copied" : "Copy embed code"}
    </button>
  );
}

export default function ProgramPage() {
  // Brella first: it's the schedule that's actually filled in.
  const [event, setEvent] = useState<EventKey>("brella");
  // Bumped by the refresh button. It goes into the URL rather than being a bare re-render
  // trigger, because the value has to reach the network: `?fresh=<n>` is what makes the
  // request miss the CDN and skip the server's hour-long cache. Zero means "normal cached
  // read", which is what an ordinary visit does.
  const [fresh, setFresh] = useState(0);

  const base = event === "techbbq" ? "/api/program" : `/api/program?event=${event}`;
  const path = fresh ? `${base}${base.includes("?") ? "&" : "?"}fresh=${fresh}` : base;

  // The cache key stays free of `fresh`, so the localStorage baseline survives a refresh and
  // the change report has something to diff against.
  const { data, loading, revalidating, error, revalidateError, changes } = useCachedList<Session>(
    `program:${event}`,
    path,
    "sessions"
  );
  const sessions = data ?? [];

  // Group by day, preserving the API's day → time order. Single-day programs (NISS)
  // have day="" and render as one unlabeled group.
  const days: { day: string; items: Session[] }[] = [];
  for (const s of sessions) {
    const last = days[days.length - 1];
    if (last && last.day === s.day) last.items.push(s);
    else days.push({ day: s.day, items: [s] });
  }

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Programs · one source per event</p>
          <h1>
            Program <span className="text-tbbq-gradient">2026</span>
          </h1>
          <p className="lede">
            The public agendas. TechBBQ 2026 comes live from Brella, the attendee app, with
            times converted to Copenhagen; the other events come from their Airtable views.
            One entry per session: time slot, topic, name, description, stage. Served as
            JSON at <code>/api/program</code>.
          </p>

          <div className="seg" role="tablist" aria-label="Program" style={{ marginTop: 28 }}>
            {EVENTS.map((e) => (
              <button
                key={e.key}
                role="tab"
                aria-selected={event === e.key}
                onClick={() => setEvent(e.key)}
              >
                {e.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyAgendaEmbed
              // `base`, never `path`: path can carry ?fresh=, and that URL is authenticated.
              // Baking it into an Elementor snippet would 401 for every public visitor.
              path={base}
              heading={EVENTS.find((e) => e.key === event)?.heading}
              note={EVENTS.find((e) => e.key === event)?.note}
              theme={EVENTS.find((e) => e.key === event)?.theme}
              icons={EVENTS.find((e) => e.key === event)?.icons}
              bigOpening={EVENTS.find((e) => e.key === event)?.bigOpening}
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet with the {EVENTS.find((e) => e.key === event)?.label} agenda.
            </span>
          </div>

          {/* Forces a live Airtable read for the open tab, bypassing the 1h cache, and
              reports what changed. Works on the deployed dashboard too — the bypass is
              gated by the dashboard password. */}
          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={() => setFresh((n) => n + 1)}
              changes={changes}
              error={revalidateError}
              resetKey={event}
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
            <p className="count-line">
              {sessions.length} session(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
            </p>
            {days.map(({ day, items }) => (
              <section key={day || "single-day"} style={{ marginTop: 28 }}>
                {day && <h2 style={{ fontSize: 22, margin: "0 0 14px" }}>{day}</h2>}
                {items.map((s) => (
                  <article
                    key={s.id}
                    style={{
                      display: "flex",
                      gap: 20,
                      background: "var(--color-card)",
                      borderRadius: 16,
                      padding: "18px 20px",
                      marginBottom: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "0 0 110px", fontWeight: 600, color: "var(--color-orange, #fa7000)" }}>
                      {s.timeSlot}
                    </div>
                    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 17 }}>{s.name}</h3>
                      {(s.type || s.room) && (
                        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                          {[s.type, s.room].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {s.description && (
                        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--color-muted)", whiteSpace: "pre-line" }}>
                          {s.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
