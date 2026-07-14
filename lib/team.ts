// Server-only access to the "#TechBBCuties" staff directory. This table holds phone numbers,
// private notes, responsibilities and internal task fields. Those stay OUT. Only an allow-list
// (name/title/photo/LinkedIn/department/email) is ever requested from Airtable, and only CURRENT
// team members (Active, not Archived) are returned. Email is public by product decision; phone
// and everything else remain server-private.

import { fetchWithTimeout } from "@/lib/http";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

// Pinned in code (not env) on purpose — a stale env table id silently breaks the feed.
const TABLE = "tbldWne3PnvebIwif"; // #TechBBCuties staff directory

// PUBLIC allow-list. Email is intentionally included: TechBBQ treats staff contact emails as
// public info (product decision). Phone, Responsibilities and every internal field stay OUT —
// do not add a field without checking it.
const SAFE_FIELDS = ["Name", "Title", "LinkedIn", "Picture", "Department", "Email"];

// The known department options (minus "Archive", which marks people who have left).
export const DEPARTMENTS = [
  "Management",
  "Event",
  "Marketing",
  "Operations",
  "Partnerships",
  "PR and Communication",
  "Program",
  "Projects",
];

export type TeamMember = {
  id: string;
  name: string;
  title: string;
  photo: string | null;
  linkedin: string | null;
  department: string;
  email?: string | null; // ONLY populated for the internal, auth-gated feed. Never public.
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

function firstDept(v: unknown): string {
  return Array.isArray(v) && v.length ? String(v[0]) : "";
}

function mapRecord(rec: AirtableRecord): TeamMember {
  const f = rec.fields;
  const link = str(f["LinkedIn"]);
  return {
    id: rec.id,
    name: str(f["Name"]),
    title: str(f["Title"]),
    photo: firstPhoto(f["Picture"]),
    linkedin: link.startsWith("http") ? link : null,
    department: firstDept(f["Department"]),
    email: str(f["Email"]) || null,
  };
}

export class TeamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function esc(v: string): string {
  return v.replace(/'/g, "\\'");
}

export async function fetchTeam(departmentFilter?: string): Promise<TeamMember[]> {
  if (!TOKEN || !BASE_ID) {
    throw new TeamError("Airtable env vars are not set on the server.", 503);
  }

  const members: TeamMember[] = [];
  let offset: string | undefined;

  // Gate: current team only. Active ticked AND not sitting in the Archive department.
  // ARRAYJOIN flattens the multi-select so FIND works on it. This is robust even while
  // some archived rows are still (incorrectly) ticked Active.
  const gate = "AND({Active Team Member}=TRUE(),NOT(FIND('Archive',ARRAYJOIN({Department}))))";

  do {
    const params = new URLSearchParams();
    const formula = departmentFilter
      ? `AND(${gate},FIND('${esc(departmentFilter)}',ARRAYJOIN({Department})))`
      : gate;
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
      console.error("[team] fetch failed", res.status, detail);
      throw new TeamError("Could not reach the team source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const m = mapRecord(rec);
      if (m.name) members.push(m); // skip blank rows
    }
    offset = data.offset;
  } while (offset);

  members.sort((a, b) => a.name.localeCompare(b.name));
  return members;
}
