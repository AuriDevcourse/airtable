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
  /**
   * Tested against titleKey(session.name) — lowercase, accents and punctuation already gone.
   *
   * Optional only because of `block` below: an entry needs one or the other, and one with neither is
   * skipped rather than matching everything.
   */
  match?: RegExp;
  /**
   * A CONTIGUOUS BLOCK IN ONE ROOM ON ONE DAY, for a programme whose rows share no title at all.
   *
   * Nordic IPO & Stock Market Day is why this exists. Brella used to carry it as a single
   * "Nordic IPO..." row, which /^nordic ipo\b/ matched; it has since been split into fourteen
   * separately-titled sessions ("Welcome Opening Session", "Will we see more IPOs in the near
   * future?", two rows just called "Break") with no track, no tags and no programme name — nothing a
   * title regex can hold on to, and the link had silently matched nothing since. The room and the
   * clock are the only things that identify the block.
   *
   * `from`/`to` are inclusive "HH:MM" bounds on the session's START time, and they matter: the same
   * room that day also runs an unrelated 09:30-11:00 session which must not get this document.
   */
  block?: { room: string; date: RegExp; from: string; to: string };
  /**
   * ALSO require this to match the session's date key (YYYY-MM-DD). Optional, and only two entries
   * need it.
   *
   * WHY IT EXISTS. Creative Business Cup runs the same titles on both days — every row on the 26th
   * and the 27th starts "Creative Business Cup 2026:" — and since 2026-08-19 it has a SEPARATE
   * document per day. A title regex cannot tell those apart, so without this the two days would have
   * to share one file again, which is the thing the partner just stopped doing.
   *
   * An entry with a `date` never matches a caller that supplies no date, rather than matching
   * everything: a link on the wrong day is worse than no link.
   */
  date?: RegExp;
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
  /**
   * THE HOSTS' OWN SIGN-UP PAGE for this session, when they run one. Optional, and separate from
   * `url` on purpose: the document and the sign-up are two different actions, and the renderers
   * already treat them that way. `programmeUrl` is a footnote under the card; `registerUrl` is the
   * button above the speaker list, because somebody who opened a side event came to sign up.
   *
   * IT LIVES HERE RATHER THAN IN A SECOND TABLE for the reason at the top of this file: set at the
   * source, one entry carries every per-session link, and /brella-program, the pasted embed and
   * /api/program?event=brella cannot disagree about it.
   *
   * Side events do NOT need this: lib/sideEvents.ts already carries their Luma URL from Airtable,
   * and registerUrlFromText() mines one out of a description that prints it. This is for a session
   * whose description says "Register by clicking HERE" with the URL hidden behind the link text,
   * which no miner can recover. Same https guard as `url`.
   */
  register?: string;
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
  // THE SAME DOCUMENT, matched by the block instead of by title — see SessionProgramme.block. The
  // entry above is kept for the day Brella carries a parent row again; today it matches nothing,
  // which is how this document ended up linked from nowhere until 2026-08-19.
  //
  // 12:30 is the networking that opens the day and 16:55 the closing bell, so the window starts at
  // the first row and ends at the last. Event Room 3's unrelated 09:30-11:00 session sits outside it.
  {
    block: {
      room: "Event Room 3",
      date: /^2026-08-26$/,
      from: "12:30",
      to: "17:15",
    },
    url: "https://techbbq.dk/wp-content/uploads/2026/08/Nordic-IPO-2026_Program_A4_Midnight-2pages.pdf",
    label: SEE_FULL,
  },
  // AI THAT SELLS (Microsoft), Event Room 4, 27 August. The Brella description already lists the
  // seven agenda items and puts a time on NONE of them; the PDF is the same list with the times on
  // it (14:30 doors, 14:40 Microsoft's opening, 14:50 Antler/Speedinvest, 15:20 the Anthropic demo,
  // 15:50 roundtables, 16:30 drinks).
  //
  // REPOINTED 2026-08-19 at Microsoft_Program_27.08.2026.pdf, the revision Auri uploaded under the
  // new naming convention. It is not a re-export of the same thing: it adds a 15:40-15:50 networking
  // break and shortens the roundtable to 15:50-16:30. `TechBBQ-Ai-that-sells.pdf` is still on the
  // server and is now the superseded copy, linked from nowhere.
  {
    match: /^ai that sells\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/Microsoft_Program_27.08.2026.pdf",
    label: SEE_FULL,
  },
  // CREATIVE BUSINESS CUP, Event Room 5 on both 26 and 27 August — ONE DOCUMENT PER DAY since
  // 2026-08-19, which is why these two entries are separated by `date` and not by title. Every row
  // of the block, on either day, is titled "Creative Business Cup 2026: <something>", so the title
  // alone cannot say which day it belongs to.
  //
  // These supersede `CBC26-@TechBBQ-programme-overview.pdf`, the combined 14 August export both days
  // used to share, and `CBC_2026_Program.pdf` before it (that one had the weekdays wrong). Both are
  // still on the server and are now linked from nowhere.
  {
    match: /^creative business cup\b/,
    date: /^2026-08-26$/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/CreativeBusinessNetwork_Program-Day-1.pdf",
    label: SEE_FULL,
  },
  {
    match: /^creative business cup\b/,
    date: /^2026-08-27$/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/CreativeBusinessNetwork_Program-Day-2.pdf",
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
  // ── ADDED 2026-08-19, all four uploaded by Auri under the new naming convention. Each one has a
  // block on the Brella board, which is the rule: no Brella rows, no link, because the link rides on
  // a row. Three partner programmes that exist in Airtable have no Brella block at all and are
  // deliberately NOT here — Women in Tech's Diversity Lounge, NORNORM's circular breakfast and the
  // Fundraising Bootcamp.
  //
  // THE POLICY STAGE, Event Room 5,6,7 on 27 August. This entry is keyed on the programme NAME
  // because lib/policyOverride.ts resolves it that way and hangs it on each of the fourteen typed
  // sessions, exactly as the Board Summit does — Brella's own rows for this room are substituted
  // away, so a link that only matched them would reach nobody. Brella's all-day band
  // ("Policy Stage: Shaping the Future of European Startups") matches this too, which is what
  // carries the link if the override ever falls back to Brella.
  {
    match: /^policy stage\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/PolicyStage_Program_27.08.2026.pdf",
    label: SEE_FULL,
  },
  // SMALL HUB, GLOBAL AMBITION (Plug and Play with Digital Serbia Initiative), Event Room 4,
  // 27 August 11:45-14:30. Brella HAD it as seven rows that all began with the same title and differed
  // only after the dash ("- Door Opening", "- Welcome and Intro", "- Panel", "- Fireside Chat",
  // "- Q&A", "- Networking Lunch"); it is ONE row now, carrying the whole run of show in its own
  // description. The prefix match covers both shapes, which is why it stays a prefix.
  //
  // URL UPDATED 2026-08-24 to the hosts' second edition. Verified rather than assumed: the new file's
  // text is byte-identical to the `Ready program` attachment on the partner's Partnership Success row
  // (recHBGvc47BGi8aP7), so this is the document marketing holds and not an older draft.
  //
  // FIRST ENTRY TO CARRY `register` (Auri, 2026-08-24). The description ends "Register to the event by
  // clicking HERE!" with the URL behind the link text, so Brella's copy of it names no address and
  // registerUrlFromText() has nothing to mine — a reader is told to click a word that is not a link.
  // The Luma page is that missing address.
  {
    match: /^small hub global ambition\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/TechBBQ-Side-Event-Hosted-by-Scale-Up-Lab-Western-Balkans-24-08.pdf",
    label: SEE_FULL,
    register: "https://luma.com/daeoai03",
  },
  // SCALING EUROPE (Google), Event Room 5, 26 August 12:00-14:45. One Brella row for the whole
  // block, with five timed items inside the PDF and none of them anywhere in the data.
  {
    match: /^scaling europe\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/Google_Program_26.08.2026.pdf",
    label: SEE_FULL,
  },
  // FUTURE OF FINTECH (Flatpay), Event Room 3, 27 August 09:30-13:00. ON THE PARENT ROW ONLY: its
  // sub-sessions are already typed with times and speakers, in Brella and in the Sessions table
  // (/api/program?event=fintech), so unlike Beyond Unicorns this block does not NEED the document to
  // be readable — it is here because the host published one. Two of those sub-rows are called
  // "Networking Breakfast" and "Networking", which no title regex can claim without also claiming
  // rows in other rooms.
  {
    match: /^future of fintech\b/,
    url: "https://techbbq.dk/wp-content/uploads/2026/08/Flatpay_Program_27.08.2026.pdf",
    label: SEE_FULL,
  },
  // AWS x NVIDIA, "The Agentic AI Era", Event Room 3 on 27 August 13:30-17:10. MATCHED ON THE BLOCK
  // and not on a title, for the same reason Nordic IPO is: the five rows are titled after their own
  // topics ("How AWS and NVIDIA Are Putting Agentic AI in Every Startup's Hands?", two "Technical
  // deep-dive...", "The Agentic AI Landscape...", "Networking") and share no prefix · and the last
  // of them is called just "Networking", which no title regex can claim without also claiming rows
  // in other rooms.
  //
  // THE WINDOW STOPS THE MORNING OUT. The same room runs Flatpay's Future of Fintech 09:30-13:00
  // with its own document, so a room-and-day match would put this PDF on that programme too.
  //
  // The declared shell row in lib/derivedShells.ts starts at 13:30 and so matches this entry as
  // well, which is deliberate: that band is not pressable in either renderer, so the link has to be
  // on the four real sessions to be reachable at all · the same reasoning as the Board Summit above.
  {
    block: {
      room: "Event Room 3",
      date: /^2026-08-27$/,
      from: "13:30",
      to: "17:10",
    },
    url: "https://techbbq.dk/wp-content/uploads/2026/08/AWS_NVIDIA-event-program-for-TechBBQ_-24-08.pdf",
    label: SEE_FULL,
  },
  // THE DIVERSITY LOUNGE 2.0, both days, hosted by Women in Tech with Google and Dansk Erhverv.
  // Auri gave the link on 2026-08-24 as the correct full programme.
  //
  // A LUMA PAGE RATHER THAN A PDF, which is a first for this table and is the point: it is the
  // hosts' own live page, so a change they make to their line-up reaches the reader without anyone
  // re-exporting a file and re-typing a URL here.
  //
  // Matched on the title prefix, which every one of the 21 rows carries ("Diversity Lounge 2.0 |
  // Coffee & Connect", "Diversity Lounge 2.0 | Panel: Show Me the Money"). A block match was the
  // alternative and is worse here: the lounge runs both days, so it would need two entries and both
  // would break the moment the hosts move a start time.
  //
  // Verified against the Brella feed on 2026-08-24: 21 of 21 sessions match the Luma agenda on time
  // and title. The two known differences are Brella's, not this link's — Day 2's "Coffee & Connect"
  // runs to 11:30 in Brella against 10:55 on Luma, and Luma's 12:35 lunch break has no Brella row.
  // Auri chose to leave the lunch out (2026-08-24) and to correct the coffee slot in Brella itself.
  //
  // NOT `SEE_FULL`, and this is the entry the label field was kept for: every other document here
  // is a PDF and says so, and promising a PDF that opens as a Luma event page is a small lie the
  // reader notices at the moment they press it.
  {
    match: /^diversity lounge 2 0\b/,
    url: "https://luma.com/wakc0i63",
    label: "See the full program",
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

/** "12:30 - 13:00" or "09:30 – 09:45" → minutes since midnight of the START, or null. */
function startMinutes(slot: string): number | null {
  const m = slot.match(/(\d{1,2})[:.](\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/** Whether a session sits inside a `block` entry's room, day and time window. */
function matchesBlock(
  block: NonNullable<SessionProgramme["block"]>,
  dateKey?: string,
  where?: { room?: string; timeSlot?: string }
): boolean {
  if (!dateKey || !block.date.test(dateKey)) return false;
  if (!where?.room || where.room !== block.room) return false;
  const start = startMinutes(where.timeSlot ?? "");
  const from = startMinutes(block.from);
  const to = startMinutes(block.to);
  if (start === null || from === null || to === null) return false;
  return start >= from && start <= to;
}

/**
 * The programme document for a session title, or null when it has none — which is every session
 * but the ones listed above.
 *
 * Takes the RAW title and keys it here, so a caller cannot forget to normalise and get a silent
 * no-match, which is indistinguishable from no entry existing.
 *
 * `dateKey` is the session's own YYYY-MM-DD, and only the entries carrying a `date` care about it.
 * Callers that have no date (the two overrides, which know their programme by name) may omit it and
 * still match every dated-agnostic entry.
 */
export function sessionProgramme(
  name: string,
  dateKey?: string,
  where?: { room?: string; timeSlot?: string }
): { url: string; label: string } | null {
  const p = findEntry(name, dateKey, where);
  if (!p) return null;
  const url = sanitise(p.url);
  if (!url) {
    // Loud rather than silent: an entry that fails its own guard is a typo in this file, and a
    // link quietly not appearing is exactly the bug this module was written to end.
    console.error("[sessionProgrammes] rejected a non-https url for", titleKey(name), p.url);
    return null;
  }
  return { url, label: p.label };
}

/**
 * The hosts' sign-up page for a session, or null — which is every session but the one entry that
 * carries `register`. Same arguments and same matching as sessionProgramme(), because it is the same
 * table: a session that has both gets both, resolved once each.
 */
export function sessionRegister(
  name: string,
  dateKey?: string,
  where?: { room?: string; timeSlot?: string }
): string | null {
  const p = findEntry(name, dateKey, where);
  if (!p?.register) return null;
  const url = sanitise(p.register);
  if (!url) {
    console.error("[sessionProgrammes] rejected a non-https register url for", titleKey(name), p.register);
    return null;
  }
  return url;
}

/** The first entry identifying this session, by title or by block. Shared by both lookups above. */
function findEntry(
  name: string,
  dateKey?: string,
  where?: { room?: string; timeSlot?: string }
): SessionProgramme | null {
  const key = titleKey(name);
  if (!key) return null;
  for (const p of PROGRAMMES) {
    if (p.block) {
      if (!matchesBlock(p.block, dateKey, where)) continue;
    } else if (p.match) {
      if (!p.match.test(key)) continue;
      // A dated entry must be told which day it is looking at. See SessionProgramme.date.
      if (p.date && !(dateKey && p.date.test(dateKey))) continue;
    } else {
      // Neither a title nor a block: an entry that can never identify anything. Skipped rather than
      // treated as a wildcard, which would put one partner's document on the whole board.
      console.error("[sessionProgrammes] entry has neither match nor block:", p.url);
      continue;
    }
    return p;
  }
  return null;
}
