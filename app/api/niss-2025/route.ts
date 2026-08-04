import { NextRequest } from "next/server";
import { fetchNiss2025 } from "@/lib/niss2025";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "niss-2025");
  if (!gate.ok) return gate.res;

  // Optional ?role=Speaker | Moderator | Team. Validated against an allow-list.
  const roleParam = req.nextUrl.searchParams.get("role");
  const ALLOWED_ROLES = ["Speaker", "Moderator", "Team"];
  const role = roleParam && ALLOWED_ROLES.includes(roleParam) ? roleParam : undefined;

  const key = `niss2025:${role || "all"}`;

  try {
    if (gate.fresh) invalidate(key);

    const people = await cached(key, () => fetchNiss2025(role), feedTtlMs());
    return feedResponse({ count: people.length, role: role || "all", people }, gate);
  } catch (err) {
    console.error("[/api/niss-2025]", err);
    return errorResponse(err, "Something went wrong loading NISS 2025 people.");
  }
}
