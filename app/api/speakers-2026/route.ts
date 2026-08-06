import { NextRequest } from "next/server";
import { fetchHubSpeakers } from "@/lib/hub";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";
// Headroom for the hierarchy fetch's 10s timeout + one retry (see lib/hierarchy.ts).
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

const KEY = "speakers-2026";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    const speakers = await cached(KEY, fetchHubSpeakers, feedTtlMs());
    return feedResponse({ count: speakers.length, speakers }, gate);
  } catch (err) {
    console.error("[/api/speakers-2026]", err);
    return errorResponse(err, "Something went wrong loading 2026 speakers.", gate);
  }
}
