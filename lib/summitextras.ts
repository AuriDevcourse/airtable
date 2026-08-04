// Server-only: Airtable-only additions to the Speakers 2026 grid.
//
// The Speaker Hub (Supabase) is the primary roster, but sometimes a speaker exists
// only as a "TechBBQ Summit" row in the Airtable Marketing Project Overview (e.g. Ken
// Villum Klause, added 2026-07-29). This reads those rows with the same allow-list
// style as lib/mainpage.ts; lib/hub.ts appends anyone whose name is not already in
// the Hub roster. The daily Hub→Airtable sync matches by the same normalized name, so
// a person can never end up duplicated by the two directions.
//
// Publish rule matches the rest of the connector: no name or no photo, no card.

import { fetchWithTimeout } from "@/lib/http";
import { photoUrl } from "@/lib/photo";
import { firstAttachmentId, firstPhoto, linkedinUrl, str } from "@/lib/fields";

const API = "https://api.airtable.com/v0";

// Pinned Airtable ids (stable, not secrets) — same table lib/hierarchy.ts reads.
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const PROJECT_NAME = "TechBBQ Summit";

// Same wide-table scan risk as the hierarchy/main-page fetches: 10s per attempt, retry.
const TIMEOUT_MS = 10_000;
const ATTEMPTS = 2;

const SAFE_FIELDS = [
  "Full Name",
  "Job Title",
  "Company",
  "Profile Picture",
  "Link to LinkedIn",
  "LinkedIn Handle",
];

// Shaped like a HubSpeaker minus hierarchy (lib/hub.ts joins that from the same table).
export type SummitExtra = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
  location: string;
  role: string;
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

async function fetchOnce(token: string, base: string): Promise<SummitExtra[]> {
  const out: SummitExtra[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `{Project Name}="${PROJECT_NAME}"`);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${base}/${TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      TIMEOUT_MS
    );

    if (!res.ok) {
      console.error("[summit-extras] fetch failed", res.status, await res.text());
      throw new Error(`Airtable summit-extras fetch failed (${res.status})`);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const f = rec.fields;
      const name = str(f["Full Name"]);
      const photo = firstPhoto(f["Profile Picture"]);
      if (!name || !photo) continue;
      out.push({
        id: rec.id,
        name,
        title: str(f["Job Title"]),
        company: str(f["Company"]),
        bio: "", // the marketing table has no bio column
        // Stable proxy URL — raw signed attachment URLs expire in ~2h (lib/photo.ts).
        photo: photoUrl("marketing", rec.id, undefined, firstAttachmentId(f["Profile Picture"])),
        linkedin: linkedinUrl(f["Link to LinkedIn"], f["LinkedIn Handle"]),
        location: "",
        role: "",
      });
    }
    offset = data.offset;
  } while (offset);

  return out;
}

export async function fetchSummitExtras(): Promise<SummitExtra[]> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return [];

  let lastErr: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fetchOnce(token, base);
    } catch (err) {
      lastErr = err;
      if (attempt < ATTEMPTS) console.error(`[summit-extras] attempt ${attempt} failed, retrying`, err);
    }
  }
  throw lastErr;
}
