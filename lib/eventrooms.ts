// Server-only access to the partner Event Room presenters — the "2026 Side event and
// event room info" view on Partnership Success. Same safety rules as lib/niss.ts: the
// token never leaves the server and only an allow-list of safe fields is requested.
// Emails, session descriptions and every other Partnership Success field stay private.
//
// Shape of the source: one row per partner submission. Presenters live in five flat
// text fields ("Name: X\nPosition: Y\nCompany: Z" per slot) with a matching photo
// attachment field each. Partners resubmit the whole form when their lineup changes,
// so a Partner ID can have several rows — the NEWEST row with at least one presenter
// wins (verified: Creative Business Network 07-28 5-presenter row supersedes the 07-22
// 3-presenter one; Flatpay's 07-21 row supersedes an empty 06-30 one).

import { fetchWithTimeout } from "@/lib/http";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { photoUrl } from "@/lib/photo";
import { firstAttachmentId, firstPhoto, str } from "@/lib/fields";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned in code on purpose (stable Airtable ids, not secrets — see lib/niss.ts).
const TABLE = "tbllvkwLhB4Omdphd"; // Partnership Success
const VIEW = "viwcC25ENg2ELGszH"; // 2026 Side event and event room info
// Marketing assigns each event-room speaker a room by creating a row here with
// Project Name = "Event Room 1".."Event Room 6". Joined by normalized person name.
const MARKETING_TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
// Wide 3k+ row table — same scan risk as lib/investors.ts, give the filter scan 10s.
const MARKETING_TIMEOUT_MS = 10_000;
// Overflow speakers ("More than 5" partners submit one row PER SPEAKER via the More
// Event Room Speakers form). The row's `Company` field holds the PARTNER ID as text —
// that's the join key back to the event-room row, which gives the hosting company.
const OVERFLOW_VIEW = "viw8pHmY9hNN8z7Zn";

// Only rows with this event type are event rooms; the view also holds Side Events.
const EVENT_ROOM_TYPE = "Event Room at TechBBQ";

// The 1st–5th field names are NOT uniform in Airtable (details/Details, Presenter/
// Presenters) — these are the exact strings, don't "fix" them.
const SLOTS = [
  { details: "1st Presenters details", photo: "1st Presenters Photo" },
  { details: "2nd Presenter Details", photo: "2nd Presenters Photo" },
  { details: "3rd Presenter details", photo: "3rd Presenters Photo" },
  { details: "4th Presenter details", photo: "4th Presenters Photo" },
  { details: "5th Presenters details", photo: "5th Presenters Photo" },
];

const SAFE_FIELDS = [
  "Company",
  "Partner ID",
  "Type of Event",
  "Created",
  ...SLOTS.flatMap((s) => [s.details, s.photo]),
];

// Overflow rows reuse some field names with different meanings: `Presenter Details`
// holds just the speaker's NAME there, and `Company` holds the partner id.
const OVERFLOW_FIELDS = [
  "Company",
  "Presenter Details",
  "Presenters Position in the Company",
  "Presenters Company",
  "Presenters Profile Picture",
  "LinkedIn Handle",
];

export type EventRoomPresenter = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  // The 1st–5th slot fields carry no LinkedIn; the overflow form does (LinkedIn Handle).
  linkedin: string | null;
  // The PRIMARY partner whose event room the person presents at (the row's Company). Kept
  // alongside `hosts` so anything reading a single host — the pasted embeds included — is
  // unaffected.
  host: string;
  // EVERY partner they present for, in the order the rows were read. Usually one. A presenter
  // booked by two partners used to be two cards with two uploads of the same face; one person is
  // one card now, and the card names both (Auri, 2026-08-05).
  hosts: string[];
  // "Event Room 1".."Event Room 6" once marketing assigns the person a room in the
  // Marketing Project Overview table; null until then (cards fall back to `host`).
  room: string | null;
  // Every room they appear in, same reasoning as `hosts`. Nulls are dropped, so this can be
  // shorter than `hosts` (or empty) while a room assignment is still missing.
  rooms: string[];
};

type AirtableRecord = { id: string; createdTime: string; fields: Record<string, unknown> };

// Parse one "Name: X\nPosition: Y\nCompany: Z" blob. The submissions are messy
// ("Name:, Adrian", "Name::Anna", "Name:Safa Serif ", missing spaces), so match the
// label loosely and strip any colon/comma soup after it.
function parseDetails(blob: string): { name: string; title: string; company: string } {
  const out = { name: "", title: "", company: "" };
  for (const rawLine of blob.split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = line.match(/^(name|position|company)[\s:,]+(.*)$/i);
    if (!m) continue;
    const value = m[2].trim();
    const label = m[1].toLowerCase();
    if (label === "name" && !out.name) out.name = value;
    if (label === "position" && !out.title) out.title = value;
    if (label === "company" && !out.company) out.company = value;
  }
  // Fallback for the form's suggested one-liner "NAME (POSITION, COMPANY)".
  if (!out.name) {
    const m = blob.trim().match(/^([^(\n]+)\(([^,)]+)(?:,\s*([^)]+))?\)/);
    if (m) {
      out.name = m[1].trim();
      out.title = (m[2] || "").trim();
      out.company = (m[3] || "").trim();
    }
  }
  return out;
}

export class EventRoomsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchView(view: string, fields: string[]): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("pageSize", "100");
    for (const field of fields) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[eventrooms] fetch failed", view, res.status, detail);
      throw new EventRoomsError("Could not reach the event rooms source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

// Host partner → room number, from the Event Rooms planning sheet (2026-07-29 state:
// room 1 = Erhvervshus Sjælland + Boardway, 3 = Flatpay + FBV + Nvidia/AWS,
// 4 = Microsoft + Industriens Fond + Play&Plug, 5 = Creative Business Network + Google,
// 2 and 6 are TechBBQ's own programs). Keys are normalized (lowercase, trimmed) and
// matched by substring both ways so "Ehvervshus Sjælland" (form typo) still hits
// "erhvervshus sjælland". Update here when the sheet moves an event.
const HOST_ROOMS: [string, number][] = [
  ["erhvervshus sjælland", 1],
  ["ehvervshus sjælland", 1],
  ["boardway", 1],
  ["flatpay", 3],
  ["fbv", 3],
  ["microsoft", 4],
  ["creative business network", 5],
];

// The reverse test (key.includes(h)) exists for hosts written shorter than the key
// ("Creative Business" vs "creative business network"), but it needs a floor: a
// one-or-two-character host would otherwise match half the table ("fbv".includes("f")).
const MIN_REVERSE_MATCH = 4;

function roomFromHost(host: string): string | null {
  const h = host.toLowerCase().trim();
  if (!h) return null;
  for (const [key, n] of HOST_ROOMS) {
    if (h.includes(key)) return `Event Room ${n}`;
    if (h.length >= MIN_REVERSE_MATCH && key.includes(h)) return `Event Room ${n}`;
  }
  return null;
}

// Which `Project Name` values count as a room assignment.
//
// This used to be `/^Event Room [1-6]$/`, a single digit, and the Policy Stage broke it: it runs
// across rooms 5, 6 and 7, so marketing added an "Event Room 5,6,7" option and filed 31 people under
// it (2026-08-05). Every one of them was silently dropped here and their cards fell back to reading
// "Danish Entrepreneurs" — the partner's name where a room should be.
//
// A comma list is therefore first-class. Written loosely on the digits on purpose: the numbers are a
// venue's business and a "7" or an "8" appearing next year must not need a code change to be seen.
const ROOM_PROJECT = /^Event Room \d+(\s*,\s*\d+)*$/;

// Normalized person name → the room label, from the marketing rows. A failure here
// only loses the room labels (cards fall back to the host name), never the people.
async function fetchRoomAssignments(): Promise<Map<string, string>> {
  const rooms = new Map<string, string>();
  // Paginated like every other fetch in this repo. It used to read only the first page:
  // Airtable caps a response at pageSize (100) and returns an `offset` for the rest, so
  // the moment marketing assigned a 101st person to a room, that person silently lost
  // their room label and fell back to the hosting partner's name.
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `FIND('Event Room ',{Project Name})=1`);
    params.set("pageSize", "100");
    params.append("fields[]", "Full Name");
    params.append("fields[]", "Project Name");
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${MARKETING_TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" },
      MARKETING_TIMEOUT_MS
    );
    if (!res.ok) {
      console.error("[eventrooms] room-assignment fetch failed", res.status, await res.text());
      return rooms; // partial map is fine — cards fall back to the host name
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const name = str(rec.fields["Full Name"]).toLowerCase().replace(/\s+/g, " ");
      const project = str(rec.fields["Project Name"]);
      if (name && ROOM_PROJECT.test(project)) rooms.set(name, project);
    }
    offset = data.offset;
  } while (offset);

  return rooms;
}

export async function fetchEventRoomPresenters(): Promise<EventRoomPresenter[]> {
  if (!TOKEN || !BASE_ID) {
    throw new EventRoomsError("Airtable env vars are not set on the server.", 503);
  }

  const [records, overflow, roomsByName] = await Promise.all([
    fetchView(VIEW, SAFE_FIELDS),
    fetchView(OVERFLOW_VIEW, OVERFLOW_FIELDS),
    fetchRoomAssignments().catch((err) => {
      console.error("[eventrooms] room assignments unavailable", err);
      return new Map<string, string>();
    }),
  ]);
  // Person-level marketing assignment wins; the planning-sheet host map fills the rest.
  const roomFor = (name: string, host: string): string | null =>
    roomsByName.get(name.toLowerCase().replace(/\s+/g, " ")) ?? roomFromHost(host);

  // Partner ID → hosting company, from every event-room row (presenter-less ones too —
  // Danish Entrepreneurs' own row has no slots but names the host for their overflow).
  const hostByPartner = new Map<string, string>();
  for (const rec of records) {
    if (str(rec.fields["Type of Event"]) !== EVENT_ROOM_TYPE) continue;
    const partnerId = String(rec.fields["Partner ID"] ?? "");
    const company = str(rec.fields["Company"]);
    if (partnerId && company && !hostByPartner.has(partnerId)) hostByPartner.set(partnerId, company);
  }

  // Event Room rows only, then one winning row per Partner ID: the newest submission
  // that actually carries presenters. Rows with zero filled slots never win (they're
  // usually the partner's first, presenter-less submission).
  const byPartner = new Map<string, AirtableRecord>();
  for (const rec of records) {
    if (str(rec.fields["Type of Event"]) !== EVENT_ROOM_TYPE) continue;
    const hasPresenters = SLOTS.some((s) => str(rec.fields[s.details]));
    if (!hasPresenters) continue;
    const key = String(rec.fields["Partner ID"] ?? rec.id);
    const current = byPartner.get(key);
    if (!current || rec.createdTime > current.createdTime) byPartner.set(key, rec);
  }

  const people: EventRoomPresenter[] = [];
  // One entry per person per event room: the overflow form takes one row per SESSION,
  // so the same speaker can appear several times (Peter Kofler is in five sessions).
  const seen = new Set<string>();
  const personKey = (host: string, name: string) =>
    `${host.toLowerCase()}|${name.toLowerCase().replace(/\s+/g, " ")}`;

  for (const rec of byPartner.values()) {
    const host = str(rec.fields["Company"]);
    SLOTS.forEach((slot, i) => {
      const blob = str(rec.fields[slot.details]);
      if (!blob) return;
      const { name, title, company } = parseDetails(blob);
      const photo = firstPhoto(rec.fields[slot.photo]);
      // Same publish rule as NISS/NASS: no name or no photo, no card.
      if (!name || !photo || seen.has(personKey(host, name))) return;
      seen.add(personKey(host, name));
      people.push({
        id: `${rec.id}-${i + 1}`,
        name,
        title,
        company,
        // Stable proxy URL pinned to this slot's photo field via the index (?f=i) —
        // raw signed attachment URLs expire in ~2h (lib/photo.ts).
        photo: photoUrl("event-rooms", rec.id, i, firstAttachmentId(rec.fields[slot.photo])),
        linkedin: null,
        host,
        hosts: [host],
        room: roomFor(name, host),
        rooms: [roomFor(name, host)].filter((r): r is string => Boolean(r)),
      });
    });
  }

  for (const rec of overflow) {
    const f = rec.fields;
    // Overflow field meanings differ from the main view: Presenter Details = the NAME,
    // Company = the partner id (join key to the host).
    const name = str(f["Presenter Details"]);
    const photo = firstPhoto(f["Presenters Profile Picture"]);
    const host = hostByPartner.get(str(f["Company"])) ?? "Event Room";
    if (!name || !photo || seen.has(personKey(host, name))) continue;
    seen.add(personKey(host, name));
    people.push({
      id: rec.id,
      name,
      title: str(f["Presenters Position in the Company"]),
      company: str(f["Presenters Company"]),
      // Overflow rows keep their photo in the 6th registered field (index 5).
      photo: photoUrl("event-rooms", rec.id, 5, firstAttachmentId(f["Presenters Profile Picture"])),
      linkedin: normalizeLinkedInUrl(f["LinkedIn Handle"]),
      host,
      hosts: [host],
      room: roomFor(name, host),
      rooms: [roomFor(name, host)].filter((r): r is string => Boolean(r)),
    });
  }

  people.sort((a, b) => a.name.localeCompare(b.name));
  return mergeByPerson(people);
}

/**
 * ONE PERSON, ONE CARD, even when two partners booked them.
 *
 * The `seen` set above already collapses a presenter who appears in five sessions of the SAME
 * partner's room. What it cannot collapse is the same presenter under TWO partners, because those
 * are legitimately different rows with different photo uploads — and the result was two cards
 * showing the same face (Auri, 2026-08-05).
 *
 * Keyed on the NAME alone. The first row wins the identity, since `people` is already sorted and
 * the main view is read before the overflow, so the choice is stable across requests. The host and
 * room LISTS are unioned, so nothing about where they speak is lost by picking one row.
 *
 * A namesake collision would merge two different people. With 97 presenters that has not happened,
 * and the alternative — keying on name + company — would fail to merge the real case whenever a
 * partner types the company differently on the second submission, which these forms do constantly.
 */
function mergeByPerson(people: EventRoomPresenter[]): EventRoomPresenter[] {
  const byName = new Map<string, EventRoomPresenter>();
  for (const p of people) {
    const key = p.name.toLowerCase().replace(/\s+/g, " ").trim();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, p);
      continue;
    }
    prev.hosts = [...new Set([...prev.hosts, ...p.hosts])];
    prev.rooms = [...new Set([...prev.rooms, ...p.rooms])];
    // A LinkedIn URL only ever arrives on an overflow row, so the merge is the only chance the
    // main-view card has of getting one.
    prev.linkedin = prev.linkedin ?? p.linkedin;
    // Same for the room: the primary should name a real room rather than stay null when the other
    // row has one.
    prev.room = prev.room ?? p.room;
  }
  return [...byName.values()];
}
