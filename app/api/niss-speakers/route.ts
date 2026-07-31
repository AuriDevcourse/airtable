import { NextRequest, NextResponse } from "next/server";
import { fetchNiss } from "@/lib/niss";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Optional ?role=Speaker | Moderator | Team. Validated against an allow-list.
  const roleParam = req.nextUrl.searchParams.get("role");
  const ALLOWED_ROLES = ["Speaker", "Moderator", "Brand Ambassadors", "Team Member"];
  const role = roleParam && ALLOWED_ROLES.includes(roleParam) ? roleParam : undefined;

  try {
    const people = await cached(`niss:${role || "all"}`, () => fetchNiss(role));
    const res = NextResponse.json({ count: people.length, role: role || "all", people }, { status: 200 });
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/niss-speakers]", err);
    return errorResponse(err, "Something went wrong loading NISS people.");
  }
}
