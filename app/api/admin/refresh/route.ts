// LOCAL ONLY: drop the server-side feed cache so the next read hits Airtable/Brella
// immediately, instead of waiting out the 1-hour TTL in lib/rate-limit.ts.
//
// Read-only in the outward direction — it deletes nothing but in-memory cache entries and
// writes nothing to Airtable. That's the difference from /api/admin/sync, which pushes the
// Speaker Hub INTO Airtable.
//
// Why it refuses to run in production, even though it is already behind the dashboard
// password (it is deliberately NOT in middleware's PUBLIC_PATHS): on the live site the CDN
// is what serves visitors, and its s-maxage is untouched by clearing this process's Map.
// So in production the button would clear a cache nobody reads and look like it worked.
// Local dev has no CDN in front, which is the only place the press is honest.
//
// Deliberately does NOT use lib/apiRoute's CORS helpers, for the same reason
// /api/tito-lookup doesn't: this is a password-gated dashboard action, not a feed for
// techbbq.dk to fetch cross-origin. It must never grow Access-Control-Allow-Origin.

import { NextRequest, NextResponse } from "next/server";
import { invalidate, invalidateAll } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cache keys are internal identifiers like "program:niss" or "speakers-2026". Anything
// outside this shape is a caller mistake, so reject it rather than silently no-op on a
// key that can never exist.
const KEY_RE = /^[a-zA-Z0-9:_-]{1,64}$/;

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // No body, or an unparseable one, means "clear everything" — the button's default.
  const body = await req.json().catch(() => ({}));
  const key = typeof body?.key === "string" ? body.key.trim() : "";

  if (key && !KEY_RE.test(key)) {
    return NextResponse.json({ ok: false, error: "Invalid cache key." }, { status: 400 });
  }

  if (key) {
    invalidate(key);
    console.log("[/api/admin/refresh] cleared", key);
    return NextResponse.json({ ok: true, cleared: 1, key }, { status: 200 });
  }

  const cleared = invalidateAll();
  console.log("[/api/admin/refresh] cleared all", cleared);
  return NextResponse.json({ ok: true, cleared }, { status: 200 });
}
