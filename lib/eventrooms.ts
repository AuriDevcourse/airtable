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

export async function fetchEventRoomPresenters(): Promise<EventRoomPresenter[]> {
  if (!TOKEN || !BASE_ID) {
    throw new EventRoomsError("Airtable env vars are not set on the server.", 503);
  }

  const [records, overflow] = await Promise.all([
    fetchView(VIEW, SAFE_FIELDS),
    fetchView(OVERFLOW_VIEW, OVERFLOW_FIELDS),
  ]);

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
      people.push({ id: `${rec.id}-${i + 1}`, name, title, company, photo, linkedin: null, host });
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
    const link = str(f["LinkedIn Handle"]);
    people.push({
      id: rec.id,
      name,
      title: str(f["Presenters Position in the Company"]),
      company: str(f["Presenters Company"]),
      photo,
      linkedin: link.startsWith("http") ? link : null,
      host,
    });
  }

  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}
