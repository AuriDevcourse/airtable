// Stable photo URLs for Airtable attachments.
//
// Airtable attachment URLs (airtableusercontent.com) are signed and expire ~2 hours
// after they are issued — after that the CDN answers 410 Gone. Because the JSON feeds
// are cached (memory + Vercel CDN + stale-while-revalidate), raw attachment URLs in
// the feed routinely outlive their signature and every photo on the WordPress embeds
// breaks. Fix: the feeds emit /api/photo/<feed>/<recordId> instead, and that route
// re-resolves a fresh signed URL server-side on demand. The proxy URL never expires,
// so the JSON can be cached indefinitely.
//
// Same safety posture as the rest of lib/: only the attachment fields listed here can
// ever be fetched through the proxy — a request can't name an arbitrary field.

import { fetchWithTimeout } from "@/lib/http";
import { cached, invalidate } from "@/lib/rate-limit";

const API = "https://api.airtable.com/v0";

export type PhotoSource = { table: string; fields: string[] };

// feed key → source table + attachment fields, in priority order (first field with an
// attachment wins, mirroring each feed's original firstPhoto(...) || firstPhoto(...)).
export const PHOTO_SOURCES: Record<string, PhotoSource> = {
  speakers: {
    table: process.env.AIRTABLE_SPEAKERS_TABLE || "Speakers",
    fields: ["Picture", "Headshots For marketing?"],
  },
  // Marketing Project Overview serves /api/main-speakers, /api/investor-speakers and
  // the summit-extras roster — all read the same Profile Picture field.
  marketing: { table: "tblTecOBecLQCNIeD", fields: ["Profile Picture"] },
  fintech: { table: "tbleh7Lqv1zMQaUKx", fields: ["Attachments"] },
  lifescience: { table: "tblvukXfmR7KTFymG", fields: ["Headshot"] },
  nass: { table: "tbl3dTaHrIFrHF6Mo", fields: ["Headshots"] },
  niss: { table: "tblfIPjV4t1c1628h", fields: ["Self Portrait"] },
  "niss-2025": { table: "tblyWVASxceyLRCaL", fields: ["Photo"] },
  team: { table: "tbldWne3PnvebIwif", fields: ["Picture"] },
  // Partnership Success: five per-slot photo fields plus the overflow form's field.
  // Callers pin the slot with photoUrl(..., fieldIndex) — see ?f= in the route.
  "event-rooms": {
    table: "tbllvkwLhB4Omdphd",
    fields: [
      "1st Presenters Photo",
      "2nd Presenters Photo",
      "3rd Presenters Photo",
      "4th Presenters Photo",
      "5th Presenters Photo",
      "Presenters Profile Picture",
    ],
  },
};

// Absolute base for the proxy URLs. WordPress consumes the JSON cross-origin, so
// relative paths only work on the local preview pages. On Vercel the production
// domain is injected automatically; PUBLIC_BASE_URL overrides it (custom domain).
function baseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return ""; // local dev: same-origin relative URL
}

// The stable URL a feed puts in its JSON. fieldIndex pins one field from the source's
// list (event-room slots); omit it to scan the fields in priority order.
export function photoUrl(
  feed: keyof typeof PHOTO_SOURCES,
  recordId: string,
  fieldIndex?: number
): string {
  const suffix = fieldIndex !== undefined ? `?f=${fieldIndex}` : "";
  return `${baseUrl()}/api/photo/${feed}/${recordId}${suffix}`;
}

type AirtableAttachment = { url: string; thumbnails?: { large?: { url: string } } };

function attachmentUrl(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const att = v[0] as AirtableAttachment;
  return att?.thumbnails?.large?.url || att?.url || null;
}

async function fetchSignedUrl(
  source: PhotoSource,
  recordId: string,
  fieldIndex?: number
): Promise<string | null> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) throw new Error("Airtable env vars are not set on the server.");

  const fields =
    fieldIndex !== undefined ? [source.fields[fieldIndex]] : source.fields;

  // List endpoint + RECORD_ID() filter instead of the single-record endpoint so the
  // fields[] allow-list applies — the record's other (possibly sensitive) fields are
  // never pulled onto this server.
  const params = new URLSearchParams();
  params.set("filterByFormula", `RECORD_ID()='${recordId}'`);
  params.set("pageSize", "1");
  for (const f of fields) params.append("fields[]", f);

  const res = await fetchWithTimeout(
    `${API}/${base}/${encodeURIComponent(source.table)}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) {
    console.error("[photo] airtable lookup failed", res.status, await res.text());
    throw new Error(`Airtable lookup failed (${res.status})`);
  }

  const data = (await res.json()) as {
    records: { fields: Record<string, unknown> }[];
  };
  const rec = data.records[0];
  if (!rec) return null;

  for (const f of fields) {
    const url = attachmentUrl(rec.fields[f]);
    if (url) return url;
  }
  return null;
}

// Signed URLs are valid ~2h; cache the lookup well inside that so repeat requests
// don't hit Airtable, but a served URL is never close to expiry.
const SIGNED_URL_TTL_MS = 45 * 60_000;

function cacheKey(feed: string, recordId: string, fieldIndex?: number): string {
  return `photo:${feed}:${recordId}:${fieldIndex ?? "*"}`;
}

// Airtable record ids: "rec" + 14 alphanumerics. The route checks this too, but the
// value is interpolated into a filterByFormula string below, so it is re-checked at the
// point of use — this function is exported and must not depend on its caller's diligence.
const REC_ID = /^rec[A-Za-z0-9]{14}$/;

export async function resolveSignedUrl(
  feed: string,
  recordId: string,
  fieldIndex?: number
): Promise<string | null> {
  const source = PHOTO_SOURCES[feed];
  if (!source) return null;
  if (!REC_ID.test(recordId)) return null;
  if (fieldIndex !== undefined && !source.fields[fieldIndex]) return null;
  return cached(
    cacheKey(feed, recordId, fieldIndex),
    () => fetchSignedUrl(source, recordId, fieldIndex),
    SIGNED_URL_TTL_MS
  );
}

// Drop a cached signed URL (used after an upstream 410 so the retry re-resolves).
export function invalidateSignedUrl(
  feed: string,
  recordId: string,
  fieldIndex?: number
): void {
  invalidate(cacheKey(feed, recordId, fieldIndex));
}
