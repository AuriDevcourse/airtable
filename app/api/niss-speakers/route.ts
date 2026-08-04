import { NextRequest } from "next/server";
import { fetchNiss } from "@/lib/niss";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "niss-speakers");
  if (!gate.ok) return gate.res;

  // Optional ?role=Speaker | Moderator | Team. Validated against an allow-list.
  const roleParam = req.nextUrl.searchParams.get("role");
  const ALLOWED_ROLES = ["Speaker", "Moderator", "Brand Ambassadors", "Team Member"];
  const role = roleParam && ALLOWED_ROLES.includes(roleParam) ? roleParam : undefined;

  // One cache entry per role, so a live-read drops the entry for the role it is about to
  // read rather than all of them.
  const key = `niss:${role || "all"}`;

  try {
    if (gate.fresh) invalidate(key);

    const people = await cached(key, () => fetchNiss(role), feedTtlMs());
    return feedResponse({ count: people.length, role: role || "all", people }, gate);
  } catch (err) {
    console.error("[/api/niss-speakers]", err);
    return errorResponse(err, "Something went wrong loading NISS people.");
  }
}
