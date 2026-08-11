"use client";

import { useState } from "react";
import Link from "next/link";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList } from "@/lib/useCachedList";
import { buildAgendaSnippet } from "@/lib/agendaSnippet";
import { embedOrigin } from "@/lib/embedOrigin";

type Session = {
  id: string;
  name: string;
  day: string;
  timeSlot: string;
  type: string;
  description: string;
  room: string;
  // WHO IS ON STAGE, for a hand-typed programme. Only the Policy Stage feed carries this today.
  // The dashboard renders it because a preview that omits what the embed shows is not a preview —
  // Auri looked at this tab, saw no faces, and reasonably reported the pictures as broken.
  onStage?: {
    speakers: { name: string; meta: string; photo: string | null }[];
    moderators: { name: string; meta: string; photo: string | null }[];
  };
};

/** One name on a hand-typed programme, as the feed serves it. */
type OnStagePersonData = { name: string; meta: string; photo: string | null };

/** One person under a session: face, name, then title in the muted colour. Mirrors the embed. */
function OnStagePerson({ p }: { p: OnStagePersonData }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      {p.photo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={p.photo}
          alt=""
          loading="lazy"
          style={{
            flex: "none",
            width: 34,
            height: 34,
            borderRadius: 9999,
            objectFit: "cover",
            // Headshots crop badly at 50% 50% — the same 30% the rest of the repo uses.
            objectPosition: "50% 30%",
            background: "var(--color-card-2)",
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            flex: "none",
            width: 34,
            height: 34,
            borderRadius: 9999,
            display: "grid",
            placeItems: "center",
            background: "var(--color-card-2)",
            fontFamily: "var(--font-heading)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-orange, #fa7000)",
          }}
        >
          {p.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span style={{ minWidth: 0, fontSize: 14, lineHeight: 1.35 }}>
        <strong style={{ fontWeight: 600 }}>{p.name}</strong>
        {p.meta && <span style={{ color: "var(--color-muted)" }}>, {p.meta}</span>}
      </span>
    </div>
  );
}

/** Moderator first, then speakers — the order a reader wants on a panel of four. */
function OnStage({ st }: { st: NonNullable<Session["onStage"]> }) {
  const groups: [string, OnStagePersonData[]][] = [
    [st.moderators.length > 1 ? "Moderators" : "Moderator", st.moderators],
    [st.speakers.length > 1 ? "Speakers" : "Speaker", st.speakers],
  ];
  return (
    <>
      {groups.map(([label, list]) =>
        list.length === 0 ? null : (
          <div key={label}>
            <p
              style={{
                margin: "14px 0 6px",
                fontFamily: "var(--font-heading)",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-muted)",
              }}
            >
              {label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map((p) => (
                <OnStagePerson key={p.name} p={p} />
              ))}
            </div>
          </div>
        )
      )}
    </>
  );
}

// This page is the PROJECT programs: NISS and Future of Fintech, each read from the program
// view its own team fills inside its own Airtable table.
//
// TechBBQ's own 2026 program is not here. It lives on /brella-program, which reads the live
// Brella schedule and is the one installed on techbbq.dk. It used to have two tabs here as
// well — Brella and the purpose-built Program 2026 Airtable table — and two places showing
// the same agenda is how a stale one ends up on the live site. `/api/program?event=brella`
// and the bare `/api/program` still serve both, so nothing that already fetches them broke.
//
// heading/note bake a fixed date line + ticket notice into that event's embed.
type EventKey =
  | "niss"
  | "fintech"
  | "policy"
  | "board"
  | "pension-summit"
  | "family-office"
  | "lp-forum"
  | "investor-day";
const EVENTS: {
  key: EventKey;
  label: string;
  heading?: string;
  note?: string;
  sub?: string;
  theme?: "orange" | "blue" | "navy" | "gold" | "beam";
  icons?: boolean;
  bigOpening?: boolean;
  people?: boolean;
}[] = [
  {
    key: "niss",
    label: "NISS 2026",
    heading: "August 26th",
    note: "Access to the program on 26th of August is for the holders of TechBBQ tickets only",
  },
  // Fintech's design (Auri's mock): blue palette on #111827, no title icons, and
  // every title the same size (no oversized Opening).
  { key: "fintech", label: "Future of Fintech", theme: "blue", icons: false, bigOpening: false },
  // THE POLICY STAGE is the first programme that names its people. It came from a PDF, so the
  // Sessions table carries "Speaker Details" and "Moderator Details" as text plus a photo cell, and
  // `people` turns those into a moderator-then-speakers list with faces under each session.
  {
    key: "policy",
    label: "The Policy Stage",
    heading: "August 26th",
    people: true,
  },
  // THE BOARD SUMMIT (Boardway), out of the same Sessions table as the Policy Stage. Dark blue
  // rather than the fire gradient (Auri, 2026-08-10) — see the `navy` theme in lib/agendaSnippet.ts.
  // Every row is Day 2, so the heading is fixed here instead of coming from the data.
  {
    key: "board",
    label: "Board Summit",
    heading: "August 27th",
    sub: "Event Room 1 & 2",
    theme: "navy",
    people: true,
  },
  // THE FOUR DAY 0 PROGRAMMES, 25 August — the day before TechBBQ opens, so none of them is a "Day 1"
  // or "Day 2" and each carries a fixed heading rather than one drawn from the data.
  //
  // They were designed as four standalone pages, and those pages share ONE look: the brand fire
  // gradient on the near-black --garage ground (theme "gold"). Investor Day is the exception — its
  // backdrop is the blue beam, so its ground is the cooler "beam" black. `sub` carries the venue,
  // which is the thing an attendee actually needs: all four happen away from Bella Center.
  {
    key: "pension-summit",
    label: "Pension & Insurance Summit",
    heading: "August 25th",
    sub: "Hotel d'Angleterre, Louis XVI",
    theme: "gold",
    people: true,
  },
  {
    key: "family-office",
    label: "Nordic Family Office Summit",
    heading: "August 25th",
    sub: "Hotel d'Angleterre, Palm Court",
    theme: "gold",
    people: true,
  },
  {
    key: "lp-forum",
    label: "LP Forum",
    heading: "August 25th",
    sub: "Hotel d'Angleterre",
    theme: "gold",
    people: true,
  },
  {
    key: "investor-day",
    label: "TechBBQ Investor Day",
    heading: "August 25th",
    sub: "The Maersk Tower · Main Stage",
    theme: "beam",
    people: true,
  },
];

// The agenda has its own snippet builder, so it gets its own copy button rather than
// the speakers CopyEmbed. Same behavior: fresh uid per copy, __ORIGIN__ → live URL.
function CopyAgendaEmbed({
  path,
  heading,
  note,
  sub,
  theme,
  icons,
  bigOpening,
  people,
}: {
  path: string;
  heading?: string;
  note?: string;
  sub?: string;
  theme?: "orange" | "blue" | "navy" | "gold" | "beam";
  icons?: boolean;
  bigOpening?: boolean;
  people?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const uid = "tbbq-" + Math.random().toString(36).slice(2, 8);
    const code = buildAgendaSnippet({ uid, path, heading, note, sub, theme, icons, bigOpening, people }).replace(/__ORIGIN__/g, embedOrigin());
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
  const [event, setEvent] = useState<EventKey>("niss");
  // Bumped by the refresh button. It goes into the URL rather than being a bare re-render
  // trigger, because the value has to reach the network: `?fresh=<n>` is what makes the
  // request miss the CDN and skip the server's hour-long cache. Zero means "normal cached
  // read", which is what an ordinary visit does.
  const [fresh, setFresh] = useState(0);

  const base = `/api/program?event=${event}`;
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
          <p className="eyebrow">Project programs · one Airtable view per event</p>
          <h1>
            TechBBQ Project <span className="text-tbbq-gradient">Programs</span>
          </h1>
          <p className="lede">
            The agendas for the events around TechBBQ, live from the program view each team
            fills in its own Airtable table. One entry per session: time slot, topic, name,
            description, stage. Served as JSON at <code>/api/program</code>.
          </p>
          <p className="lede" style={{ fontSize: 14 }}>
            TechBBQ&apos;s own agenda is not here. It comes from Brella and lives on{" "}
            <Link href="/brella-program" style={{ color: "var(--color-orange, #fa7000)" }}>
              Program 2026
            </Link>
            , which is the one installed on techbbq.dk.
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
              sub={EVENTS.find((e) => e.key === event)?.sub}
              theme={EVENTS.find((e) => e.key === event)?.theme}
              icons={EVENTS.find((e) => e.key === event)?.icons}
              bigOpening={EVENTS.find((e) => e.key === event)?.bigOpening}
              people={EVENTS.find((e) => e.key === event)?.people}
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
                      {s.onStage && <OnStage st={s.onStage} />}
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
