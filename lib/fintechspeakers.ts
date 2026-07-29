// Server-only access to the Future of Fintech speakers — the speaker-submission view
// on the Future of Fintech table. The table is form data and holds PII (Email, Phone
// Number, consent checkboxes); ONLY the allow-listed marketing fields below are ever
// requested, so none of that can leak.
//
// Only rows with Role = "Speaker" are served (Auri, 2026-07-29: keynote speaker and
// moderator are not shown for now). Order = the curated `Hierarchy ` column, which is
// TEXT here: "1".."9" on speakers, role names on the keynote/moderator rows.
// Publish rule: name + photo, like every other feed.

import { fetchWithTimeout } from "@/lib/http";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned in code on purpose (stable Airtable ids, not secrets — see lib/niss.ts).
const TABLE = "tbleh7Lqv1zMQaUKx"; // Future of Fintech
const VIEW = "viwsqDRAVlgJh3STT"; // speaker submissions

// `Role ` and `Hierarchy ` really have trailing spaces in Airtable — don't "fix" them.
const SAFE_FIELDS = ["Name", "Job title", "Company Name", "LinkedIn", "Attachments", "Role ", "Hierarchy "];

export type FintechSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  // Curated order 1..9; null = unranked (sorts last, alphabetical).
  hierarchy: number | null;
};

type AirtableAttachment = { url: string; thumbnails?: { large?: { url: string } } };
type AirtableRecord = { id: string; fields: Record<string, unknown> };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function firstPhoto(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const att = v[0] as AirtableAttachment;
  return att?.thumbnails?.large?.url || att?.url || null;
}

export class FintechSpeakersError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchFintechSpeakers(): Promise<FintechSpeaker[]> {
  if (!TOKEN || !BASE_ID) {
    throw new FintechSpeakersError("Airtable env vars are not set on the server.", 503);
  }

  const people: FintechSpeaker[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("view", VIEW);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[fintech-speakers] fetch failed", res.status, detail);
      throw new FintechSpeakersError("Could not reach the fintech speakers source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const rec of data.records) {
      const f = rec.fields;
      // Values carry trailing spaces ("Speaker ", "Keynote Speaker ") — trim first.
      if (str(f["Role "]) !== "Speaker") continue;
      const name = str(f["Name"]);
      const photo = firstPhoto(f["Attachments"]);
      if (!name || !photo) continue;
      const rankNum = parseInt(str(f["Hierarchy "]), 10);
      people.push({
        id: rec.id,
        name,
        title: str(f["Job title"]),
        company: str(f["Company Name"]),
        photo,
        linkedin: normalizeLinkedInUrl(f["LinkedIn"]),
        hierarchy: Number.isFinite(rankNum) ? rankNum : null,
      });
    }
    offset = data.offset;
  } while (offset);

  // Curated 1..9 first, unranked after (alphabetical).
  people.sort((a, b) => {
    if (a.hierarchy === null && b.hierarchy === null) return a.name.localeCompare(b.name);
    if (a.hierarchy === null) return 1;
    if (b.hierarchy === null) return -1;
    return a.hierarchy - b.hierarchy;
  });
  return people;
}
