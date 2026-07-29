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

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned in code on purpose (stable Airtable ids, not secrets — see lib/niss.ts).
const TABLE = "tbllvkwLhB4Omdphd"; // Partnership Success
const VIEW = "viwcC25ENg2ELGszH"; // 2026 Side event and event room info

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

export type EventRoomPresenter = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  // The source form has no LinkedIn field; kept null so cards render as plain cards.
  linkedin: null;
  // Which partner's event room the person presents at (the row's Company).
  host: string;
};

type AirtableAttachment = { url: string; thumbnails?: { large?: { url: string } } };
type AirtableRecord = { id: string; createdTime: string; fields: Record<string, unknown> };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function firstPhoto(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const att = v[0] as AirtableAttachment;
  return att?.thumbnails?.large?.url || att?.url || null;
}

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

export async function fetchEventRoomPresenters(): Promise<EventRoomPresenter[]> {
  if (!TOKEN || !BASE_ID) {
    throw new EventRoomsError("Airtable env vars are not set on the server.", 503);
  }

  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("view", VIEW);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[eventrooms] fetch failed", res.status, detail);
      throw new EventRoomsError("Could not reach the event rooms source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

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
  for (const rec of byPartner.values()) {
    const host = str(rec.fields["Company"]);
    SLOTS.forEach((slot, i) => {
      const blob = str(rec.fields[slot.details]);
      if (!blob) return;
      const { name, title, company } = parseDetails(blob);
      const photo = firstPhoto(rec.fields[slot.photo]);
      // Same publish rule as NISS/NASS: no name or no photo, no card.
      if (!name || !photo) return;
      people.push({ id: `${rec.id}-${i + 1}`, name, title, company, photo, linkedin: null, host });
    });
  }

  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}
