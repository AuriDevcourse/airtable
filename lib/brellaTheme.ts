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
  { re: "^event room|^rooms?\\b", color: "#1B6CA8" },
  { re: "^side event", color: "#CE0F2E" },
];

export const DEFAULT_TRACK_COLOR = "#FA7000";

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
  "Founder Stage": [
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
