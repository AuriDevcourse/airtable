import { NextRequest } from "next/server";
import { fetchNass } from "@/lib/nass";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "nass-speakers");
  if (!gate.ok) return gate.res;

  // Optional ?role=Speaker | Moderator. Validated against an allow-list.
  const roleParam = req.nextUrl.searchParams.get("role");
  const ALLOWED_ROLES = ["Speaker", "Moderator"];
  const role = roleParam && ALLOWED_ROLES.includes(roleParam) ? roleParam : undefined;

  const key = `nass:${role || "all"}`;

  try {
    if (gate.fresh) invalidate(key);

    const people = await cached(key, () => fetchNass(role), feedTtlMs());
    return feedResponse({ count: people.length, role: role || "all", people }, gate);
  } catch (err) {
    console.error("[/api/nass-speakers]", err);
    return errorResponse(err, "Something went wrong loading NASS people.");
  }
}
