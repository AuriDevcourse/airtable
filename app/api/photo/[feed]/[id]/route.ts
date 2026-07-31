// Streams one Airtable attachment photo. The feeds put these URLs in their JSON
// instead of raw airtableusercontent.com links, because those are signed and die
// with 410 Gone after ~2 hours (see lib/photo.ts). This URL is stable forever:
// on each cold hit we re-resolve a fresh signed URL server-side and stream the
// bytes; Vercel's CDN then serves repeats without touching Airtable at all.

import { NextRequest, NextResponse } from "next/server";
import {
  PHOTO_SOURCES,
  resolveSignedUrl,
  invalidateSignedUrl,
} from "@/lib/photo";
import { fetchWithTimeout } from "@/lib/http";

export const dynamic = "force-dynamic";

// Airtable record ids: "rec" + 14 alphanumerics. Rejecting anything else keeps the
// route from being used as an open proxy or probing tool.
const REC_ID = /^rec[A-Za-z0-9]{14}$/;

function notFound(): NextResponse {
  return NextResponse.json({ error: "Photo not found." }, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ feed: string; id: string }> }
) {
  const { feed, id } = await params;
  if (!PHOTO_SOURCES[feed] || !REC_ID.test(id)) return notFound();

  // Digits only. Number("") and Number(" ") are both 0, so a bare "?f=" used to be
  // accepted as index 0 — which silently pinned the FIRST attachment field and skipped
  // the priority-order fallback (on /speakers that means no "Headshots For marketing?"
  // when "Picture" is empty). An explicit ?f= must name a real slot or 404.
  const rawF = req.nextUrl.searchParams.get("f");
  let fieldIndex: number | undefined;
  if (rawF !== null) {
    if (!/^\d+$/.test(rawF)) return notFound();
    fieldIndex = Number(rawF);
    if (!PHOTO_SOURCES[feed].fields[fieldIndex]) return notFound();
  }

  try {
    let signed = await resolveSignedUrl(feed, id, fieldIndex);
    if (!signed) return notFound();

    let upstream = await fetchWithTimeout(signed, { cache: "no-store" });

    // The cached signed URL can still expire in the 45-min cache window if Airtable
    // rotates early — re-resolve once and retry before giving up.
    if (upstream.status === 410 || upstream.status === 403) {
      invalidateSignedUrl(feed, id, fieldIndex);
      signed = await resolveSignedUrl(feed, id, fieldIndex);
      if (!signed) return notFound();
      upstream = await fetchWithTimeout(signed, { cache: "no-store" });
    }

    if (!upstream.ok || !upstream.body) {
      console.error("[photo] upstream fetch failed", upstream.status, feed, id);
      return notFound();
    }

    const res = new NextResponse(upstream.body, { status: 200 });
    res.headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "image/jpeg"
    );
    // Headshots almost never change once uploaded. Browser caches a day, CDN a week
    // (serving stale while it refreshes) — a swapped photo shows up within a day.
    res.headers.set(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000"
    );
    return res;
  } catch (err) {
    console.error("[/api/photo]", feed, id, err);
    return NextResponse.json(
      { error: "Could not load the photo." },
      { status: 502 }
    );
  }
}
