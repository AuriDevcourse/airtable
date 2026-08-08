// Server-only access to the "Intern Pool" — a TALENT POOL, not a staff directory.
//
// The point of the page is to help TechBBQ's interns get hired off the back of the traffic the
// site carries in August and September (Auri, 2026-08-08). So each card is a pitch: who they are,
// what they own, what they are looking for next, and a LinkedIn button for a recruiter to act on.
//
// ─── THIS FEED PUBLISHES A PRIVATE INDIVIDUAL'S NAME, FACE AND PITCH ────────────────────
// That is the difference between this file and every other feed in lib/. A partner logo is a
// company's marketing asset and a speaker's headshot was submitted to be on a stage. An intern is
// a private person, usually early-career, and this page is on the open internet where it will be
// indexed. Three consequences, all enforced below rather than left to a process:
//
//   1. CONSENT IS A GATE, NOT A NOTE. `Consent to publish` must be ticked or the record does not
//      leave this server, whatever else is filled in. GDPR lawful basis for publishing personal
//      data of a private individual is their consent, and consent that lives in someone's memory
//      of a conversation is not consent. See SECURITY r6/r18.
//   2. `Email` AND `Manager (internal)` ARE NEVER REQUESTED. They are not in SAFE_FIELDS, so they
//      never reach this process, let alone the JSON. A recruiter contacts them on LinkedIn. An
//      email address on an indexed page is a spam magnet, and it is the intern who pays for it.
//   3. IT EXPIRES BY ITSELF. See `Show until`.
//
// Adding a field here is therefore a privacy decision, not a plumbing one. Check it against the
// three rules above before you add it.

import { fetchWithTimeout } from "@/lib/http";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { photoUrl } from "@/lib/photo";
import { firstAttachmentId, firstPhoto, str } from "@/lib/fields";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

// Pinned in code, not env — a stale env table id silently breaks the feed.
const TABLE = "tbl5VhWYQ6FeXfoJy"; // Intern Pool

// PUBLIC allow-list. Note the absentees and keep them absent: `Email`, `Manager (internal)`,
// `Notes` and `Assignee` are internal columns on this table and must never be requested.
const SAFE_FIELDS = [
  "Name",
  "Role",
  "Department",
  "Photo",
  "Responsibilities",
  "Pitch",
  "Looking for",
  "Available from",
  "LinkedIn",
  "Show until",
  "Consent to publish",
  "Put on web",
];

// Re-exported so a server-side caller can get the feed and the list from one import. The list
// itself lives in lib/internDepartments.ts, which has no server imports — the "Copy embed code"
// button is a client component and must not pull this file's Airtable fetcher into the browser
// bundle. See the header there.
export { INTERN_DEPARTMENTS } from "@/lib/internDepartments";
import { INTERN_DEPARTMENTS } from "@/lib/internDepartments";

// A pitch is meant to be read in one breath off a card. The form asks for 220 characters and
// Airtable's long-text field cannot enforce that, so the cap is applied HERE — the one place
// every consumer goes through. Truncated on a word boundary with an ellipsis rather than cut
// mid-word, and never silently: an over-long pitch is logged so somebody can ask them to trim it.
const PITCH_MAX = 220;

function clampPitch(raw: string, who: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length <= PITCH_MAX) return text;
  console.info(`[interns] "${who}" wrote a ${text.length}-character pitch, trimmed to ${PITCH_MAX}`);
  const cut = text.slice(0, PITCH_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > PITCH_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type Intern = {
  id: string;
  name: string;
  role: string;
  department: string;
  photo: string | null;
  responsibilities: string;
  pitch: string;
  lookingFor: string;
  availableFrom: string | null; // ISO date, or null when they did not say
  linkedin: string | null;
};

/**
 * Why an intern is not on the page yet, and therefore what somebody has to do about it.
 *
 *   "no-consent"  the consent box is not ticked. NOBODY can tick it but the intern — ask them.
 *   "not-on-web"  consent is in, the TechBBQ-side "Put on web" tick is not. Tick it.
 *   "no-photo"    no usable photo. A wall of grey circles is not a talent pool.
 *   "expired"     `Show until` has passed. Extend the date or let it go.
 *   "no-date"     no `Show until` at all, so it would never come down on its own.
 *
 * Only ever set on a dashboard read. A public read has none of these records at all.
 */
export type InternPending = "no-consent" | "not-on-web" | "no-photo" | "expired" | "no-date";

export type PendingIntern = Intern & { pending: InternPending };

export class InternsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type AirtableRecord = { id: string; fields: Record<string, unknown> };

// ─── THE MONTH RUNS OUT ON ITS OWN ──────────────────────────────────────────────────────
// `Show until` is the last day the card is on the site, INCLUSIVE, so a date of 2026-09-30 keeps
// them up through the whole of the 30th and drops them on 1 October.
//
// Read from the clock ON EVERY CALL and never captured at module load. A value read once at cold
// start would freeze, and a long-lived Vercel instance would keep showing an intern for days after
// their month ended — the same rule as lib/cachePolicy.ts and the HIDDEN_UNTIL block in
// lib/partners.ts, and the bug that bit the AI Workshop dashboard.
//
// Compared in UTC on the DATE only. Airtable hands back a bare "2026-09-30" with no timezone, so
// parsing it as an instant and comparing to `now` would drop the card at 02:00 Copenhagen on the
// last day rather than at midnight after it. Copenhagen is UTC+1/+2, so a whole-day comparison is
// the honest reading of a field a human filled in as "the last day".
function isExpired(showUntil: string, now: Date = new Date()): boolean {
  if (!showUntil) return false;
  const today = now.toISOString().slice(0, 10);
  return showUntil.slice(0, 10) < today;
}

function mapRecord(rec: AirtableRecord): Intern {
  const f = rec.fields;
  const name = str(f["Name"]);
  const attachmentId = firstAttachmentId(f["Photo"]);
  return {
    id: rec.id,
    name,
    role: str(f["Role"]),
    department: str(f["Department"]),
    // Through the proxy, never the raw Airtable URL: attachment URLs are signed and 410 after
    // ~2 hours, so a cached feed would serve dead images (lib/photo.ts). ?v= makes a REPLACED
    // photo appear immediately instead of sitting behind a week of CDN cache.
    photo: firstPhoto(f["Photo"]) ? photoUrl("interns", rec.id, undefined, attachmentId ?? undefined) : null,
    responsibilities: str(f["Responsibilities"]).replace(/\s+/g, " ").trim(),
    pitch: clampPitch(str(f["Pitch"]), name || rec.id),
    lookingFor: str(f["Looking for"]).replace(/\s+/g, " ").trim(),
    availableFrom: str(f["Available from"]).slice(0, 10) || null,
    linkedin: normalizeLinkedInUrl(f["LinkedIn"]),
  };
}

/**
 * The public list, or — with `includePending` — that list plus everyone the gates turned away,
 * each carrying the reason.
 *
 * `includePending` is OPT-IN and the route requires the dashboard password for it. That direction
 * matters twice over here: the default is the strict list, so the snippet on techbbq.dk keeps
 * getting exactly what it should even if someone forgets a parameter, and an intern who has NOT
 * consented can never be published by a missing argument.
 */
export async function fetchInterns(opts?: { department?: string }): Promise<Intern[]>;
export async function fetchInterns(opts: {
  department?: string;
  includePending: true;
}): Promise<(Intern | PendingIntern)[]>;
export async function fetchInterns({
  department,
  includePending = false,
}: { department?: string; includePending?: boolean } = {}): Promise<(Intern | PendingIntern)[]> {
  if (!TOKEN || !BASE_ID) {
    throw new InternsError("Airtable env vars are not set on the server.", 503);
  }

  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[interns] fetch failed", res.status, detail);
      throw new InternsError("Could not reach the intern pool.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  const out: (Intern | PendingIntern)[] = [];
  const noConsent: string[] = [];
  const notOnWeb: string[] = [];
  const expired: string[] = [];

  for (const rec of records) {
    const f = rec.fields;
    const name = str(f["Name"]);
    // A row with no name is the Airtable template's empty scaffolding, not a person.
    if (!name) continue;

    if (department && str(f["Department"]) !== department) continue;

    const showUntil = str(f["Show until"]).slice(0, 10);

    // Ordered by what somebody has to DO about it, and by who has to do it. Consent comes first
    // because only the intern can give it and nothing else matters until they have; the missing
    // date comes before the TechBBQ tick because publishing a card with no end date is how one
    // stays up until December.
    const pending: InternPending | null = !(f["Consent to publish"] === true)
      ? "no-consent"
      : !firstPhoto(f["Photo"])
        ? "no-photo"
        : !showUntil
          ? "no-date"
          : isExpired(showUntil)
            ? "expired"
            : f["Put on web"] !== true
              ? "not-on-web"
              : null;

    if (pending === "no-consent") noConsent.push(name);
    if (pending === "not-on-web") notOnWeb.push(name);
    if (pending === "expired") expired.push(`${name} (until ${showUntil})`);

    if (!pending) {
      out.push(mapRecord(rec));
      continue;
    }
    // THE ONE GATE THAT IS ABSOLUTE. Everything else can be shown to the dashboard as a worklist;
    // a record without consent is not ours to render anywhere, not even behind a password, because
    // the dashboard is where somebody would copy the pitch out of.
    if (includePending && pending !== "no-consent") {
      out.push({ ...mapRecord(rec), pending });
    } else if (includePending) {
      // Named, not silent — "why is my card not up" has to have an answer. Name only: no pitch,
      // no photo, no LinkedIn.
      out.push({
        id: rec.id,
        name,
        role: "",
        department: str(f["Department"]),
        photo: null,
        responsibilities: "",
        pitch: "",
        lookingFor: "",
        availableFrom: null,
        linkedin: null,
        pending,
      });
    }
  }

  if (noConsent.length) {
    console.info(
      `[interns] ${noConsent.length} intern(s) have not ticked "Consent to publish", so nothing ` +
        `about them is published: ${noConsent.join(", ")}`
    );
  }
  if (notOnWeb.length) {
    console.info(
      `[interns] ${notOnWeb.length} intern(s) consented but "Put on web" is not ticked: ${notOnWeb.join(", ")}`
    );
  }
  if (expired.length) {
    console.info(`[interns] ${expired.length} intern(s) are past their "Show until" date: ${expired.join(", ")}`);
  }

  // Grouped by department on the page, so sort by department then name and let the UI slice it.
  // localeCompare with the department index first keeps the bands in the order above rather than
  // alphabetical, which would put Event before Management and read as a ranking nobody chose.
  out.sort((a, b) => {
    const da = INTERN_DEPARTMENTS.indexOf(a.department);
    const db = INTERN_DEPARTMENTS.indexOf(b.department);
    // An unknown or empty department sorts last rather than first — indexOf gives -1.
    const ra = da === -1 ? INTERN_DEPARTMENTS.length : da;
    const rb = db === -1 ? INTERN_DEPARTMENTS.length : db;
    return ra - rb || a.name.localeCompare(b.name);
  });

  return out;
}
