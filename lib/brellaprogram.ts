// Server-only: the TechBBQ 2026 program as it exists in BRELLA (the attendee app), not
// Airtable. Brella's timeslots are where the real schedule is maintained, so this is the
// source that is actually complete: 30 published sessions with times, stage, topic tags
// and descriptions, versus the near-empty "Program 2026" Airtable table.
//
// Read-only BY CHOICE. The same key can create sessions and speakers in the live attendee app —
// brella-push.mjs does exactly that with POST /timeslots and POST /speakers — so nothing in the
// feed path uses anything but GET.
//
// If you are here wondering whether writes are possible: they are, and the working request shapes
// are documented in brella-push.mjs. Do NOT conclude otherwise from Brella's public help page
// (it describes the read API only) or from an OPTIONS probe (OPTIONS 404s on a path whose GET
// returns 200). Both of those misled a session on 2026-08-12 into reporting the API as read-only.
// What genuinely has no route is ASSIGNING a speaker to a session; that stays a manual step in the
// Brella UI.
//
// Mapped onto the shared ProgramSession shape from lib/program.ts, so the existing
// /program page and the agenda embed render it with no changes.

import { fetchWithTimeout } from "@/lib/http";
import type { ProgramSession, ProgramSpeaker } from "@/lib/program";
import { sessionProgramme, sessionRegister } from "@/lib/sessionProgrammes";
import { derivedShells } from "@/lib/derivedShells";
import { str } from "@/lib/fields";
import { identityOf, rewriteIdentityText } from "@/lib/identityOverride";
import {
  dayProgrammeOf,
  programmeOf,
  roomAlias,
  spansMorningToEvening,
} from "@/lib/brellaSections";

const API = "https://api.brella.io/api/integration";

// Pinned ids (stable, not secrets). Org 109 = TechBBQ, event 10356 = TechBBQ 2026
// (slug techbbq2026). Both come from the admin panel URL.
const ORG_ID = "109";
const EVENT_ID = "10356";

// Brella returns UTC. The program is read by people in Copenhagen, and 08:00Z is 10:00
// locally, so every time is converted before it is published.
const TZ = "Europe/Copenhagen";

// Brella pads the schedule with one untitled 15-minute row per networking slot — 50 of the
// 80 timeslots. They belong to this track and are not sessions.
const NETWORKING_TRACK = "1:1 meetings";

// ─── HIDDEN FOR NOW ─────────────────────────────────────────────────────────────────────
// The LP Forum track. Auri is building it inside the 2026 programme and asked for it to stay out
// of every surface until he says otherwise (2026-08-05). One all-day row exists today: "LP Forum",
// 25 August, Hotel d'Angleterre, no speakers yet.
//
// Filtered on the TRACK rather than the session name, so any number of rows added under it stay
// hidden without anyone touching this file again. Matched as a PREFIX because the track is called
// "LP Forum 2026" today and a rename to plain "LP Forum" should not un-hide it.
//
// Deliberately here, at the source, rather than in the page: /brella-program, the pasted embed and
// /api/program?event=brella all read this function, and hiding it in one of them would have left it
// live in the other two.
//
// TO REVEAL IT: delete this constant and the one `continue` below. Nothing else references it.
// The LP Forum entries on /investors are a DIFFERENT thing (investor speakers, from Airtable) and
// are not affected.
const HIDDEN_TRACKS: RegExp[] = [/^lp forum/i];

// Anything this long is an all-day thing (side-event promos run 720 minutes), and printing
// "00:00 - 12:00" for it reads like a bug.
const ALL_DAY_MINUTES = 360;

// MORNING TO EVENING IS AN ALL-DAY THING TOO, however long it technically runs (Auri,
// 2026-08-06). A booking that opens in the morning and is still going in the evening has taken
// the room for the day, and on the board it should be the band that says so rather than a tall
// block that happens to reach both ends.
//
// Deliberately strict — BOTH ends, not a duration. Auri chose this over lowering the 6h cap:
// Nordic IPO (12:30-17:30) and Beyond Unicorns (13:30-17:30) run to the close but start after
// lunch, and calling an afternoon workshop "all day" overstates it. Nothing in the 2026
// schedule matches yet; the rule is here for the bookings that will.
// The thresholds live in lib/brellaSections.ts — the page needs the same rule for a room's
// whole day, and two copies of a threshold is one that will disagree.
/** "09:30" → 570. null when Brella gave us something unparseable. */
function minutesOfDay(iso: string): number | null {
  const hhmm = localTime(iso);
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Tags carry topics ("AI", "HealthTech") but marketing also parks room/hall labels in
// there. The stage already comes from the track, so those are skipped when picking the
// topic shown on a card.
const ROOMISH_TAG = /^(hall\b|event room\b|rooms?\b|stage\b)/i;

// Brella allows as many tags as marketing cares to add — the 2026 event has sessions carrying
// six. Three is what a card can show without becoming a tag cloud, and what the Event Rooms
// filter offers (Auri, 2026-08-06). Cut here rather than in the UI so the page, the embed and
// anything else reading the feed agree on which three.
const MAX_TAGS = 3;

const TIMEOUT_MS = 12_000;

export class BrellaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Ref = { id: string; type: string };
type Rel = { data?: Ref | Ref[] | null };
type Resource = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, Rel>;
};

// Brella's own admin decorates track and tag names with emoji ("⭐ Founders Stage"). Those
// are labels on techbbq.dk once published, and emoji are not UI elements here, so they are
// stripped rather than shipped. Covers pictographs, dingbats, symbols, variation selectors
// and ZWJ joiners.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

function label(v: unknown): string {
  return str(v).replace(EMOJI, "").replace(/\s+/g, " ").trim();
}

function one(rel: Rel | undefined): Ref | null {
  const d = rel?.data;
  if (!d || Array.isArray(d)) return Array.isArray(d) ? (d[0] ?? null) : null;
  return d;
}

function many(rel: Rel | undefined): Ref[] {
  const d = rel?.data;
  if (!d) return [];
  return Array.isArray(d) ? d : [d];
}

// Brella stores rich text as Draft.js block JSON: { blocks: [{ text }], entity_map }.
// Only the plain text is published — the agenda embed renders a description string, and
// passing raw JSON through would print "[object Object]" on techbbq.dk.
function draftToText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (!v || typeof v !== "object") return "";
  const blocks = (v as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => (b && typeof b === "object" ? str((b as { text?: unknown }).text) : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

// "2026-08-26" in Copenhagen, whatever the UTC instant is.
function localDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return p; // en-CA gives YYYY-MM-DD
}

// "10:00" in Copenhagen.
function localTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// "26 August" for the day heading.
function localDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  }).format(d);
}

type RawTimeslot = Resource & {
  attributes: {
    title?: unknown;
    subtitle?: unknown;
    content?: unknown;
    duration?: unknown;
    "start-time"?: unknown;
    "end-time"?: unknown;
  };
};

export async function fetchBrellaProgram(): Promise<ProgramSession[]> {
  // Accepts either name: the key was first added to .env.local as bare `BRELLA`.
  const key = process.env.BRELLA_API_KEY || process.env.BRELLA;
  if (!key) {
    throw new BrellaError("Brella env var is not set on the server (BRELLA_API_KEY).", 503);
  }

  // PAGED, because a single call silently truncates. This used to be one request with
  // `page[size]=500` and no loop: fine at 281 timeslots, but the 501st would have vanished with no
  // error anywhere — the feed would just be short, which nobody would notice until a session was
  // missing from techbbq.dk. Brella honours page sizes up to at least 500 and reports
  // `meta.total_pages`, so the loop below asks for 500 at a time and today still finishes in ONE
  // request, exactly as before.
  //
  // `included` DIFFERS PER PAGE (page 1 carried 344 related records, page 2 360, page 3 252) and the
  // union across pages is what the single big call returned. So every page's `included` is merged
  // into one index before anything is resolved — indexing only the last page would leave most
  // timeslots without their track, tags or speakers.
  const rows: RawTimeslot[] = [];
  const byId = new Map<string, Resource>();

  // Brella answers a page past the end with 200 and an empty `data`, so the loop has a natural
  // terminator. This cap is the backstop against a paginator that never says "done": at 500 a page
  // it allows 20,000 timeslots, far past any real event.
  const PAGE_SIZE = 500;
  const MAX_PAGES = 40;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams();
    params.set("page[size]", String(PAGE_SIZE));
    params.set("page[number]", String(page));

    const res = await fetchWithTimeout(
      `${API}/organizations/${ORG_ID}/events/${EVENT_ID}/timeslots?${params.toString()}`,
      {
        headers: {
          "Brella-API-Access-Token": key,
          Accept: "application/vnd.brella.v4+json",
        },
        cache: "no-store",
      },
      TIMEOUT_MS
    );

    if (!res.ok) {
      // Throws on ANY page, including a later one. A partial programme is worse than an error: the
      // page would render as if complete while missing sessions, and the cache would then hold that
      // short version for its whole TTL.
      console.error("[brella-program] fetch failed", res.status, "page", page);
      throw new BrellaError("Could not reach the Brella program.", 502);
    }

    const body = (await res.json()) as {
      data?: RawTimeslot[];
      included?: Resource[];
      meta?: { total_pages?: unknown };
    };
    const batch = Array.isArray(body.data) ? body.data : [];
    rows.push(...batch);
    // Later pages win on a duplicate key, which is harmless: the same record repeated across pages
    // is the same record.
    for (const inc of body.included ?? []) byId.set(`${inc.type}:${inc.id}`, inc);

    // Stop on the first short or empty page. `total_pages` is checked too, so a full last page
    // that happens to divide exactly does not cost a wasted extra request.
    const totalPages = typeof body.meta?.total_pages === "number" ? body.meta.total_pages : null;
    if (batch.length < PAGE_SIZE) break;
    if (totalPages !== null && page >= totalPages) break;

    if (page === MAX_PAGES) {
      // Never silently: if this ever fires, the programme really is 20,000 rows and the cap needs
      // raising rather than the truncation going unnoticed.
      console.error(`[brella-program] hit the ${MAX_PAGES}-page cap; the feed may be truncated.`);
    }
  }

  const nameOf = (type: string, id: string | undefined): string =>
    id ? label(byId.get(`${type}:${id}`)?.attributes?.name) : "";

  // Speakers hang off the timeslot INDIRECTLY: timeslot → speaker-assignment → speaker.
  // The assignment carries the ordering AND the role, so it is followed rather than skipped.
  // (An older comment here said Brella always left `role` null. It does not: the 2026 event
  // has 27 Moderator, 42 Panelist, 26 Speaker, 4 Facilitator and 3 Keynote speaker rows.) Only names are required; a speaker with no name is a
  // half-created record and is dropped rather than rendered as an empty card.
  //
  // photo-url points at brella-assets.brella.io and is a plain public URL, NOT a signed one
  // like Airtable's attachments, so it is passed through instead of proxied through
  // /api/photo. If Brella ever starts signing these, they will need the same treatment.
  const speakersFor = (row: RawTimeslot): ProgramSpeaker[] => {
    const out: ProgramSpeaker[] = [];
    for (const ref of many(row.relationships?.["speaker-assignments"])) {
      const assignment = byId.get(`speaker-assignment:${ref.id}`);
      const speakerId = one(assignment?.relationships?.speaker)?.id;
      const speaker = speakerId ? byId.get(`speaker:${speakerId}`) : undefined;
      if (!speaker) continue;

      const a = speaker.attributes;
      const name = [str(a["first-name"]), str(a["middle-name"]), str(a["last-name"])]
        .filter(Boolean)
        .join(" ");
      if (!name) continue;

      out.push({
        id: `brella-speaker-${speaker.id}`,
        name,
        // Ken Villum Klausen's Lunar -> Repodo swap fires here at its declared minute; every
        // other person passes straight through. See lib/identityOverride.ts.
        ...identityOf(name, str(a["job-title"]), str(a["company-name"])),
        photo: str(a["photo-url"]) || null,
        bio: draftToText(a.bio),
        role: str(assignment?.attributes?.role),
      });
    }
    // Brella's own display order, which is what the attendee app shows.
    return out;
  };

  type Prepared = { session: ProgramSession; dateKey: string; startIso: string };
  const prepared: Prepared[] = [];

  for (const row of rows) {
    const a = row.attributes;
    const title = str(a.title);
    const startIso = str(a["start-time"]);
    const track = nameOf("track", one(row.relationships?.track)?.id);

    // Publish rule, matching the rest of the connector: a session needs a title and a
    // start time. That alone drops all 50 untitled networking rows; the track check keeps
    // them out even if someone later types a title into one.
    if (!title || !startIso) continue;
    if (track === NETWORKING_TRACK) continue;
    // Held back on request — see HIDDEN_TRACKS. Checked against the RAW track, before roomAlias()
    // can rewrite it into an event room number.
    if (HIDDEN_TRACKS.some((rx) => rx.test(track))) continue;

    const dateKey = localDateKey(startIso);
    if (!dateKey) continue;

    const duration = typeof a.duration === "number" ? a.duration : 0;
    const endIso = str(a["end-time"]);
    const startMin = minutesOfDay(startIso);
    const endMin = endIso ? minutesOfDay(endIso) : null;
    const morningToEvening =
      startMin !== null && endMin !== null && spansMorningToEvening(startMin, endMin);
    const timeSlot =
      duration >= ALL_DAY_MINUTES || morningToEvening
        ? "All day"
        : [localTime(startIso), endIso ? localTime(endIso) : ""].filter(Boolean).join(" - ");

    // Topic for the card's tag. Room/hall labels live in tags too, so they are skipped —
    // the stage is already the `room` field.
    const tags = many(row.relationships?.tags)
      .map((t) => nameOf("tag", t.id))
      .filter((n) => n && !ROOMISH_TAG.test(n))
      .slice(0, MAX_TAGS);
    const topic = tags[0] || "";

    // Brella's subtitle is a one-liner ("Side Event Promotion by Rockstart"); the body copy
    // is the Draft.js content. Both are useful, so subtitle leads the description.
    // Two of these sentences name Ken Villum Klausen's old company. See lib/identityOverride.ts:
    // exact declared phrases only, never a blanket /Lunar/ rewrite — Lunar is a real bank that
    // other sessions legitimately discuss.
    const description = rewriteIdentityText([str(a.subtitle), draftToText(a.content)].filter(Boolean).join("\n"));

    // The host's own run of show, for an all-day row that is really a whole agenda. Null for all
    // but a couple of sessions — see lib/sessionProgrammes.ts.
    //
    // `dateKey` is passed because Creative Business Cup now publishes one document per day and its
    // two days share every title. `session.day` cannot be used here: it is filled in below, once the
    // distinct dates are known, and is still "" at this point.
    //
    // The room and the slot go with it because one programme (Nordic IPO) can only be identified by
    // where and when it runs — its fourteen rows share no title. `roomAlias(track)` is computed again
    // below for the session itself; it is cheap and pure.
    const programme = sessionProgramme(title, dateKey, {
      room: roomAlias(track),
      timeSlot,
    });

    // The hosts' own sign-up page, from the same table and matched the same way. Only Plug and Play's
    // event room carries one today: its description tells the reader to "click HERE" and Brella keeps
    // no address behind those words, so without this the instruction points nowhere. Side events do
    // not come through here — lib/sideEvents.ts already has their Luma URL from Airtable.
    const register = sessionRegister(title, dateKey, {
      room: roomAlias(track),
      timeSlot,
    });

    prepared.push({
      dateKey,
      startIso,
      session: {
        id: `brella-${row.id}`,
        day: "", // filled below, once the distinct dates are known
        name: title,
        timeSlot,
        type: topic,
        tags,
        description,
        // A named programme that occupies a numbered event room is filed under that room.
        // See ROOM_ALIASES; done here so page, route and embed cannot disagree.
        room: roomAlias(track),
        // The named programme this session belongs to, when its track is one. Kept because
        // roomAlias() rewrites the track into a room number and throws the name away, and the
        // board needs it to label a room with what is ACTUALLY running in it.
        ...(programmeOf(track) ? { programme: programmeOf(track) as string } : {}),
        location: label(a.location),
        speakers: speakersFor(row),
        // The host's own run of show, where an all-day row is really a whole agenda and Brella
        // has nowhere to put the timings. Matched on the title, so a row deleted and recreated in
        // Brella's admin keeps its link.
        ...(programme ? { programmeUrl: programme } : {}),
        // Spread the same way, so a session without one carries no null into the JSON: the two
        // renderers test truthiness and the embed's snippet is smaller for the absence.
        ...(register ? { registerUrl: register } : {}),
      },
    });
  }

  // Day labels are derived, not stored: Brella has no "Day 1" field. Numbering the distinct
  // dates keeps them sortable ("Day 1" < "Day 2") the way the Airtable sources' free-text
  // Day column is, and the date is appended so a reader knows which day that is.
  const dateKeys = [...new Set(prepared.map((p) => p.dateKey))].sort();
  for (const p of prepared) {
    const n = dateKeys.indexOf(p.dateKey) + 1;
    p.session.day = `Day ${n} · ${localDateLabel(p.startIso)}`;
    // Applied HERE and not in the loop above, because it needs the day label that loop has only
    // just produced. Never overwrites a programme the TRACK already named — a real track is
    // better evidence than a room-and-date rule.
    if (!p.session.programme) {
      const byDay = dayProgrammeOf(p.session.room, p.session.day);
      if (byDay) p.session.programme = byDay;
    }
  }

  // Chronological. lib/program.ts re-sorts by (day, parsed start time, name), but that
  // parses "10:00" out of the label; sorting on the real instants here means an unparsed
  // label ("All day") can never scramble the order.
  prepared.sort((x, y) => x.dateKey.localeCompare(y.dateKey) || x.startIso.localeCompare(y.startIso));

  const sessions = prepared.map((p) => p.session);

  // A DECLARED SHELL ROW for a partner block Brella carries only as its separate sessions —
  // AWS x NVIDIA, Event Room 3, 13:30-17:10 on the 27th. See lib/derivedShells.ts for why this is
  // a row in the feed rather than a change in the two renderers: the dashed band, the nesting and
  // the drop from the lane pass all follow from lib/shellRule.ts recognising the row's SHAPE, so a
  // row is the one edit that reaches /brella-program, the pasted embed and the API at once.
  //
  // AFTER the day pass and the sort, so a shell inherits the day label and the feed position of the
  // first session it wraps instead of needing a start instant Brella never gave it.
  const preparedById = new Map(prepared.map((p) => [p.session.id, p]));
  for (const { session, anchorId } of derivedShells(sessions, (s) => preparedById.get(s.id)?.dateKey ?? "")) {
    const at = sessions.findIndex((s) => s.id === anchorId);
    const anchor = preparedById.get(anchorId);
    if (at < 0 || !anchor) continue;
    session.day = anchor.session.day;
    // The shell's own run of show, keyed on the same room-and-clock block as the four sessions it
    // wraps (lib/sessionProgrammes.ts). Set here rather than in the loop above because this row was
    // not built from a Brella row.
    const doc = sessionProgramme(session.name, anchor.dateKey, {
      room: session.room,
      timeSlot: session.timeSlot,
    });
    if (doc) session.programmeUrl = doc;
    sessions.splice(at, 0, session);
  }

  return dropRedundantAllDayRows(sessions);
}

// ─── AN UMBRELLA ROW THAT ONLY REPEATS ITS OWN COLUMN HEADING ───────────────────────────
//
// Brella carries the Diversity Lounge twice over: one "All day" row per day called "Diversity
// Lounge 2.0 by Women in Tech", plus the 21 timed sessions that actually make up the day. The
// renderers turn that all-day row into the dashed band washed behind the whole column, and on
// this track the band says nothing the column heading has not already said — the column is
// literally titled "Diversity Lounge". Auri asked for it gone (2026-08-24).
//
// It is worth being clear about why this is NOT the Board Summit case, which keeps its band.
// There the band carries a fact the heading cannot: "Event Room 1" is a place, and the band is
// what tells you a named summit has taken it for the day. A band reading "Diversity Lounge"
// over a column reading "Diversity Lounge" carries no fact at all.
//
// DROPPED IN THE FEED, not in the renderers. The band is drawn by components/ProgramTimeline.tsx
// AND again by the string renderer in lib/brellaEmbedSnippet.ts, so a fix in either one leaves
// every already-pasted embed still showing it. One row removed here reaches the page, the embed
// builder and /api/program together.
const NO_ALL_DAY_BAND: RegExp[] = [/^diversity lounge$/i];

const ALL_DAY_SLOT = /^all\s*day$/i;

/**
 * Remove an all-day umbrella row from the listed tracks — but ONLY on a day where that track
 * also carries timed sessions.
 *
 * The condition is the safety catch. If Brella's timed rows for a lounge were ever pulled, or
 * arrived late, an unconditional rule would leave the column completely blank rather than
 * falling back to the one row that says the lounge is on at all.
 */
function dropRedundantAllDayRows(sessions: ProgramSession[]): ProgramSession[] {
  const timedDays = new Set(
    sessions
      .filter((s) => !ALL_DAY_SLOT.test(s.timeSlot ?? ""))
      .map((s) => `${s.room}|${s.day}`)
  );
  return sessions.filter(
    (s) =>
      !(
        ALL_DAY_SLOT.test(s.timeSlot ?? "") &&
        NO_ALL_DAY_BAND.some((rx) => rx.test(s.room ?? "")) &&
        timedDays.has(`${s.room}|${s.day}`)
      )
  );
}
