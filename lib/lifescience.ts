// Server-only access to the "Life Science Project" table — the Life Science & Deep Tech
// speaker roster for 2026. Same safety rules as lib/niss.ts: the token never leaves the
// server, only an allow-list of safe fields is requested, and only records inside the
// curated public VIEW are returned. This table mixes a lot of sensitive data (email,
// phone, GDPR flags, survey answers); none of it is exposed here.

import { fetchWithTimeout } from "@/lib/http";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Table + view are pinned in code on purpose, NOT read from env (see lib/niss.ts for why
// a stale env var silently breaks prod). These ids aren't secret.
const TABLE = "tblvukXfmR7KTFymG"; // Life Science Project
// The curated "Speakers Library 2026" grid is the publish gate — membership in this view
// is what makes a person show up on the site.
const VIEW = "viw8tGwoWltVeBwpl";

const SAFE_FIELDS = [
  "Stakeholder", // person's name (primary field)
  "Title",
  "Company",
  "Speaker bio",
  "Description",
  "Headshot",
  "Linkedin",
  "LS Type", // Human Health / Planetary Health / Intersection / Deep Tech
];

export type LsPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
  role: string; // LS Type, used as the card badge
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

// LS Type is a multi-select, so it arrives as an array. Show the first tag as the badge.
function firstTag(v: unknown): string {
  if (Array.isArray(v)) return str(v[0]);
  return str(v);
}

function mapRecord(rec: AirtableRecord): LsPerson {
  const f = rec.fields;
  const link = str(f["Linkedin"]);
  return {
    id: rec.id,
    name: str(f["Stakeholder"]),
    title: str(f["Title"]),
    company: str(f["Company"]),
    bio: str(f["Speaker bio"]) || str(f["Description"]),
    photo: firstPhoto(f["Headshot"]),
    // Field is a URL type, but guard anyway so a stray non-URL never renders as a link.
    linkedin: link.startsWith("http") ? link : null,
    role: firstTag(f["LS Type"]),
  };
}

export class LsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchLifeScience(): Promise<LsPerson[]> {
  if (!TOKEN || !BASE_ID) {
    throw new LsError("Airtable env vars are not set on the server.", 503);
  }

  const people: LsPerson[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("view", VIEW);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[lifescience] fetch failed", res.status, detail);
      throw new LsError("Could not reach the Life Science source.", 502);
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
