// Server-only access to the event programs/agendas. Multi-source: each event keeps
// its program in its own table, mapped here onto one ProgramSession shape.
//
//   brella  — the TechBBQ 2026 schedule as maintained in BRELLA (the attendee app), read
//             from its timeslots API. Not Airtable. This is the source that is actually
//             filled in, so it is the default. See lib/brellaprogram.ts.
//   techbbq — the purpose-built "Program 2026" table (created 2026-07-29): one row
//             per session, Day/Time Slot/Session Type/Description/Event Room.
//   niss    — the NISS 2026 table's program view (viwMqDT1GMW7AwOtQ): the NISS team
//             fills Session Name/Time Slot/Type of Session there; single-day event,
//             so no Day column. "Should be On Website"="NO" hides a row (opt-out,
//             same semantics as the NISS speaker gate).
//
// Only the allow-listed fields per source are ever requested. Publish rule: a row
// needs a Session Name and a Time Slot (plus Day where the source has one) —
// half-filled drafts stay invisible.

import { fetchWithTimeout } from "@/lib/http";
import { str } from "@/lib/fields";
import { photoUrl } from "@/lib/photo";
import type { BrellaSection } from "@/lib/brellaSections";
// Type only — the runtime import of this module stays dynamic and inside a try, so a face lookup
// can never be what takes an agenda down.
import type { FaceViewSource } from "@/lib/programFaces";

const API = "https://api.airtable.com/v0";

// The /api/photo feed key for the Policy Stage's photo cells (lib/photo.ts). One key covers both the
// speaker and the moderator field, because the proxy scans a source's fields in order.
const PHOTO_FEED = "policy-program";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

// A person billed on a session. Brella is the only source that has these; the Airtable
// program tables carry no speaker link, so their sessions come back with an empty array.
export type ProgramSpeaker = {
  id: string;
  name: string;
  title: string; // job title
  company: string;
  photo: string | null;
  bio: string;
  // Brella's speaker-assignment role: "Moderator", "Panelist", "Speaker", "Facilitator",
  // "Keynote speaker", or "" when it was left blank. Kept verbatim rather than folded into a
  // boolean: a panel lists panelists and a moderator, and calling them all "speakers" is
  // wrong on the one that is chairing.
  role?: string;
};

export type ProgramSession = {
  id: string;
  name: string;
  day: string; // "" for single-day events — the UI skips empty day headings
  timeSlot: string;
  type: string;
  description: string;
  room: string;
  // Optional so the three Airtable sources don't have to invent them. Consumers must treat
  // both as possibly-absent: the agenda embed predates them and ignores them entirely.
  /**
   * Every topic tag on the session, room/hall labels stripped, capped at three.
   *
   * `type` is the FIRST of these and is unchanged — the speaker grids and older embeds read it,
   * and a card has room for one kicker. This is the full set, for FILTERING: a session tagged
   * Panel + AI & ML + Investment is findable by only one of the three if the feed keeps one.
   *
   * Optional, like the two below: only the Brella source fills it, and the Airtable-sourced
   * programmes have no tags to give.
   */
  tags?: string[];
  /**
   * The named programme this session is part of — "NISS", "Future of Fintech", "Policy Stage".
   *
   * Only set where a Brella track was folded into a room number by roomAlias(); the fold throws
   * the track name away and this is what survives it. Absent on a plain "Event Room 4" session,
   * which belongs to no programme.
   */
  programme?: string;
  location?: string; // Brella's own venue string, e.g. "Bella Center Copenhagen"
  speakers?: ProgramSpeaker[];
  // Public sign-up page. Only the Side Events carry one, and only because they come from
  /**
   * Side events only: the partner's own event artwork, lifted from their ticketing page's
   * og:image (lib/eventPages.ts). Absent for events on a host we do not read, and for the one
   * that publishes no image, so every consumer must treat it as optional.
   */
  image?: string | null;
  // Airtable (lib/sideEvents.ts) — Brella's API sends the WORDS "LINK TO REGISTER" in the
  // description with no URL behind them, so a Brella-sourced side event can never have this.
  registerUrl?: string | null;
  // Which part of the program this belongs to, when the session knows rather than leaving it
  // to be guessed from the track name. Set on the Airtable-sourced Side Events, whose `room`
  // is the hosting partner and would otherwise read as a stage. Absent on Brella sessions,
  // which are classified by name (lib/brellaSections.ts).
  section?: BrellaSection;
  // Whether anyone can turn up. Side Events only, from Airtable's `Event type`.
  //
  // The source offers exactly two options, "Public Event" and "Private Event (invite only)", so
  // it cannot distinguish an invitation from an approval queue. In practice the private ones do
  // both: the Luma pages behind them show "Request to Join · Approval Required" (verified
  // 2026-08-04), while the label says invite only. The UI copy therefore says invitation OR
  // approval rather than picking one the data cannot support.
  access?: "public" | "private-invite";
  // What to show where the time goes when there is no time: "25 August". Side Events only,
  // because they are the only sessions that can legitimately lack one — partners submit the
  // date and the `Time slot` cell is often left empty. A card showing the date beats a card
  // showing "Time TBC", which tells a visitor nothing they can act on.
  dateLabel?: string;
  // WHO IS ON STAGE for a hand-typed programme (the Policy Stage). Separate from `speakers` above,
  // which is Brella's structured speaker-assignment data — these come from a text cell and a photo
  // cell, so they carry a display line and a face and nothing else.
  onStage?: { speakers: ProgramPerson[]; moderators: ProgramPerson[] };
};

// Two kinds of source now. Airtable ones name a table + the fields to read; the Brella one
// needs no config here because its org/event ids are pinned in lib/brellaprogram.ts.
type AirtableSource = {
  kind: "airtable";
  table: string;
  view?: string;
  /**
   * An Airtable filterByFormula, applied server-side on top of `view`.
   *
   * Needed because a VIEW IS NOT A CONTRACT. The Sessions table now holds three programmes — the
   * Policy Stage, the Board Summit and Defence & Dual Use — and the view pinned below stopped
   * filtering at some point, so /api/program?event=policy was serving all 36 rows of the table
   * with the three agendas interleaved by start time (caught 2026-08-10). The formula pins the
   * programme to a CELL VALUE, which nobody can widen by editing a view in the Airtable UI.
   */
  filter?: string;
  /**
   * Fill missing faces from the speaker CRM, by name, out of this `Project Name`.
   *
   * For a programme typed in from a document: the photo cells on the session rows have to be filled
   * per session in the same order as the names, while the CRM holds one headshot per person. Setting
   * this joins the two, so a photo uploaded once in Marketing Project Overview reaches the agenda.
   * See lib/programFaces.ts — including why it is opt-in rather than on for every source.
   *
   * A LIST is an ordered fallback: the programme's own project first, then projects a speaker might
   * be filed under instead. Earlier entries win, so a fallback can only fill a gap.
   */
  facesFrom?: string | readonly string[];
  /**
   * Fill missing faces from a CURATED VIEW instead of the CRM — for a co-hosted summit whose people
   * signed up through its own form and are therefore not in Marketing Project Overview. Tried after
   * `facesFrom`, so a CRM headshot still wins where both tables know the person.
   * See lib/programFaces.ts, FaceViewSource.
   */
  facesFromView?: FaceViewSource;
  fields: {
    name: string;
    day?: string;
    timeSlot: string;
    type: string;
    description?: string;
    room?: string;
    gate?: string; // single-select whose value "NO" hides the row
    // WHO IS ON STAGE, as two free-text lines plus their photo cells. Only the Policy Stage has
    // these: its programme came from a PDF, so the people are typed into the row rather than
    // linked, and one cell holds every face on a panel.
    speakerDetails?: string;
    speakerPhoto?: string;
    moderatorDetails?: string;
    moderatorPhoto?: string;
  };
};

type BrellaSource = { kind: "brella" };

type SourceConfig = AirtableSource | BrellaSource;

// Pinned Airtable ids (stable, not secrets — see lib/niss.ts for why not env vars).
export const PROGRAM_SOURCES = {
  // The live TechBBQ 2026 schedule. Brella, not Airtable — see lib/brellaprogram.ts.
  brella: { kind: "brella" },
  techbbq: {
    kind: "airtable",
    table: "tblI4IW0b3sLxNWgz", // Program 2026
    fields: {
      name: "Session Name",
      day: "Day",
      timeSlot: "Time Slot",
      type: "Session Type",
      description: "Description",
      room: "Event Room",
    },
  },
  niss: {
    kind: "airtable",
    table: "tblfIPjV4t1c1628h", // NISS 2026
    view: "viwMqDT1GMW7AwOtQ", // program rows
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Type of Session",
      gate: "Should be On Website",
    },
  },
  // THE POLICY STAGE, from the purpose-built Sessions table. Its programme arrived as a PDF, so it is
  // typed in by hand rather than linked to speaker records: `Speaker Details` is one line of
  // "Name, Title, Company" entries joined with " · ", and `Speaker Photo` holds the matching faces in
  // the same order. parsePeople() below pairs them.
  policy: {
    kind: "airtable",
    table: "tblSlpTzDi2oVYwqv", // Sessions
    view: "viwrTVxvTBucbJW7S", // The Policy Stage
    filter: '{Name of the Event}="The Policy Stage"',
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Session Type",
      description: "Description",
      speakerDetails: "Speaker Details",
      speakerPhoto: "Speaker Photo",
      moderatorDetails: "Moderator Details",
      moderatorPhoto: "Moderator Photo",
    },
  },
  // THE BOARD SUMMIT (hosted by Boardway), 14 sessions on Day 2. Same Sessions table and the same
  // hand-typed people fields as the Policy Stage above — it arrived the same way, as a document
  // rather than as linked speaker records — so it needs no new parsing, only its own filter.
  board: {
    kind: "airtable",
    table: "tblSlpTzDi2oVYwqv", // Sessions
    filter: '{Name of the Event}="Board Summit"',
    // The 27 people were written into Marketing Project Overview under this project on 2026-08-10,
    // because Brella carries the Board Summit as a single all-day row with no speakers on it and
    // had no faces to give. Event Room 1 is where Brella places the Board Summit; the six older
    // rows under the same project belong to "Beyond Unicorns" and simply never match a name here.
    facesFrom: "Event Room 1",
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Session Type",
      description: "Description",
      speakerDetails: "Speaker Details",
      speakerPhoto: "Speaker Photo",
      moderatorDetails: "Moderator Details",
      moderatorPhoto: "Moderator Photo",
    },
  },
  // THE FOUR DAY 0 PROGRAMMES — 25 August, the day before TechBBQ opens. Same Sessions table and the
  // same hand-typed people fields as the Policy Stage and the Board Summit above; they arrived the
  // same way, as designed pages rather than linked speaker records, so they need no new parsing.
  //
  // NO `view` on any of them, deliberately. The Sessions table's two views (Event Rooms, Side Events)
  // are edited in the Airtable UI and have already widened once — see the note on AirtableSource.filter
  // for what that did to ?event=policy. The filter pins each programme to its `Name of the Event` cell,
  // which no view edit can widen.
  //
  // `facesFrom` names the matching `Project Name` in Marketing Project Overview, where these speakers
  // already have one headshot each from the /investors pages. The session rows carry no photo cells at
  // all, so every face on these four comes from that join (lib/programFaces.ts). The CRM's option is
  // "Nordic Family Office" — shorter than the event's own name, and it is the option string that has
  // to match, not the title.
  "pension-summit": {
    kind: "airtable",
    table: "tblSlpTzDi2oVYwqv", // Sessions
    filter: '{Name of the Event}="European Growth Pension & Insurance Summit"',
    facesFrom: ["European Growth Pension & Insurance Summit", "TechBBQ Summit"],
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Session Type",
      description: "Description",
      speakerDetails: "Speaker Details",
      speakerPhoto: "Speaker Photo",
      moderatorDetails: "Moderator Details",
      moderatorPhoto: "Moderator Photo",
    },
  },
  "family-office": {
    kind: "airtable",
    table: "tblSlpTzDi2oVYwqv", // Sessions
    filter: '{Name of the Event}="Nordic Family Office Summit"',
    // The CRM option is "Nordic Family Office Summit", spelled out in full — the shorter
    // "Nordic Family Office" this used to name matches nothing, so the join silently found no
    // faces. Eight rows are filed under it now (checked 2026-08-13). The Event Room fallbacks
    // stay for the two who are still filed there (Zenia W. Francker, Adrian Larsen).
    facesFrom: ["Nordic Family Office Summit", "Event Room 2", "Event Room 1"],
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Session Type",
      description: "Description",
      speakerDetails: "Speaker Details",
      speakerPhoto: "Speaker Photo",
      moderatorDetails: "Moderator Details",
      moderatorPhoto: "Moderator Photo",
    },
  },
  "lp-forum": {
    kind: "airtable",
    table: "tblSlpTzDi2oVYwqv", // Sessions
    filter: '{Name of the Event}="LP Forum"',
    // Erik Balck Sørensen moderates here but is filed under the main programme, not the LP Forum.
    facesFrom: ["LP Forum", "TechBBQ Summit", "Event Room 1"],
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Session Type",
      description: "Description",
      speakerDetails: "Speaker Details",
      speakerPhoto: "Speaker Photo",
      moderatorDetails: "Moderator Details",
      moderatorPhoto: "Moderator Photo",
    },
  },
  "investor-day": {
    kind: "airtable",
    table: "tblSlpTzDi2oVYwqv", // Sessions
    filter: '{Name of the Event}="TechBBQ Investor Day"',
    // Only three people are filed under Investor Day. Yoram Wijngaarde keynotes here as well as at
    // the LP Forum and the Pension Summit, and is filed under those.
    facesFrom: ["TechBBQ Investor Day", "LP Forum", "European Growth Pension & Insurance Summit"],
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Session Type",
      description: "Description",
      speakerDetails: "Speaker Details",
      speakerPhoto: "Speaker Photo",
      moderatorDetails: "Moderator Details",
      moderatorPhoto: "Moderator Photo",
    },
  },
  // NASS 2026 — the Nordic Africa Startup Summit, Day 2 in Event Room 2. Same Sessions table and the
  // same hand-typed people fields as the Policy Stage above: its agenda arrived as a run-of-show
  // spreadsheet and was typed in on 2026-08-12, so the session rows carry "Speaker Details" text and
  // no photo cells at all.
  //
  // EVERY FACE COMES FROM THE JOIN, and it needs BOTH sources. The 52 people on this agenda are split
  // across two tables: 21 are filed in the CRM under "Event Room 2" (which is how the speaker pages
  // already find them), and the full roster of 45 lives behind the Nordic-Africa Summit Presenters
  // view that /nass publishes. Neither covers the agenda on its own. The CRM is listed first because
  // its headshot is the one the rest of techbbq.dk already shows for that person.
  nass: {
    kind: "airtable",
    table: "tblSlpTzDi2oVYwqv", // Sessions
    filter: '{Name of the Event}="Nordic Africa Startup Summit"',
    facesFrom: "Event Room 2",
    facesFromView: {
      table: "tbl3dTaHrIFrHF6Mo", // Ticketing Forms
      view: "viw9pkLpUOThgHfGB", // Nordic-Africa Summit Presenters — the same publish gate as /nass
      nameField: "Presenter's full name",
      photoField: "Headshots",
      feed: "nass", // lib/photo.ts PHOTO_SOURCES.nass, already pointed at this table's Headshots
    },
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Session Type",
      description: "Description",
      speakerDetails: "Speaker Details",
      speakerPhoto: "Speaker Photo",
      moderatorDetails: "Moderator Details",
      moderatorPhoto: "Moderator Photo",
    },
  },
  fintech: {
    kind: "airtable",
    table: "tbleh7Lqv1zMQaUKx", // Future of Fintech
    view: "viw0mk6kOUKxNqgzU", // program rows (no website gate on this one)
    fields: {
      name: "Session Name",
      timeSlot: "Time Slot",
      type: "Type of Session",
    },
  },
} satisfies Record<string, SourceConfig>;

export type ProgramSourceKey = keyof typeof PROGRAM_SOURCES;

type AirtableRecord = { id: string; fields: Record<string, unknown> };

// "09:30 - 11:00" / "09:00–09:30" → minutes since midnight; unparseable → end of day.
function startMinutes(slot: string): number {
  const m = slot.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return 24 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** One name on a hand-typed programme: the display line, and a face when the row has one. */
export type ProgramPerson = { name: string; meta: string; photo: string | null };

/**
 * Split a "Speaker Details" line into people and pair each with the photo at the same index.
 *
 * The cell reads "Karen Ellemann, Secretary General, Nordic Council of Ministers · Stina Lantz, CEO,
 * SISP" — people separated by " · ", and commas INSIDE a person separating name from title. So the
 * split is on the bullet only, and the first comma divides name from the rest.
 *
 * PAIRING IS BY INDEX, which is safe only while the photo cell holds one face per person in the same
 * order. When the counts disagree the photos are dropped rather than guessed: a panel showing the
 * wrong face next to the wrong minister is worse than a panel showing no faces.
 */
function parsePeople(details: string, photos: unknown, feed: string, recordId: string): ProgramPerson[] {
  const entries = details
    .split("·")
    .map((x) => x.trim())
    // A PLACEHOLDER IS NOT A PERSON. Several Board Summit rows carry "TBC" in the moderator cell
    // while the booking is open, and without this the embed draws a circle with a "T" in it and
    // announces TBC as the moderator. Dropping the entry leaves the group empty, which the
    // renderers already handle by omitting the heading.
    .filter((x) => x && !/^(tbc|tba|tbd|to be (confirmed|announced))\.?$/i.test(x));
  if (!entries.length) return [];

  const atts = Array.isArray(photos)
    ? (photos as { id?: string }[]).filter((a) => a?.id)
    : [];
  const aligned = atts.length === entries.length;

  return entries.map((entry, i) => {
    const comma = entry.indexOf(",");
    const name = comma === -1 ? entry : entry.slice(0, comma).trim();
    const meta = comma === -1 ? "" : entry.slice(comma + 1).trim();
    // ?v=<attachment id> picks this person's face out of a shared cell — see lib/photo.ts.
    const photo = aligned && atts[i]?.id ? photoUrl(feed, recordId, undefined, atts[i].id) : null;
    return { name, meta, photo };
  });
}

export class ProgramError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchProgram(source: ProgramSourceKey = "techbbq"): Promise<ProgramSession[]> {
  const cfg: SourceConfig = PROGRAM_SOURCES[source];

  // Brella keeps its own client, ids and error type; it also returns sessions already in
  // chronological order, so it skips the Airtable path and its label-parsing sort entirely.
  if (cfg.kind === "brella") {
    const { fetchBrellaProgram, BrellaError } = await import("@/lib/brellaprogram");
    try {
      return await fetchBrellaProgram();
    } catch (err) {
      if (err instanceof BrellaError) throw new ProgramError(err.message, err.status);
      throw err;
    }
  }

  if (!TOKEN || !BASE_ID) {
    throw new ProgramError("Airtable env vars are not set on the server.", 503);
  }

  const f = cfg.fields;
  // Every field the source declares, and nothing else — this list IS the allow-list sent to Airtable
  // as fields[], so a column missing here comes back undefined however carefully it is parsed later.
  // The four people fields were added to the config and forgotten here, and the result was a feed
  // that looked complete with no speakers in it (2026-08-05).
  const wanted = [
    f.name,
    f.day,
    f.timeSlot,
    f.type,
    f.description,
    f.room,
    f.gate,
    f.speakerDetails,
    f.speakerPhoto,
    f.moderatorDetails,
    f.moderatorPhoto,
  ].filter((x): x is string => Boolean(x));

  const sessions: ProgramSession[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (cfg.view) params.set("view", cfg.view);
    if (cfg.filter) params.set("filterByFormula", cfg.filter);
    params.set("pageSize", "100");
    for (const field of wanted) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${cfg.table}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[program:${source}] fetch failed`, res.status, detail);
      throw new ProgramError("Could not reach the program source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const r = rec.fields;
      // Opt-out gate: only an explicit "NO" hides a row (blank/YES both show).
      if (f.gate && str(r[f.gate]) === "NO") continue;
      const s: ProgramSession = {
        id: rec.id,
        name: str(r[f.name]),
        day: f.day ? str(r[f.day]) : "",
        timeSlot: str(r[f.timeSlot]),
        type: str(r[f.type]),
        description: f.description ? str(r[f.description]) : "",
        room: f.room ? str(r[f.room]) : "",
      };
      // Hand-typed programmes carry their people in two text cells. Only built when the source
      // declares those fields, so every other Airtable programme is unchanged.
      if (f.speakerDetails || f.moderatorDetails) {
        const speakers = f.speakerDetails
          ? parsePeople(str(r[f.speakerDetails]), f.speakerPhoto ? r[f.speakerPhoto] : null, PHOTO_FEED, rec.id)
          : [];
        const moderators = f.moderatorDetails
          ? parsePeople(str(r[f.moderatorDetails]), f.moderatorPhoto ? r[f.moderatorPhoto] : null, PHOTO_FEED, rec.id)
          : [];
        if (speakers.length || moderators.length) s.onStage = { speakers, moderators };
      }
      const dayOk = f.day ? Boolean(s.day) : true;
      if (s.name && s.timeSlot && dayOk) sessions.push(s);
    }
    offset = data.offset;
  } while (offset);

  // Day asc ("Day 1…" before "Day 2…" alphabetically), then start time, then name.
  sessions.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      startMinutes(a.timeSlot) - startMinutes(b.timeSlot) ||
      a.name.localeCompare(b.name)
  );

  // Faces from the CRM for anyone the session rows left without one. Done HERE rather than in the
  // route so it lands inside the same `cached("program:<source>")` entry: one extra Airtable read
  // per cache fill, not one per request. A failure is logged and swallowed — an agenda with
  // initials in it is a working agenda, and this must never be what takes the programme down.
  if (cfg.facesFrom || cfg.facesFromView) {
    try {
      const { fetchProjectFaces, fetchViewFaces, applyFaces } = await import("@/lib/programFaces");
      const faces = new Map<string, string>();
      // CRM first, curated view second, and `set` only where the key is new — same "first source
      // wins" rule the facesFrom list itself follows, so adding the view can only fill a gap.
      if (cfg.facesFrom) {
        for (const [k, url] of await fetchProjectFaces(cfg.facesFrom)) faces.set(k, url);
      }
      if (cfg.facesFromView) {
        for (const [k, url] of await fetchViewFaces(cfg.facesFromView)) {
          if (!faces.has(k)) faces.set(k, url);
        }
      }
      return applyFaces(sessions, faces);
    } catch (err) {
      console.error(`[program:${source}] faces unavailable, keeping initials`, err);
    }
  }

  return sessions;
}
