// Server-only access to the "Nordic India Startup Summit (Registrants)" table — the
// NISS 2026 roster. Same safety rules as lib/airtable.ts: the token never leaves the
// server, only an allow-list of safe fields is requested, and only records inside the
// curated public VIEW are returned. Email, phone, dietary and pitch-deck fields are
// deliberately NOT exposed.

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Table + view are pinned in code on purpose, NOT read from env. A stale
// AIRTABLE_NISS_TABLE left over from the 2025 setup silently overrode the default
// and broke prod (2025 table + 2026 view = 502). These ids aren't secret.
const TABLE = "tblfIPjV4t1c1628h"; // Nordic India Startup Summit (Registrants), 2026
// The curated grid is a specific view; membership in it is the publish gate.
const VIEW = "viwRMZMX5NeN68XX7";

// Note the trailing space in "Position at Company " — it's part of the real field name.
const SAFE_FIELDS = [
  "Full Name",
  "Company Name",
  "Position at Company ",
  "Role",
  "Linkedin/Social Profile link",
  "Self Portrait",
];

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
  const link = str(f["Linkedin/Social Profile link"]);
  return {
    id: rec.id,
    name: str(f["Full Name"]),
    title: str(f["Position at Company "]),
    company: str(f["Company Name"]),
    bio: "", // 2026 table has no bio/description field
    photo: firstPhoto(f["Self Portrait"]),
    // Field is free text, so only treat it as a link if it's an actual URL.
    linkedin: link.startsWith("http") ? link : null,
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
    // Gate on the curated view; optionally also filter by Role.
    params.set("view", VIEW);
    if (roleFilter) {
      const esc = roleFilter.replace(/'/g, "\\'");
      params.set("filterByFormula", `{Role}='${esc}'`);
    }
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
      if (p.name) people.push(p); // skip blank rows
    }
    offset = data.offset;
  } while (offset);

  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}
