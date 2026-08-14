/**
 * A SESSION'S OWN PROGRAMME, as a document, for the all-day bookings that are really a whole
 * agenda inside one row.
 *
 * THE PROBLEM THIS SOLVES. Brella models a partner's all-day takeover of an event room as ONE
 * timeslot: "Beyond Unicorns - Building Europe's Resilient Industries", Event Room 1, 13:30 - 17:30,
 * seventeen people attached to it. Every one of those seventeen is on the card, and not one of them
 * has a time. An attendee reading it can tell that Randi Wahlsten is somewhere in those four hours
 * and nothing more (Auri, 2026-08-14: "it's difficult to understand when exactly they are speaking
 * and what is happening specifically"). The run of show exists, as a PDF the partner sent to
 * marketing, and it was published on techbbq.dk but linked from nowhere the agenda can reach.
 *
 * So the session gets a link to it. Not a fix for the shape of the data — the real fix is typing
 * the run of show into the Sessions table the way NASS and the Policy Stage were, and that is a
 * separate job — but it puts the answer one press away instead of nowhere.
 *
 * AT THE SOURCE, not in a page. lib/brellaprogram.ts sets `programmeUrl` while it maps the feed, so
 * /brella-program, the pasted embed and /api/program?event=brella all carry it. The same reasoning
 * as roomAlias() and HIDDEN_TRACKS living there: a link added to one of the three surfaces would
 * have been missing from the other two.
 *
 * MATCHED ON A REGEX over titleKey(), not on the Brella timeslot id and not on the exact title.
 * The id is stable until somebody deletes and recreates the row, which happened to the 15:35
 * Investor Reverse Pitch during NASS; the full title gets edited in Brella's admin all summer.
 * A prefix on the distinctive words survives both, and the same reasoning already governs
 * HIDDEN_TRACKS.
 */
import { titleKey } from "@/lib/eventArtwork";

type SessionProgramme = {
  /** Tested against titleKey(session.name) — lowercase, accents and punctuation already gone. */
  match: RegExp;
  /** Must be https. See sanitise() below for why that is enforced here and not only in the UI. */
  url: string;
  /**
   * What the link says. Written out per entry rather than defaulted, because "programme" is not
   * always the honest word: a run of show, a schedule and a workshop plan are different documents
   * and the visitor is entitled to know which one they are about to open.
   */
  label: string;
};

const PROGRAMMES: SessionProgramme[] = [
  // BEYOND UNICORNS, Event Room 1, 26 August, hosted by Closing Loops. Their own PDF, uploaded to
  // techbbq.dk in August 2026, holds the timed run of show for the four hours: which panel is when,
  // and which of the seventeen people is on which one.
  //
  // The Brella row's description already names the document ("Closing Loops, TechBBQ 26.08.2026,
  // Program") without linking it, which is how it went unnoticed. That line stays as it is: it is
  // Brella's copy, edited in Brella's admin, and this file does not rewrite descriptions.
  {
    match: /^beyond unicorns\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/Closing-Loops-TechBBQ.pdf",
    label: "Open the full programme (PDF)",
  },
];

/**
 * HTTPS ONLY. These are hand-typed constants, so this cannot catch a hostile value — nobody can
 * inject into a literal in this file. It catches the ordinary mistake: a URL pasted out of a
 * browser bar as http, or with a stray space, which on techbbq.dk would be a mixed-content warning
 * on a page that is otherwise clean. The embed's own safeUrl() is the second gate, for the copy of
 * the snippet already pasted on a page that nobody can go back and correct.
 */
function sanitise(url: string): string | null {
  const s = url.trim();
  return /^https:\/\//i.test(s) ? s : null;
}

/**
 * The programme document for a session title, or null when it has none — which is every session
 * but the ones listed above.
 *
 * Takes the RAW title and keys it here, so a caller cannot forget to normalise and get a silent
 * no-match, which is indistinguishable from no entry existing.
 */
export function sessionProgramme(name: string): { url: string; label: string } | null {
  const key = titleKey(name);
  if (!key) return null;
  for (const p of PROGRAMMES) {
    if (!p.match.test(key)) continue;
    const url = sanitise(p.url);
    if (!url) {
      // Loud rather than silent: an entry that fails its own guard is a typo in this file, and a
      // link quietly not appearing is exactly the bug this module was written to end.
      console.error("[sessionProgrammes] rejected a non-https url for", key, p.url);
      return null;
    }
    return { url, label: p.label };
  }
  return null;
}
