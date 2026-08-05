"use client";

import { useState } from "react";
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
