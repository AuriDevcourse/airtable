// ON-DEMAND REFRESH. Airtable calls this the moment a record changes, instead of everyone
// waiting out the cache cadence.
//
// ─── WHAT THIS DOES AND DOES NOT DO. READ THIS BEFORE TRUSTING IT. ──────────────────────
// Its ONE reliable job is to tell WordPress to drop its cached copy, which makes WordPress
// refetch through the authenticated `?fresh=` bypass and land current data on techbbq.dk.
// That is the whole point of the endpoint.
//
// It ALSO tries to drop this project's own in-memory cache, and that part is BEST EFFORT ONLY.
// Measured on 2026-08-08: purging from here dropped ZERO entries belonging to other routes while
// their caches were demonstrably warm — /api/program?event=brella stayed at 0.45s (cached) instead
// of returning to its 4.8s cold time. The `cached()` Map in lib/rate-limit.ts is module state, and
// each route handler gets its own module instance; on Vercel they are separate serverless
// functions in separate isolates, so there is no shared Map to reach into and never will be. The
// `dropped` count in the response tells the truth about this — expect 0 and do not treat it as a
// failure. The `?fresh=` bypass works precisely because it bypasses per request rather than trying
// to clear someone else's memory, which is the same reason the README says the Refresh button
// cannot purge techbbq.dk.
//
// Do NOT "fix" the above by reaching for revalidateTag: Next's own docs are explicit that
// revalidateTag/revalidatePath do not reach a CDN ("you must explicitly trigger CDN purges"), and
// Vercel exposes no per-URL purge API. Making it work would mean moving every feed off the bespoke
// Map onto Next's Data Cache, which is a rewrite of the caching core — see progress.md for why
// that is the wrong thing to do in the weeks before the event.
//
// So: with WORDPRESS_PURGE_URL unset, this endpoint is plumbing that does almost nothing. With it
// set, it is the thing that makes an Airtable edit appear on techbbq.dk in seconds.
//
// ─── AUTH ───────────────────────────────────────────────────────────────────────────────
// `Authorization: Bearer <REVALIDATE_SECRET>`, compared constant-time, FAILING CLOSED when the
// variable is unset — the same shape as /api/sync-speakers, and for the same reason: this is a
// route that costs third-party API calls, so an open version of it is SECURITY r5, the exact
// hole this account has shipped six times. It is additionally rate limited, because a valid
// secret that leaks should still not be able to hammer Airtable.
//
// POST only. A GET would be fetched by link previewers and crawlers.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { invalidate, invalidatePrefix, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/apiRoute";
import { ALL_FEED_KEYS, FEED_NAMES, resolveFeeds } from "@/lib/feedKeys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Deliberately tighter than the feeds' 60/min. A refresh is an Airtable scan on the next read,
// and Airtable edits do not arrive 20 times a minute — if they do, something is looping.
const MAX_PER_MINUTE = 20;

function authorized(req: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false; // fail closed: no secret configured => no access

  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false; // timingSafeEqual needs equal lengths
  return timingSafeEqual(a, b);
}

type Body = { feed?: unknown; feeds?: unknown; all?: unknown };

/**
 * Read the requested feeds out of the body.
 *
 * Accepts `{"feed":"partners"}`, `{"feeds":["partners","team"]}` or `{"all":true}`, because an
 * Automation author will reasonably write any of the three and a 400 over the shape of a JSON key
 * is a bad first experience of a webhook.
 */
function requestedNames(body: Body): { names: string[]; all: boolean } {
  if (body.all === true) return { names: [], all: true };
  const raw = body.feeds ?? body.feed;
  if (typeof raw === "string") return { names: [raw], all: false };
  if (Array.isArray(raw)) {
    return { names: raw.filter((v): v is string => typeof v === "string"), all: false };
  }
  return { names: [], all: false };
}

/**
 * Tell WordPress to drop its cached copy, if a plugin is installed and configured.
 *
 * Best-effort by design: this project's own cache is already clear by the time this runs, so a
 * WordPress that is down, slow or not yet fitted with the plugin must not turn a successful
 * refresh into a 500 for Airtable to retry. The outcome is reported in the response body and
 * logged, so a silent failure is still a visible one.
 */
async function purgeWordPress(): Promise<string> {
  const url = process.env.WORDPRESS_PURGE_URL;
  const secret = process.env.WORDPRESS_PURGE_SECRET;
  if (!url) return "skipped: WORDPRESS_PURGE_URL not set";
  if (!secret) return "skipped: WORDPRESS_PURGE_SECRET not set";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok ? "purged" : `failed: HTTP ${res.status}`;
  } catch (err) {
    return `failed: ${err instanceof Error ? err.message : "unknown error"}`;
  }
}

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientIp(req), { bucket: "revalidate:", max: MAX_PER_MINUTE });
  if (!limit.ok) {
    const res = NextResponse.json(
      { error: "Too many refresh requests. Try again shortly." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(limit.retryAfter));
    return res;
  }

  // Rate limit BEFORE auth so a wrong secret cannot be retried without limit either.
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as Body;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON.", expected: { feeds: ["partners"] } },
      { status: 400 }
    );
  }

  const { names, all } = requestedNames(body);

  if (!all && names.length === 0) {
    return NextResponse.json(
      {
        error: "Name at least one feed, or send {\"all\": true}.",
        validFeeds: FEED_NAMES,
      },
      { status: 400 }
    );
  }

  const { keys, unknown } = all
    ? { keys: ALL_FEED_KEYS, unknown: [] as string[] }
    : resolveFeeds(names);

  // A body naming ONLY feeds that do not exist is an error, not a no-op: silently reporting
  // success for a typo is how a webhook stops being trusted.
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "No known feed named.", unknown, validFeeds: FEED_NAMES },
      { status: 400 }
    );
  }

  // A key ending in ":" is a prefix covering every per-parameter variant (`niss:all`,
  // `niss:Speaker`, …). See the comment on FEED_KEYS.
  let dropped = 0;
  for (const key of keys) {
    dropped += key.endsWith(":")
      ? invalidatePrefix(key)
      : invalidate(key)
        ? 1
        : 0;
  }

  const wordpress = await purgeWordPress();

  // Logged as one line of JSON so it is greppable in the Vercel log alongside the feed warnings.
  console.log(
    "[/api/revalidate]",
    JSON.stringify({ requested: all ? "all" : names, keys, dropped, unknown, wordpress })
  );

  const res = NextResponse.json({
    ok: true,
    purged: keys,
    // How many cache entries actually went. A prefix can cover several, and zero is normal on a
    // cold instance that had nothing cached yet — it is information, not an error.
    dropped,
    // Present but empty on a clean call, so an Automation author can see at a glance that every
    // name they sent was understood.
    unknown,
    wordpress,
    // Said in the response rather than only in a doc, because this is the thing about this
    // endpoint that misleads people. `dropped: 0` is the NORMAL result, not a fault.
    note:
      "WordPress is what makes this reach techbbq.dk. The local in-memory purge is best effort and normally drops 0 — route handlers do not share a cache. See the header of app/api/revalidate/route.ts.",
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// A GET returns the usable feed names rather than 405, so someone wiring up the Automation can
// check the spelling from a browser. It is still behind the secret and still lists nothing else.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = NextResponse.json({
    ok: true,
    usage: 'POST {"feeds":["partners"]} or {"all":true} with Authorization: Bearer <REVALIDATE_SECRET>',
    validFeeds: FEED_NAMES,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
