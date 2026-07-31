// Server-only: investor speakers for the European Growth Pension & Insurance Summit,
// the LP Forum and TechBBQ Investor Day. Same source as the Main Page 12 — the
// "Marketing Project Overview" table (tblTecOBecLQCNIeD), rows whose Project Name is
// one of those events. Only the
// allow-listed marketing fields below are ever requested; the table is wide and holds
// unrelated internal project data, none of it is read here.

import { fetchWithTimeout } from "@/lib/http";
import { photoUrl } from "@/lib/photo";
import { firstPhoto, linkedinUrl, num, str } from "@/lib/fields";

const API = "https://api.airtable.com/v0";

// Pinned Airtable id (stable, not a secret) — same table lib/mainpage.ts reads.
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview

// Short URL-safe keys → the exact Project Name single-select options in Airtable.
// The keys are what ?event= accepts; the values are what the filter formula matches.
export const INVESTOR_EVENTS = {
  "pension-summit": "European Growth Pension & Insurance Summit",
  "lp-forum": "LP Forum",
  "investor-day": "TechBBQ Investor Day",
} as const;
export type InvestorEventKey = keyof typeof INVESTOR_EVENTS;

// filterByFormula scans the whole (3k+ row, wide) table, so like the main-page fetch it
// can spike past the default 8s timeout on a cold Airtable. 10s per attempt, retry once.
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
  "Project Name",
];

export type InvestorSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  // Which of the two events the row belongs to, as the short key ("pension-summit").
  event: string;
  // Curated importance from the same table (1 = first); blanks sort last.
  hierarchy: number;
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

// First value that normalizes to a working LinkedIn URL wins (handles www./scheme-less/
// mobile variants; a bare non-URL handle still never renders as a broken href).

function eventKey(projectName: string): string {
  for (const [key, name] of Object.entries(INVESTOR_EVENTS)) {
    if (name === projectName) return key;
  }
  return "";
}

function mapRecord(rec: AirtableRecord): InvestorSpeaker {
  const f = rec.fields;
  return {
    id: rec.id,
    name: str(f["Full Name"]),
    title: str(f["Job Title"]),
    company: str(f["Company"]),
    // Stable proxy URL — raw signed attachment URLs expire in ~2h (lib/photo.ts).
    photo: firstPhoto(f["Profile Picture"]) ? photoUrl("marketing", rec.id) : null,
    linkedin: linkedinUrl(f["Link to LinkedIn"], f["LinkedIn Handle"]),
    event: eventKey(str(f["Project Name"])),
    hierarchy: num(f["Hierarchy"]),
  };
}

// The view holds real duplicate rows for several people (same person submitted/added
// more than once, e.g. Thomas Kristensen ×3). Collapse by normalized name per event,
// preferring the row that has a LinkedIn URL, then the lower (better) hierarchy.
function dedupe(people: InvestorSpeaker[]): InvestorSpeaker[] {
  const byKey = new Map<string, InvestorSpeaker>();
  for (const p of people) {
    const key = p.event + ":" + p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, p);
      continue;
    }
    const better =
      (p.linkedin ? 1 : 0) - (prev.linkedin ? 1 : 0) ||
      (p.hierarchy < prev.hierarchy ? 1 : 0);
    if (better > 0) byKey.set(key, p);
  }
  return [...byKey.values()];
}

export class InvestorsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchInvestorsOnce(
  token: string,
  base: string,
  event?: InvestorEventKey
): Promise<InvestorSpeaker[]> {
  const people: InvestorSpeaker[] = [];
  let offset: string | undefined;

  const names = event ? [INVESTOR_EVENTS[event]] : Object.values(INVESTOR_EVENTS);
  const formula =
    names.length === 1
      ? `{Project Name}='${names[0]}'`
      : `OR(${names.map((n) => `{Project Name}='${n}'`).join(",")})`;

  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", formula);
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
      console.error("[investors] fetch failed", res.status, detail);
      throw new InvestorsError("Could not reach the investor-speakers source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const p = mapRecord(rec);
      // No portrait, no card — same publish rule as NISS/NASS: uploading a Profile
      // Picture is what makes a person appear, so nobody renders as a grey placeholder.
      if (p.name && p.photo) people.push(p);
    }
    offset = data.offset;
  } while (offset);

  const unique = dedupe(people);
  // Order by curated Hierarchy (1 first); unranked sink to the end, then by name.
  unique.sort((a, b) => a.hierarchy - b.hierarchy || a.name.localeCompare(b.name));
  return unique;
}

export async function fetchInvestors(event?: InvestorEventKey): Promise<InvestorSpeaker[]> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) {
    throw new InvestorsError("Airtable env vars are not set on the server.", 503);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fetchInvestorsOnce(token, base, event);
    } catch (err) {
      lastErr = err;
      if (attempt < ATTEMPTS) console.error(`[investors] attempt ${attempt} failed, retrying`, err);
    }
  }
  throw lastErr instanceof InvestorsError
    ? lastErr
    : new InvestorsError("Something went wrong loading investor speakers.", 502);
}
