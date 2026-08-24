// Colours and icons for the Brella program, shared by the dashboard page and the embed
// builder.
//
// WHY THIS FILE EXISTS. The page renders React and the embed builder emits a raw HTML string,
// so neither can import the other's markup. Everything they must AGREE on lives here instead:
// a track's accent colour and a stage's icon. Both were duplicated by hand before, and a
// duplicated colour table is a table that will disagree the first time a stage is renamed.
//
// Regexes are stored as SOURCE STRINGS rather than RegExp literals so this can be
// JSON.stringify'd straight into the snippet. The page compiles them once at module load.

export type TrackStyle = {
  re: string;
  color: string;
  /** Second stop. Set only where the card should be a gradient rather than a flat tint. */
  color2?: string;
};

// Order matters: first match wins. The five stages come first so a stage can never fall
// through to one of the generic rules below it.
export const TRACK_STYLES: TrackStyle[] = [
  { re: "^bbq stage", color: "#FA7000" },
  { re: "^tech stage", color: "#2BB4E1" },
  { re: "campfire", color: "#F2C744" },
  { re: "^founders? stage", color: "#37C978" },
  // Two disciplines in one stage, so the card reads blue to green.
  { re: "life science", color: "#2BB4E1", color2: "#37C978" },
  // The Grill tracks are named after their colour, so these are matched by name rather than
  // assigned from a rotation: an "Orange Grill Session" card with a green bar is just wrong.
  { re: "green grill", color: "#5CBC8B" },
  { re: "blue grill", color: "#1B6CA8" },
  { re: "orange grill", color: "#FA7000" },
  // The two lounges share the Grill Sessions board without being grill sessions. They need
  // their own accents for the same reason the grills do: with no rule both fall through to the
  // orange default, so each column reads as a second Orange Grill Session sat directly beside
  // the real one — and, worse, the two lounges become indistinguishable from each other.
  // Teal and magenta are the last unspoken hues: orange, blue, yellow, green and red are
  // stages, rooms and side events, and violet is the breathwork badge.
  { re: "diversity lounge", color: "#17A398" },
  { re: "longevity lounge", color: "#B5179E" },
  { re: "^event room|^rooms?\\b", color: "#1B6CA8" },
  // The Policy Stage is three event rooms opened up, not a stage, so it wears the room blue.
  // Without this it fell through to the orange default and read as a sixth stage on a board of
  // otherwise-blue rooms.
  { re: "policy stage", color: "#1B6CA8" },
  { re: "^side event", color: "#CE0F2E" },
];

export const DEFAULT_TRACK_COLOR = "#FA7000";

// A section's own colour, used when the track name cannot carry it.
//
// Side Events are RED (#CE0F2E, Auri's rule and what /partner-events already uses). The name
// rule above matched Brella's track "Side Event Promotion"; now that these come from Airtable
// their `room` is the hosting partner — "Rockstart", "Google" — which matches nothing and fell
// through to the orange default. A declared section beats guessing at a company name.
export const SECTION_COLORS: Record<string, string> = {
  side: "#CE0F2E",
};

// ─── BREATHWORK BREAKS ──────────────────────────────────────────────────────────────────
// Fourteen guided breathing breaks run across the stages on 26 and 27 August, facilitated by
// QuietSpace. Every one of them is 3 to 10 minutes long, and on a timeline where height means
// duration that makes them the SMALLEST cards on the board — so by default the program reads
// them as filler between the talks, which is backwards. They are one of the few things on the
// schedule a visitor is meant to stop for.
//
// So they get their own accent instead of their stage's, plus a badge and a legend line. The
// rule is the NAME, because Brella leaves their Session Type blank and their track is whichever
// stage hosts them.
//
// Violet because nothing else in the palette is violet: orange, blue, yellow and green are all
// spoken for by stages, and a fifth warm tint would just read as a sixth stage.
//
// MATCHED ON "meditation" TOO, and in the 2026 feed that is the only word that hits: all eight
// breaks are named "3 Minute Arrival Meditation" or "Meditation & Talk Break!", none say
// breathwork. So the badge reads "Meditation". "breathwork" stays in the pattern because the
// 2025 programme used it and a returning session should not silently lose its treatment.
export const BREATHWORK_RE = "breathwork|meditation";
export const BREATHWORK_COLOR = "#B49BFF";
export const BREATHWORK_LABEL = "Meditation";

const BREATHWORK_RX = new RegExp(BREATHWORK_RE, "i");

/** Whether a session is one of the breathwork breaks. Matched on the name — see above. */
export function isBreathwork(s: { name?: string } | null | undefined): boolean {
  return BREATHWORK_RX.test(s?.name || "");
}

// Lucide "wind". Reads as breath at 12px, where lungs and a heart both turn to mush.
export const BREATHWORK_ICON_PATHS: string[] = [
  "M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2",
  "M9.6 4.6A2 2 0 1 1 11 8H2",
  "M12.6 19.4A2 2 0 1 0 14 16H2",
];

// ─── STAGE OPENINGS ─────────────────────────────────────────────────────────────────────
// Every stage opens its day with a 5-to-10 minute welcome, and those are the cards a visitor
// most needs to find — they are where you go to start the day. Same problem as breathwork: on
// a timeline where height means duration, a 5-minute opening is 15px and reads as filler.
//
// So they get breathwork's WEIGHT (a filled card, a full outline, a badge) but NOT its colour.
// An opening belongs to its stage — the BBQ Stage opening is orange, the Founders Stage opening
// is green — because unlike a breathwork break, an opening is not a thing running across the
// stages, it is the stage starting. That is the whole distinction between the two treatments,
// and it is why sessionColor() below is deliberately NOT given an opening branch: no override
// means the card keeps its track colour, which is exactly what is wanted.
//
// MATCHED ON THE NAME, and the names are not consistent — Brella has "Stage Opening" (5 of
// them), "Welcome to TechBBQ 2026!", "Welcome to Day 2 of TechBBQ 2026!", "Opening of Day 2"
// and, on Life Science's first day, plain "Introduction".
//
//   \bopening\b   the word, not the substring. "Copenhagen" contains "open" and this schedule
//                 has two side events with Copenhagen in the title; \bopening\b misses both,
//                 but a looser /open/i would paint them as stage openings.
//   ^welcome\b    anchored, so a talk called "A warm welcome to quantum" is not an opening.
//   ^introduction$  EXACT, and it exists for one card: Life Science's 26 Aug opening, the
//                 counterpart to its "Opening of Day 2" the next day. Unanchored it would
//                 catch any session with "introduction" in the title.
export const OPENING_RE = "\\bopening\\b|^\\s*welcome\\b|^\\s*introduction\\s*$";
export const OPENING_LABEL = "Opening";

const OPENING_RX = new RegExp(OPENING_RE, "i");

/**
 * Whether a session is a stage opening.
 *
 * Breathwork is excluded rather than merely ordered after: the two treatments differ only in
 * colour, so a session matching both would get the violet override AND the opening badge, which
 * reads as a breathwork break that is somehow also an opening. Nothing in the 2026 schedule
 * matches both; this keeps a future "Opening Breathwork" from rendering as a contradiction.
 */
export function isOpening(s: { name?: string } | null | undefined): boolean {
  const n = s?.name || "";
  return OPENING_RX.test(n) && !BREATHWORK_RX.test(n);
}

// Lucide "play". A right-pointing triangle is the one shape that still reads as "start here" at
// 12px — a sunrise or a flag turns to mush at that size, which is the same test the breathwork
// wind glyph had to pass.
export const OPENING_ICON_PATHS: string[] = ["M6 3l14 9-14 9z"];

// THE MARK FOR "THIS ONE HAS A PROGRAMME DOCUMENT" — Lucide file-text, on any card whose session
// carries `programmeUrl` (lib/sessionProgrammes.ts).
//
// WHY THE CARD NEEDS IT AT ALL. The link itself lives in the dialog, which is correct: it is a
// 3 MB PDF and no card should be a launcher for one. But nothing on the board said the document
// existed, so the only way to find it was to press an all-day block on the off-chance — which is
// how Auri, who asked for the link himself, concluded on 2026-08-17 that it had not been added
// ("on here there is no link whatsoever"). If he cannot find it, no attendee will.
//
// A MARK, NOT A LINK. The card is already a <button> that opens the dialog, and an anchor nested
// inside it is both invalid and a coin-flip for which one a tap hits. This says "there is a run of
// show behind this card"; the dialog hands it over.
export const PROGRAMME_LABEL = "Programme";
export const PROGRAMME_ICON_PATHS: string[] = [
  "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
  "M14 2v4a2 2 0 0 0 2 2h4",
  "M16 13H8",
  "M16 17H8",
];

// Lucide building-2, for the "Hosted by <partner>" line on a side event. Shared here rather
// than written twice, for the same reason the stage icons are: the embed emits raw SVG strings
// and cannot render the page's React component.
export const HOST_ICON_PATHS: string[] = [
  "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
  "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",
  "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",
  "M10 6h4",
  "M10 10h4",
  "M10 14h4",
  "M10 18h4",
];

// Lucide conventions: 24x24, currentColor stroke, 2px, round caps and joins, no fill.
// BBQ/Tech/Founder are Lucide's own flame, zap and rocket. Campfire and the helix are drawn
// here because Lucide has no firewood or DNA glyph that fits.
export const STAGE_ICON_PATHS: Record<string, string[]> = {
  "BBQ Stage": [
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  ],
  "Tech Stage": [
    "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
  ],
  // Two crossed logs spanning the box. A small flame above them rendered as a stray dot at
  // 16px, so the logs carry the whole idea.
  "Campfire Stage": ["m4 18 16-9", "m4 9 16 9"],
  // Keyed on the LABEL in lib/brellaSections.ts, so the two move together — renamed to
  // "Founders Stage" with it on 2026-08-07 to match the signage.
  "Founders Stage": [
    "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0z",
    "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
    "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0",
    "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
  ],
  // Drawn across almost the full 24 units; at a narrower span it collapsed into a squiggle.
  "Life Science x Deep Tech Stage": [
    "M6 2c0 5 12 5 12 10s-12 5-12 10",
    "M18 2c0 5-12 5-12 10s12 5 12 10",
    "M8 6.5h8",
    "M6 12h12",
    "M8 17.5h8",
  ],
};

const COMPILED = TRACK_STYLES.map((t) => ({ ...t, rx: new RegExp(t.re, "i") }));

export function trackColor(room: string): string {
  const hit = COMPILED.find((t) => t.rx.test(room || ""));
  return hit ? hit.color : DEFAULT_TRACK_COLOR;
}

export function trackColor2(room: string): string | undefined {
  return COMPILED.find((t) => t.rx.test(room || ""))?.color2;
}

/**
 * A session's accent: its section's colour when it declares one, else its track's.
 *
 * MEDITATION BREAKS OVERRIDE IT AND COME BACK VIOLET (Auri, 2026-08-18). This flipped twice:
 * violet first, then the stage's own colour on 2026-08-06 so a break on the BBQ Stage was
 * orange, now violet again. The reason for going back is that the badge and the wind glyph
 * alone did not separate the breaks from the talks around them — eight 3-minute cards wearing
 * four stage colours read as eight more sessions. Violet is the one hue no stage uses.
 *
 * The embed (lib/brellaEmbedSnippet.ts) never stopped painting them violet, so this also ends a
 * drift where the dashboard and the copied snippet showed the same break in two colours.
 */
export function sessionColor(s: { room: string; section?: string; name?: string }): string {
  if (isBreathwork(s)) return BREATHWORK_COLOR;
  return (s.section && SECTION_COLORS[s.section]) || trackColor(s.room);
}

/**
 * Gradient second stop. Section colours are flat, so this is track-only. Meditation breaks are
 * flat as well: the violet above is the whole point of the card, and a gradient running off it
 * into a stage tint would put the stage colour back on a card that just stopped wearing one.
 */
export function sessionColor2(
  s: { room: string; section?: string; name?: string }
): string | undefined {
  if (isBreathwork(s)) return undefined; // flat violet, same as the section colours
  return s.section && SECTION_COLORS[s.section] ? undefined : trackColor2(s.room);
}
