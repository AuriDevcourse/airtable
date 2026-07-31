// Shared field readers for Airtable records.
//
// Every feed lib used to carry its own private copy of str/num/firstPhoto/firstTag/
// linkedinUrl — 15 identical str()s and 11 identical firstPhoto()s. They were genuinely
// identical, so a fix to one (the mobile-LinkedIn normalization was the last) had to be
// remembered 15 times. One copy here instead; the per-feed mapRecord functions stay where
// they are, because those really do differ per table.

import { normalizeLinkedInUrl } from "@/lib/linkedin";

/** Trimmed string, or "" for anything that isn't a string (missing/number/array cells). */
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

type AirtableAttachment = { url: string; thumbnails?: { large?: { url: string } } };

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
