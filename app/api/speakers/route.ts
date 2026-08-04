import { NextRequest } from "next/server";
import { fetchSpeakers } from "@/lib/airtable";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const KEY = "speakers";

export async function GET(req: NextRequest) {
  // Rate limit + the authenticated ?fresh= live-read. See lib/apiRoute.ts.
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    // Drop this instance's entry first, so the read below really goes to Airtable AND the
    // refreshed value is what ordinary cached reads on this instance serve next.
    if (gate.fresh) invalidate(KEY);

    const speakers = await cached(KEY, fetchSpeakers, feedTtlMs());
    // Cacheable + CORS for the Elementor embeds; a live-read is no-store instead.
    return feedResponse({ count: speakers.length, speakers }, gate);
  } catch (err) {
    console.error("[/api/speakers]", err);
    return errorResponse(err, "Something went wrong loading speakers.");
  }
}
