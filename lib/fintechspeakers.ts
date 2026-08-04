// Server-only access to the Future of Fintech people — the speaker-submission view on the
// Future of Fintech table. The table is form data and holds PII (Email, Phone Number, consent
// checkboxes); ONLY the allow-listed marketing fields below are ever requested, so none of that
// can leak.
//
// THREE ROLES, kept apart rather than filtered away (Auri, 2026-08-04). This lib used to serve
// only `Role = "Speaker"` and drop the rest on the floor, which is why the two moderators and
// the keynote were invisible even though the team had filled them in months ago. All three come
// back now with `role` attached, and the ROUTE decides which to serve — defaulting to Speaker,
// so anything already embedded on techbbq.dk keeps the shape it has.
//
// Order = the curated `Hierarchy ` column, which is TEXT: "1".."9" on speakers, "1.1"/"1.2" on
// the moderators (someone numbered them expecting exactly this separation) and the word
// "Keynote" on the keynote row. Parsed as a FLOAT for that reason — parseInt would read both
// moderators as 1 and lose their order.
//
// Publish rule: name + photo + a non-empty `Hierarchy ` cell. That last one is the gate Auri
// added on 2026-08-04: someone with no hierarchy has not been placed yet and does not go on the
// site. It also means a fresh form submission cannot appear on techbbq.dk before a human has
// looked at it, which is the same instinct as `On Website?` on the speakers table.

import { fetchWithTimeout } from "@/lib/http";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { photoUrl } from "@/lib/photo";
import { firstAttachmentId, firstPhoto, str } from "@/lib/fields";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
// Pinned in code on purpose (stable Airtable ids, not secrets — see lib/niss.ts).
const TABLE = "tbleh7Lqv1zMQaUKx"; // Future of Fintech
const VIEW = "viwsqDRAVlgJh3STT"; // speaker submissions

// `Role ` and `Hierarchy ` really have trailing spaces in Airtable — don't "fix" them.
const SAFE_FIELDS = ["Name", "Job title", "Company Name", "LinkedIn", "Attachments", "Role ", "Hierarchy "];

// The roles this view actually contains, as an allow-list. Anything else is a form row nobody
// has classified yet and is logged rather than published — the same instinct as every other gate
// in this repo: an unrecognised value must not become a public card by default.
export const FINTECH_ROLES = ["Speaker", "Moderator", "Keynote Speaker"] as const;
export type FintechRole = (typeof FINTECH_ROLES)[number];

export type FintechSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  // Curated order: 1..9 for speakers, 1.1/1.2 for moderators. null only where the cell holds
  // text rather than a number, which today is the keynote row ("Keynote Speaker"); a BLANK cell
  // is not published at all, so this is never null for want of curation.
  hierarchy: number | null;
  role: FintechRole;
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

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
      const role = str(f["Role "]) as FintechRole;
      if (!FINTECH_ROLES.includes(role)) {
        if (str(f["Name"])) {
          console.warn(
            `[fintech-speakers] unknown Role ${JSON.stringify(str(f["Role "]))} on "${str(f["Name"])}" — not published`
          );
        }
        continue;
      }
      const name = str(f["Name"]);
      const photo = firstPhoto(f["Attachments"]);
      if (!name || !photo) continue;

      // A BLANK Hierarchy cell means the team has not placed this person yet, and an unplaced
      // person is not published (Auri, 2026-08-04). It used to sort them to the end of the
      // grid instead, which put whoever submitted the form most recently on techbbq.dk before
      // anyone had decided they belonged there.
      //
      // The test is "is the cell empty", NOT "is it a number". The keynote row carries the text
      // "Keynote Speaker" rather than a digit — that is a curated row with a deliberate value in
      // it, and a numeric test would have quietly emptied the Keynote tab.
      const rankText = str(f["Hierarchy "]);
      if (!rankText) {
        console.warn(
          `[fintech-speakers] "${name}" (${str(f["Company Name"])}, ${role}) has no Hierarchy — not published. Give it a number in Airtable to publish.`
        );
        continue;
      }
      // Float, not int: the moderators are numbered 1.1 and 1.2.
      const rank = parseFloat(rankText);
      people.push({
        id: rec.id,
        name,
        title: str(f["Job title"]),
        company: str(f["Company Name"]),
        // Stable proxy URL — raw signed attachment URLs expire in ~2h (lib/photo.ts).
        photo: photoUrl("fintech", rec.id, undefined, firstAttachmentId(f["Attachments"])),
        linkedin: normalizeLinkedInUrl(f["LinkedIn"]),
        hierarchy: Number.isFinite(rank) ? rank : null,
        role,
      });
    }
    offset = data.offset;
  } while (offset);

  const deduped = dedupe(people);

  // Curated first, unranked after (alphabetical).
  deduped.sort((a, b) => {
    if (a.hierarchy === null && b.hierarchy === null) return a.name.localeCompare(b.name);
    if (a.hierarchy === null) return 1;
    if (b.hierarchy === null) return -1;
    return a.hierarchy - b.hierarchy;
  });
  return deduped;
}

/**
 * One card per person. This is a FORM table and people submit it twice: Jens Grønlund (Norlix)
 * was in the live feed twice on 2026-08-04, once ranked 5 and once unranked, so the page showed
 * him twice. Every other lib that reads form data already collapses resubmissions; this one
 * never did.
 *
 * The ranked row wins, because a hierarchy is something a human typed on purpose. On a tie the
 * fuller row wins. Collisions are logged with both record ids so the source can be cleaned —
 * this hides the symptom, it does not fix the table.
 */
function dedupe(people: FintechSpeaker[]): FintechSpeaker[] {
  const key = (p: FintechSpeaker) =>
    `${p.role}|${p.name.toLowerCase().replace(/\s+/g, " ").trim()}|${p.company.toLowerCase().trim()}`;
  const weight = (p: FintechSpeaker) =>
    (p.hierarchy !== null ? 2 : 0) + (p.title ? 1 : 0) + (p.linkedin ? 1 : 0);

  const best = new Map<string, FintechSpeaker>();
  for (const p of people) {
    const k = key(p);
    const current = best.get(k);
    if (!current) {
      best.set(k, p);
      continue;
    }
    const winner = weight(p) > weight(current) ? p : current;
    console.warn(
      `[fintech-speakers] duplicate submission for "${p.name}" (${p.company}): ` +
        `${current.id} and ${p.id} — keeping ${winner.id}. Delete the extra row in Airtable.`
    );
    best.set(k, winner);
  }
  return [...best.values()];
}
