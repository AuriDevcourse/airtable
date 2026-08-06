// Venue and time for a side event, read from its own public Luma page.
//
// WHY. Airtable has no venue field for side events at all (checked across all 128 columns of
// Partnership Success) and its `Time slot` is empty on every side event row. Brella has times
// for some and no venue. But most of these events are sold through Luma, and a public Luma
// event page carries a schema.org Event in JSON-LD — the same block search engines read —
// which holds both. So the sign-up link the partner already gave us is also the answer to
// "where is it".
//
// Measured 2026-08-04 across the 11 side events: 5 gave a venue and exact times, 3 are private
// Luma events that publish no JSON-LD at all, 2 use other ticketing (nrich.io,
// rsvp.withgoogle.com) and 1 has no link. So this fills in roughly half, and everything else
// keeps working exactly as before.
//
// RULES THIS FOLLOWS
//   * Public pages only, and only the /<slug> event pages. luma.com/robots.txt disallows
//     /in/, /company/, /social-share and /session-* for crawlers; none of those are touched.
//   * Identifies itself in the User-Agent rather than pretending to be a browser.
//   * Cached on a LONG ttl by the caller (a venue does not move), so this runs a handful of
//     times a day rather than on the feeds' 30-minute cadence.
//   * Never blocks a feed. Every fetch is timeout-bounded and every failure is swallowed: no
//     venue is a missing line, not a broken program.
//   * Read-only, and nothing from the page is trusted as markup — the caller escapes it like
//     any other upstream string.

import { fetchWithTimeout } from "@/lib/http";

export type LumaDetail = {
  /** The venue as Luma states it: "Matrikel1", "Højbro Pl. 10". */
  venue?: string;
  /** "København". Kept separate so the UI can show a venue without repeating the city. */
  city?: string;
  /** "19:00-01:00" in Copenhagen time. Only used when no other source has a time. */
  timeSlot?: string;
};

const TIMEOUT_MS = 6000;

/** Only Luma's own event pages. Anything else (nrich.io, rsvp.withgoogle.com) is left alone. */
export function isLumaEventUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!/^(www\.)?(luma\.com|lu\.ma)$/i.test(u.hostname)) return false;
    // A slug, not one of the paths robots.txt asks crawlers to stay out of.
    return /^\/[A-Za-z0-9-]+\/?$/.test(u.pathname) && !/^\/(in|company|social-share)\b/.test(u.pathname);
  } catch {
    return false;
  }
}

// The times arrive as ISO strings with an offset ("2026-08-25T19:00:00.000+02:00"). Formatted
// in Europe/Copenhagen rather than the server's zone, which on Vercel is UTC and would print
// every evening event two hours early.
function hhmm(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Copenhagen",
  }).format(d);
}

type Jsonish = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Pull the Event out of a page's JSON-LD.
 *
 * Written defensively because this is someone else's markup: the block can be an array, a
 * @graph, or a single object, and any field can be missing. Anything unexpected yields an
 * empty detail rather than throwing into the feed.
 */
export function parseLumaHtml(html: string): LumaDetail {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const candidates: Jsonish[] = [];
    const push = (v: unknown) => {
      if (v && typeof v === "object") candidates.push(v as Jsonish);
    };
    if (Array.isArray(parsed)) parsed.forEach(push);
    else {
      push(parsed);
      const graph = (parsed as Jsonish)?.["@graph"];
      if (Array.isArray(graph)) graph.forEach(push);
    }

    for (const node of candidates) {
      if (str(node["@type"]) !== "Event") continue;
      const loc = (node.location && typeof node.location === "object" ? node.location : {}) as Jsonish;
      const addr = (loc.address && typeof loc.address === "object" ? loc.address : {}) as Jsonish;

      const city = str(addr.addressLocality);
      const name = str(loc.name);
      // Luma uses the city as the location name when a host gives no venue. Reporting
      // "København" as a venue would be a false specific, so it is dropped and only the city
      // survives.
      const venue = name && name !== city ? name : "";

      const start = hhmm(str(node.startDate));
      const end = hhmm(str(node.endDate));

      return {
        venue: venue || undefined,
        city: city || undefined,
        timeSlot: start && end ? `${start}-${end}` : start || undefined,
      };
    }
  }
  return {};
}

/** One page. Any failure is a missing detail, never an exception. */
async function fetchOne(url: string): Promise<LumaDetail> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          // Says who we are and why, rather than impersonating a browser.
          "User-Agent": "TechBBQ-connector/1.0 (+https://techbbq.dk; side event venue lookup)",
          Accept: "text/html",
        },
        cache: "no-store",
      },
      TIMEOUT_MS
    );
    if (!res.ok) {
      console.warn("[luma]", res.status, url);
      return {};
    }
    return parseLumaHtml(await res.text());
  } catch (err) {
    console.warn("[luma] fetch failed", url, err instanceof Error ? err.message : err);
    return {};
  }
}

/**
 * Look up every Luma URL given, returning url → detail for the ones that answered.
 *
 * Fetched in small batches rather than all at once: this is someone else's site, and eleven
 * simultaneous requests from one IP is how a polite reader gets rate-limited.
 */
export async function fetchLumaDetails(urls: (string | null | undefined)[]): Promise<Map<string, LumaDetail>> {
  const wanted = [...new Set(urls.filter(isLumaEventUrl) as string[])];
  const out = new Map<string, LumaDetail>();
  const BATCH = 3;

  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(fetchOne));
    batch.forEach((url, j) => {
      const d = results[j];
      if (d.venue || d.city || d.timeSlot) out.set(url, d);
    });
  }
  return out;
}
