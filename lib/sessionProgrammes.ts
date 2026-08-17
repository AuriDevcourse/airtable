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
   * What the link says.
   *
   * ONE WORDING FOR ALL OF THEM, "See the full program (PDF)", Auri's words on 2026-08-17. It was
   * per-entry before, on the reasoning that a run of show and a workshop plan are different
   * documents; with six of them on one board that just produced six slightly different sentences
   * for the same action. The field stays so a genuinely different document can say so.
   */
  label: string;
};

/** What every entry says unless it has a reason not to. See SessionProgramme.label. */
const SEE_FULL = "See the full program (PDF)";

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
    label: SEE_FULL,
  },
  // NORDIC IPO & STOCK MARKET DAY, Event Room 3, 26 August, organised by the Association of Listed
  // Companies. THE WORST BLOCK ON THE BOARD until this link: five hours, 12:30-17:30, with a
  // fourteen-character description ("Session by FBV"), no speakers and nothing inside it.
  //
  // THE PDF IS NOT A SUMMARY, IT IS THE WHOLE PROGRAMME: fourteen timed items and 25 named
  // speakers, from the 12:30 networking to the closing bell at 16:55. Which means this link is a
  // stopgap and the run of show should be typed into the Sessions table the way NASS and the Policy
  // Stage were — see progress.md. Note the PDF ends at 17:15 where Brella books the room to 17:30.
  {
    match: /^nordic ipo\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/Nordic-IPO-2026_Program_A4_Midnight-2pages.pdf",
    label: SEE_FULL,
  },
  // AI THAT SELLS (Microsoft), Event Room 4, 27 August. The Brella description already lists the
  // seven agenda items and puts a time on NONE of them; the PDF is the same list with the times on
  // it (14:30 doors, 14:40 Microsoft's opening, 14:50 Antler/Speedinvest, 15:20 the Anthropic demo,
  // 15:50 roundtables, 16:30 drinks).
  {
    match: /^ai that sells\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/TechBBQ-Ai-that-sells.pdf",
    label: SEE_FULL,
  },
  // CREATIVE BUSINESS CUP, both blocks, Event Room 5 on 26 and 27 August. Two entries and not one:
  // the two days are separate Brella rows, and a regex loose enough to catch both would also catch
  // the sub-sessions pushed inside them.
  //
  // THE SAME DOCUMENT COVERS BOTH DAYS, so both point at the programme overview rather than at
  // `CBC_2026_Program.pdf`, which is also uploaded and is the SUPERSEDED version — it has the
  // weekdays wrong (Tue 26 / Wed 27, when 26 August 2026 is a Wednesday) and times that no longer
  // hold. It is deliberately not linked from anywhere.
  //
  // WHICH FILE IS BEHIND THIS URL MATTERS. The copy on techbbq.dk today is the 14 August export;
  // Creative Business Network sent a revision on 17 August that drops the 09:15 Day 2 welcome. When
  // that one is uploaded OVER this filename, this entry needs no edit — see progress.md.
  {
    match: /^creative business cup\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/CBC26-@TechBBQ-programme-overview.pdf",
    label: SEE_FULL,
  },
  {
    // "creativity" pins this to the parent block. The pushed sub-session is titled exactly
    // "CBC Global Finals", so /^cbc global finals\b/ alone would put the link on both.
    match: /^cbc global finals creativity\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/CBC26-@TechBBQ-programme-overview.pdf",
    label: SEE_FULL,
  },
  // BOARD SUMMIT by Boardway, Event Room 1, 27 August. Brella carries the whole day as ONE all-day
  // row with 31 people heaped on it and no times — the same shape as Beyond Unicorns above, and the
  // reason a visitor cannot tell that Viktor Axelsen is on at 09:45 and Jakob Riis at 14:00.
  //
  // UNLIKE BEYOND UNICORNS, THE TIMED VERSION ALSO EXISTS AS DATA: 14 sessions hand-typed in the
  // Sessions table, with moderators and speakers named per session, served at
  // /api/program?event=board. Since 2026-08-17 lib/boardOverride.ts substitutes those into the
  // Brella column, so the board draws the real agenda and this all-day row becomes the dashed band
  // around it.
  //
  // THE LINK IS KEPT ANYWAY, and moves onto the sessions with it (Auri, 2026-08-17: "if we have
  // speakers and everything, let's add it up, but make sure to have also pdf program"). The document
  // holds things no session row does — the session formats ("Keynote 20+10 min"), the pitch running
  // order — and after the substitution the all-day row is a band nobody can press, so a link only on
  // this row would be a link nobody can reach.
  {
    match: /^board summit\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/Board-Summit-Program-2026.pdf",
    label: SEE_FULL,
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
