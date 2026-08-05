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
import { logoUrl, pickLogo } from "@/lib/logoPick";

const API = "https://api.airtable.com/v0";

export type PhotoSource = {
  table: string;
  fields: string[];
  // Opt in to lib/logoPick.ts instead of "take the first attachment". Only the startup logo
  // wall needs it, because those cells hold several variants of the same mark (an original
  // plus a white SVG added later) and the first one is the wrong one. Every other feed has a
  // single headshot per cell, where first-wins is correct and cheaper.
  pickLogo?: true;
};

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
  // Life Science Project again, but the exhibiting startup's company logo rather than a
  // speaker headshot (lib/lsstartups.ts). Separate key because the field differs.
  "ls-startups": {
    table: "tblvukXfmR7KTFymG",
    fields: ["High quality company logo"],
    pickLogo: true,
  },
  // Marketing Project Overview a third time, for the PARTNER WALL's company logos rather than a
  // speaker headshot. Its cells hold several variants of one mark (the colour original plus the
  // white export Auri uploaded for this wall), so it needs the picker, not first-wins.
  // "Logo" is a unique field name in this 112-field table — checked, unlike "Partners 2026 copy",
  // which appears eight times — so requesting it by name is safe.
  partners: { table: "tblTecOBecLQCNIeD", fields: ["Logo"], pickLogo: true },
  nass: { table: "tbl3dTaHrIFrHF6Mo", fields: ["Headshots"] },
  niss: { table: "tblfIPjV4t1c1628h", fields: ["Self Portrait"] },
  "niss-2025": { table: "tblyWVASxceyLRCaL", fields: ["Photo"] },
  team: { table: "tbldWne3PnvebIwif", fields: ["Picture"] },
  // Partnership Success again, but the session-level logo rather than a presenter photo
  // (lib/partnerevents.ts). Separate key because the field list differs; "Company Logo"
  // is NOT one of the duplicated names in that table, so it is safe to request by name.
  "partner-events": { table: "tbllvkwLhB4Omdphd", fields: ["Company Logo"] },
  // The Policy Stage programme (lib/program.ts, source "policy"). ONE CELL HOLDS SEVERAL FACES —
  // a four-person panel puts four attachments in "Speaker Photo" — which is why ?v= now SELECTS an
  // attachment rather than only busting the cache. See fetchSignedUrl.
  "policy-program": {
    table: "tblSlpTzDi2oVYwqv",
    fields: ["Speaker Photo", "Moderator Photo"],
  },
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
export function baseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return ""; // local dev: same-origin relative URL
}

// The stable URL a feed puts in its JSON. fieldIndex pins one field from the source's
// list (event-room slots); omit it to scan the fields in priority order.
//
// `version` is a cache-buster, and it exists because "stable URL" and "24h max-age" fight
// each other the moment the underlying attachment is REPLACED. The bytes behind
// /api/photo/<feed>/<rec> change, the URL does not, and every browser and CDN keeps serving
// yesterday's logo for up to a day. Passing Airtable's per-attachment id makes the URL change
// whenever the file does, so a swapped logo appears immediately and an unchanged one still
// caches hard. The route ignores this param; only the cache key cares.
export function photoUrl(
  feed: keyof typeof PHOTO_SOURCES,
  recordId: string,
  fieldIndex?: number,
  version?: string
): string {
  const params = new URLSearchParams();
  if (fieldIndex !== undefined) params.set("f", String(fieldIndex));
  if (version) params.set("v", version);
  const qs = params.toString();
  return `${baseUrl()}/api/photo/${feed}/${recordId}${qs ? `?${qs}` : ""}`;
}

type AirtableAttachment = { url: string; thumbnails?: { large?: { url: string } } };

function attachmentUrl(v: unknown, usePicker?: boolean, attachmentId?: string): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  // ?v=<attachment id> SELECTS that attachment when the cell holds it.
  //
  // It began life as a cache-buster and nothing more, which was fine while every cell held one
  // photo. The Policy Stage programme broke that assumption: a four-person panel keeps four faces in
  // one "Speaker Photo" cell, and first-wins would serve the same face four times.
  //
  // Still a cache-buster for every existing caller — a replaced file gets a new id, so a new URL.
  // An id the cell does not contain falls through to the rules below rather than 404ing, so an old
  // link keeps working after the artwork is swapped.
  // STRICT when an id is named: a miss returns null instead of falling through to "first attachment".
  //
  // Without that, the first pass in fetchSignedUrl scans "Speaker Photo" for the MODERATOR's id, does
  // not find it, and happily returns the first speaker's face — so the panel's moderator appeared
  // wearing another panelist's photo. Caught by hashing the bytes of all five faces on one panel and
  // finding four distinct images (2026-08-05). The caller runs a second pass with no id, which is
  // where the priority-order fallback belongs.
  if (attachmentId) {
    const hit = (v as { id?: string; url?: string; thumbnails?: { large?: { url: string } } }[]).find(
      (a) => a?.id === attachmentId
    );
    return hit ? hit.thumbnails?.large?.url || hit.url || null : null;
  }
  // Cells holding several variants of one logo choose by what the file IS, not by position.
  // Must stay in step with lib/lsstartups.ts, which uses the same picker to decide whether to
  // publish a logo URL at all — see lib/logoPick.ts.
  if (usePicker) {
    const best = pickLogo(v);
    return best ? logoUrl(best) : null;
  }
  const att = v[0] as AirtableAttachment;
  return att?.thumbnails?.large?.url || att?.url || null;
}

// ─── ONE AIRTABLE LOOKUP PER PHOTO, AND 99 PHOTOS ON A PAGE ─────────────────────────────
// Every cold photo request costs one Airtable API call to re-resolve the signed URL. The partner
// wall carries 99 logos, so a cold load fires ~99 lookups at once — and Airtable's limit is 5
// requests per second per base, answering the excess with 429 and a 30-second penalty. The route
// turned each of those into a 404/502, which is exactly the "some logos don't load, it looks
// crashed" that Auri reported (2026-08-05).
//
// The CDN hides this most of the time: each URL is cached for a week, so the burst only happens
// after a deploy, a region cold-start, or an upload that changes ?v=. But "most of the time" on a
// partner wall means a partner occasionally seeing a hole where their logo should be.
//
// So lookups queue. Three at a time leaves headroom under the 5/s limit for the feeds themselves,
// and a 429 is retried with the delay Airtable asks for rather than being reported as a missing
// photo. A cold wall now paints in a few seconds instead of dropping a third of its images.
const MAX_CONCURRENT_LOOKUPS = 3;
const LOOKUP_RETRIES = 3;
// Airtable's documented penalty is 30s, but it sends Retry-After; this is only the fallback for a
// response that omits it. Deliberately short — the request is already waiting on a page.
const RETRY_AFTER_FALLBACK_MS = 2_000;

let active = 0;
const queue: (() => void)[] = [];

async function withLookupSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_LOOKUPS) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchSignedUrl(
  source: PhotoSource,
  recordId: string,
  fieldIndex?: number,
  attachmentId?: string
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

  const url = `${API}/${base}/${encodeURIComponent(source.table)}?${params.toString()}`;
  const res = await withLookupSlot(async () => {
    for (let attempt = 1; ; attempt++) {
      const r = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      // 429 is the one status worth waiting on: it means the base is busy, not that the photo is
      // gone. Anything else is answered immediately, success or not.
      if (r.status !== 429 || attempt > LOOKUP_RETRIES) return r;
      const after = Number(r.headers.get("retry-after"));
      const waitMs = Number.isFinite(after) && after > 0 ? after * 1000 : RETRY_AFTER_FALLBACK_MS * attempt;
      console.info(`[photo] rate-limited by Airtable, retrying in ${waitMs}ms (attempt ${attempt})`);
      await sleep(waitMs);
    }
  });
  if (!res.ok) {
    console.error("[photo] airtable lookup failed", res.status, await res.text());
    throw new Error(`Airtable lookup failed (${res.status})`);
  }

  const data = (await res.json()) as {
    records: { fields: Record<string, unknown> }[];
  };
  const rec = data.records[0];
  if (!rec) return null;

  // Two passes when an attachment is named: find the cell that actually holds it before falling back
  // to the priority order, or a record whose FIRST photo field lacks that id would answer with the
  // wrong picture.
  if (attachmentId) {
    for (const f of fields) {
      const url = attachmentUrl(rec.fields[f], source.pickLogo, attachmentId);
      if (url) return url;
    }
  }
  for (const f of fields) {
    const url = attachmentUrl(rec.fields[f], source.pickLogo);
    if (url) return url;
  }
  return null;
}

// Signed URLs are valid ~2h; cache the lookup well inside that so repeat requests
// don't hit Airtable, but a served URL is never close to expiry.
const SIGNED_URL_TTL_MS = 45 * 60_000;

// The VERSION is part of the key. Without it, replacing a headshot left this cache pointing at
// the old file's signed URL for up to 45 minutes, so even the new ?v= URL served the old
// picture — the CDN was only half the reason Kent Damsgaard's swap stayed invisible. A new
// attachment id is a new key, which forces a fresh resolve immediately.
function cacheKey(
  feed: string,
  recordId: string,
  fieldIndex?: number,
  version?: string
): string {
  return `photo:${feed}:${recordId}:${fieldIndex ?? "*"}:${version ?? "*"}`;
}

// Airtable record ids: "rec" + 14 alphanumerics. The route checks this too, but the
// value is interpolated into a filterByFormula string below, so it is re-checked at the
// point of use — this function is exported and must not depend on its caller's diligence.
const REC_ID = /^rec[A-Za-z0-9]{14}$/;

export async function resolveSignedUrl(
  feed: string,
  recordId: string,
  fieldIndex?: number,
  version?: string
): Promise<string | null> {
  const source = PHOTO_SOURCES[feed];
  if (!source) return null;
  if (!REC_ID.test(recordId)) return null;
  if (fieldIndex !== undefined && !source.fields[fieldIndex]) return null;
  return cached(
    cacheKey(feed, recordId, fieldIndex, version),
    () => fetchSignedUrl(source, recordId, fieldIndex, version),
    SIGNED_URL_TTL_MS
  );
}

// Drop a cached signed URL (used after an upstream 410 so the retry re-resolves).
export function invalidateSignedUrl(
  feed: string,
  recordId: string,
  fieldIndex?: number,
  version?: string
): void {
  invalidate(cacheKey(feed, recordId, fieldIndex, version));
}

/**
 * Airtable attachment ids: "att" + 14 alphanumerics.
 *
 * The route validates `?v=` against this before it reaches the cache key, and that check is
 * load-bearing rather than cosmetic: the key goes into a long-lived in-memory Map, so an
 * unvalidated value would let anyone grow that map without limit by requesting ?v=1, ?v=2 and
 * so on. An unrecognised value is ignored, not rejected — the photo still serves, just on the
 * unversioned key.
 */
export const ATTACHMENT_ID = /^att[A-Za-z0-9]{14}$/;
