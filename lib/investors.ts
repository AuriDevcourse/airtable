// Server-only: investor speakers for the European Growth Pension & Insurance Summit,
// the LP Forum, TechBBQ Investor Day and the Nordic Family Office Summit. Same source as the Main Page 12 — the
// "Marketing Project Overview" table (tblTecOBecLQCNIeD), rows whose Project Name is
// one of those events. Only the
// allow-listed marketing fields below are ever requested; the table is wide and holds
// unrelated internal project data, none of it is read here.

import { fetchWithTimeout } from "@/lib/http";
import { photoUrl } from "@/lib/photo";
import { firstAttachmentId, firstPhoto, linkedinUrl, num, str } from "@/lib/fields";

const API = "https://api.airtable.com/v0";

// Pinned Airtable id (stable, not a secret) — same table lib/mainpage.ts reads.
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview

// Short URL-safe keys → the exact Project Name single-select options in Airtable.
// The keys are what ?event= accepts; the values are what the filter formula matches.
export const INVESTOR_EVENTS = {
  "pension-summit": "European Growth Pension & Insurance Summit",
  "lp-forum": "LP Forum",
  "investor-day": "TechBBQ Investor Day",
  // Added 2026-08-13: the Nordic Family Office Summit rows are now filed in the CRM under
  // their own Project Name option, so the feed reads them like the other three.
  "family-office": "Nordic Family Office Summit",
} as const;
export type InvestorEventKey = keyof typeof INVESTOR_EVENTS;

// filterByFormula scans the whole (3k+ row, wide) table, so like the main-page fetch it
// can spike past the default 8s timeout on a cold Airtable. 10s per attempt, retry once.
const TIMEOUT_MS = 10_000;
const ATTEMPTS = 2;

const SAFE_FIELDS = [
  "Full Name",
  "Job Title",
  "Company",
  "Profile Picture",
  "Link to LinkedIn",
  "LinkedIn Handle",
  "Hierarchy",
  "Project Name",
];

export type InvestorSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  // The PRIMARY event, as the short key ("pension-summit"). Kept alongside `events` so anything
  // that already reads a single event — the pasted embeds included — keeps working unchanged.
  event: string;
  // EVERY event this person speaks at, in the order INVESTOR_EVENTS declares them. Usually one.
  // Yoram Wijngaarde (Dealroom) speaks at both the LP Forum and the Pension & Insurance Summit,
  // and he used to be two cards with two different photos of the same man (Auri, 2026-08-05).
  // One person is one card; the card names both events.
  events: string[];
  // Curated importance from the same table (1 = first); blanks sort last.
  hierarchy: number;
  // Set only when the row has no Profile Picture. The DASHBOARD asks for these (?pending=1) and
  // draws a "no photo in Airtable" tile carrying the person's name and title, so the gap is a
  // visible worklist instead of a silent omission. The public feed never returns them, so what
  // techbbq.dk renders is unchanged: a card with no face is not something to publish.
  // Same shape and same reasoning as `pending` on the partner wall (lib/partners.ts).
  pending?: "no-photo";
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

// First value that normalizes to a working LinkedIn URL wins (handles www./scheme-less/
// mobile variants; a bare non-URL handle still never renders as a broken href).

function eventKey(projectName: string): string {
  for (const [key, name] of Object.entries(INVESTOR_EVENTS)) {
    if (name === projectName) return key;
  }
  return "";
}

function mapRecord(rec: AirtableRecord): InvestorSpeaker {
  const f = rec.fields;
  return {
    id: rec.id,
    name: str(f["Full Name"]),
    title: str(f["Job Title"]),
    company: str(f["Company"]),
    // Stable proxy URL — raw signed attachment URLs expire in ~2h (lib/photo.ts).
    photo: firstPhoto(f["Profile Picture"])
      ? photoUrl("marketing", rec.id, undefined, firstAttachmentId(f["Profile Picture"]))
      : null,
    linkedin: linkedinUrl(f["Link to LinkedIn"], f["LinkedIn Handle"]),
    event: eventKey(str(f["Project Name"])),
    events: [eventKey(str(f["Project Name"]))].filter(Boolean),
    hierarchy: num(f["Hierarchy"]),
    pending: firstPhoto(f["Profile Picture"]) ? undefined : ("no-photo" as const),
  };
}

// Declaration order, so a person at two events always lists them the same way round. Sorting by
// the label would reorder the moment a label is reworded.
const EVENT_ORDER = Object.keys(INVESTOR_EVENTS);

/**
 * ONE PERSON, ONE CARD.
 *
 * Two different duplicates live in this view and both end here:
 *
 *   1. The same person entered twice for the SAME event (Thomas Kristensen ×3). A straight
 *      duplicate; one row wins.
 *   2. The same person speaking at TWO events — Yoram Wijngaarde at the LP Forum and the Pension
 *      & Insurance Summit. That used to be two cards, each with its own upload of the same face.
 *      It is one card now, listing both events (Auri, 2026-08-05).
 *
 * Keyed on the NAME alone, which is what makes case 2 collapse. The row that wins is the one with
 * a LinkedIn URL, then the better hierarchy — but the EVENT LIST is unioned across every row, so
 * choosing an identity never loses the fact that he speaks somewhere else too.
 */
function dedupe(people: InvestorSpeaker[]): InvestorSpeaker[] {
  const byKey = new Map<string, InvestorSpeaker>();
  for (const p of people) {
    const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...p });
      continue;
    }
    const events = [...new Set([...prev.events, ...p.events])].sort(
      (a, b) => EVENT_ORDER.indexOf(a) - EVENT_ORDER.indexOf(b)
    );
    // A ROW WITH A PHOTO ALWAYS BEATS ONE WITHOUT, and it is the first test for a reason: the
    // dashboard now keeps photoless rows, so the same person entered twice — once with a headshot,
    // once without — could otherwise be won by the empty row and render as "no photo in Airtable"
    // while their picture sits in the other row.
    const better =
      (p.photo ? 1 : 0) - (prev.photo ? 1 : 0) ||
      (p.linkedin ? 1 : 0) - (prev.linkedin ? 1 : 0) ||
      (p.hierarchy < prev.hierarchy ? 1 : 0);
    // The winning row supplies the identity — photo, title, LinkedIn — and the merged list
    // supplies the events. `event` follows the list rather than the winner, so the primary is
    // always the earliest of the two by declaration order and cannot flip with the data.
    const identity = better > 0 ? p : prev;
    byKey.set(key, { ...identity, events, event: events[0] ?? identity.event });
  }
  return [...byKey.values()];
}

export class InvestorsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchInvestorsOnce(
  token: string,
  base: string,
  event?: InvestorEventKey,
  includePending = false
): Promise<InvestorSpeaker[]> {
  const people: InvestorSpeaker[] = [];
  let offset: string | undefined;

  const names = event ? [INVESTOR_EVENTS[event]] : Object.values(INVESTOR_EVENTS);
  const formula =
    names.length === 1
      ? `{Project Name}='${names[0]}'`
      : `OR(${names.map((n) => `{Project Name}='${n}'`).join(",")})`;

  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", formula);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${base}/${TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      TIMEOUT_MS
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[investors] fetch failed", res.status, detail);
      throw new InvestorsError("Could not reach the investor-speakers source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const p = mapRecord(rec);
      // NO PORTRAIT, NO CARD ON techbbq.dk — same publish rule as NISS/NASS: uploading a Profile
      // Picture is what makes a person appear, so nobody renders as a grey placeholder in public.
      //
      // The dashboard is the exception (includePending). Dropping these here meant a speaker with
      // no headshot vanished with no trace anywhere: the /investors page could not name who was
      // missing, so nobody knew there was anything to chase. They come back as `pending` rows now,
      // for the dashboard only, and the route below is what keeps them out of the public feed.
      if (!p.name) continue;
      if (p.photo || includePending) people.push(p);
    }
    offset = data.offset;
  } while (offset);

  const unique = dedupe(people);
  // Order by curated Hierarchy (1 first); unranked sink to the end, then by name. Anyone with no
  // photo sorts BELOW everyone else regardless of hierarchy, so the grid reads as the finished
  // roster first and the chase-list after it — the same rule the partner wall uses.
  unique.sort(
    (a, b) =>
      Number(!!a.pending) - Number(!!b.pending) ||
      a.hierarchy - b.hierarchy ||
      a.name.localeCompare(b.name)
  );
  return unique;
}

/**
 * `includePending` keeps the rows with no Profile Picture. ONLY the dashboard passes it, via
 * `?pending=1` + the dashboard password (app/api/investor-speakers/route.ts). Everything else —
 * every pasted embed on techbbq.dk, /all-speakers-2026's combined feed — gets the finished roster.
 */
export async function fetchInvestors(
  event?: InvestorEventKey,
  includePending = false
): Promise<InvestorSpeaker[]> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) {
    throw new InvestorsError("Airtable env vars are not set on the server.", 503);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fetchInvestorsOnce(token, base, event, includePending);
    } catch (err) {
      lastErr = err;
      if (attempt < ATTEMPTS) console.error(`[investors] attempt ${attempt} failed, retrying`, err);
    }
  }
  throw lastErr instanceof InvestorsError
    ? lastErr
    : new InvestorsError("Something went wrong loading investor speakers.", 502);
}
