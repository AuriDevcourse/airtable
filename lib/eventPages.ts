// Venue, time and artwork for a side event, read from its own public ticketing page.
//
// WAS LUMA-ONLY until 2026-08-07, when Auri asked for a thumbnail on the side event cards
// ("the majority of them you have to go and register somewhere else and they usually have a
// visual"). Measuring the other ticketing hosts settled the scope: og:image is published by
// Luma, Eventbrite, nrich.io and EUVC's Circle community — 13 of the 14 events — and only
// rsvp.withgoogle.com has nothing, so it is not fetched at all. See EVENT_HOSTS below for why
// that list is an allowlist rather than a filter.
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

export type EventPageDetail = {
  /** The venue as Luma states it: "Matrikel1", "Højbro Pl. 10". */
  venue?: string;
  /** "København". Kept separate so the UI can show a venue without repeating the city. */
  city?: string;
  /** "19:00-01:00" in Copenhagen time. Only used when no other source has a time. */
  timeSlot?: string;
  /** The event's own artwork, from og:image. Absolute https. */
  image?: string;
};

const TIMEOUT_MS = 6000;

// ─── A CLOSED LIST OF TICKETING HOSTS, WHICH IS THE WHOLE SSRF STORY ────────────────────
// This used to be Luma only. It was widened on 2026-08-07 so side event cards can carry the
// partner's own artwork, and 4 of the 5 non-Luma events turned out to publish an og:image too.
//
// The URLs come from PARTNERS, through an Airtable form. Fetching a partner-supplied URL
// server-side is the textbook SSRF shape, so the guard is an ALLOWLIST of hostnames rather
// than a denylist of bad ones: a hostname that is not in this table is never fetched, so
// there is no `169.254.169.254`, no `localhost`, no internal address to reach. HTTPS is
// required for the same reason — a plain-http redirect target is not worth the surface.
//
// Each entry also pins the PATH shape, which keeps this to the public event pages. Luma's
// exclusions come from its robots.txt; the others are simply the one path that holds an event.
//
// ADDING A HOST IS A DELIBERATE ACT. Check the page is public, that it publishes og:image or
// JSON-LD, and that its robots.txt does not ask readers away.
const EVENT_HOSTS: { host: RegExp; path: RegExp; deny?: RegExp }[] = [
  {
    host: /^(www\.)?(luma\.com|lu\.ma)$/i,
    path: /^\/[A-Za-z0-9-]+\/?$/,
    // luma.com/robots.txt disallows these for crawlers.
    deny: /^\/(in|company|social-share|session-)/i,
  },
  // eventbrite.com, .dk, .co.uk — the TLD varies by which storefront the partner links to.
  { host: /^(www\.)?eventbrite(\.[a-z]{2,3}){1,2}$/i, path: /^\/e\// },
  { host: /^(www\.)?nrich\.io$/i, path: /^\/events\// },
  // EUVC's community runs on Circle.
  { host: /^members\.eu\.vc$/i, path: /^\/c\// },
];

/**
 * Is this a public event page we are willing to read?
 *
 * rsvp.withgoogle.com is deliberately absent: it is the one link that publishes no image, so
 * fetching it would cost a request to learn nothing.
 */
export function isEventPageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const hit = EVENT_HOSTS.find((h) => h.host.test(u.hostname));
    if (!hit) return false;
    if (hit.deny?.test(u.pathname)) return false;
    return hit.path.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * The artwork a page advertises to link previews, or undefined.
 *
 * `og:image` rather than the JSON-LD `image`, and measured rather than assumed: across the 14
 * side events og:image is present on 13 and JSON-LD on fewer — one private Luma page publishes
 * no JSON-LD at all but still has an og:image. Luma also serves og:image at 800x420, which is a
 * card thumbnail, while its JSON-LD image is 1920x1920.
 *
 * Only https is accepted. This string ends up in an <img src> on techbbq.dk, and a page that
 * advertised an http image would turn a secure page into a mixed-content warning.
 */
function ogImage(html: string): string | undefined {
  const m =
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html) ||
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html);
  const raw = m?.[1]?.trim();
  if (!raw || !/^https:\/\//i.test(raw)) return undefined;
  return raw;
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
export function parseEventPageHtml(html: string): EventPageDetail {
  // Read FIRST and returned on every path, including the early return below: a page can carry
  // artwork and no JSON-LD (three of the private Luma events do exactly that), and returning {}
  // for those would have thrown the picture away with the venue.
  const image = ogImage(html);
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
        image,
      };
    }
  }
  return image ? { image } : {};
}

/** One page. Any failure is a missing detail, never an exception. */
async function fetchOne(url: string): Promise<EventPageDetail> {
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
    return parseEventPageHtml(await res.text());
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
export async function fetchEventPageDetails(urls: (string | null | undefined)[]): Promise<Map<string, EventPageDetail>> {
  const wanted = [...new Set(urls.filter(isEventPageUrl) as string[])];
  const out = new Map<string, EventPageDetail>();
  const BATCH = 3;

  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(fetchOne));
    batch.forEach((url, j) => {
      const d = results[j];
      if (d.venue || d.city || d.timeSlot || d.image) out.set(url, d);
    });
  }
  return out;
}
