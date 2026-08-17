// Server-only access to THE BOARD SUMMIT roster.
//
// Source: Marketing Project Overview (`tblTecOBecLQCNIeD`), the rows filed under Project Name
// "Event Room 1" AND Session Name "Board Summit". 31 people as of 2026-08-17: 23 Speakers,
// 4 Moderators and 4 rows nobody has given a Role yet.
//
// BOTH CONDITIONS ARE LOAD-BEARING. Event Room 1 holds two programmes: the Board Summit and
// "Beyond Unicorns - Building Europe's Resilient Industries", 17 more people. Filtering on the
// room alone would put the Beyond Unicorns line-up on the Board Summit's wall, which is the exact
// mistake the Policy Stage filter avoids by naming "Event Room 5,6,7" in full rather than matching
// "Event Room 5" loosely. See lib/policystage.ts, which this file is modelled on: same table, same
// publish rule, same curated Role column.
//
// The Board Summit's SESSIONS are a different feed entirely — they are hand-typed in the Sessions
// table and served at /api/program?event=board (lib/program.ts). This file is only the faces.
//
// PUBLISH RULE: a name and a photo, then a Role of Speaker or Moderator. All 31 rows have a name
// and a face today, so the Role column is the only gate that actually drops anyone, and the four it
// drops are reported back rather than swallowed — see BoardSummitRoster.needsRole.
//
// Only the allow-listed fields are ever requested. The table is 113 fields wide and holds unrelated
// internal project data; none of it is read here.

import { fetchWithTimeout } from "@/lib/http";
import { firstAttachmentId, firstPhoto, firstTag, linkedinUrl, numOrNull, str } from "@/lib/fields";
import { photoUrl } from "@/lib/photo";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned Airtable ids (stable, not secrets — same reasoning as lib/policystage.ts).
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
// The two `Project Name` / `Session Name` values, written out in full. See the header: matching the
// room alone sweeps in a second programme that runs in the same room.
export const BOARD_SUMMIT_PROJECT = "Event Room 1";
export const BOARD_SUMMIT_SESSION = "Board Summit";

// The wide Marketing table can be slow to scan, like the Policy Stage and investor fetches.
const TIMEOUT_MS = 10_000;

const SAFE_FIELDS = [
  "Full Name",
  "Job Title",
  "Company",
  "Profile Picture",
  // Both LinkedIn columns, because linkedinUrl reads them in preference order. Requesting only one
  // makes the other permanently undefined — Airtable returns nothing you did not ask for. Neither
  // is filled on any Board Summit row today, so every card is currently unlinked; the moment
  // somebody pastes a profile in, it becomes a link with no change here.
  "Link to LinkedIn",
  "LinkedIn Handle",
  "Role",
  "Hierarchy",
  "Session Name",
];

// The roles this roster holds, as an allow-list. Anything else is a value nobody has agreed on, and
// it is reported rather than published — an unclassified row must not become a public card by
// default. Same gate as the Policy Stage.
export const BOARD_ROLES = ["Speaker", "Moderator"] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];

export type BoardSummitPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  role: BoardRole;
  /** Curated order where somebody has set it; null means unranked and sorts after the ranked block. */
  hierarchy: number | null;
  /** "Board Summit" on every row by definition. Carried so a card can prove which filter caught it. */
  session: string;
};

/**
 * The roster plus what is wrong with it.
 *
 * The two lists are the reason this returns an object rather than an array. A person on a stage in
 * ten days who is missing from the wall is a phone call, and "it is in the server log" is not an
 * answer anybody reads. The ROUTE only hands them to an authenticated dashboard read.
 */
export type BoardSummitRoster = {
  people: BoardSummitPerson[];
  /** Named, has a photo, but the Role cell is empty or holds something unrecognised. */
  needsRole: string[];
  /** Has a name but no usable photo. */
  needsPhoto: string[];
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

export class BoardSummitError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchBoardSummit(): Promise<BoardSummitRoster> {
  if (!TOKEN || !BASE_ID) {
    throw new BoardSummitError("Airtable env vars are not set on the server.", 503);
  }

  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    // Filtered server-side on both fields, so a 3k-row table never lands in memory here.
    params.set(
      "filterByFormula",
      `AND({Project Name}="${BOARD_SUMMIT_PROJECT}",{Session Name}="${BOARD_SUMMIT_SESSION}")`
    );
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
      console.error("[board-summit] fetch failed", res.status, detail);
      throw new BoardSummitError("Could not reach the Board Summit source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  const people: BoardSummitPerson[] = [];
  const needsRole: string[] = [];
  const needsPhoto: string[] = [];

  for (const rec of records) {
    const f = rec.fields;
    const name = str(f["Full Name"]);
    const photo = firstPhoto(f["Profile Picture"]);
    // Publish rule: a name and a face. A half-filled row is not a card.
    if (!name || !photo) {
      if (name) needsPhoto.push(name);
      continue;
    }

    // firstTag, not str: `Role` is a MULTI-select, so the cell arrives as ["Speaker"] and str()
    // returns "" for an array — the bug that once unpublished all 31 Policy Stage people at once.
    const role = firstTag(f["Role"]);
    if (!(BOARD_ROLES as readonly string[]).includes(role)) {
      needsRole.push(role ? `${name} (role “${role}”)` : name);
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
      role: role as BoardRole,
      hierarchy: numOrNull(f["Hierarchy"]),
      session: str(f["Session Name"]),
    });
  }

  if (needsPhoto.length) {
    console.info(
      `[board-summit] ${needsPhoto.length} row(s) have no photo and are not published: ${needsPhoto.join(", ")}`
    );
  }
  if (needsRole.length) {
    console.info(
      `[board-summit] ${needsRole.length} row(s) are not published because their Role is not ` +
        `Speaker or Moderator: ${needsRole.join(", ")}`
    );
  }

  // Curated Hierarchy first where it exists, then alphabetical. Nothing on this roster is ranked
  // today, so in practice the page's own shuffle decides the order. numOrNull rather than num,
  // because Infinity does not survive JSON.stringify.
  people.sort((a, b) => (a.hierarchy ?? Infinity) - (b.hierarchy ?? Infinity) || a.name.localeCompare(b.name));

  return { people, needsRole, needsPhoto };
}
