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
import { firstAttachmentId, str } from "@/lib/fields";

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
  timeSlot: "fldhN0f81UfgVpseR", // Time slot (singleLineText, free text — see parseTimeSlot)
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
  // "09:30-11:30", normalized from the free-text `Time slot` cell. null when the cell is
  // empty OR when what someone typed could not be read (see parseTimeSlot).
  timeSlot: string | null;
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

// ─── TIME SLOT PARSING ──────────────────────────────────────────────────────────────
// `Time slot` is free text typed by hand, and the malformed values are not hypothetical:
// this base has already shipped `13:30-14-30` (NISS) and `'10:00–10:10\n'` (Future of
// Fintech) to techbbq.dk, because the only check anywhere was "is the cell non-empty".
// So this parser is strict about the OUTPUT and forgiving about the INPUT: it accepts the
// separators and hour formats people actually type (`9.30 - 11.00`, en dash, stray
// newlines) and always emits one shape, `09:30-11:30`. Anything it cannot read with
// confidence becomes null and is logged rather than rendered — a card with no time is a
// gap the team can fill, a card showing `13:30-14-30` is a public defect.
//
// The dash stays a plain hyphen on purpose (no en dash): Auri's UI rule bans long dashes,
// and a mix of both is exactly the inconsistency this normalizes away.
//
// It also finds the range inside a longer string rather than demanding the cell hold
// nothing else, because the planning sheet writes its cells as `Day 1 - 12:30-17:30` and
// `Day 2 (09:30-13:00)` and someone WILL paste one of those in whole. That tolerance is
// safe precisely because it insists on finding EXACTLY ONE range: two ranges is a cell
// holding two sessions, and picking either one would publish a confident wrong answer.
const TIME_SLOT_RE = /(\d{1,2})[:.](\d{2})\s*(?:-|–|—|to)\s*(\d{1,2})[:.](\d{2})/gi;

export type TimeSlot = { label: string; startMinutes: number };

function parseTimeSlot(raw: string, context: string): TimeSlot | null {
  // Collapse the newlines and doubled spaces that survive a copy-paste out of a sheet.
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const found = [...cleaned.matchAll(TIME_SLOT_RE)];
  if (found.length !== 1) {
    const why = found.length ? `${found.length} time ranges` : "no time range";
    console.warn(
      `[partnerevents] ${why} in Time slot ${JSON.stringify(raw)} on ${context} — dropped`
    );
    return null;
  }

  const m = found[0];
  const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) {
    console.warn(`[partnerevents] impossible Time slot ${JSON.stringify(raw)} on ${context}`);
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    label: `${pad(h1)}:${pad(m1)}-${pad(h2)}:${pad(m2)}`,
    startMinutes: h1 * 60 + m1,
  };
}

function firstAttachment(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

// `Link to register` is a url field, but Airtable does not enforce that a url field holds a
// url: the Beyond Unicorns row contains the literal text "No link", and this feed published
// it as a registration link. Anything that is not an absolute http(s) URL becomes null and is
// logged, because a Register button that navigates to "No link" is worse than no button.
// Trailing punctuation gets trimmed — a pasted link often arrives with a full stop attached.
function cleanUrl(raw: string): string | null {
  const cleaned = raw.trim().replace(/[.,;)]+$/, "");
  return cleaned && /^https?:\/\/\S+$/i.test(cleaned) ? cleaned : null;
}

function registerUrl(raw: string, context: string): string | null {
  const cleaned = cleanUrl(raw);
  if (cleaned) return cleaned;
  if (raw.trim()) {
    console.warn(
      `[partnerevents] Link to register is not a URL on ${context}: ${JSON.stringify(raw)} — dropped`
    );
    return null;
  }
  return cleaned;
}

// How much a row actually carries, used to pick a winner among resubmissions of the same
// session. A partner filling in the description + register link later is the common case.
function richness(f: Record<string, unknown>): number {
  return (
    (str(f[FIELDS.description]) ? 1 : 0) +
    // A real URL only. Scoring "No link" as a filled-in link would let a weaker row beat the
    // one that actually carries the sign-up page.
    (cleanUrl(str(f[FIELDS.registerUrl])) ? 1 : 0) +
    // Duplicate submissions exist (Nordic IPO has two rows for the same day); whichever
    // copy the time was typed into should be the one that wins.
    (str(f[FIELDS.timeSlot]) ? 1 : 0) +
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
  // Kept alongside the events only to sort same-day cards by start time; the minutes are
  // an implementation detail and never reach the JSON.
  const startMinutes = new Map<string, number>();

  for (const rec of bySession.values()) {
    const f = rec.fields;
    const kindInfo = KINDS[str(f[FIELDS.typeOfEvent]) as keyof typeof KINDS];
    const accessInfo = ACCESS[str(f[FIELDS.accessType]) as keyof typeof ACCESS];
    const date = str(f[FIELDS.datePrimary]) || str(f[FIELDS.dateSecondary]);
    const title = str(f[FIELDS.title]);
    const slot = parseTimeSlot(str(f[FIELDS.timeSlot]), `${rec.id} "${title}"`);
    if (slot) startMinutes.set(rec.id, slot.startMinutes);

    events.push({
      id: rec.id,
      title,
      company: str(f[FIELDS.company]),
      kind: kindInfo.kind,
      kindLabel: kindInfo.label,
      color: kindInfo.color,
      date: date || null,
      dateLabel: date ? formatDate(date) : null,
      timeSlot: slot?.label ?? null,
      accessKind: accessInfo?.accessKind ?? null,
      accessLabel: accessInfo?.accessLabel ?? null,
      description: str(f[FIELDS.description]) || null,
      registerUrl: registerUrl(str(f[FIELDS.registerUrl]), `${rec.id} "${title}"`),
      // Presence is checked against the attachment cell, but the URL served is the stable
      // proxy — raw signed Airtable URLs 410 after ~2h (lib/photo.ts).
      logo: firstAttachment(f[FIELDS.logo])
        ? photoUrl("partner-events", rec.id, undefined, firstAttachmentId(f[FIELDS.logo]))
        : null,
    });
  }

  // Chronological, undated last (a partner who never set a date shouldn't lead the page),
  // then by start time within the day, then alphabetical. Events without a time sort after
  // the timed ones on the same day for the same reason the undated ones sort last: a card
  // the team has not scheduled yet should not sit above one they have.
  events.sort((a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    }
    const ta = startMinutes.get(a.id);
    const tb = startMinutes.get(b.id);
    if (ta !== tb) {
      if (ta === undefined) return 1;
      if (tb === undefined) return -1;
      return ta - tb;
    }
    return a.title.localeCompare(b.title);
  });

  return events;
}
