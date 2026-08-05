// Server-only access to THE POLICY LOUNGE roster.
//
// Source: Marketing Project Overview (`tblTecOBecLQCNIeD`), the rows whose `Project Name` is
// "Event Room 5,6,7" — the Policy Stage runs across rooms 5, 6 and 7, which is why that option
// exists at all. 31 people as of 2026-08-05: 28 Speakers, 3 Moderators.
//
// HOW THEY GOT THERE, because it explains the shape of this file. The people arrive through the
// "Add Event Room Speakers" overflow form (Partnership Success), which takes ONE ROW PER SESSION and
// asks for no role. They were imported into the CRM as one row per person, and Auri then filled in
// the new `Role` column by hand. So the role is curated here, not submitted, and it is the only thing
// separating the two tabs.
//
// PUBLISH RULE: a name and a photo, the same rule NISS and NASS use. Deliberately NOT "Put on web":
// that checkbox is the partner WALL's gate and nobody has ticked it on these rows, so requiring it
// would serve an empty page. If it should gate this feed too, it is one condition in the loop below —
// but say so first, because turning it on hides all 31 people until someone ticks 31 boxes.
//
// Only the allow-listed fields are ever requested. The table is 113 fields wide and holds unrelated
// internal project data; none of it is read here.

import { fetchWithTimeout } from "@/lib/http";
import { firstAttachmentId, firstPhoto, linkedinUrl, numOrNull, str } from "@/lib/fields";
import { photoUrl } from "@/lib/photo";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned Airtable ids (stable, not secrets — same reasoning as lib/niss.ts).
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
// The `Project Name` single-select option. Written out rather than pattern-matched: the Policy Stage
// is this one value, and a looser match would sweep in Event Room 5 (a different room with its own
// sessions, Scaling Europe and Creative Business Cup).
export const POLICY_LOUNGE_PROJECT = "Event Room 5,6,7";

// The wide Marketing table can be slow to scan, like the investor and main-page fetches.
const TIMEOUT_MS = 10_000;

const SAFE_FIELDS = [
  "Full Name",
  "Job Title",
  "Company",
  "Profile Picture",
  "LinkedIn Handle",
  "Role",
  "Hierarchy",
  "Session Name",
];

// The roles this roster holds, as an allow-list. Anything else is a value nobody has agreed on and is
// logged rather than published — the same instinct as every other gate in this repo.
export const POLICY_ROLES = ["Speaker", "Moderator"] as const;
export type PolicyRole = (typeof POLICY_ROLES)[number];

export type PolicyLoungePerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  role: PolicyRole;
  // Curated order when somebody has set it; null means unranked and sorts after the ranked block.
  hierarchy: number | null;
  // "Policy Stage" on every row today. Carried so a second session in these rooms can be told apart
  // without another feed.
  session: string;
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

export class PolicyLoungeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchPolicyLounge(): Promise<PolicyLoungePerson[]> {
  if (!TOKEN || !BASE_ID) {
    throw new PolicyLoungeError("Airtable env vars are not set on the server.", 503);
  }

  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    // Filtered server-side on the project, so a 3k-row table never lands in memory here.
    params.set("filterByFormula", `{Project Name}="${POLICY_LOUNGE_PROJECT}"`);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" },
      TIMEOUT_MS
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[policy-lounge] fetch failed", res.status, detail);
      throw new PolicyLoungeError("Could not reach the Policy Lounge source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  const people: PolicyLoungePerson[] = [];
  const unknownRole: string[] = [];
  const incomplete: string[] = [];

  for (const rec of records) {
    const f = rec.fields;
    const name = str(f["Full Name"]);
    const photo = firstPhoto(f["Profile Picture"]);
    // Publish rule: a name and a face. A half-filled row is not a card.
    if (!name || !photo) {
      if (name) incomplete.push(name);
      continue;
    }

    const role = str(f["Role"]);
    if (!(POLICY_ROLES as readonly string[]).includes(role)) {
      // Named, not silently dropped: a blank Role is a row waiting for a human, and "our speaker is
      // missing" is the complaint this line answers before it is made.
      unknownRole.push(role ? `${name} (role "${role}")` : `${name} (no role yet)`);
      continue;
    }

    people.push({
      id: rec.id,
      name,
      title: str(f["Job Title"]),
      company: str(f["Company"]),
      // Stable proxy URL — raw signed attachment URLs expire in ~2h (lib/photo.ts).
      photo: photoUrl("marketing", rec.id, undefined, firstAttachmentId(f["Profile Picture"])),
      linkedin: linkedinUrl(f["Link to LinkedIn"], f["LinkedIn Handle"]),
      role: role as PolicyRole,
      hierarchy: numOrNull(f["Hierarchy"]),
      session: str(f["Session Name"]),
    });
  }

  if (incomplete.length) {
    console.info(
      `[policy-lounge] ${incomplete.length} row(s) have no photo and are not published: ${incomplete.join(", ")}`
    );
  }
  if (unknownRole.length) {
    console.info(
      `[policy-lounge] ${unknownRole.length} row(s) are not published because their Role is not ` +
        `Speaker or Moderator: ${unknownRole.join(", ")}`
    );
  }

  // Curated Hierarchy first where it exists, then alphabetical. numOrNull rather than num, because
  // Infinity does not survive JSON.stringify — it serializes as null and the client would read the
  // ranked and unranked rows as the same thing.
  people.sort((a, b) => (a.hierarchy ?? Infinity) - (b.hierarchy ?? Infinity) || a.name.localeCompare(b.name));
  return people;
}
