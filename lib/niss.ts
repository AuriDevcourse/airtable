// Server-only access to the "NISS 2025" table (Nordic India Startup Summit).
// Same safety rules as lib/airtable.ts: token never leaves the server, only an
// allow-list of safe fields is requested, and only records gated for the website
// are returned. Email and internal Note are deliberately NOT exposed.

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = process.env.AIRTABLE_NISS_TABLE || "NISS 2025";
// NISS uses a single-select "Status"; the public value is "On website".
const GATE_FIELD = process.env.AIRTABLE_NISS_GATE_FIELD || "Status";
const GATE_VALUE = process.env.AIRTABLE_NISS_GATE_VALUE || "On website";

const SAFE_FIELDS = ["Name", "Job title", "Company Name", "copy", "LinkedIn", "Photo", "Role"];

export type NissPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
  role: string;
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

function mapRecord(rec: AirtableRecord): NissPerson {
  const f = rec.fields;
  return {
    id: rec.id,
    name: str(f["Name"]),
    title: str(f["Job title"]),
    company: str(f["Company Name"]),
    bio: str(f["copy"]),
    photo: firstPhoto(f["Photo"]),
    linkedin: str(f["LinkedIn"]) || null,
    role: str(f["Role"]),
  };
}

export class NissError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchNiss(roleFilter?: string): Promise<NissPerson[]> {
  if (!TOKEN || !BASE_ID) {
    throw new NissError("Airtable env vars are not set on the server.", 503);
  }

  const people: NissPerson[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    // Gate on website status; optionally also on Role (e.g. only Speakers).
    const escVal = (v: string) => v.replace(/'/g, "\\'");
    let formula = `{${GATE_FIELD}}='${escVal(GATE_VALUE)}'`;
    if (roleFilter) formula = `AND(${formula},{Role}='${escVal(roleFilter)}')`;
    params.set("filterByFormula", formula);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetch(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[niss] fetch failed", res.status, detail);
      throw new NissError("Could not reach the NISS source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const p = mapRecord(rec);
      if (p.name) people.push(p);
    }
    offset = data.offset;
  } while (offset);

  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}
