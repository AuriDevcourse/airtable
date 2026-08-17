// THE EVENT GUIDE — practical information for people attending TechBBQ 2026.
//
// Unlike every other feed in this repo, this content is NOT in Airtable. It is here, in git,
// on purpose (Auri, 2026-08-11): the guide changes a handful of times a year, an Airtable table
// would add a live dependency and a cache TTL to copy that is essentially static, and a typo fix
// wants a diff and a review rather than someone editing a cell in a 3,670-row base.
//
// WHERE THE DESIGN COMES FROM. The staging techbbq.dk Event Guide (Humandone). Each section is a
// row of pill tabs above ONE split panel: text left, photo right. That replaces the old
// icon-grid-plus-popup guide, which needed a click into a modal to read a sentence.
//
// WHERE THE CONTENT COMES FROM. The live guide's popup markup, carried over item for item. The
// old guide had 30 items and the new design showed 27 — Brella, Venue Map and Keypitt had no tab.
// All 30 are here (Auri, 2026-08-11): dropping a partner and the official app off a live page is
// not a thing to do silently.
//
// ─── DATES WERE WRONG IN THE SOURCE, and are corrected here ──────────────────────────────────
// The old guide contradicted itself. Opening Hours said August 26th/27th while Badge Claim, Info
// Desk and Keypitt all said "Wednesday 27th / Thursday 28th", and the staging design carried the
// 27th/28th through. Those are LAST YEAR's dates: TechBBQ 2025 ran 27–28 August, and both were a
// Wednesday and a Thursday, which is why they read as plausible.
//
// TechBBQ 2026 is 26–27 August (Tito event `2026` starts 2026-08-26; Brella confirms 27 August as
// the closing day). 26 and 27 August 2026 are also a Wednesday and a Thursday. Every date in this
// file is therefore 26th/27th. Same for the body copy that still said "TechBBQ 2025".
//
// If a date here is ever edited, edit it HERE and nowhere else — the preview page and the pasted
// embed both render this file, which is the whole reason the copy lives in one place.
//
// ─── TIMES AND ON-SITE FACTS COME FROM THE WALKTHROUGH DECK (2026-08-13) ─────────────────────
// "TECHBBQ 2026 - WALKTHROUGH.pdf" (the internal event walkthrough) is the authority for the
// schedule, the pre-badge days and the venue layout, and it overrode this file where the two
// disagreed: day 1 stage program ends 17:30 not 17:00, the program starts at 10:00 both days,
// Thursday finishes with a pre-after party in Hall E 17:15–19:00, and there is a SECOND pre-badge
// day (24 August at Bella) on top of the 20th at Matrikel1.
//
// The deck's Brella screenshots are dated 10 August 2026 and show a fully populated program,
// speaker list, partner list and side events, so the "opens two weeks before" future tense that
// used to be in here is gone: the platform is live.

/** Where the guide photos live. All already uploaded to the WordPress media library. */
const IMG = "https://techbbq.dk/wp-content/uploads";

/**
 * A paragraph, optionally opening with a bold lead-in ("Important Note:"), which is the pattern
 * the design uses to break a panel into scannable claims without a heading per sentence.
 *
 * `text` may contain `[label](url)` links and nothing else. The renderers escape the whole string
 * first and then convert those, so a stray `<` in the copy can never become markup. Keep it that
 * way: this file is authored by hand and read by two separate renderers, and the moment it
 * accepts raw HTML both of them become an injection surface for whoever edits it next.
 */
export type GuideBlock =
  | { kind: "p"; lead?: string; text: string }
  | { kind: "list"; lead?: string; items: string[] }
  /** A day of opening hours: a bold day heading over its own rows. */
  | { kind: "schedule"; day: string; rows: string[] };

export type GuideItem = {
  /** Stable id, used for the tab button, the panel and the deep link (#event-guide-venue). */
  key: string;
  /** The pill label. Short — it sits in a row with five others on one line. */
  tab: string;
  /**
   * The small red-dotted line above the panel title. Uppercased by CSS.
   * Defaults to `tab` when omitted, which is what the design does for most panels.
   */
  eyebrow?: string;
  /** The panel headline. A real answer where there is one ("Bella Center Copenhagen"). */
  title: string;
  /** Small uppercase chips under the intro. Only the Venue panel uses them in the design. */
  tags?: string[];
  blocks: GuideBlock[];
  image: string;
  /** Alt text. Never decorative here: every panel photo carries meaning (SECURITY r9). */
  alt: string;
};

export type GuideSection = {
  /** Stable id, used for the section anchor. */
  key: string;
  title: string;
  items: GuideItem[];
};

export const GUIDE_SECTIONS: GuideSection[] = [
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    key: "essentials",
    title: "Event Essentials",
    items: [
      {
        key: "venue",
        tab: "Venue",
        eyebrow: "Venue location",
        title: "Bella Center Copenhagen",
        tags: [
          "Large venue",
          "Modern facilities",
          "Flexible spaces",
          "Ørestad location",
          "5 min to airport",
          "Easy city access",
        ],
        blocks: [
          {
            kind: "p",
            lead: "Address:",
            // 25, not 23 (Auri, 2026-08-17). The only address in this file, so it is the only place
            // it had to change — but it was wrong on a public page, and the venue's own entrance.
            text: "Entrance 1, Emma Gads Vej 25, Copenhagen S, Denmark",
          },
          {
            kind: "list",
            lead: "Venue details:",
            items: [
              "One of Scandinavia's largest modern event venues",
              "State-of-the-art facilities with flexible meeting rooms",
              "In the Ørestad district, a few minutes from Copenhagen Airport",
              "Direct Metro connection to the city centre",
            ],
          },
        ],
        // 2026 photo (Auri, 2026-08-17), replacing the 2024 exhibition-hall shot. Better on its own
        // terms for a panel about the VENUE: the old one was an interior that could be any hall, this
        // is the building an attendee has to recognise from the street.
        image: `${IMG}/2026/08/Venue.jpg`,
        alt: "The Bella Center facade under a large TechBBQ banner, with attendees arriving at the Entrance 1 revolving doors",
      },
      {
        key: "entrance",
        tab: "Entrance",
        eyebrow: "Entrance location",
        title: "Entrance 1",
        blocks: [
          {
            kind: "p",
            text: "Entrance 1 is at the front of Bella Center Copenhagen and is visible as you arrive from the Metro or the bike lanes.",
          },
          {
            kind: "list",
            lead: "What to look for:",
            items: [
              "Signage directing TechBBQ attendees from the moment you arrive",
              // Same correction as the venue-layout list: the Info Desk is in Hall E, not at the door.
              "Check-in visible immediately as you enter",
            ],
          },
        ],
        // THE SAME FILE AS THE VENUE PANEL, deliberately (Auri, 2026-08-17: "entrance the same").
        // It works here because the photo happens to answer both questions: the doors in it are
        // labelled "Entrance 1", which is the one thing this panel exists to help somebody find.
        // The cost is two adjacent tabs showing the same picture — say the word and Entrance goes
        // back to TechBBQ-Entrance-Logo.webp.
        image: `${IMG}/2026/08/Venue.jpg`,
        alt: "The Entrance 1 revolving doors at Bella Center Copenhagen, under the TechBBQ banner",
      },
      {
        key: "transportation",
        tab: "Transportation",
        eyebrow: "Getting here",
        title: "How to reach the venue",
        blocks: [
          {
            kind: "list",
            lead: "Public transport:",
            items: [
              "Metro: M1 line, Bella Center station",
              "Bus: line 30 from Copenhagen Central Station",
              "Train: regional trains stop at Ørestad station",
            ],
          },
          {
            kind: "list",
            lead: "Driving:",
            items: ["E20 motorway, exit 19 “Ørestad”", "24-hour paid parking at the venue"],
          },
          {
            kind: "list",
            lead: "From the airport:",
            items: [
              "Copenhagen Airport (CPH) is the closest airport",
              "Metro, train or taxi to the venue",
              "8 to 15 minutes door to door",
            ],
          },
        ],
        image: `${IMG}/2026/08/Copy-of-27091709A1-TechBBQ-2025-scaled.jpg`,
        alt: "An attendee stepping out of a car outside the venue, with bicycles parked at a rack behind",
      },
      {
        key: "access",
        tab: "Access",
        eyebrow: "Accessibility",
        title: "Accessibility at the venue",
        blocks: [
          {
            kind: "list",
            lead: "Venue features:",
            items: [
              "Accessible entrances to all areas",
              "Lifts and elevators to all floors",
              "Wide, clear walkways",
              "Accessible parking nearby",
            ],
          },
          {
            kind: "list",
            lead: "Additional support:",
            items: [
              "Service animals are welcome",
              "Assistance is available on request",
              "For specific needs, call +45 32 52 88 11",
            ],
          },
          {
            kind: "p",
            lead: "AC Hotel Bella Sky Copenhagen:",
            text: "Elevators in both towers, and accessible rooms are available.",
          },
        ],
        image: `${IMG}/2025/01/Accessibility.webp`,
        alt: "Accessible routes and facilities at Bella Center Copenhagen",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    key: "on-site",
    title: "On-Site Experience",
    items: [
      {
        key: "opening-hours",
        tab: "Opening Hours",
        title: "Two days at Bella Center",
        blocks: [
          {
            kind: "schedule",
            day: "Wednesday, August 26th (Event day 1)",
            rows: [
              "9:00 · Check-in opens",
              "10:00 · Stage program starts",
              "17:30 · Stage program ends",
              "20:00 · Doors close",
            ],
          },
          {
            kind: "schedule",
            day: "Thursday, August 27th (Event day 2)",
            rows: [
              "9:00 · Check-in opens",
              "10:00 · Stage program starts",
              "17:00 · Stage program ends",
              "17:15 – 19:00 · Pre-after party in Hall E",
            ],
          },
        ],
        image: `${IMG}/2025/01/opening-hours.webp`,
        alt: "Attendees arriving as the doors open at TechBBQ",
      },
      {
        key: "venue-map",
        tab: "Venue Map",
        title: "Find your way around",
        blocks: [
          {
            kind: "p",
            text: "Everything runs off one main artery. You enter at Entrance 1, pass check-in and the wardrobe, and the exhibition, the stages and the lounges open up from there.",
          },
          {
            kind: "list",
            lead: "Roughly where things are:",
            items: [
              // THE INFO DESK MOVED OUT OF THIS LINE. It used to read "Check-in, wardrobe and the
              // Info Desk: straight ahead from Entrance 1", which the 2026-08-17 update contradicts
              // — the desk is in Hall E. Two panels said it sat by check-in, and both are corrected;
              // a guide that puts the help desk in two places is worse than one that names neither.
              "Check-in and wardrobe: straight ahead from Entrance 1",
              "Event Rooms 1 to 6, the Investor Lounge and the exhibition: hall C",
              "The Info Desk, Grill Sessions and the pre-after party: hall E",
              "The BBQ Stage, the Founders Lounge and the Matchmaking Area: halls C3 and C4",
            ],
          },
          {
            kind: "p",
            lead: "On the day:",
            // PRINTED MAPS DROPPED and the app's map named instead (Auri, 2026-08-17). Promising a
            // paper map that may not be there is the same mistake as promising the barbecue.
            text: "Signage is up throughout the venue, and the Info Desk in Hall E can point you anywhere. Via the TechBBQ app you will also find the virtual map.",
          },
        ],
        // An elevated view, which is the right kind of picture for a panel about GETTING AROUND —
        // it shows the halls as a layout rather than as a wall of people at eye level.
        image: `${IMG}/2026/08/Copy-of-IMG_3701-2-scaled.jpg`,
        alt: "An elevated view across a busy TechBBQ hall, showing stands, seating areas and the walkways between them",
      },
      {
        key: "stage-program",
        tab: "Stage Program",
        title: "What is on, and when",
        blocks: [
          {
            kind: "p",
            text: "The full program is live on the event platform. You can browse it by day, filter by track, stage, speaker or session type, and save sessions to your own schedule.",
          },
          {
            kind: "p",
            lead: "Both days:",
            text: "The stage program starts at 10:00. It runs until 17:30 on Wednesday and until 17:00 on Thursday.",
          },
        ],
        image: `${IMG}/2024/11/TechBBQ-audience-engaged-with-headphones.webp`,
        alt: "A TechBBQ audience listening to a stage session with headphones",
      },
      {
        key: "badge-claim",
        tab: "Badge Claim",
        title: "Collecting your badge",
        blocks: [
          {
            kind: "p",
            lead: "Where:",
            text: "The check-in area is right as you enter Bella Center through Entrance 1.",
          },
          {
            kind: "list",
            lead: "What you get:",
            items: ["A name badge", "A lanyard", "A wristband"],
          },
          {
            kind: "list",
            lead: "Check-in hours:",
            items: ["9:00 – 18:00 on Wednesday 26th", "9:00 – 18:00 on Thursday 27th"],
          },
          {
            kind: "list",
            lead: "Pick up early:",
            // Both days corrected on 2026-08-17: the 20th now opens an hour earlier and closes half
            // an hour later, and the 24th has real hours and the full address instead of just the
            // venue name.
            items: [
              "Thursday, August 20th, 11:00 – 18:30 at Matrikel 1 Café (outdoor area)",
              "Monday, August 24th, 14:00 – 18:00 at Bella Center, Entrance 1, Emma Gads Vej 25, 2300 Copenhagen S",
            ],
          },
          {
            kind: "list",
            lead: "Pickup options:",
            items: [
              "Individual attendees can collect their own badge",
              // BULK COLLECTION IS THE 20TH ONLY (Auri, 2026-08-17). Unqualified, this line read as a
              // standing offer, so a partner could turn up on the 26th expecting to collect for a
              // whole company. The date is named rather than "the pre-badge day", because a partner
              // reading this has no reason to know which day that is.
              "Partners may collect all badges for their company in bulk, on Thursday the 20th only",
            ],
          },
          {
            kind: "list",
            lead: "Please note:",
            items: ["Lost badge reprint: 50 DKK", "Lost wristband replacement: 750 DKK"],
          },
        ],
        image: `${IMG}/2025/01/badge-claim.webp`,
        alt: "A TechBBQ attendee collecting a badge at the check-in desk",
      },
      {
        key: "wardrobe",
        tab: "Wardrobe",
        eyebrow: "Keypitt™ wardrobe",
        title: "Keypitt™ wardrobe",
        blocks: [
          { kind: "p", lead: "Where:", text: "Directly in front of the check-in area." },
          {
            kind: "list",
            lead: "Prices:",
            items: ["Jackets: free of charge", "Luggage and larger items: 35 DKK"],
          },
          {
            kind: "list",
            lead: "Opening hours:",
            items: ["8:00 – 18:00 on Wednesday 26th", "8:00 – 18:00 on Thursday 27th"],
          },
          {
            kind: "p",
            lead: "Skip the queue:",
            text: "Get your [KeyPass](https://www.keypitt.io/welcome?rf=RV8JCCHk29uhEbOm6PKZLrlQU-XuIGpt7suzn-HxGYA) before you arrive.",
          },
          {
            kind: "list",
            items: [
              "Takes 20 seconds, once for life",
              "Works at all Keypitt™ venues and events",
              "Add it to your phone wallet for one-tap access",
              "Show it at check-in and check-out, no paper ticket needed",
            ],
          },
          {
            kind: "p",
            text: "Already have one with payment connected? Head straight to the fast-track line.",
          },
        ],
        // The best match in the whole set: the Keypitt™ Fast track sign is IN the photo, which is the
        // one thing this panel is selling.
        image: `${IMG}/2026/08/Copy-of-27091109C1-TechBBQ-2025-scaled.jpg`,
        alt: "Attendees handing jackets over at the Keypitt wardrobe desks, under a Keypitt Fast track sign, with coat racks behind",
      },
      {
        key: "lost-and-found",
        tab: "Lost & Found",
        title: "Lost something?",
        blocks: [
          {
            kind: "p",
            lead: "During the event:",
            text: "Visit the Info Desk in Hall E. Our team will help you, and found items are handed in there.",
          },
          {
            kind: "p",
            lead: "After the event:",
            text: "Email us at [info@techbbq.org](mailto:info@techbbq.org).",
          },
        ],
        // A CLEAR IMPROVEMENT ON WHAT WAS HERE. The old file was a Silent Events crew member holding
        // an armful of headphones, under alt text claiming it was "the TechBBQ info desk where lost
        // and found items are handled" — a description of a photo nobody had looked at. This one is
        // actually staff at a desk helping somebody, which is what the panel tells you to do.
        //
        // The coat racks behind them make it read as the wardrobe rather than the Info Desk in Hall E.
        // Flagged to Auri; still better than the headphones.
        image: `${IMG}/2026/08/Copy-of-28103228C3-TechBBQ-2025-scaled.jpg`,
        alt: "Two TechBBQ staff members at a service desk, with rows of tagged coats on racks behind them",
      },
      {
        key: "info-desk",
        tab: "Info Desk",
        title: "Ask us anything",
        blocks: [
          { kind: "p", lead: "Where:", text: "You will find us in Hall E." },
          {
            // Thursday now runs an hour later than Wednesday (Auri, 2026-08-17). Note the wardrobe
            // next door still closes at 18:00 on the 27th — see the note in the Keypitt panel.
            kind: "list",
            lead: "Opening hours:",
            items: ["8:00 – 18:00 on Wednesday 26th", "8:00 – 19:00 on Thursday 27th"],
          },
        ],
        image: `${IMG}/2026/08/Copy-of-27100543C1-TechBBQ-2025-scaled.jpg`,
        alt: "TechBBQ staff working at laptops behind a desk, helping attendees",
      },
      {
        key: "media-policy",
        tab: "Media Policy",
        eyebrow: "Photo & video policy",
        title: "Photos, filming and press",
        blocks: [
          {
            kind: "p",
            lead: "General policy:",
            text: "You are welcome to take photos and video on your phone and share them online. TechBBQ is a public event.",
          },
          {
            kind: "p",
            lead: "Professional equipment:",
            text: "Professional filming equipment is only allowed by prior agreement, or if you are an accredited member of the press.",
          },
        ],
        image: `${IMG}/2025/01/Photo.jpg`,
        alt: "A photographer covering TechBBQ",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    key: "food",
    title: "Food, Drinks & Payments",
    items: [
      {
        key: "food-beverage",
        tab: "Food & Beverage",
        // THE TITLE HAD TO GO WITH THE COPY. Auri, 2026-08-17: "maybe we should not promise a BBQ".
        // The old body promised "barbecue setups for you to enjoy", and a heading reading "BBQ
        // Experience" over a paragraph that carefully avoids promising a barbecue promises it louder
        // than the paragraph can take it back. So the panel now says what is actually there.
        title: "Food and drink on site",
        blocks: [
          {
            kind: "p",
            text: "There is a large food court, several cafés and coffee points across the venue, and a kiosk. The food court and the cafés serve a selection of hot and cold food, including a brisket option in the food court.",
          },
          {
            kind: "p",
            lead: "Important note:",
            text: "Catering is not included with your ticket, and bringing your own food and drinks is not permitted.",
          },
        ],
        image: `${IMG}/2025/01/food.webp`,
        alt: "Food being served at TechBBQ",
      },
      {
        key: "coffee",
        tab: "Coffee",
        title: "Coffee on site",
        blocks: [
          {
            kind: "p",
            text: "Espresso-based coffee is available to buy at the cafés inside the event area.",
          },
        ],
        image: `${IMG}/2025/01/coffee.webp`,
        alt: "Coffee being poured at a TechBBQ café",
      },
      {
        key: "water",
        tab: "Water Stations",
        title: "Free water in the Garden Hall",
        blocks: [
          {
            kind: "p",
            text: "Our water stations in the Garden Hall serve some of the world's purest tap water.",
          },
          {
            kind: "p",
            lead: "Bring a bottle:",
            text: "We care about sustainability, so please bring a reusable bottle and refill it at the stations rather than using single-use cups.",
          },
        ],
        // NOT a picture of a tap, and that is why it fits: this panel's title is "Free water in the
        // GARDEN HALL", and the photo is the Garden Hall — glass roof, planting up the walls, the long
        // benches. It shows somebody where to go, which a close-up of a refill station cannot.
        image: `${IMG}/2026/08/Copy-of-27120416C1-TechBBQ-2025-scaled.jpg`,
        alt: "The Garden Hall under its glass roof, with long benches full of attendees eating and drinking",
      },
      {
        key: "payments",
        tab: "Payments",
        title: "A cashless event",
        blocks: [
          {
            kind: "p",
            text: "TechBBQ is cashless. We accept card and contactless payments only, everywhere on site.",
          },
        ],
        image: `${IMG}/2025/01/payment.webp`,
        alt: "A contactless card payment at TechBBQ",
      },
      {
        key: "recycling",
        tab: "Recycling",
        title: "Sorting into 21 categories",
        blocks: [
          {
            kind: "p",
            lead: "Waste management:",
            text: "Bella Center Copenhagen sorts waste at the point of disposal into 21 distinct categories, so materials are separated before they are ever collected.",
          },
          {
            kind: "p",
            lead: "The result:",
            text: "Less than 0.5% of the venue's waste goes to landfill, and the rest is recycled or upcycled.",
          },
        ],
        image: `${IMG}/2025/01/recycling.webp`,
        alt: "Waste sorting stations at Bella Center Copenhagen",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    key: "work",
    title: "Work & Lounges",
    items: [
      {
        key: "event-platform",
        tab: "Online Event Platform",
        title: "Official Event App",
        blocks: [
          {
            kind: "p",
            lead: "Maximise your experience:",
            text: "The event platform has a matchmaking tool and the full program in one place. It is the best way to connect and stay informed.",
          },
          {
            kind: "p",
            lead: "It is open now:",
            text: "Ticket holders can set up a profile and start networking today, on desktop and on mobile. The program, the speaker list, the partner list and the side events are all in there.",
          },
          {
            kind: "p",
            lead: "Access:",
            text: "Ticket holders receive an email with a personal invitation and a download link.",
          },
          {
            kind: "p",
            lead: "Pro tip:",
            text: "Most meetings are arranged before the event begins, so set your profile up early.",
          },
        ],
        // The NUMBERED matchmaking tables, which is the platform's output rather than its interface —
        // you book a meeting in the app and then stand at table 14. Would suit the Table Reservation
        // panel equally well; that panel and Brella currently share one photo between them.
        image: `${IMG}/2026/08/Copy-of-28115820C3-TechBBQ-2025-scaled.jpg`,
        alt: "A hall of numbered meeting tables, with pairs of attendees talking at them",
      },
      {
        key: "brella",
        tab: "Brella App",
        eyebrow: "Event app · Brella",
        title: "This is Brella",
        blocks: [
          {
            kind: "p",
            text: "Brella is TechBBQ's official networking and event app, and it is the platform described above. It is live for TechBBQ 2026, so you can start booking meetings before you arrive.",
          },
          {
            kind: "list",
            lead: "What you can do:",
            items: [
              "Book 1:1 meetings with other attendees",
              "Browse the agenda and build your own schedule",
              "Find exhibitors and partners",
              "Get event updates and notifications",
            ],
          },
          {
            kind: "p",
            lead: "Download:",
            text: "Available for iOS and Android. You will receive an email with instructions before the event.",
          },
        ],
        image: `${IMG}/2024/07/Networking-at-TechBBQ.jpg`,
        alt: "Attendees meeting each other at TechBBQ",
      },
      {
        key: "table-reservation",
        tab: "Table Reservation",
        title: "Meetings in the Matchmaking Area",
        blocks: [
          {
            kind: "p",
            text: "Meetings you accept on the event platform are given a table in the Matchmaking Area automatically. There are 200 tables in hall C4, plus a post-meeting lounge and workzone beside them.",
          },
          {
            kind: "p",
            lead: "Note:",
            text: "You cannot reserve a table without matching on the platform first.",
          },
        ],
        image: `${IMG}/2024/07/Networking-at-TechBBQ.jpg`,
        alt: "Meeting tables in the TechBBQ matchmaking area",
      },
      {
        key: "wifi",
        tab: "WiFi",
        title: "Free WiFi",
        blocks: [
          { kind: "p", text: "TechBBQ offers free WiFi throughout the venue." },
        ],
        image: `${IMG}/2024/08/53231547134_85dce7b644_c.jpg`,
        alt: "Attendees working on laptops at TechBBQ",
      },
      {
        key: "charging",
        tab: "Charging",
        title: "Stay powered up",
        blocks: [
          {
            kind: "p",
            lead: "Charging area:",
            text: "There is a dedicated charging area in hall C4, next to the Matchmaking Area.",
          },
          {
            kind: "p",
            text: "Power outlets are also available in the workspaces throughout the venue. Please bring your own charger.",
          },
        ],
        image: `${IMG}/2025/01/charging.webp`,
        alt: "A phone charging at a TechBBQ workspace",
      },
      {
        key: "workspaces",
        tab: "Workspaces",
        title: "Somewhere to get work done",
        blocks: [
          {
            kind: "p",
            text: "Workspaces are spread across the venue, free to use at any time and with no reservation. They suit a quick task or an hour on your laptop.",
          },
          {
            kind: "p",
            lead: "Our thinking:",
            text: "We hope you can be present at the event, and we know work does not always wait.",
          },
        ],
        image: `${IMG}/2026/08/Copy-of-IMG_3405-scaled.jpg`,
        alt: "Attendees working on laptops at tall shared work benches with stools",
      },
      {
        key: "relaxation",
        tab: "Relaxation",
        // RENAMED from the Re-Charging Zone to the Longevity Lounge (Auri, 2026-08-17). All three
        // places it was named are changed together — the eyebrow, the list lead and the two body
        // paragraphs — because half a rename reads as two different rooms.
        eyebrow: "Longevity Lounge",
        title: "A quieter room",
        blocks: [
          {
            kind: "list",
            lead: "In the Longevity Lounge:",
            // Biohacking devices KEPT. Auri's note listed only the first two and was cut off
            // mid-word, so this is not evidence the third is gone. Ask before dropping it.
            items: ["Guided meditation", "Breathwork sessions", "Biohacking devices"],
          },
          {
            kind: "p",
            lead: "Why:",
            text: "Two days of networking is a lot. The lounge is somewhere to release tension and get your focus back.",
          },
          {
            kind: "p",
            lead: "Partner:",
            // One Thirty Labs kept, wording only. Whether they still co-host the room under its new
            // name is not something a rename can answer — check before the guide goes out.
            text: "The lounge is co-hosted by [One Thirty Labs](https://onethirtylabs.com).",
          },
        ],
        image: `${IMG}/2024/11/Guided-meditation-at-TechBBQ.jpg`,
        alt: "A guided meditation session in the quiet room at TechBBQ",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    key: "safety",
    title: "Safety",
    items: [
      {
        key: "safety-overview",
        tab: "Safety Overview",
        title: "Security & Safety",
        blocks: [
          {
            kind: "p",
            lead: "Our commitment:",
            text: "We work closely with our security partner at Bella Center Copenhagen to keep the event safe and welcoming.",
          },
          {
            kind: "p",
            lead: "Staff:",
            text: "All venue staff are trained in safety and evacuation procedures.",
          },
          {
            kind: "p",
            lead: "Security check:",
            text: "Every visitor and staff member passes a security check at the entrance, and the security team is present throughout the event.",
          },
          {
            kind: "p",
            lead: "Questions:",
            text: "Approach the nearest security personnel at any time.",
          },
        ],
        image: `${IMG}/2024/11/Smiles-and-connections-at-TechBBQ.jpg`,
        alt: "Attendees and staff at TechBBQ",
      },
      {
        key: "facility-safety",
        tab: "Facility Safety",
        title: "What the venue has in place",
        blocks: [
          {
            kind: "list",
            items: [
              "CCTV surveillance",
              "Automatic fire alarm and sprinkler system",
              "Monitored door alarms",
              "A security officer on site 24/7",
              "Automatic external defibrillators",
              "A fully stocked first aid office",
            ],
          },
        ],
        // A CCTV camera and a sprinkler head are not photographable without looking like a warning
        // notice, so this is the humane version of the same fact: one person walking a wide, clear,
        // unobstructed hall. It would also answer the Accessibility panel's "wide, clear walkways"
        // bullet better than anything currently on offer — see the note there.
        image: `${IMG}/2026/08/Copy-of-27093727B1-TechBBQ-2025-scaled.jpg`,
        alt: "An attendee walking through a wide, clear hall at Bella Center Copenhagen",
      },
      {
        key: "first-aid",
        // The staging design spells this "Firts Aid". Corrected here rather than reproduced.
        tab: "First Aid",
        title: "If you need help",
        blocks: [
          {
            kind: "p",
            lead: "Getting help:",
            text: "Approach the nearest security personnel. They are trained in basic first aid and can call emergency responders.",
          },
          {
            kind: "p",
            lead: "On site:",
            text: "Trained paramedics are available throughout the event. For immediate assistance, contact the nearest staff or security member, or go to the Info Desk.",
          },
          {
            kind: "p",
            lead: "Emergency number:",
            text: "The national emergency number in Denmark is 112. Call 112 first, then tell nearby TechBBQ staff or security.",
          },
          {
            kind: "p",
            lead: "Distressing behaviour:",
            text: "If you witness or experience distressing or inappropriate behaviour, tell the nearest security personnel. See our [Code of Conduct](https://techbbq.dk/techbbq-code-of-conduct/).",
          },
        ],
        image: `${IMG}/2024/11/Two-women-at-a-TechBBQ-booth-showcasing-eco-friendly-technology.jpg`,
        alt: "TechBBQ staff available to help attendees",
      },
      {
        key: "code-of-conduct",
        tab: "Code of Conduct",
        title: "How we treat each other",
        blocks: [
          {
            kind: "p",
            lead: "What we expect:",
            text: "Respect every attendee, regardless of identity or background.",
          },
          {
            kind: "p",
            lead: "Where it applies:",
            text: "All event activities, in person and online.",
          },
          {
            kind: "p",
            lead: "Full text:",
            text: "Read the complete [Code of Conduct](https://techbbq.dk/techbbq-code-of-conduct/).",
          },
        ],
        image: `${IMG}/2024/11/TechBBQ-interviewer-preparing-to-film-an-attendee-outdoors.jpg`,
        alt: "An interview being filmed at TechBBQ",
      },
      {
        key: "health-measures",
        tab: "Health Measures",
        title: "Looking after each other",
        blocks: [
          {
            kind: "p",
            lead: "If you feel unwell:",
            text: "TechBBQ hosts thousands of people. Please consider everyone's wellbeing and stay home. You can transfer your ticket to someone else.",
          },
          {
            kind: "p",
            lead: "Hygiene:",
            text: "Bathrooms for handwashing are available throughout the venue.",
          },
        ],
        image: `${IMG}/2025/01/health-measures.jpg`,
        alt: "Hand hygiene facilities at the venue",
      },
      {
        key: "prohibited-items",
        tab: "Prohibited Items",
        title: "What you cannot bring",
        blocks: [
          {
            kind: "list",
            items: [
              "Drugs or narcotics",
              "Weapons or firearms",
              // Added 2026-08-17, Auri's question ("should we add animals if it is not service
              // animal?"). Worded as an exception rather than a ban: under the Danish Disability Act
              // a service animal is not a pet, and a flat "no animals" on a public page reads as
              // turning away a guide dog. Assistance animals are named too — a psychiatric service
              // dog is not what most readers picture from "service animal".
              "Animals, unless it is a service or assistance animal",
              "Glass or deposit bottles, bring a reusable water bottle instead",
              "Professional filming equipment without prior approval",
              "Walkie-talkies or portable speakers",
              "Aerosol sprays, including paint and deodorant",
              "Portable chairs of any kind",
              "Flyers or promotional material, without permission",
            ],
          },
        ],
        // A neutral exhibition-floor photo, like the audience shot it replaces. Nothing illustrates a
        // list of banned items without looking like an accusation, so the picture stays scenery.
        image: `${IMG}/2026/08/Copy-of-27101335D1-TechBBQ-2025-scaled.jpg`,
        alt: "Two attendees talking in front of an exhibition stand on the TechBBQ show floor",
      },
    ],
  },
];

// NO F.A.Q. HERE. The staging design has one, and it was built and then removed at Auri's
// request (2026-08-11). The four questions came from the design with their answers collapsed,
// so the copy could only ever have been a draft nobody at TechBBQ had approved — the guide is
// better with no F.A.Q. than with four invented answers on a public page. If it comes back, the
// answers have to come from TechBBQ, not from re-reading the panels above.

/** Every item, flattened. Used for the count on the dashboard and for deep-link lookups. */
export function guideItems(): GuideItem[] {
  return GUIDE_SECTIONS.flatMap((s) => s.items);
}

/**
 * Throws if two items share a key.
 *
 * Called by the API route and the preview page rather than trusted: the keys become element ids
 * and `aria-controls` targets in both renderers, and a duplicate would silently wire one tab to
 * another section's panel. Cheap to check, invisible to debug.
 */
export function assertUniqueKeys(): void {
  const seen = new Set<string>();
  for (const item of guideItems()) {
    if (seen.has(item.key)) {
      throw new Error(`[event-guide] duplicate item key "${item.key}" — keys become element ids`);
    }
    seen.add(item.key);
  }
}
