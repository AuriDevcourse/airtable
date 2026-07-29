// Server-only access to the NASS 2026 roster — the "Nordic-Africa Summit Presenters"
// view on the Ticketing Forms table. Same safety rules as lib/niss.ts: the token never
// leaves the server, only an allow-list of safe fields is requested, and only records
// inside the curated public VIEW are returned. Emails, form answers and every other
// Ticketing Forms field are deliberately NOT exposed.

import { fetchWithTimeout } from "@/lib/http";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Table + view are pinned in code on purpose, NOT read from env (see lib/niss.ts for
// the incident that motivated this). These ids aren't secret.
const TABLE = "tbl3dTaHrIFrHF6Mo"; // Ticketing Forms
// The curated grid is a specific view; membership in it is the publish gate.
const VIEW = "viw9pkLpUOThgHfGB"; // Nordic-Africa Summit Presenters

const SAFE_FIELDS = [
  "Presenter's full name",
  "Presenter's job title",
  "Company Name Investor Dinner",
  "Presenter's bio",
  "Headshots",
  "LinkedIn profile",
  "Speaker or Moderator",
];

export type NassPerson = {
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

function mapRecord(rec: AirtableRecord): NassPerson {
  const f = rec.fields;
  return {
    id: rec.id,
    name: str(f["Presenter's full name"]),
    title: str(f["Presenter's job title"]),
    // The table is a shared multi-form dump; company lives in this oddly named column.
    company: str(f["Company Name Investor Dinner"]),
    bio: str(f["Presenter's bio"]),
    // Free-text field — normalized (www./scheme-less/mobile variants) or dropped.
    linkedin: normalizeLinkedInUrl(f["LinkedIn profile"]),
    role: str(f["Speaker or Moderator"]),
    photo: firstPhoto(f["Headshots"]),
  };
}

export class NassError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchNass(roleFilter?: string): Promise<NassPerson[]> {
  if (!TOKEN || !BASE_ID) {
    throw new NassError("Airtable env vars are not set on the server.", 503);
  }

  const people: NassPerson[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    // Gate on the curated view; optionally also filter by role.
    params.set("view", VIEW);
    if (roleFilter) {
      const esc = roleFilter.replace(/'/g, "\\'");
      params.set("filterByFormula", `{Speaker or Moderator}='${esc}'`);
    }
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[nass] fetch failed", res.status, detail);
      throw new NassError("Could not reach the NASS source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const p = mapRecord(rec);
      // No portrait, no card — same publish rule as NISS: uploading a Headshot is what
      // makes a person appear, so nobody ever renders as a grey placeholder.
      if (p.name && p.photo) people.push(p);
    }
    offset = data.offset;
  } while (offset);

  // This table has no Hierarchy column, so the order is simply alphabetical.
  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}
