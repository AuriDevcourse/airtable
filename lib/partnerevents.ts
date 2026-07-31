// Server-only access to the partner-hosted events — Side Events and Event Rooms — from
// the "2026 Side event and event room info" view on Partnership Success.
//
// Same table and view as lib/eventrooms.ts, but a different grain: that lib returns one
// entry per PRESENTER, this one returns one entry per EVENT (the session itself). Keep
// them separate; merging them would force one shape to carry the other's nulls.
//
// Safety: the token never leaves the server and only the allow-list below is requested.
// This feed DOES publish `Session Description` and `Link to register`, which lib/
// eventrooms.ts deliberately withheld — they are the partner's own public marketing copy
// and public sign-up link (only the 6 Side Events carry them). Contact Person, Contact
// Email, Average rating, partner feedback and the other ~120 columns stay server-side.
//
// ─── WHY THIS LIB ADDRESSES FIELDS BY ID ────────────────────────────────────────────
// Partnership Success has THREE columns all literally named "Date of Event " (identical,
// trailing space included) plus a fourth "Date of Event" without the space. Airtable
// rejects the whole request with AMBIGUOUS_FIELD_NAMES if a duplicated name appears in
// fields[], so the allow-list pattern used everywhere else in this repo is impossible
// here — it is a hard API error, not a preference.
//
// So: fields[] carries field IDs and the fetch sets returnFieldsByFieldId=true, which
// makes the response keys IDs too. Field IDs are also immune to the trailing-space
// renames that bite this base constantly (`Hierarchy `, `Role `, `Which LS DT stage? `).
// Verified 2026-07-31: the date is genuinely SPLIT across two of the three same-named
// columns (13 rows in DATE_PRIMARY, 3 in DATE_SECONDARY, 1 row has both and they agree),
// so both are requested and coalesced. Reading either one alone loses rows.

import { fetchWithTimeout } from "@/lib/http";
import { photoUrl } from "@/lib/photo";
import { str } from "@/lib/fields";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned in code on purpose (stable Airtable ids, not secrets — see lib/niss.ts).
const TABLE = "tbllvkwLhB4Omdphd"; // Partnership Success
const VIEW = "viwcC25ENg2ELGszH"; // 2026 Side event and event room info

// Field IDs, not names — see the header. Re-read them from
// GET /v0/meta/bases/<base>/tables if a column is ever rebuilt from scratch (renaming a
// column does NOT change its id, which is the point).
const FIELDS = {
  title: "fldLO43hWLBlNd02m", // Session Title
  description: "fldupJmTIeVOVBuag", // Session Description (multilineText)
  typeOfEvent: "fldXs3aNUEHHuiZZY", // Type of Event: Side Event | Event Room at TechBBQ | Bridge Event
  accessType: "fldvM6e7NA8N9RVfX", // Event type: Public Event | Private Event (invite only)
  registerUrl: "fldW7Kf9e7UtOzzgC", // Link to register (url)
  logo: "fldh42Bwz9nd1oONo", // Company Logo (attachments)
  company: "fldYCL0PV6YJVupvS", // Company
  // The two populated "Date of Event " twins. Coalesced primary-first.
  datePrimary: "fld5S7DvQz7C09BNm",
  dateSecondary: "fldDUuXRNZ8nIjTo3",
} as const;

const SAFE_FIELD_IDS = Object.values(FIELDS);

// Type of Event → the card's kind + colour. Red for Side Events, blue for Event Rooms
// (Auri's rule). "Bridge Event" is a real third option in the select with zero rows in
// this view today; it is neither of the two this page is about, so it is filtered out
// rather than guessed a colour for. Add it here if it should start showing.
// Blue is #1B6CA8, chosen to MATCH the red on both contrast axes rather than by eye:
// 5.59:1 against white (red is 5.63) so the Register button's white label is legible, and
// 3.32:1 against the #131313 card (red is 3.30) so the badge reads the same as the red one.
// The earlier #2BB4E1 was only 2.41:1 on white — white button text on it failed outright.
// Do NOT reuse lib/lifescience.ts's #2BB4E1; that is the Deep Tech stage colour.
const KINDS = {
  "Side Event": { kind: "side-event", label: "Side Event", color: "#CE0F2E" },
  "Event Room at TechBBQ": { kind: "event-room", label: "Event Room", color: "#1B6CA8" },
} as const;

// Event type → the access badge. Airtable offers exactly two options, so "private" and
// "invitation only" are ONE fused state ("Private Event (invite only)") — this feed
// cannot separate them, because the source does not. A third select option would be
// needed for that; nothing here has to change except this map.
const ACCESS = {
  "Public Event": { accessKind: "public", accessLabel: "Public" },
  "Private Event (invite only)": { accessKind: "private-invite", accessLabel: "Private · invite only" },
} as const;

export type PartnerEvent = {
  id: string;
  title: string;
  // The hosting partner. Often the fuller legal name on a resubmitted row ("FBV" vs
  // "FBV - Association of Listed Companies"), which is why the newest row wins below.
  company: string;
  kind: "side-event" | "event-room";
  kindLabel: string; // "Side Event" | "Event Room"
  color: string; // red for side events, blue for event rooms
  date: string | null; // ISO "2026-08-26", null when the partner never filled it in
  dateLabel: string | null; // "Tue 25 Aug" — formatted here so consumers don't re-parse
  accessKind: "public" | "private-invite" | null;
  accessLabel: string | null; // null when the partner never picked one (3 rows today)
  // Partner's own blurb. Only the Side Events carry it; two run past 400 chars, so the
  // card clamps it in CSS rather than truncating the data here.
  description: string | null;
  registerUrl: string | null;
  logo: string | null; // /api/photo proxy URL (raw Airtable URLs 410 after ~2h)
};

type AirtableRecord = { id: string; createdTime: string; fields: Record<string, unknown> };

export class PartnerEventsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// "2026-08-26" → "Tue 25 Aug". Formatted in UTC on purpose: these are date-only cells
// with no time component, so formatting them in a local zone west of UTC would shift
// them a day earlier.
function formatDate(iso: string): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

function firstAttachment(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

// How much a row actually carries, used to pick a winner among resubmissions of the same
// session. A partner filling in the description + register link later is the common case.
function richness(f: Record<string, unknown>): number {
  return (
    (str(f[FIELDS.description]) ? 1 : 0) +
    (str(f[FIELDS.registerUrl]) ? 1 : 0) +
    (firstAttachment(f[FIELDS.logo]) ? 1 : 0) +
    (str(f[FIELDS.accessType]) ? 1 : 0)
  );
}

async function fetchView(): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("view", VIEW);
    params.set("pageSize", "100");
    // Response keys become field IDs — required to tell the same-named date columns
    // apart. See the header.
    params.set("returnFieldsByFieldId", "true");
    for (const id of SAFE_FIELD_IDS) params.append("fields[]", id);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[partnerevents] fetch failed", res.status, detail);
      throw new PartnerEventsError("Could not reach the partner events source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

export async function fetchPartnerEvents(): Promise<PartnerEvent[]> {
  if (!TOKEN || !BASE_ID) {
    throw new PartnerEventsError("Airtable env vars are not set on the server.", 503);
  }

  const records = await fetchView();

  // One row per session, keyed on title + date. Partners resubmit the whole form when
  // something changes, which produces exact duplicates (Nordic IPO has two rows for
  // 2026-08-26). The date is part of the key on purpose: Creative Business Cup runs on
  // BOTH 08-26 and 08-27 and those are two real events, not a duplicate.
  const bySession = new Map<string, AirtableRecord>();

  for (const rec of records) {
    const f = rec.fields;
    // No title, no card — three rows in this view are empty form starts.
    const title = str(f[FIELDS.title]);
    if (!title) continue;
    // Side Events and Event Rooms only; a "Bridge Event" is neither.
    if (!(str(f[FIELDS.typeOfEvent]) in KINDS)) continue;

    const date = str(f[FIELDS.datePrimary]) || str(f[FIELDS.dateSecondary]);
    const key = `${title.toLowerCase().replace(/\s+/g, " ")}|${date}`;
    const current = bySession.get(key);
    if (!current) {
      bySession.set(key, rec);
      continue;
    }
    // Richer row wins; on a tie the newer submission does.
    const better =
      richness(f) - richness(current.fields) ||
      rec.createdTime.localeCompare(current.createdTime);
    if (better > 0) bySession.set(key, rec);
  }

  const events: PartnerEvent[] = [];

  for (const rec of bySession.values()) {
    const f = rec.fields;
    const kindInfo = KINDS[str(f[FIELDS.typeOfEvent]) as keyof typeof KINDS];
    const accessInfo = ACCESS[str(f[FIELDS.accessType]) as keyof typeof ACCESS];
    const date = str(f[FIELDS.datePrimary]) || str(f[FIELDS.dateSecondary]);

    events.push({
      id: rec.id,
      title: str(f[FIELDS.title]),
      company: str(f[FIELDS.company]),
      kind: kindInfo.kind,
      kindLabel: kindInfo.label,
      color: kindInfo.color,
      date: date || null,
      dateLabel: date ? formatDate(date) : null,
      accessKind: accessInfo?.accessKind ?? null,
      accessLabel: accessInfo?.accessLabel ?? null,
      description: str(f[FIELDS.description]) || null,
      registerUrl: str(f[FIELDS.registerUrl]) || null,
      // Presence is checked against the attachment cell, but the URL served is the stable
      // proxy — raw signed Airtable URLs 410 after ~2h (lib/photo.ts).
      logo: firstAttachment(f[FIELDS.logo]) ? photoUrl("partner-events", rec.id) : null,
    });
  }

  // Chronological, undated last (a partner who never set a date shouldn't lead the page),
  // then alphabetical so same-day events have a stable order.
  events.sort((a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    }
    return a.title.localeCompare(b.title);
  });

  return events;
}
