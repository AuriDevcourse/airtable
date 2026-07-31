import { NextRequest, NextResponse } from "next/server";
import { fetchNass } from "@/lib/nass";
import { rateLimit, cached } from "@/lib/rate-limit";
import { FEED_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Optional ?role=Speaker | Moderator. Validated against an allow-list.
  const roleParam = req.nextUrl.searchParams.get("role");
  const ALLOWED_ROLES = ["Speaker", "Moderator"];
  const role = roleParam && ALLOWED_ROLES.includes(roleParam) ? roleParam : undefined;

  try {
    const people = await cached(`nass:${role || "all"}`, () => fetchNass(role));
    const res = NextResponse.json({ count: people.length, role: role || "all", people }, { status: 200 });
    res.headers.set("Cache-Control", FEED_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/nass-speakers]", err);
    return errorResponse(err, "Something went wrong loading NASS people.");
  }
}
