// Server-only: the TechBBQ 2026 program as it exists in BRELLA (the attendee app), not
// Airtable. Brella's timeslots are where the real schedule is maintained, so this is the
// source that is actually complete: 30 published sessions with times, stage, topic tags
// and descriptions, versus the near-empty "Program 2026" Airtable table.
//
// Read-only. The same key can create and delete sessions in the live attendee app, so
// nothing here uses anything but GET.
//
// Mapped onto the shared ProgramSession shape from lib/program.ts, so the existing
// /program page and the agenda embed render it with no changes.

import { fetchWithTimeout } from "@/lib/http";
import type { ProgramSession, ProgramSpeaker } from "@/lib/program";
import { str } from "@/lib/fields";

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

// Anything this long is an all-day thing (side-event promos run 720 minutes), and printing
// "00:00 - 12:00" for it reads like a bug.
const ALL_DAY_MINUTES = 360;

// Tags carry topics ("AI", "HealthTech") but marketing also parks room/hall labels in
// there. The stage already comes from the track, so those are skipped when picking the
// topic shown on a card.
const ROOMISH_TAG = /^(hall\b|event room\b|rooms?\b|stage\b)/i;

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

  // One call returns the schedule plus its tracks and tags via `included`.
  const params = new URLSearchParams();
  params.set("page[size]", "500");

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
    console.error("[brella-program] fetch failed", res.status);
    throw new BrellaError("Could not reach the Brella program.", 502);
  }

  const body = (await res.json()) as { data?: RawTimeslot[]; included?: Resource[] };
  const rows = Array.isArray(body.data) ? body.data : [];

  // included is a flat list of every related record; index it by type + id.
  const byId = new Map<string, Resource>();
  for (const inc of body.included ?? []) byId.set(`${inc.type}:${inc.id}`, inc);

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
        title: str(a["job-title"]),
        company: str(a["company-name"]),
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

    const dateKey = localDateKey(startIso);
    if (!dateKey) continue;

    const duration = typeof a.duration === "number" ? a.duration : 0;
    const endIso = str(a["end-time"]);
    const timeSlot =
      duration >= ALL_DAY_MINUTES
        ? "All day"
        : [localTime(startIso), endIso ? localTime(endIso) : ""].filter(Boolean).join(" - ");

    // Topic for the card's tag. Room/hall labels live in tags too, so they are skipped —
    // the stage is already the `room` field.
    const topic =
      many(row.relationships?.tags)
        .map((t) => nameOf("tag", t.id))
        .find((n) => n && !ROOMISH_TAG.test(n)) || "";

    // Brella's subtitle is a one-liner ("Side Event Promotion by Rockstart"); the body copy
    // is the Draft.js content. Both are useful, so subtitle leads the description.
    const description = [str(a.subtitle), draftToText(a.content)].filter(Boolean).join("\n");

    prepared.push({
      dateKey,
      startIso,
      session: {
        id: `brella-${row.id}`,
        day: "", // filled below, once the distinct dates are known
        name: title,
        timeSlot,
        type: topic,
        description,
        room: track,
        location: label(a.location),
        speakers: speakersFor(row),
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
  }

  // Chronological. lib/program.ts re-sorts by (day, parsed start time, name), but that
  // parses "10:00" out of the label; sorting on the real instants here means an unparsed
  // label ("All day") can never scramble the order.
  prepared.sort((x, y) => x.dateKey.localeCompare(y.dateKey) || x.startIso.localeCompare(y.startIso));

  return prepared.map((p) => p.session);
}
