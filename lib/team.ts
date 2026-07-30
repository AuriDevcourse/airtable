// Server-only access to the "#TechBBCuties" staff directory. This table holds phone numbers,
// private notes, responsibilities and internal task fields. Those stay OUT. Only an allow-list
// (name/title/photo/LinkedIn/department/email) is ever requested from Airtable, and only CURRENT
// team members (Active, not Archived, not a long term volunteer) are returned. Email is public by product decision; phone
// and everything else remain server-private.

import { fetchWithTimeout } from "@/lib/http";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

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
// Must stay in step with the Department select in Airtable: a real department missing from
// here is silently rejected as a ?department= filter and buckets its people under "Other"
// on the page. That is how Finance was hiding.
export const DEPARTMENTS = [
  "Management",
  "Event",
  "Finance",
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
  // Leadership order: 1 = CEO, 2 = other chiefs, 3 = heads of department. null = everyone
  // else, who get shuffled.
  //
  // Deliberately named `hierarchy` to match the speaker feeds: the page and the Elementor
  // snippet both already know how to shuffle a list while pinning anyone with a numeric
  // hierarchy at the top, so the team list gets "chiefs first, everyone else random" without
  // a line of new ordering code. Derived from the job title, NOT stored in Airtable — there
  // is no rank column in #TechBBCuties to maintain.
  hierarchy: number | null;
};

// People Auri wants surfaced above the random block regardless of title (asked for by name,
// 2026-07-30). They sit at rank 4 — directly after the heads of department — and shuffle
// among themselves.
//
// This is a hand-maintained list because #TechBBCuties has no rank column. A name that no
// longer matches simply has no effect, so a leaver here is harmless, just dead weight. If it
// grows much past a handful, add a number field to Airtable instead and read that: a rank
// list living in code is one more thing to remember when someone joins or changes their name.
const PINNED_AFTER_HEADS = [
  "Alev Burcin Aydin Jensen",
  "Andrei Ratcu",
  "Marie-Louise Nielsen",
].map((n) => n.toLowerCase().replace(/\s+/g, " ").trim());

// Leadership rank, derived from the job title (and the pin list above):
//   1  CEO
//   2  every other chief ("Chief Projects and Strategy Officer", "COO - Chief Operations
//      Officer" — chiefs here spell out "Chief", but the C-suite abbreviations are matched
//      too so a title written as just "CTO" still ranks)
//   3  heads of department ("Head of Partnerships", "Head of Finance")
//   4  PINNED_AFTER_HEADS, by name
//   null  everyone else, shuffled
//
// Members sharing a rank are shuffled among themselves, so no single chief or head is
// permanently listed above their peers.
function leadershipRank(name: string, title: string): number | null {
  const t = title.toLowerCase();
  // A title can NAME a role without being it: "PA to CEO" is a personal assistant, and
  // ranked as the CEO it landed at the very top of the team page. Anything reporting "to"
  // a chief or a head, and any assistant, is excluded before the matches below.
  if (/\bto\s+(the\s+)?(c[a-z]o|chief|head)\b/.test(t)) return null;
  if (/\b(assistant|pa|ea)\b/.test(t)) return null;

  if (/\bchief\b/.test(t) || /\b(ceo|coo|cfo|cto|cmo|cco|cpo|cxo)\b/.test(t)) {
    const isCeo = /\bceo\b/.test(t) || /chief executive/.test(t);
    return isCeo ? 1 : 2;
  }

  // "Head of …" only. Director/Lead/Manager titles are NOT treated as heads of department —
  // that line is Auri's to draw, and guessing would quietly promote people.
  if (/\bhead of\b/.test(t)) return 3;

  if (PINNED_AFTER_HEADS.includes(name.toLowerCase().replace(/\s+/g, " ").trim())) return 4;

  return null;
}

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
  const title = str(f["Title"]);
  const name = str(f["Name"]);
  return {
    id: rec.id,
    name,
    title,
    photo: firstPhoto(f["Picture"]),
    linkedin: normalizeLinkedInUrl(f["LinkedIn"]),
    department: firstDept(f["Department"]),
    email: str(f["Email"]) || null,
    hierarchy: leadershipRank(name, title),
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

  // Gate: current team only.
  //   1. Active Team Member ticked, AND
  //   2. not sitting in the Archive department (ARRAYJOIN flattens the multi-select so FIND
  //      works on it — robust even while some archived rows are still incorrectly ticked
  //      Active), AND
  //   3. LTV (long term volunteer) is not YES. Volunteers are staff-adjacent but not staff,
  //      so they stay off the public team list (Auri's rule, 2026-07-30).
  //
  // Point 3 excludes YES rather than requiring NO on purpose. The rule as stated was "list
  // the NO ones", and today every row is filled in (27 NO, 1 YES, 0 blank) so the two are
  // identical — but a NEW hire whose LTV nobody set yet would silently vanish from the team
  // page under a require-NO rule. Blank means "not marked a volunteer", so they stay listed.
  const gate =
    "AND({Active Team Member}=TRUE()," +
    "NOT(FIND('Archive',ARRAYJOIN({Department})))," +
    "{LTV}!='YES')";

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
