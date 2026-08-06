import { NextRequest } from "next/server";
import { fetchFintechSpeakers, FINTECH_ROLES, FintechRole } from "@/lib/fintechspeakers";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const KEY = "fintech-speakers";

// ?role=Speaker | Moderator | Keynote Speaker | all
//
// THE DEFAULT IS SPEAKER, and that is not laziness. The feed served speakers only until
// 2026-08-04, and whatever is pasted on techbbq.dk fetches this URL bare — defaulting to "all"
// would drop two moderators and a keynote into the middle of the speaker grid on a live page,
// with no way to correct it except a re-paste. A new audience opts in by asking for it.
//
// An unknown value falls back to Speaker rather than serving everyone, for the same reason.
const DEFAULT_ROLE: FintechRole = "Speaker";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  const param = req.nextUrl.searchParams.get("role");
  const role = param === "all" ? "all" : ((FINTECH_ROLES as readonly string[]).includes(param ?? "") ? (param as FintechRole) : DEFAULT_ROLE);

  try {
    if (gate.fresh) invalidate(KEY);

    // One Airtable read for every variant: the lib returns all three roles and the filter
    // happens after the cache, the same way ?tier=, ?kind= and ?stage= work elsewhere.
    // KEY opts this feed into the HOURLY override in lib/cachePolicy.ts — one hour, event
    // window or not, standing until Auri says otherwise. Passed to feedResponse below as well,
    // so the CDN's s-maxage agrees with this in-memory TTL.
    const all = await cached(KEY, fetchFintechSpeakers, feedTtlMs(KEY));
    const people = role === "all" ? all : all.filter((p) => p.role === role);

    // `counts` lets the dashboard label its tabs without three extra requests.
    const counts = Object.fromEntries(
      FINTECH_ROLES.map((r) => [r, all.filter((p) => p.role === r).length])
    );

    return feedResponse({ count: people.length, role, counts, people }, gate, { key: KEY });
  } catch (err) {
    console.error("[/api/fintech-speakers]", err);
    return errorResponse(err, "Something went wrong loading fintech speakers.", gate);
  }
}
