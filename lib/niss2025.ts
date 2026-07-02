// Server-only access to last year's "NISS 2025" registrants table. Same safety rules
// as lib/niss.ts: the token never leaves the server, only an allow-list of safe fields
// is requested, and only records with Status = "On website" are returned. This table
// mixes internal notes; email/phone/etc. are deliberately NOT exposed.

import { fetchWithTimeout } from "@/lib/http";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

// Pinned in code (not env) on purpose — see lib/niss.ts for why stale env vars are risky.
const TABLE = "tblyWVASxceyLRCaL"; // NISS 2025 roster
// This table has no single all-role public view, so the publish gate is a Status field.
const GATE_FIELD = "Status";
const GATE_VALUE = "On website";

const SAFE_FIELDS = ["Name", "Job title", "Company Name", "LinkedIn", "Photo", "Role"];

// Curated moderator list: only these four moderators are shown, regardless of how many
// have Status = "On website". Matched by case-insensitive substring on the name (the
// Airtable names are longer, e.g. "Zenia Worm Francke"). Speakers and Team are unaffected.
// NOTE: hardcoded curation — the cleaner long-term home for this is a Status/flag in Airtable.
const MODERATOR_ALLOW = ["zenia", "christina brinch", "julia abrams", "nicolaj geller"];

function isAllowedModerator(role: string, name: string): boolean {
  if (role.toLowerCase() !== "moderator") return true; // only moderators are curated
  const n = name.toLowerCase();
  return MODERATOR_ALLOW.some((allowed) => n.includes(allowed));
}

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
  const link = str(f["LinkedIn"]);
  return {
    id: rec.id,
    name: str(f["Name"]),
    title: str(f["Job title"]),
    company: str(f["Company Name"]),
    bio: "", // no bio/description field in this table
    photo: firstPhoto(f["Photo"]),
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

function esc(v: string): string {
  return v.replace(/'/g, "\\'");
}

export async function fetchNiss2025(roleFilter?: string): Promise<NissPerson[]> {
  if (!TOKEN || !BASE_ID) {
    throw new NissError("Airtable env vars are not set on the server.", 503);
  }

  const people: NissPerson[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    // Gate on Status; optionally also filter by Role.
    const gate = `{${GATE_FIELD}}='${esc(GATE_VALUE)}'`;
    const formula = roleFilter ? `AND(${gate},{Role}='${esc(roleFilter)}')` : gate;
    params.set("filterByFormula", formula);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(`${API}/${BASE_ID}/${TABLE}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[niss2025] fetch failed", res.status, detail);
      throw new NissError("Could not reach the NISS 2025 source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const p = mapRecord(rec);
      if (!p.name) continue; // skip blank rows
      if (!isAllowedModerator(p.role, p.name)) continue; // curated moderator list
      people.push(p);
    }
    offset = data.offset;
  } while (offset);

  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}
