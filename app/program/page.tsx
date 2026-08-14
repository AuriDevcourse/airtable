"use client";

import { useMemo, useState } from "react";
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
    speakers: OnStagePersonData[];
    moderators: OnStagePersonData[];
  };
  /** People are linked to this session but withheld because it is not Locked yet. */
  lineupPending?: boolean;
};

/** One name on a hand-typed programme, as the feed serves it. */
type OnStagePersonData = {
  name: string;
  meta: string;
  photo: string | null;
  /** "Host" on the intro slot of an event whose host also moderates. Absent otherwise. */
  role?: string;
};

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

/**
 * WHAT IS STILL MISSING ON THIS AGENDA, said on the page instead of in a chat message.
 *
 * The list of PEOPLE is computed from the feed every load, never typed in, so a face that gets
 * uploaded removes its own line here with no edit. WHY each one is missing cannot be computed —
 * it took a scan of 3,765 CRM rows and 2,185 form rows to establish — so those notes are written
 * down per person, keyed by name, with a plain fallback for anyone who appears later.
 *
 * Scoped to the events that have one of these notes. Every other agenda renders nothing, rather
 * than a panel saying "0 problems", which is noise on a page somebody opens to read a programme.
 */
const GAP_NOTES: Record<string, Record<string, string>> = {
  nass: {
    "Sherief Kesseba":
      "is in Airtable WITH a headshot, but only as a 2025 Investor Dinner applicant — he is not ticked into the “Nordic-Africa Summit Presenters” view, so the agenda is not allowed to read him. Tick him in, and align Sherief / Sherif.",
    "Impact Fund Denmark":
      "is a placeholder, not a person: the cell says “Danish Company Representative”. It needs the name of whoever is actually taking the seat.",
    "Lamiaa El Rashidy": "has no row in either the CRM or the presenter form. She needs one, with a portrait.",
    "Gabriella Mukamugema": "has no row in either the CRM or the presenter form. She needs one, with a portrait.",
  },
};

/** Extra facts about an event that no session row can carry. */
const GAP_FOOTNOTES: Record<string, string[]> = {
  niss: [
    "Names publish per session, not per programme — so an outreach target cannot read their own name on techbbq.dk before they have said yes. Session Status lives on the row in the Sessions table, beside NASS, the Policy Stage and the Board Summit.",
    "Session Description is empty on all 13 rows. The descriptions only exist in the planning sheet, so an unlocked session currently shows a title and nothing to read behind it.",
    "India Shark Tank and Nordic Founder Pitch have no Session Type: the select has no “Pitch Session” option and the Airtable API cannot add one. Add it in the UI and they can be labelled.",
  ],
  nass: [
    "Brella has no timeslot at 15:35 for the Investor Reverse Pitch, so its five people have nowhere to be linked in the attendee app. It has to be created there by hand.",
    "Eight session titles read differently in Brella than here. The board on this dashboard shows these titles; the Brella app shows its own.",
  ],
};

function ProgrammeGaps({ event, sessions }: { event: string; sessions: Session[] }) {
  const notes = GAP_NOTES[event];
  const foot = GAP_FOOTNOTES[event] ?? [];
  const missing = useMemo(() => {
    if (!notes) return [];
    // A programme with footnotes but no per-person notes (NISS) lists no names here: an unlocked
    // session has nobody on it to be missing a face.
    const out: { name: string; where: string }[] = [];
    for (const s of sessions) {
      const st = s.onStage;
      if (!st) continue;
      for (const p of [...st.moderators, ...st.speakers]) {
        if (p.photo || out.some((x) => x.name === p.name)) continue;
        out.push({ name: p.name, where: s.timeSlot });
      }
    }
    return out;
  }, [notes, sessions]);

  // WHICH SESSIONS ARE STILL TO BE LOCKED, from the feed rather than typed here, so the list shrinks
  // by itself as the NISS team ticks them. Only sessions that HAVE people waiting are listed: a
  // break is "not locked" too, and saying so would bury the nine that actually need chasing.
  const pending = useMemo(
    () => sessions.filter((s) => s.lineupPending).map((s) => `${s.timeSlot} · ${s.name}`),
    [sessions]
  );

  if (!missing.length && !foot.length && !pending.length) return null;
  return (
    <section className="ev-gaps" aria-label="Missing source data" style={{ marginTop: 24 }}>
      <h2>Still missing for this programme</h2>
      <ul>
        {pending.length > 0 && (
          <li>
            <strong>
              {pending.length} session{pending.length === 1 ? "" : "s"} not locked yet
            </strong>{" "}
            · the people are already linked, they just do not publish until{" "}
            <code>Session Status</code> reads <strong>Locked</strong>. Tick one and its speakers
            appear on the next refresh:
            <ul style={{ marginTop: 6 }}>
              {pending.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </li>
        )}
        {missing.map((m) => (
          <li key={m.name}>
            <strong>{m.name}</strong> ({m.where}) has no photo on the agenda ·{" "}
            {notes[m.name] ?? "no headshot found in Airtable under this spelling."}
          </li>
        ))}
        {foot.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className="ev-gaps__foot">
        The lists above are read from the feed on every load, so a line disappears by itself once
        Airtable is fixed — a session drops off when it is locked, a person when their headshot
        lands. Nothing in this panel reaches techbbq.dk.
      </p>
    </section>
  );
}

/** Moderator first, then speakers — the order a reader wants on a panel of four. */
function OnStage({ st }: { st: NonNullable<Session["onStage"]> }) {
  // A LONE PERSON CARRYING A ROLE NAMES THAT ROLE. The event's host opens alone and sits in
  // `Speaker Details`, so the label used to read "Speaker" for somebody who is not speaking at that
  // point — they are hosting. The feed marks that one case (lib/programFaces.ts, applyHostRole) and
  // nothing else, so every other session keeps Speaker/Speakers exactly as before.
  const soloRole = st.speakers.length === 1 ? st.speakers[0].role : undefined;
  const groups: [string, OnStagePersonData[]][] = [
    [st.moderators.length > 1 ? "Moderators" : "Moderator", st.moderators],
    [soloRole || (st.speakers.length > 1 ? "Speakers" : "Speaker"), st.speakers],
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
  | "nass"
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
  theme?: "orange" | "blue" | "navy" | "gold" | "beam" | "crimson";
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
  // NASS 2026 — Nordic Africa Startup Summit, all of it Day 2 in Event Room 2, so the heading is
  // fixed here rather than drawn from the data (every row is the same day). `people` because the
  // agenda names its speakers and moderators, like the Policy Stage below.
  //
  // ONE FLAT #FF0028 rather than the fire gradient (Auri, 2026-08-12) — the `crimson` theme in
  // lib/agendaSnippet.ts.
  {
    key: "nass",
    label: "NASS 2026",
    heading: "August 27th",
    sub: "Event Room 2",
    theme: "crimson",
    people: true,
  },
  // Fintech's design (Auri's mock): blue palette on #111827, no title icons, and
  // every title the same size (no oversized Opening).
  //
  // `people` since 2026-08-14: the programme moved into the Sessions table and three of its eight
  // sessions now name a line-up in `Speaker Details`, so it renders faces exactly like the Policy
  // Stage. The four panels name nobody yet and simply show no people. Heading and venue are fixed
  // here because every row is the same morning in the same room.
  {
    key: "fintech",
    label: "Future of Fintech",
    heading: "August 27th",
    sub: "Event Room 3 · Hall C",
    theme: "blue",
    icons: false,
    bigOpening: false,
    people: true,
  },
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
  theme?: "orange" | "blue" | "navy" | "gold" | "beam" | "crimson";
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
            <ProgrammeGaps event={event} sessions={sessions} />
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
