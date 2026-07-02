// Server-only Airtable access. The token NEVER leaves this server.
// This module deliberately exposes only an allow-listed, marketing-safe slice
// of the Speakers table. The raw table also holds passport numbers, dates of
// birth, phone numbers and emails — none of those fields are read here.

import { fetchWithTimeout } from "@/lib/http";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = process.env.AIRTABLE_SPEAKERS_TABLE || "Speakers";
// Only records where this checkbox is ticked are ever returned.
const GATE_FIELD = process.env.AIRTABLE_GATE_FIELD || "On Website?";

// SAFE allow-list. Airtable is asked to return ONLY these fields, so even a
// future code mistake cannot leak a non-listed (sensitive) field.
const SAFE_FIELDS = [
  "Full Name",
  "Job Title",
  "Company",
  "Text for website",
  "Speaker Bio",
  "Bio",
  "Personal Quote for Marketing Purposes",
  "Picture",
  "Headshots For marketing?",
  "Linkedin (Personal)",
  "Company website",
  "Company LinkedIn",
];

export type Speaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  quote: string;
  photo: string | null;
  linkedin: string | null;
  website: string | null;
};

type AirtableAttachment = { url: string; thumbnails?: { large?: { url: string } } };
type AirtableRecord = { id: string; fields: Record<string, unknown> };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function firstPhoto(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const att = v[0] as AirtableAttachment;
  return att?.thumbnails?.large?.url || att?.url || null;
}

function mapRecord(rec: AirtableRecord): Speaker {
  const f = rec.fields;
  return {
    id: rec.id,
    name: str(f["Full Name"]),
    title: str(f["Job Title"]),
    company: str(f["Company"]),
    bio: str(f["Text for website"]) || str(f["Speaker Bio"]) || str(f["Bio"]),
    quote: str(f["Personal Quote for Marketing Purposes"]),
    photo: firstPhoto(f["Picture"]) || firstPhoto(f["Headshots For marketing?"]),
    linkedin: str(f["Linkedin (Personal)"]) || null,
    website: str(f["Company website"]) || str(f["Company LinkedIn"]) || null,
  };
}

export class AirtableError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchSpeakers(): Promise<Speaker[]> {
  if (!TOKEN || !BASE_ID) {
    throw new AirtableError("Airtable env vars are not set on the server.", 503);
  }

  const speakers: Speaker[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `{${GATE_FIELD}}=TRUE()`);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      // Surface a safe status to the caller; full detail stays in server logs.
      const detail = await res.text();
      console.error("[airtable] fetch failed", res.status, detail);
      const status = res.status === 401 || res.status === 403 ? 502 : 502;
      throw new AirtableError("Could not reach the speaker source.", status);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const s = mapRecord(rec);
      if (s.name) speakers.push(s); // skip blank rows
    }
    offset = data.offset;
  } while (offset);

  speakers.sort((a, b) => a.name.localeCompare(b.name));
  return speakers;
}
