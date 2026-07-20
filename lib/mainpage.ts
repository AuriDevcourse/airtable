// Server-only: the 12 "front page" speakers for techbbq.dk's main page.
//
// Marketing picks them by ticking a "Main Page" = YES cell in the Airtable
// "Marketing Project Overview" table (tblTecOBecLQCNIeD, view viwfIcQFDNQ9ggSqx).
// Everything shown comes straight from that table — name, job title, company and the
// Profile Picture attachment — so this feed needs no Supabase join. NO bio is read or
// returned: the main-page grid is photos + name + title·company only, by design.
//
// Only the allow-listed marketing fields below are ever requested. That table is wide
// and holds unrelated internal project data; none of it is read here.

import { fetchWithTimeout } from "@/lib/http";

const API = "https://api.airtable.com/v0";

// Pinned Airtable id (stable, not a secret) — same table lib/hierarchy.ts reads.
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
// The checkbox/select marketing ticks to feature someone on the main page.
const GATE_FIELD = "Main Page";
const GATE_VALUE = "YES";

// filterByFormula makes Airtable scan the whole (3k+ row, wide) table, so like the
// hierarchy fetch it can spike past the default 8s timeout on a cold Airtable. Give each
// attempt 10s and retry once so one blip doesn't blank the main page.
const TIMEOUT_MS = 10_000;
const ATTEMPTS = 2;

const SAFE_FIELDS = [
  "Full Name",
  "Job Title",
  "Company",
  "Profile Picture",
  "Link to LinkedIn",
  "LinkedIn Handle",
  "Hierarchy",
];

export type MainSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  // Curated importance from the same table; used only to order the 12 (1 = first).
  hierarchy: number | null;
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

// Only accept an http(s) URL — the "LinkedIn Handle" field mostly holds a full profile URL,
// but guard against a bare handle sneaking in as a broken href.
function linkedinUrl(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = str(v);
    if (/^https?:\/\//i.test(s)) return s;
  }
  return null;
}

function mapRecord(rec: AirtableRecord): MainSpeaker {
  const f = rec.fields;
  const rank = f["Hierarchy"];
  return {
    id: rec.id,
    name: str(f["Full Name"]),
    title: str(f["Job Title"]),
    company: str(f["Company"]),
    photo: firstPhoto(f["Profile Picture"]),
    // "Link to LinkedIn" is mostly empty; "LinkedIn Handle" holds the real profile URL.
    linkedin: linkedinUrl(f["Link to LinkedIn"], f["LinkedIn Handle"]),
    hierarchy: typeof rank === "number" && Number.isFinite(rank) ? rank : null,
  };
}

export class MainPageError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchMainPageOnce(token: string, base: string): Promise<MainSpeaker[]> {
  const out: MainSpeaker[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `{${GATE_FIELD}}="${GATE_VALUE}"`);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${base}/${TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      TIMEOUT_MS
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[main-page] fetch failed", res.status, detail);
      throw new MainPageError("Could not reach the main-page source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const s = mapRecord(rec);
      if (s.name) out.push(s); // skip blank rows
    }
    offset = data.offset;
  } while (offset);

  // Order by curated Hierarchy (1 first); unranked sink to the end, then by name.
  out.sort((a, b) => {
    if (a.hierarchy === null && b.hierarchy === null) return a.name.localeCompare(b.name);
    if (a.hierarchy === null) return 1;
    if (b.hierarchy === null) return -1;
    return a.hierarchy - b.hierarchy;
  });
  return out;
}

export async function fetchMainPageSpeakers(): Promise<MainSpeaker[]> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) {
    throw new MainPageError("Airtable env vars are not set on the server.", 503);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fetchMainPageOnce(token, base);
    } catch (err) {
      lastErr = err;
      if (attempt < ATTEMPTS) console.error(`[main-page] attempt ${attempt} failed, retrying`, err);
    }
  }
  throw lastErr instanceof MainPageError
    ? lastErr
    : new MainPageError("Something went wrong loading main-page speakers.", 502);
}
