// Server-only access to the "Program 2026" table — the public event agenda.
// Purpose-built table (created 2026-07-29): one row per session, filled by the team
// directly in Airtable. Every field here is meant for the website, but the same
// allow-list pattern as the other feeds still applies so future internal columns
// (notes, owner, budget…) can never leak.
//
// Publish rule: a row needs a Session Name, a Day and a Time Slot to appear —
// half-filled drafts stay invisible until those three are set.

import { fetchWithTimeout } from "@/lib/http";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned in code on purpose (stable Airtable id, not a secret — see lib/niss.ts).
const TABLE = "tblI4IW0b3sLxNWgz"; // Program 2026

const SAFE_FIELDS = [
  "Session Name",
  "Day",
  "Time Slot",
  "Session Type",
  "Description",
  "Event Room",
];

export type ProgramSession = {
  id: string;
  name: string;
  day: string;
  timeSlot: string;
  type: string;
  description: string;
  room: string;
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// "09:30 - 11:00" → 570 (minutes since midnight) for sorting; unparseable → end of day.
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

export async function fetchProgram(): Promise<ProgramSession[]> {
  if (!TOKEN || !BASE_ID) {
    throw new ProgramError("Airtable env vars are not set on the server.", 503);
  }

  const sessions: ProgramSession[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[program] fetch failed", res.status, detail);
      throw new ProgramError("Could not reach the program source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const f = rec.fields;
      const s: ProgramSession = {
        id: rec.id,
        name: str(f["Session Name"]),
        day: str(f["Day"]),
        timeSlot: str(f["Time Slot"]),
        type: str(f["Session Type"]),
        description: str(f["Description"]),
        room: str(f["Event Room"]),
      };
      if (s.name && s.day && s.timeSlot) sessions.push(s);
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
