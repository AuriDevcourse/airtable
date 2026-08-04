import { NextRequest } from "next/server";
import { fetchFintechSpeakers } from "@/lib/fintechspeakers";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const KEY = "fintech-speakers";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    const people = await cached(KEY, fetchFintechSpeakers, feedTtlMs());
    return feedResponse({ count: people.length, people }, gate);
  } catch (err) {
    console.error("[/api/fintech-speakers]", err);
    return errorResponse(err, "Something went wrong loading fintech speakers.");
  }
}
