import { NextRequest } from "next/server";
import { fetchPolicyLounge, POLICY_ROLES, PolicyRole } from "@/lib/policylounge";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

// THE POLICY LOUNGE feed: the Policy Stage roster, from the Marketing Project Overview rows filed
// under Project Name "Event Room 5,6,7". See lib/policylounge.ts for where the people come from.

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const KEY = "policy-lounge";

// ?role=Speaker | Moderator | all
//
// SPEAKER IS THE DEFAULT, and that is a decision rather than laziness: the tab a visitor should land
// on is the speakers, and whatever gets pasted on techbbq.dk fetches this URL bare. Defaulting to
// "all" would drop three moderators into the middle of a speaker grid on a live page with no way to
// correct it except a re-paste. Same reasoning as /api/fintech-speakers.
//
// An unknown value falls back to Speaker rather than serving everyone, for the same reason.
const DEFAULT_ROLE: PolicyRole = "Speaker";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  const param = req.nextUrl.searchParams.get("role");
  const role =
    param === "all"
      ? "all"
      : (POLICY_ROLES as readonly string[]).includes(param ?? "")
        ? (param as PolicyRole)
        : DEFAULT_ROLE;

  try {
    if (gate.fresh) invalidate(KEY);

    // One Airtable read serves every variant: the lib returns both roles and the filter happens
    // after the cache, the same way ?tier=, ?kind= and ?stage= work elsewhere.
    const all = await cached(KEY, fetchPolicyLounge, feedTtlMs());
    const people = role === "all" ? all : all.filter((p) => p.role === role);

    // `counts` lets the dashboard label its tabs without a request per tab.
    const counts = Object.fromEntries(
      POLICY_ROLES.map((r) => [r, all.filter((p) => p.role === r).length])
    );

    return feedResponse({ count: people.length, role, counts, people }, gate);
  } catch (err) {
    console.error("[/api/policy-lounge]", err);
    return errorResponse(err, "Something went wrong loading the Policy Lounge.", gate);
  }
}
