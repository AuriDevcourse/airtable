"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { HOURLY_FEEDS, NEAR_LIVE_FEEDS, inFastWindow } from "@/lib/cachePolicy";
import { SECTIONS, matchesQuery, type SectionKey } from "@/lib/pages";

// THE FRONT DOOR. Everything this dashboard holds, on one screen.
//
// WHY IT LOOKS LIKE THIS. "/" used to be one specific speaker feed, so every other page in here
// was reachable only by opening the dropdown and already knowing its name. It then became four
// accordion sections, which fixed the naming but not the finding: all four started CLOSED and
// only one could be open at a time, so a page whose whole job is "send me somewhere" opened
// showing zero destinations (Auri, 2026-08-08).
//
// It is now a GRID of section cards, all open. Twenty-one pages, no clicks to see them, and the
// 1400px container finally carries more than one column. The filter box at the top is the
// shortcut for anyone who already knows the name — type "niss" and only NISS survives.
//
// The page list itself lives in lib/pages.ts and is shared with the top menu, because two copies
// of it had already drifted apart.

type SectionIconKey = SectionKey;

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

// Lucide "door-open": the Event Rooms group is the physical rooms at the venue, not a topic.
function IconDoor() {
  return (
    <>
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h3" />
      <path d="M13 20h9" />
      <path d="M10 12v.01" />
      <path d="M13 2.5a1 1 0 0 0-1.16-.99l-6 1A1 1 0 0 0 5 3.5V20a1 1 0 0 0 1.16.99l6-1A1 1 0 0 0 13 19z" />
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

function IconSearch() {
  return (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  );
}

// Section key to icon, so lib/pages.ts can stay data-only.
const SECTION_ICON: Record<SectionIconKey, React.ReactNode> = {
  speakers: <IconUsers />,
  projects: <IconLayers />,
  rooms: <IconDoor />,
  program: <IconCalendar />,
  internal: <IconTools />,
};

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

// ─── THE DAILY CHECK ────────────────────────────────────────────────────────────────────
// What to look at each morning to know the site is showing current information (Auri, 2026-08-05).
//
// It reads the LIVE feeds rather than listing links, because a list of links cannot tell you that
// Brella emptied out overnight or that four partners are waiting on a logo. Every number here is the
// number techbbq.dk would render, so a zero on this page is a hole on the live site.
//
// Six requests, all server-cached for an hour and shared with the pages themselves, so this is
// usually warm. They run in parallel and each one fails on its own — a dead feed shows as a red
// tile instead of blanking the panel.
//
// Drawn as a GRID of tiles rather than six full-width rows (2026-08-08): the number is the point,
// and six numbers side by side can be read in one glance instead of one scroll.
type Check = {
  label: string;
  href: string;
  // What you are actually checking for, in one line.
  look: string;
  // The headline number, or null while loading and on failure.
  value: number | null;
  // The unit under the number, e.g. "sessions".
  unit?: string;
  // The breakdown, e.g. "197 summit · 110 event room".
  detail?: string;
  // Something a human has to DO. Its presence turns the tile amber.
  todo?: string;
  failed?: boolean;
};

type CheckState = "ok" | "todo" | "down" | "loading";

function StatusDot({ state }: { state: CheckState }) {
  const color =
    state === "down"
      ? "var(--color-red, #ce0f2e)"
      : state === "todo"
        ? "#fd9d04"
        : state === "ok"
          ? "#10c8a7"
          : "var(--color-border)";
  // A loading dot reads as "not answered yet" rather than as a healthy green.
  return (
    <span
      aria-hidden="true"
      className="check__dot"
      style={{ background: color, opacity: state === "loading" ? 0.5 : 1 }}
    />
  );
}

// Rendered while the feeds answer, so the panel has its real height immediately and nothing jumps
// when six requests land.
const PLACEHOLDER_CHECKS: Check[] = [
  { label: "Program 2026", href: "/brella-program", look: "Sessions, times and rooms, live from Brella.", value: null },
  { label: "All speakers", href: "/all-speakers-2026", look: "Everyone on stage.", value: null },
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

/**
 * HOW OFTEN THE FEEDS UPDATE.
 *
 * The question that kept getting asked in chat ("how often does X refresh?"), answered where
 * anyone lands first rather than in a README nobody opens.
 *
 * It is a ONE-LINE summary that opens into the detail (2026-08-08). The full text was four
 * paragraphs of reference material sitting between the reader and every link on the page, which is
 * the wrong trade for something you read once and then know.
 *
 * Everything here is READ FROM lib/cachePolicy.ts, never retyped. A hard-coded "30 minutes"
 * would be a lie from the 28th of August onwards, and a lie the moment a feed joins
 * HOURLY_FEEDS — the two things this box exists to explain are exactly the two that change.
 */
function RefreshCadence() {
  // Read at render, not at module scope: a value captured once at first render is wrong for
  // anyone who leaves the tab open across the cutover, and on a static build it would freeze
  // at BUILD time. Same rule as defaultEventDay().
  const fast = inFastWindow();
  const hourly = [...HOURLY_FEEDS];
  const nearLive = [...NEAR_LIVE_FEEDS];

  // The override lists hold CACHE KEYS, and a key is not always the route: the partner-events feed
  // caches under "partnerevents" but serves at /api/partner-events. Printing the key as a URL puts
  // a 404 on the front page, which is precisely the kind of small lie this panel exists to avoid.
  const routeOf = (key: string) => (key === "partnerevents" ? "partner-events" : key);

  return (
    <details className="cadence">
      <summary className="cadence__summary">
        <span className="cadence__lead">
          Airtable edits reach techbbq.dk{" "}
          <strong>{fast ? "within 30 minutes" : "within the hour"}</strong>
          {fast ? " · event cadence, until end of 27 August" : " · normal cadence"}
        </span>
        <span className="cadence__more">How caching works</span>
        <ChevronRight />
      </summary>

      <div className="cadence__body">
        <p>
          Nothing here is live-read on every visit. Each feed is cached twice over, once in the
          server&rsquo;s memory and once on the CDN that actually answers techbbq.dk.
        </p>
        <ul>
          {nearLive.length > 0 && (
            <li>
              <strong>{nearLive.map((k) => `/api/${routeOf(k)}`).join(", ")}</strong> · about{" "}
              <strong>1 minute</strong>, event window or not. These are the tables somebody edits
              while watching the site, so they are read from Airtable roughly once a minute rather
              than twice an hour.
            </li>
          )}
          <li>
            <strong>Most feeds</strong> · {fast ? "30 minutes now, 1 hour from 28 August" : "1 hour"}.
            The switch is a clock comparison, not a deploy, so nobody has to undo it.
          </li>
          <li>
            <strong>The team list</strong> ·{" "}
            {fast ? "30 minutes now, once a day from 28 August" : "once a day"}. Staff change a few
            times a year.
          </li>
          {hourly.length > 0 && (
            <li>
              <strong>{hourly.map((k) => `/api/${routeOf(k)}`).join(", ")}</strong> · held at{" "}
              <strong>1 hour</strong>, event window or not, by request. That table is filled by a
              submission form at roughly one entry every two days, so checking twice an hour mostly
              finds nothing.
            </li>
          )}
          <li>
            <strong>In a hurry?</strong> Every page has a <em>Refresh from Airtable</em> button. It
            reads live, past both caches, and reports what changed — but it cannot purge the copy
            techbbq.dk is already serving, so the public site still waits out the cadence above.
          </li>
        </ul>
      </div>
    </details>
  );
}

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
          look: "Live from Brella. This is the one on techbbq.dk.",
          value: brella.ok ? brella.v.sessions.length : null,
          unit: "sessions",
          failed: !brella.ok,
        },
        {
          // NOT "Speakers". That word is now a row in the grid above pointing at /speakers-2026,
          // the Summit roster of 199 — and this tile is the union of 348 across every event. One
          // word, two destinations, on the same screen.
          label: "All speakers",
          href: "/all-speakers-2026",
          look: "Everyone on stage, across the whole Summit.",
          value: speakers.ok
            ? speakers.v.counts.speakers + speakers.v.counts.eventRoom + speakers.v.counts.investors
            : null,
          unit: "speakers",
          detail: speakers.ok
            ? `${speakers.v.counts.speakers} summit · ${speakers.v.counts.eventRoom} event room · ${speakers.v.counts.investors} investor`
            : undefined,
          failed: !speakers.ok,
        },
        {
          label: "Partner wall",
          href: "/partners",
          look: "Logos live on techbbq.dk.",
          value: partners.ok ? all.length - waiting.length : null,
          unit: "live",
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
          unit: "people",
          detail: policy.ok
            ? `${policy.v.counts.Speaker} speakers · ${policy.v.counts.Moderator} moderators`
            : undefined,
          failed: !policy.ok,
        },
        {
          label: "Policy Stage programme",
          href: "/program",
          look: "The agenda, with who speaks and who moderates.",
          value: policyProgram.ok ? policyProgram.v.sessions.length : null,
          unit: "sessions",
          failed: !policyProgram.ok,
        },
        {
          label: "Side Events & Event Rooms",
          href: "/partner-events",
          look: "What partners are running, and where.",
          value: sideEvents.ok ? sideEvents.v.count : null,
          unit: "events",
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

      <ul className="check__grid">
        {(checks ?? PLACEHOLDER_CHECKS).map((c) => {
          const state: CheckState =
            checks === null ? "loading" : c.failed || c.value === 0 ? "down" : c.todo ? "todo" : "ok";
          return (
            <li key={c.label}>
              <Link href={c.href} className="check__tile" data-state={state}>
                <span className="check__tileHead">
                  <StatusDot state={state} />
                  <span className="check__label">{c.label}</span>
                  <ChevronRight size={15} />
                </span>

                <span className="check__value">
                  {c.value === null ? "—" : c.value}
                  {c.unit && c.value !== null && <span className="check__unit">{c.unit}</span>}
                </span>

                <span className="check__look">{c.look}</span>
                {c.detail && <span className="check__detail">{c.detail}</span>}
                {c.todo && <span className="check__todo">{c.todo}</span>}
                {c.failed && (
                  <span className="check__todo">Could not load · the feed is down, or Airtable is slow</span>
                )}
                {!c.failed && c.value === 0 && (
                  <span className="check__todo">Empty · nothing would render on the site</span>
                )}
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
  const [query, setQuery] = useState("");

  // Sections with their items narrowed by the filter. A section whose items all fail the filter is
  // dropped entirely rather than left as an empty card.
  const sections = useMemo(() => {
    const q = query.trim();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => matchesQuery(i, q)) })).filter(
      (s) => s.items.length > 0,
    );
  }, [query]);

  // Counted in PAGES, not rows: the NISS row is one card and two pages.
  const hits = sections.reduce(
    (n, s) => n + s.items.reduce((m, i) => m + (i.years?.length ?? 1), 0),
    0,
  );

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
            to paste into WordPress.
          </p>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {/* NAVIGATION FIRST. The daily check is a once-a-morning read; getting to a page is every
            visit, so the pages are what the page opens on (2026-08-08). */}
        <div className="hubbar">
          <label className="hubbar__search">
            <Icon size={17}>
              <IconSearch />
            </Icon>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter pages · try niss, partners, program"
              aria-label="Filter pages"
              autoComplete="off"
            />
          </label>
          <p className="hubbar__count" aria-live="polite">
            {query.trim() ? `${hits} page${hits === 1 ? "" : "s"}` : `${hits} pages`}
          </p>
        </div>

        {sections.length === 0 ? (
          <p className="hub__empty">
            Nothing matches “{query.trim()}”. Try a shorter word, or clear the filter.
          </p>
        ) : (
          <div className="hub">
            {sections.map((s) => (
              <section key={s.key} className="hub__section" data-section={s.key}>
                <div className="hub__head">
                  <span className="hub__icon">
                    <Icon>{SECTION_ICON[s.key]}</Icon>
                  </span>
                  <span className="hub__headText">
                    <h2 className="hub__title">{s.title}</h2>
                    <p className="hub__blurb">{s.blurb}</p>
                  </span>
                </div>

                {/* TITLES ONLY. Every section is open at once now, so nineteen one-line
                    descriptions read as a wall of text (Auri, 2026-08-08). The note survives as the
                    hover title and is still matched by the filter, so nothing became unfindable. */}
                <ul className="hub__list">
                  {s.items.map((it) =>
                    it.years ? (
                      // A page that exists once per year is ONE row with a link per year. The row
                      // itself is not a link — an <a> cannot contain another <a>, and "which year"
                      // is the actual choice being made here.
                      <li key={it.href}>
                        <div className="hub__item hub__item--years" title={it.note}>
                          <span className="hub__itemLabel">{it.label}</span>
                          <span className="hub__years">
                            {it.years.map((y) => (
                              <Link key={y.href} href={y.href} className="hub__year">
                                {y.label}
                              </Link>
                            ))}
                          </span>
                        </div>
                      </li>
                    ) : (
                      <li key={it.href}>
                        <Link href={it.href} className="hub__item" title={it.note}>
                          <span className="hub__itemLabel">{it.label}</span>
                          <ChevronRight />
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}

        <DailyCheck />
        <RefreshCadence />
      </div>
    </main>
  );
}
