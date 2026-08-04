import { NextRequest } from "next/server";
import { fetchMainPageSpeakers } from "@/lib/mainpage";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";
// Headroom for the Airtable fetch's 10s timeout + one retry (see lib/mainpage.ts).
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

const KEY = "main-speakers";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    const speakers = await cached(KEY, fetchMainPageSpeakers, feedTtlMs());
    return feedResponse({ count: speakers.length, speakers }, gate);
  } catch (err) {
    console.error("[/api/main-speakers]", err);
    return errorResponse(err, "Something went wrong loading main-page speakers.", gate);
  }
}
