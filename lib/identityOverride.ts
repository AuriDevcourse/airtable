// A PERSON WHOSE JOB CHANGES AT A KNOWN MINUTE, applied everywhere at once.
//
// ─── WHY THIS EXISTS RATHER THAN A ROUND OF EDITS ───────────────────────────────────────
// Ken Villum Klausen is billed across five Brella sessions, a Speaker Hub card, an event-room
// presenter row and two side-event descriptions, and on 25 August 2026 at 08:40 Copenhagen all of
// them have to stop saying "Lunar" and start saying "Repodo" — the same minute the partner wall
// reveals Repodo (lib/partners.ts, HIDDEN_UNTIL).
//
// Editing those sources by hand is the obvious approach and it is the wrong one here, for two
// reasons that both matter:
//
//   1. IT WOULD LEAK. Repodo is in stealth. The moment the name is typed into Airtable it is in a
//      feed, and the feeds are public. There is no way to stage the edit in the data.
//   2. NOBODY IS AWAKE AT 08:40 to make eight edits across three systems in the right order.
//
// So the swap is declared here with the instant it takes effect, and every surface reads through
// it. Before that instant the sources are served untouched; after it, they are rewritten in
// flight. No deploy, no cron, nobody watching a clock.
//
// ─── WHAT IT CANNOT REACH ───────────────────────────────────────────────────────────────
// Only what this repo serves: techbbq.dk's embeds, /brella-program, /all-speakers-2026 and the
// JSON feeds. The BRELLA ATTENDEE APP and the SPEAKER HUB app read their own databases and will
// keep saying Lunar until somebody edits them there. That is a manual step and it stays one.
//
// ─── READ THE CLOCK ON EVERY CALL ───────────────────────────────────────────────────────
// `now` is a parameter with a Date.now() default and is never captured at module load. A value
// read once at cold start would freeze, and a long-lived Vercel instance would go on serving the
// old title for hours after the switch — the same rule as lib/cachePolicy.ts and
// lib/partners.ts, and the bug that bit the AI Workshop dashboard.
//
// CACHING IS THE OTHER HALF OF THE TIMING. The feeds are cached, so the change lands when the
// cache next turns rather than on the second. Inside the event window that is minutes
// (lib/cachePolicy.ts), which is the resolution this needs. Do not read "08:40" as "08:40:00".
//
// ─── DELETE THE ENTRY AFTERWARDS ────────────────────────────────────────────────────────
// Once the real sources say Repodo, this rewrite becomes a no-op that still runs on every
// request. Harmless, but it is a lie about where the data comes from, so remove it when the
// sources are updated.

/** The moment Lunar becomes Repodo: 25 August 2026, 08:30 Copenhagen (CEST = UTC+2).
 *
 * BROUGHT FORWARD from 08:40 on Auri's say-so at 08:34 on the day (2026-08-25), so the swap
 * fires the moment this deploys rather than six minutes later. The instant is in the PAST on
 * purpose — that is what makes it immediate, and it keeps the gate rather than deleting it, so
 * the mechanism and its audit trail survive until the real sources are updated. */
const REPODO_AT = "2026-08-25T06:30:00Z";

type IdentitySwap = {
  /** Folded full name — see fold(). Matched exactly, so a namesake cannot be caught by it. */
  person: string;
  /** ISO instant. Before this the person's own data is served untouched. */
  at: string;
  title: string;
  company: string;
};

const IDENTITY_SWAPS: IdentitySwap[] = [
  {
    person: "ken villum klausen",
    at: REPODO_AT,
    // Auri's exact wording, 2026-08-24. He currently reads four different ways across the site
    // ("Founder of Lunar" at "In stealth mode", "Founder" at "Lunar", "Co-founder at Lunar"), and
    // one declared answer is what makes them agree.
    title: "CEO & Co-Founder",
    company: "Repodo",
  },
];

/**
 * PROSE THAT NAMES THE OLD COMPANY, swapped at the same instant.
 *
 * Structural fields are the easy half: a title and a company are their own cells. These are
 * sentences somebody wrote — two side-event blurbs and a stage session's description — where the
 * old employer is part of the copy.
 *
 * Declared as exact phrases rather than a /Lunar/ regex ON PURPOSE. Lunar is a real bank that
 * other sessions may legitimately discuss, and his own Speaker Hub biography describes founding
 * and scaling it, which is history and stays true. A blanket rewrite would falsify all of that.
 * Each phrase here was read in place first.
 */
const TEXT_SWAPS: { at: string; from: string; to: string }[] = [
  // The Nordic Founder Mindset, BBQ Stage, 26 August (Brella's own description).
  { at: REPODO_AT, from: "Ken Villum Klausen (Founder, Lunar)", to: "Ken Villum Klausen (CEO & Co-Founder, Repodo)" },
  // Mesh x TechBBQ Pre-Party, 25 August.
  { at: REPODO_AT, from: "Ken Villum Klausen (Lunar/Stealth)", to: "Ken Villum Klausen (Repodo)" },
  // CFO Round Table Dinner, 26 August.
  { at: REPODO_AT, from: "Ken Villum Klausen, founder of Lunar", to: "Ken Villum Klausen, CEO & Co-Founder of Repodo" },
];

/** Lowercase, accents stripped, punctuation dropped, spaces collapsed. */
function fold(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The title and company to publish for this person right now.
 *
 * Returns the values it was given whenever no swap applies or the moment has not arrived, so
 * every call site can pass its own data straight through.
 */
export function identityOf(
  name: string,
  title: string,
  company: string,
  now: number = Date.now()
): { title: string; company: string } {
  const key = fold(name);
  const swap = IDENTITY_SWAPS.find((s) => s.person === key && now >= Date.parse(s.at));
  return swap ? { title: swap.title, company: swap.company } : { title, company };
}

/** The same swap applied to a sentence. Returns the text unchanged when nothing is due. */
export function rewriteIdentityText(text: string, now: number = Date.now()): string {
  if (!text) return text;
  let out = text;
  for (const s of TEXT_SWAPS) {
    if (now < Date.parse(s.at)) continue;
    out = out.split(s.from).join(s.to);
  }
  return out;
}
