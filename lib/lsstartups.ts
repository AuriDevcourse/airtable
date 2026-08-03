// Server-only access to the Life Science & Deep Tech startups EXHIBITING at TechBBQ 2026.
//
// Same table as lib/lifescience.ts (Life Science Project) but a different view and a
// completely different grain: that lib returns the SPEAKER roster, this one returns the
// exhibiting companies. Keep them separate — one is a person, the other is a company, and
// merging them would force one shape to carry the other's nulls.
//
// ─── SAFETY ─────────────────────────────────────────────────────────────────────────
// This table is the most sensitive one the connector touches. The application view carries
// Email, Phone, a GDPR consent column, third-party-sharing answers, internal Comments, the
// lead owner, the acquisition Source, and the selection decision itself. NONE of that may
// reach the browser. Only the allow-list below is ever requested, so a field added to the
// table in future cannot leak by default — it has to be added here on purpose.
//
// Specifically NOT published, and not by accident:
//   Email / Phone            — personal contact data, no lawful basis to publish
//   Comments / Source        — internal notes about the company
//   status / Confirmation    — the selection decision. `status` is read as the gate below but
//                              never emitted, and `Confirmation` is not even requested:
//                              publishing either would tell every rejected applicant they
//                              were "To be rejected", straight out of a public JSON feed
//   Stakeholder / Title      — the contact PERSON. This page lists companies.

import { fetchWithTimeout } from "@/lib/http";
import { photoUrl } from "@/lib/photo";
import { pickLogo } from "@/lib/logoPick";
import { str } from "@/lib/fields";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned in code on purpose (stable Airtable ids, not secrets — see lib/niss.ts).
const TABLE = "tblvukXfmR7KTFymG"; // Life Science Project
const VIEW = "viwC65YEXxl8iDPzN"; // the 2026 startup applications

const SAFE_FIELDS = [
  "Company",
  "One-liner",
  "Company description",
  "Website",
  "High quality company logo",
  "LS Type", // the three categories
  "Country",
  "Industry Vertical",
  "status", // read as the publish gate, never emitted
];

// THE PUBLISH GATE. Auri: only the confirmed startups.
//
// Two columns could plausibly mean "confirmed", and they are NOT the same set:
//   Confirmation = Selected        24 rows — selected for the programme
//   status       = Confirmed startup  12 rows — has actually confirmed they are coming
// Every Confirmed startup is also Selected, but 8 Selected rows are only "Contacted", 2 are
// "In progress" and 1 has "Declined". Those are pipeline, not exhibitors, so `status` is the
// gate. Cross-tab from the live view, 2026-08-03.
//
// `status` is a MULTI-select, so it arrives as an ARRAY. This bit once already: comparing the
// cell to the string "Confirmed startup" is false for every row (an array is never equal to a
// string), which made the column look empty and sent the first version of this gate to the
// wrong field. Always read it with tags().
//
// The gate fails CLOSED — a blank or unrecognised status is excluded — because the cost of
// showing a rejected applicant on techbbq.dk far exceeds the cost of a confirmed one
// appearing a day late.
const CONFIRMED = "Confirmed startup";

// The three categories, in the order the page shows them. These are the exact `LS Type`
// select options; it is a MULTI-select, so a startup can legitimately be in two and will
// appear under both filters.
export const LS_CATEGORIES = ["Human Health", "Planetary Health", "Deep Tech"] as const;

export type LsStartup = {
  id: string;
  company: string;
  // The short pitch. `One-liner` is the purpose-written one; `Company description` is the
  // longer free-text fallback for the rows that never filled it in.
  pitch: string;
  website: string | null;
  logo: string | null; // /api/photo proxy URL (raw Airtable URLs 410 after ~2h)
  categories: string[]; // subset of LS_CATEGORIES
  country: string;
  verticals: string[];
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

export class LsStartupsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Multi-select cell → a clean string array, dropping blanks. */
function tags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  const s = str(v);
  return s ? [s] : [];
}

// Only the three known categories, in the page's display order rather than Airtable's
// per-record order, so two startups with the same pair of categories read identically.
// An unrecognised option is dropped: the page has no pill for it, so it could only ever
// render as a label nobody can filter by.
function categoriesOf(v: unknown): string[] {
  const set = new Set(tags(v));
  return LS_CATEGORIES.filter((c) => set.has(c));
}

// Airtable url cells are free text. Only http(s) survives, so a stray "www.foo.com" or a
// javascript: URL can never become a live link on techbbq.dk.
// A hostname: at least one dot, a 2+ letter TLD, no spaces. Deliberately strict enough that
// prose cannot pass — "no website yet" has no dot, so it is rejected rather than linked.
const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?$/i;

function safeUrl(v: unknown): string | null {
  const raw = str(v);
  if (!raw) return null;

  // Founders type whatever they like into this cell. The real values include a bare domain
  // ("immunordic.com"), a LinkedIn company page with no scheme, a domain followed by a human
  // note ("walthertx.com (currently under construction — live in a few weeks)"), and plain
  // prose ("no website yet"). Taking the first whitespace-separated token handles the note
  // case; HOSTNAME rejects the prose.
  const token = raw.split(/\s+/)[0].replace(/[),.]+$/, "");
  if (!token) return null;

  if (/^https?:\/\//i.test(token)) return token;
  // Bare host, with or without www. Upgraded to https rather than dropped: four of the
  // fifteen startups wrote their site this way, and dropping them cost real links.
  if (HOSTNAME.test(token)) return `https://${token}`;
  return null;
}

// Whether this record has a logo the browser can actually draw.
//
// Presence in the cell is NOT enough on two counts. Some startups uploaded an Illustrator .ai
// or a CorelDRAW .cdr, which Airtable stores happily and gives no thumbnail, so the proxy
// would serve a valid file no browser can render. And most cells now hold SEVERAL variants of
// the same mark, since Auri added white SVGs alongside the originals.
//
// pickLogo() answers both, and is the SAME function lib/photo.ts uses to choose which bytes
// to serve. Sharing it is the point: if this said "has a logo" while the proxy picked a
// different attachment, the page would render a file this feed never approved.

export async function fetchLsStartups(): Promise<LsStartup[]> {
  if (!TOKEN || !BASE_ID) {
    throw new LsStartupsError("Airtable env vars are not set on the server.", 503);
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
      console.error("[ls-startups] fetch failed", res.status, detail);
      throw new LsStartupsError("Could not reach the Life Science startups source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  const startups: LsStartup[] = [];
  let noCategory = 0;

  for (const rec of records) {
    const f = rec.fields;
    // tags(), not str(): `status` is a multi-select and arrives as an array.
    if (!tags(f["status"]).includes(CONFIRMED)) continue;

    // No company name, no card. One Selected row in the view today is an empty form start.
    const company = str(f["Company"]);
    if (!company) continue;

    // Picked here rather than only inside the proxy, so its id can version the URL below.
    const logo = pickLogo(f["High quality company logo"]);
    const categories = categoriesOf(f["LS Type"]);
    if (categories.length === 0) noCategory++;

    startups.push({
      id: rec.id,
      company,
      pitch: str(f["One-liner"]) || str(f["Company description"]),
      website: safeUrl(f["Website"]),
      // Presence is checked against the attachment cell, but the URL served is the stable
      // proxy — raw signed Airtable URLs 410 after ~2h (lib/photo.ts).
      // The attachment id rides along as ?v= so replacing a logo in Airtable busts every
      // cache immediately instead of waiting out the proxy's 24h max-age.
      logo: logo ? photoUrl("ls-startups", rec.id, undefined, logo.id) : null,
      categories,
      country: str(f["Country"]),
      verticals: tags(f["Industry Vertical"]),
    });
  }

  // A confirmed startup with no category still SHOWS (it is exhibiting either way) but it
  // matches no filter pill, so the gap is logged for whoever maintains the table.
  if (noCategory) {
    console.info(`[ls-startups] ${noCategory} confirmed startup(s) have no LS Type set`);
  }

  startups.sort((a, b) => a.company.localeCompare(b.company));
  return startups;
}
