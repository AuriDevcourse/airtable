// Shared field readers for Airtable records.
//
// Every feed lib used to carry its own private copy of str/num/firstPhoto/firstTag/
// linkedinUrl — 15 identical str()s and 11 identical firstPhoto()s. They were genuinely
// identical, so a fix to one (the mobile-LinkedIn normalization was the last) had to be
// remembered 15 times. One copy here instead; the per-feed mapRecord functions stay where
// they are, because those really do differ per table.

import { normalizeLinkedInUrl } from "@/lib/linkedin";

/**
 * Trimmed string, or "" for anything that isn't a string (missing/number/array cells).
 *
 * WATCH THE ARRAY CASE. A MULTI-select cell arrives as `["Speaker"]`, so str() gives you "" and
 * nothing throws. That silently unpublished the entire Policy Stage (31 people, all 5 of the roles
 * read as blank) and blanked `country` on all 44 Life Science startups. Airtable lets anyone flip
 * single-select to multi-select from the UI, and TypeScript cannot see it because the cell is
 * `unknown` either way.
 *
 * Use `firstTag()` for anything select-shaped — it reads both, so a later conversion is harmless.
 * `npm run audit:fields` checks every field read in lib/ against its real type in the base.
 */
export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Numeric cell, or Infinity for blank/non-numeric — so unranked rows sort last with a
 * plain `a - b` comparator. Note that Infinity serializes to `null` in JSON, which is
 * what the clients test for (`typeof x.hierarchy === "number"`).
 */
export function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : Infinity;
}

/** Numeric cell, or null for blank/non-numeric. Use where the value is serialized. */
export function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

type AirtableAttachment = { id?: string; url: string; thumbnails?: { large?: { url: string } } };

/**
 * The first attachment's URL, preferring the large thumbnail. Only used as a PRESENCE
 * check now — the feeds publish a stable /api/photo/... proxy URL instead, because raw
 * airtableusercontent.com links are signed and 410 after ~2h (see lib/photo.ts).
 */
export function firstPhoto(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const att = v[0] as AirtableAttachment;
  return att?.thumbnails?.large?.url || att?.url || null;
}

/**
 * The first attachment's ID, for the `?v=` cache-buster on a proxy photo URL.
 *
 * WHY THIS MATTERS (2026-08-04). /api/photo/<feed>/<recordId> is stable by design, and the
 * CDN holds it for a WEEK. Replacing a headshot in Airtable changes nothing about that URL,
 * so visitors kept the old picture: Kent Damsgaard's replacement sat unseen while the CDN
 * served a 36,841-byte file against Airtable's 55,268. The route's own comment claimed "a
 * swapped photo shows up within a day", which was wrong for the same reason.
 *
 * Airtable issues a NEW attachment id whenever the file is replaced, so threading it into the
 * URL makes a replaced photo a URL no cache has ever seen — instant everywhere — while an
 * unchanged photo keeps its week-long cache. Undefined when there is no attachment, which
 * leaves the URL exactly as it was.
 */
export function firstAttachmentId(v: unknown): string | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  return (v[0] as AirtableAttachment)?.id || undefined;
}

/** First option of a multi-select (which arrives as an array), or a plain single-select. */
export function firstTag(v: unknown): string {
  if (Array.isArray(v)) return str(v[0]);
  return str(v);
}

/**
 * First of several free-text cells that normalizes to a working LinkedIn URL. Tables
 * differ on which column is actually filled ("Link to LinkedIn" vs "LinkedIn Handle"),
 * so callers pass them in preference order.
 */
export function linkedinUrl(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = normalizeLinkedInUrl(v);
    if (s) return s;
  }
  return null;
}

/** Escape a value interpolated into a single-quoted Airtable filterByFormula string. */
export function escFormula(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
