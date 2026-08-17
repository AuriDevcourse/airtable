// THE PAGE CATALOG — the one list of what is in this dashboard.
//
// WHY IT EXISTS. Until 2026-08-08 the front page (app/page.tsx) and the top menu
// (components/TopNav.tsx) each held their own hardcoded copy of the page list, and they had
// already drifted: /interns was in the menu but not on the front page, and Policy Stage and
// Future of Fintech were filed under "Projects" in one and "Event Rooms" in the other. The same
// page told you two different stories depending on how you got there.
//
// Both now read this file. Adding a page is ONE line here and it appears in both places.
//
// Data only, no JSX — the section icons live in app/page.tsx, keyed by `key` below, because a
// .ts file cannot hold them and splitting the data into a .tsx would pull React into the menu.

export type PageItem = {
  href: string;
  label: string;
  /**
   * One line on what it is. NOT printed on the front-page cards any more (Auri, 2026-08-08: too
   * much text once every section was open at once) — it is the hover title on the row, and it is
   * still matched by the filter, so searching "passport" or "deep tech" finds a page whose card
   * shows only a name.
   */
  note: string;
  /** Extra words the front-page filter should match, e.g. "fintech" finding the Fintech page. */
  keywords?: string;
  /**
   * A page that exists once per year. The row then prints the label plain and one small link per
   * year instead of being a link itself — "NISS · 2026 2025" rather than two unrelated cards
   * called NISS 2026 and NISS 2025 (Auri, 2026-08-08). Newest year FIRST; `href` above must equal
   * the first year's href, because the menu and the filter both use `href` as the destination.
   */
  years?: { label: string; href: string }[];
};

export type SectionKey = "speakers" | "projects" | "rooms" | "program" | "internal";

export type PageSection = {
  key: SectionKey;
  title: string;
  blurb: string;
  items: PageItem[];
};

export const SECTIONS: PageSection[] = [
  {
    key: "speakers",
    title: "Speakers",
    blurb: "Who is on stage. The rosters behind the speaker grids on techbbq.dk.",
    items: [
      {
        href: "/all-speakers-2026",
        label: "All Speakers 2026",
        note: "Everyone speaking in 2026, stages and event rooms and investor events in one list.",
        keywords: "roster everyone combined",
      },
      {
        // Same merge as NISS (Auri, 2026-08-08). The two are not the same feed a year apart —
        // 2026 is the Speaker Hub, the app speakers fill in themselves, and 2025 is the Airtable
        // Speakers table — but "speakers, which year?" is the question a person actually arrives
        // with, and two cards called Speakers 2026 and Speakers 2025 make them hunt for it.
        href: "/speakers-2026",
        label: "Speakers",
        note: "2026 is the live roster from the Speaker Hub · 2025 is last year's Airtable table, kept as an archive.",
        keywords: "hub roster 2026 2025 last year archive all table airtable on website",
        years: [
          { label: "2026", href: "/speakers-2026" },
          { label: "2025", href: "/speakers" },
        ],
      },
      {
        href: "/main-speakers",
        // Was "Main Page 12", which names an Airtable filter rather than a thing a human wants.
        label: "Front page speakers",
        note: "The handful picked for the techbbq.dk front page · Airtable “Main Page = YES”.",
        keywords: "main page 12 featured homepage",
      },
      // /speakers is NOT a row of its own any more — it is the 2025 pill on the Speakers row
      // above. It was labelled "Speakers (all)", which reads as "the complete current list" and is
      // the exact opposite of what it holds: last year's table.
    ],
  },
  // Program sits second rather than last because the front page lays the sections out in COLUMNS
  // (see .hub in globals.css) and fills them in this order. Speakers is four entries and Projects
  // is seven, so a short section directly after Speakers is what keeps the first column from
  // ending half a screen above the others. It also reads correctly: who is on stage, then when.
  {
    key: "program",
    title: "Program",
    blurb: "The agendas. What is on, when, and on which stage.",
    items: [
      {
        href: "/brella-program",
        label: "Program 2026",
        note: "The live schedule from Brella, and the one installed on techbbq.dk. Start here.",
        keywords: "brella agenda schedule sessions timetable",
      },
      {
        href: "/program",
        label: "Project programs",
        note: "The agendas for NISS and Future of Fintech, from each team's own Airtable view.",
        keywords: "agenda schedule niss fintech policy",
      },
      {
        // Filed under Program because it answers the same question a visitor arrives with —
        // "what do I need to know to turn up" — even though it is the one page here whose
        // content is in git rather than Airtable.
        href: "/event-guide",
        label: "Event Guide",
        note: "Practical attendee info: venue, hours, badges, food, safety. Written in the repo, not Airtable.",
        keywords:
          "guide venue entrance transportation accessibility opening hours badge claim keypitt wardrobe lost found info desk photo policy food coffee water payments recycling wifi charging workspaces relaxation brella safety first aid code of conduct prohibited faq practical",
      },
    ],
  },
  {
    key: "projects",
    title: "Projects",
    blurb: "One feed per event around the Summit. Each team fills its own Airtable table.",
    items: [
      {
        href: "/life-science",
        label: "Life Science 2026",
        note: "Life Science & Deep Tech speakers · Airtable “Speakers Library 2026”.",
        keywords: "deep tech biotech ls",
      },
      {
        href: "/ls-startups",
        label: "Life Science Startups",
        note: "The startups that applied to the Life Science & Deep Tech track.",
        keywords: "deep tech applications ls",
      },
      {
        href: "/niss",
        label: "NISS",
        note: "Nordic India Startup Summit · 2026 is this year's grid, 2025 is kept as an archive.",
        keywords: "nordic india 2026 2025 archive last year",
        years: [
          { label: "2026", href: "/niss" },
          { label: "2025", href: "/niss-2025" },
        ],
      },
      {
        href: "/nass",
        label: "NASS 2026",
        note: "Nordic Africa Startup Summit, this year's grid.",
        keywords: "nordic africa",
      },
      {
        href: "/investors",
        label: "Investor speakers",
        note: "LP Forum, Investor Day, the Pension & Insurance Summit and the Nordic Family Office Summit, filtered per event.",
        keywords: "lp forum investor day pension insurance vc nordic family office",
      },
      {
        href: "/partners",
        label: "Partners 2026",
        note: "The partner logo wall · Airtable “Partner Deliverables 2026”.",
        keywords: "logos sponsors wall tiers",
      },
    ],
  },
  // EVENT ROOMS is a PLACE, not a theme — that is the whole point of splitting it out of
  // Projects (Auri, 2026-08-06). Policy Stage is Rooms 5/6/7, Future of Fintech runs in a room
  // rather than on a stage, and the partner-run sessions are the room schedule itself. Grouped
  // by where you physically go, they stop reading as three unrelated Airtable tables.
  {
    // The section was "Event Rooms" and its first entry was "Side Events & Event Rooms", so the
    // group and the page inside it fought over the same name and neither told you which was which
    // (Auri, 2026-08-08). The SECTION now carries the full name, and the entry says plainly that it
    // is the all-of-them view — the other two entries are single rooms within it.
    key: "rooms",
    title: "Side Events & Event Rooms",
    blurb: "What partners are running around the Summit, and who is in each room.",
    items: [
      {
        href: "/partner-events",
        label: "All side events & event rooms",
        note: "The whole room schedule · what partners are running around the Summit, and where.",
        keywords: "side events partner sessions schedule rooms everything all",
      },
      {
        href: "/policy-stage",
        label: "The Policy Stage",
        note: "Ministers, MEPs and ecosystem leaders · Event Rooms 5, 6 and 7.",
        keywords: "politics ministers mep government eu",
      },
      {
        href: "/fintech-speakers",
        label: "Future of Fintech",
        note: "Speakers, moderators and keynotes for the fintech day.",
        keywords: "finance banking payments",
      },
      {
        // Event Room 1, so it belongs here beside the Policy Stage rather than in Projects: the
        // section is a PLACE. Its sessions are on /program; this is the roster behind them.
        href: "/board-summit",
        label: "Board Summit",
        note: "Board members and chairs · Event Room 1, hosted by Boardway.",
        keywords: "boardway board chair governance directors",
      },
    ],
  },
  // Neither a roster nor an agenda: these are for the team, not for the website.
  {
    key: "internal",
    title: "For the team",
    blurb: "Internal tools. Nothing here renders on techbbq.dk.",
    items: [
      {
        href: "/team",
        label: "Team",
        note: "The TechBBQ staff directory · who to ask about what.",
        keywords: "staff directory colleagues who to ask",
      },
      {
        href: "/interns",
        label: "Intern Pool",
        note: "The intern applications, by department.",
        keywords: "applications volunteers students",
      },
      {
        href: "/lookup",
        label: "Ticket lookup",
        note: "Find an attendee's ticket in Tito. Password-gated.",
        keywords: "tito attendee ticket order",
      },
    ],
  },
];

/**
 * The investor page takes an ?event= param that preselects one event. These are menu shortcuts
 * into a page that already exists, not pages of their own, so they live beside the catalog
 * rather than in it — putting them in `SECTIONS` would print four near-identical cards on the
 * front page for one destination.
 */
export const INVESTOR_EVENTS: PageItem[] = [
  { href: "/investors?event=lp-forum", label: "LP Forum", note: "" },
  { href: "/investors?event=investor-day", label: "TechBBQ Investor Day", note: "" },
  { href: "/investors?event=pension-summit", label: "Pension & Insurance Summit", note: "" },
  { href: "/investors?event=family-office", label: "Nordic Family Office Summit", note: "" },
];

/** Every page as one flat list, for the front-page filter and for "current page" matching. */
export const ALL_PAGES: PageItem[] = SECTIONS.flatMap((s) => s.items);

/** Lowercased haystack for the filter: label, note and keywords, matched as plain substrings. */
export function matchesQuery(item: PageItem, q: string): boolean {
  if (!q) return true;
  const hay = `${item.label} ${item.note} ${item.keywords ?? ""} ${item.href}`.toLowerCase();
  // Every word must appear somewhere, so "niss 2025" narrows rather than widens.
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}
