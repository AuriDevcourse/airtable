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

const API = "https://api.airtable.com/v0";

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
  location?: string; // Brella's own venue string, e.g. "Bella Center Copenhagen"
  speakers?: ProgramSpeaker[];
};

// Two kinds of source now. Airtable ones name a table + the fields to read; the Brella one
// needs no config here because its org/event ids are pinned in lib/brellaprogram.ts.
type AirtableSource = {
  kind: "airtable";
  table: string;
  view?: string;
  fields: {
    name: string;
    day?: string;
    timeSlot: string;
    type: string;
    description?: string;
    room?: string;
    gate?: string; // single-select whose value "NO" hides the row
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
  const wanted = [f.name, f.day, f.timeSlot, f.type, f.description, f.room, f.gate].filter(
    (x): x is string => Boolean(x)
  );

  const sessions: ProgramSession[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (cfg.view) params.set("view", cfg.view);
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
  return sessions;
}
