// Server-only access to the "#TechBBCuties" staff directory. This table holds phone numbers,
// private notes, responsibilities and internal task fields. Those stay OUT. Only an allow-list
// (name/title/photo/LinkedIn/department/email) is ever requested from Airtable, and only CURRENT
// team members (not Archived, not a long term volunteer — see the gate in fetchTeamOnce) are
// returned. Email is public by product decision; phone and everything else remain server-private.

import { fetchWithTimeout } from "@/lib/http";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { photoUrl } from "@/lib/photo";
import { firstAttachmentId, firstPhoto, str } from "@/lib/fields";

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
  // PUBLIC. /api/team is in middleware's PUBLIC_PATHS and the team embed renders these as
  // mailto links on techbbq.dk — staff contact addresses are public info by product
  // decision (see the SAFE_FIELDS note above). This field is NOT a private/internal one;
  // an earlier comment here claimed the opposite and was simply wrong. Phone, Responsibilities
  // and the rest of the table are what stay server-side.
  email?: string | null;
  // Leadership order: 1 = CEO, 2 = other chiefs, 3 = heads of department. null = everyone
  // else, who get shuffled.
  //
  // Deliberately named `hierarchy` to match the speaker feeds: the page and the Elementor
  // snippet both already know how to shuffle a list while pinning anyone with a numeric
  // hierarchy at the top, so the team list gets "chiefs first, everyone else random" without
  // a line of new ordering code. Derived from the job title, NOT stored in Airtable — there
  // is no rank column in #TechBBCuties to maintain.
  hierarchy: number | null;
  // Vertical crop for the card photo as a CSS object-position Y value ("40%"). Only set for
  // the few people in PHOTO_FOCUS_Y; null means the card's own 30% default applies.
  focus: string | null;
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
].map(normName);

// Per-person photo crop, for the handful whose headshot sits wrong in a square card.
//
// Cards use `object-fit: cover` with a default `object-position: 50% 30%`. That Y value is
// how far DOWN the photo the visible window sits, so a BIGGER number moves the subject UP in
// the frame and a smaller one moves them down. Values here are that Y percentage; anyone not
// listed keeps the 30% default.
//
// Hand-maintained like PINNED_AFTER_HEADS, and for the same reason: there is no crop field in
// Airtable. A name that no longer matches simply has no effect. Re-check a value if someone
// swaps their photo — this is tuned to the specific image, not to the person.
const PHOTO_FOCUS_Y: Record<string, number> = {
  // Asked for 10% higher (2026-07-30).
  "andrei ratcu": 40,
  "marie-louise nielsen": 40,
  "alev burcin aydin jensen": 40,
  // Asked for lower.
  "charlotte esmann": 20,
  "stephan evon": 20,
};

function normName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

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

  if (PINNED_AFTER_HEADS.includes(normName(name))) return 4;

  return null;
}

type AirtableRecord = { id: string; fields: Record<string, unknown> };

function firstDept(v: unknown): string {
  return Array.isArray(v) && v.length ? String(v[0]) : "";
}

function mapRecord(rec: AirtableRecord): TeamMember {
  const f = rec.fields;
  const title = str(f["Title"]);
  const name = str(f["Name"]);
  const focusY = PHOTO_FOCUS_Y[normName(name)];
  return {
    id: rec.id,
    name,
    title,
    // Stable proxy URL — raw signed attachment URLs expire in ~2h (lib/photo.ts).
    photo: firstPhoto(f["Picture"])
      ? photoUrl("team", rec.id, undefined, firstAttachmentId(f["Picture"]))
      : null,
    linkedin: normalizeLinkedInUrl(f["LinkedIn"]),
    department: firstDept(f["Department"]),
    email: str(f["Email"]) || null,
    hierarchy: leadershipRank(name, title),
    focus: focusY === undefined ? null : `${focusY}%`,
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

// #TechBBCuties is a wide table, so this scan is normally ~1s but spikes past the default
// 8s fetch timeout on a cold Airtable. That matters MORE here than anywhere else because
// /api/team is cached for a full day (DAY_MS + s-maxage=86400): a cold miss is rare, but
// every cold miss is a deploy or a 24h rollover, and there is no stale value to fall back
// on, so a single blip surfaces to techbbq.dk as "Could not load right now." on the live
// team embed. Same 10s + retry-once treatment as lib/hierarchy.ts.
//
// Observed 2026-08-01: the team embed showed that message shortly after a deploy (which
// resets the in-memory cache), then recovered on its own — the signature of exactly this.
const TEAM_TIMEOUT_MS = 10_000;
const TEAM_ATTEMPTS = 2;

export async function fetchTeam(departmentFilter?: string): Promise<TeamMember[]> {
  if (!TOKEN || !BASE_ID) {
    throw new TeamError("Airtable env vars are not set on the server.", 503);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= TEAM_ATTEMPTS; attempt++) {
    try {
      return await fetchTeamOnce(departmentFilter);
    } catch (err) {
      lastErr = err;
      // A 503 is a config fault (missing env) and a 502 is Airtable rejecting us — neither
      // improves on a retry. Only a timeout/network abort is worth trying again.
      const worthRetrying = !(err instanceof TeamError);
      if (!worthRetrying || attempt === TEAM_ATTEMPTS) break;
      console.error(`[team] attempt ${attempt} failed, retrying`, err);
    }
  }
  throw lastErr;
}

async function fetchTeamOnce(departmentFilter?: string): Promise<TeamMember[]> {
  const members: TeamMember[] = [];
  let offset: string | undefined;

  // Gate: current team only.
  //   1. not sitting in the Archive department (ARRAYJOIN flattens the multi-select so FIND
  //      works on it), AND
  //   2. LTV (long term volunteer) is not YES. Volunteers are staff-adjacent but not staff,
  //      so they stay off the public team list (Auri's rule, 2026-07-30).
  //
  // Point 2 excludes YES rather than requiring NO on purpose. The rule as stated was "list
  // the NO ones", and today every row is filled in (27 NO, 1 YES, 0 blank) so the two are
  // identical — but a NEW hire whose LTV nobody set yet would silently vanish from the team
  // page under a require-NO rule. Blank means "not marked a volunteer", so they stay listed.
  //
  // {Active Team Member} WAS A THIRD CONDITION AND IS DELIBERATELY GONE (Auri's call,
  // 2026-08-19). It is the field nobody remembers to tick, so a new hire with a photo, a
  // department and an email sat invisible on techbbq.dk while every other field said they had
  // joined. Two rows were hidden that way the day it came out: Nadja Schwabach and Ida
  // Nørgaard, both non-Archive, both LTV=NO. The checkbox still exists in Airtable and is fine
  // as an internal marker; it just no longer decides who is public.
  //
  // CONSEQUENCE, plainly: Archive is now the ONLY thing keeping a leaver off the public page.
  // Taking someone off the team means setting their Department to Archive — unticking the
  // checkbox does nothing here any more. That trade was made knowingly. Forgetting to tick hid
  // people who had joined, which happened every time anyone joined; forgetting to archive shows
  // someone who left, which is rare and visible on the page itself.
  const gate =
    "AND(NOT(FIND('Archive',ARRAYJOIN({Department})))," +
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

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" },
      TEAM_TIMEOUT_MS
    );

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
