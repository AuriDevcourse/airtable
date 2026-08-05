"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeroBackdrop } from "@/components/HeroBackdrop";

// THE FRONT DOOR. Two steps: pick what you are looking for, then pick the page.
//
// WHY IT EXISTS. "/" used to be one specific speaker feed, which meant every other page in here
// — twenty of them — was reachable only by opening the dropdown and already knowing its name.
// A page called "Main Page 12" tells a newcomer nothing. So the front page now sorts everything
// into the three things this dashboard actually holds (Auri, 2026-08-05):
//
//   Speakers   who is on stage
//   Projects   one feed per event around the Summit
//   Program    the agendas
//
// The old speaker grid moved to /speakers, unchanged, and is the last entry under Speakers.
//
// Every line here is a LINK, so a middle-click or a bookmark works and nothing depends on the
// step state. The step is only about how much is on screen at once.

type Item = { href: string; label: string; note: string };
type SectionKey = "speakers" | "projects" | "program";
type Section = {
  key: SectionKey;
  title: string;
  blurb: string;
  icon: React.ReactNode;
  items: Item[];
};

function IconUsers() {
  return (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  );
}

function IconLayers() {
  return (
    <>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m6.08 9.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59" />
      <path d="m6.08 14.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59" />
    </>
  );
}

function IconCalendar() {
  return (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  );
}

// Lucide "activity": the daily check is a heartbeat on the data, not a settings screen.
function IconPulse() {
  return (
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
  );
}

function IconTools() {
  return (
    <>
      <path d="M14 17H5" />
      <path d="M19 7h-9" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </>
  );
}

// One wrapper for all of them, so stroke width and joins cannot drift icon to icon.
function Icon({ children, size = 22 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ChevronRight({ size = 16 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

const SECTIONS: Section[] = [
  {
    key: "speakers",
    title: "Speakers",
    blurb: "Who is on stage. The rosters behind the speaker grids on techbbq.dk.",
    icon: <IconUsers />,
    items: [
      {
        href: "/all-speakers-2026",
        label: "All Speakers 2026",
        note: "Everyone speaking in 2026, stages and event rooms and investor events in one list.",
      },
      {
        href: "/speakers-2026",
        label: "Speakers 2026",
        note: "The live roster from the Speaker Hub, the app the speakers fill in themselves.",
      },
      {
        href: "/main-speakers",
        label: "Main Page 12",
        note: "The handful picked for the techbbq.dk front page · Airtable “Main Page = YES”.",
      },
      {
        href: "/speakers",
        label: "Speakers (all)",
        note: "The full Airtable Speakers table, every record with “On Website?” ticked.",
      },
    ],
  },
  {
    key: "projects",
    title: "Projects",
    blurb: "One feed per event around the Summit. Each team fills its own Airtable table.",
    icon: <IconLayers />,
    items: [
      {
        href: "/life-science",
        label: "Life Science 2026",
        note: "Life Science & Deep Tech speakers · Airtable “Speakers Library 2026”.",
      },
      {
        href: "/ls-startups",
        label: "Life Science Startups",
        note: "The startups that applied to the Life Science & Deep Tech track.",
      },
      {
        href: "/niss",
        label: "NISS 2026",
        note: "Nordic India Startup Summit, this year's grid.",
      },
      {
        href: "/nass",
        label: "NASS 2026",
        note: "Nordic Africa Startup Summit, this year's grid.",
      },
      {
        href: "/fintech-speakers",
        label: "Fintech Speakers",
        note: "Future of Fintech · the speaker submissions for that day.",
      },
      {
        href: "/policy-stage",
        label: "The Policy Stage",
        note: "The Policy Stage roster · ministers, MEPs and ecosystem leaders, across Event Rooms 5, 6 and 7.",
      },
      {
        href: "/investors",
        label: "Investor speakers",
        note: "LP Forum, Investor Day and the Pension & Insurance Summit, filtered per event.",
      },
      {
        href: "/partners",
        label: "Partners 2026",
        note: "The partner logo wall · Airtable “Partner Deliverables 2026”.",
      },
      {
        href: "/niss-2025",
        label: "NISS 2025",
        note: "Last year's Nordic India Startup Summit, kept as an archive.",
      },
    ],
  },
  {
    key: "program",
    title: "Program",
    blurb: "The agendas. What is on, when, and on which stage.",
    icon: <IconCalendar />,
    items: [
      {
        href: "/brella-program",
        label: "Program 2026",
        note: "The live schedule from Brella, and the one installed on techbbq.dk. Start here.",
      },
      {
        href: "/program",
        label: "Project programs",
        note: "The agendas for NISS and Future of Fintech, from each team's own Airtable view.",
      },
      {
        href: "/partner-events",
        label: "Side Events & Event Rooms",
        note: "What partners are running around the Summit, and where.",
      },
    ],
  },
];

// Neither a roster nor an agenda: these two are for the team, not for the website.
const INTERNAL: Item[] = [
  {
    href: "/team",
    label: "Team",
    note: "The TechBBQ staff directory · who to ask about what.",
  },
  {
    href: "/lookup",
    label: "Ticket lookup",
    note: "Find an attendee's ticket in Tito. Password-gated.",
  },
];

// ─── THE DAILY CHECK ────────────────────────────────────────────────────────────────────
// What to look at each morning to know the site is showing current information (Auri, 2026-08-05).
//
// It reads the LIVE feeds rather than listing links, because a list of links cannot tell you that
// Brella emptied out overnight or that four partners are waiting on a logo. Every number here is the
// number techbbq.dk would render, so a zero on this page is a hole on the live site.
//
// Six requests, all server-cached for an hour and shared with the pages themselves, so this is
// usually warm. They run in parallel and each one fails on its own — a dead feed shows as a red row
// instead of blanking the panel.
type Check = {
  label: string;
  href: string;
  // What you are actually checking for, in one line.
  look: string;
  // The headline number, or null while loading and on failure.
  value: number | null;
  // The breakdown under it, e.g. "197 summit · 110 event room".
  detail?: string;
  // Something a human has to DO. Its presence turns the row amber.
  todo?: string;
  failed?: boolean;
};

function StatusDot({ state }: { state: "ok" | "todo" | "down" | "loading" }) {
  const color =
    state === "down"
      ? "var(--color-red, #ce0f2e)"
      : state === "todo"
        ? "#fd9d04"
        : state === "ok"
          ? "#10c8a7"
          : "var(--color-border)";
  // A loading dot reads as "not answered yet" rather than as a healthy green.
  return <span aria-hidden="true" className="check__dot" style={{ background: color, opacity: state === "loading" ? 0.5 : 1 }} />;
}

// Rendered while the feeds answer, so the panel has its real height immediately and nothing jumps
// when six requests land.
const PLACEHOLDER_CHECKS: Check[] = [
  { label: "Program 2026", href: "/brella-program", look: "Sessions, times and rooms, live from Brella.", value: null },
  { label: "Speakers", href: "/all-speakers-2026", look: "Everyone on stage.", value: null },
  { label: "Partner wall", href: "/partners", look: "Logos live on techbbq.dk.", value: null },
  { label: "The Policy Stage", href: "/policy-stage", look: "The roster behind the Policy Stage page.", value: null },
  { label: "Policy Stage programme", href: "/program", look: "The agenda itself.", value: null },
  { label: "Side Events & Event Rooms", href: "/partner-events", look: "What partners are running.", value: null },
];

const PENDING_REASON: Record<string, string> = {
  "no-logo": "needing a logo",
  "not-on-web": "needing a tick",
  "no-tier": "needing a Company Link",
};

function DailyCheck() {
  const [checks, setChecks] = useState<Check[] | null>(null);

  useEffect(() => {
    let alive = true;
    const get = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    };
    // Each area settles on its own: one dead feed must not blank the other five.
    const settle = (u: string) =>
      get(u).then((v) => ({ ok: true, v })).catch(() => ({ ok: false, v: null }));

    Promise.all([
      settle("/api/program?event=brella"),
      settle("/api/all-speakers"),
      // ?pending=1 needs the dashboard password, which this same-origin request carries because the
      // page is already behind it.
      settle("/api/partners?pending=1"),
      settle("/api/policy-stage?role=all"),
      settle("/api/program?event=policy"),
      settle("/api/partner-events"),
    ]).then(([brella, speakers, partners, policy, policyProgram, sideEvents]) => {
      if (!alive) return;

      // Partners is the one feed that reports its own worklist, so this todo is exact rather than a
      // guess from a count.
      const all: { pending?: string }[] = partners.ok ? partners.v.partners ?? [] : [];
      const waiting = all.filter((p) => p.pending);
      const byReason = waiting.reduce<Record<string, number>>((m, p) => {
        const k = p.pending as string;
        m[k] = (m[k] ?? 0) + 1;
        return m;
      }, {});

      setChecks([
        {
          label: "Program 2026",
          href: "/brella-program",
          look: "Sessions, times and rooms, live from Brella. This is the one on techbbq.dk.",
          value: brella.ok ? brella.v.sessions.length : null,
          detail: brella.ok ? "sessions" : undefined,
          failed: !brella.ok,
        },
        {
          label: "Speakers",
          href: "/all-speakers-2026",
          look: "Everyone on stage, across the Summit, the event rooms and the investor events.",
          value: speakers.ok
            ? speakers.v.counts.speakers + speakers.v.counts.eventRoom + speakers.v.counts.investors
            : null,
          detail: speakers.ok
            ? `${speakers.v.counts.speakers} summit · ${speakers.v.counts.eventRoom} event room · ${speakers.v.counts.investors} investor`
            : undefined,
          failed: !speakers.ok,
        },
        {
          label: "Partner wall",
          href: "/partners",
          look: "Logos live on techbbq.dk, and the ones still waiting on something.",
          value: partners.ok ? all.length - waiting.length : null,
          detail: partners.ok ? "live" : undefined,
          todo:
            waiting.length > 0
              ? `${waiting.length} waiting · ${Object.entries(byReason)
                  .map(([k, n]) => `${n} ${PENDING_REASON[k] ?? k}`)
                  .join(", ")}`
              : undefined,
          failed: !partners.ok,
        },
        {
          label: "The Policy Stage",
          href: "/policy-stage",
          look: "The roster behind the Policy Stage page.",
          value: policy.ok ? policy.v.count : null,
          detail: policy.ok
            ? `${policy.v.counts.Speaker} speakers · ${policy.v.counts.Moderator} moderators`
            : undefined,
          failed: !policy.ok,
        },
        {
          label: "Policy Stage programme",
          href: "/program",
          look: "The agenda itself, with who speaks and who moderates each session.",
          value: policyProgram.ok ? policyProgram.v.sessions.length : null,
          detail: policyProgram.ok ? "sessions" : undefined,
          failed: !policyProgram.ok,
        },
        {
          label: "Side Events & Event Rooms",
          href: "/partner-events",
          look: "What partners are running around the Summit, and where.",
          value: sideEvents.ok ? sideEvents.v.count : null,
          detail: sideEvents.ok ? "events" : undefined,
          failed: !sideEvents.ok,
        },
      ]);
    });

    return () => {
      alive = false;
    };
  }, []);

  const attention = checks?.filter((c) => c.failed || c.value === 0 || c.todo).length ?? 0;

  return (
    <section className="check">
      <div className="check__head">
        <p className="check__title">
          <Icon size={15}>
            <IconPulse />
          </Icon>
          Daily check
        </p>
        <p className="check__sub">
          {checks === null
            ? "Reading the live feeds…"
            : attention === 0
              ? "Everything is answering and nothing is waiting."
              : `${attention} thing${attention === 1 ? "" : "s"} to look at.`}
        </p>
      </div>

      <ul className="check__list">
        {(checks ?? PLACEHOLDER_CHECKS).map((c) => {
          const state =
            checks === null ? "loading" : c.failed || c.value === 0 ? "down" : c.todo ? "todo" : "ok";
          return (
            <li key={c.label}>
              <Link href={c.href} className="check__row">
                <StatusDot state={state} />
                <span className="check__rowText">
                  <span className="check__label">{c.label}</span>
                  <span className="check__look">{c.look}</span>
                  {c.todo && <span className="check__todo">{c.todo}</span>}
                  {c.failed && (
                    <span className="check__todo">Could not load · the feed is down, or Airtable is slow</span>
                  )}
                  {!c.failed && c.value === 0 && (
                    <span className="check__todo">Empty · nothing would render on the site</span>
                  )}
                </span>
                <span className="check__value">
                  {c.value === null ? "—" : c.value}
                  {c.detail && <span className="check__detail">{c.detail}</span>}
                </span>
                <ChevronRight />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* The one check a browser cannot make: whiteness lives in the pixels, and this page cannot
          rasterise 120 logos. Named here so it is not forgotten rather than buried in a README. */}
      <p className="check__note">
        After uploading logos, run <code>node scripts/check-logo-tone.mjs</code> · a dark or boxed
        logo passes every check above and still disappears on the wall.
      </p>
    </section>
  );
}

export default function Home() {
  // Which section is open. null is step one, where all three are closed.
  const [open, setOpen] = useState<SectionKey | null>(null);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-2.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">TechBBQ Airtable Connector · one place for every feed</p>
          <h1>
            What are you <span className="text-tbbq-gradient">looking for?</span>
          </h1>
          <p className="lede">
            Every page in here is a live preview of one Airtable view or feed, with the embed code
            to paste into WordPress. Pick a group, then pick the page.
          </p>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        <DailyCheck />

        <ol className="hub">
          {SECTIONS.map((s) => {
            const isOpen = open === s.key;
            return (
              <li key={s.key} className="hub__section" data-open={isOpen ? "1" : undefined}>
                {/* The heading is the control. aria-expanded and the panel id are what tell a
                    screen reader this press reveals the list below rather than navigating. */}
                <button
                  type="button"
                  className="hub__head"
                  aria-expanded={isOpen}
                  aria-controls={`hub-panel-${s.key}`}
                  onClick={() => setOpen(isOpen ? null : s.key)}
                >
                  <span className="hub__icon">
                    <Icon>{s.icon}</Icon>
                  </span>
                  <span className="hub__headText">
                    <span className="hub__title">{s.title}</span>
                    <span className="hub__blurb">{s.blurb}</span>
                  </span>
                  <span className="hub__count">
                    {s.items.length} page{s.items.length === 1 ? "" : "s"}
                  </span>
                  <span className="hub__chev" data-open={isOpen ? "1" : undefined}>
                    <ChevronRight size={18} />
                  </span>
                </button>

                {isOpen && (
                  <ul className="hub__list" id={`hub-panel-${s.key}`}>
                    {s.items.map((it) => (
                      <li key={it.href}>
                        <Link href={it.href} className="hub__item">
                          <span className="hub__itemText">
                            <span className="hub__itemLabel">{it.label}</span>
                            <span className="hub__itemNote">{it.note}</span>
                          </span>
                          <ChevronRight />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <div className="hub__internal">
          <p className="hub__internalHead">
            <Icon size={15}>
              <IconTools />
            </Icon>
            For the team
          </p>
          <ul className="hub__list hub__list--flat">
            {INTERNAL.map((it) => (
              <li key={it.href}>
                <Link href={it.href} className="hub__item">
                  <span className="hub__itemText">
                    <span className="hub__itemLabel">{it.label}</span>
                    <span className="hub__itemNote">{it.note}</span>
                  </span>
                  <ChevronRight />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
