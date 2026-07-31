import { NextRequest, NextResponse } from "next/server";
import { fetchTeam, DEPARTMENTS } from "@/lib/team";
import { rateLimit, cached, DAY_MS } from "@/lib/rate-limit";
import { DAILY_CACHE_CONTROL, clientIp, corsPreflight, errorResponse, tooManyRequests, withCors } from "@/lib/apiRoute";

// The team list changes a few times a year, so it refreshes ONCE A DAY rather than hourly
// like the speaker feeds (Auri's rule, 2026-07-30). Two layers, both set to a day:
// the in-memory cache below and the CDN's s-maxage. Consequence to know about: an Airtable
// edit can take up to 24h to appear. A deploy resets the in-memory cache instantly, so an
// empty commit is the way to force it sooner.
export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  const limit = rateLimit(ip);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Optional ?department=Marketing etc. Validated against the known allow-list.
  const deptParam = req.nextUrl.searchParams.get("department");
  const department = deptParam && DEPARTMENTS.includes(deptParam) ? deptParam : undefined;

  try {
    const members = await cached(
      `team:${department || "all"}`,
      () => fetchTeam(department),
      DAY_MS
    );
    const res = NextResponse.json(
      { count: members.length, department: department || "all", team: members },
      { status: 200 }
    );
    // Fresh for a day, then servable stale for another day while it refetches — so the
    // once-a-day refresh never makes a visitor wait on Airtable.
    res.headers.set("Cache-Control", DAILY_CACHE_CONTROL);
    return withCors(res);
  } catch (err) {
    console.error("[/api/team]", err);
    return errorResponse(err, "Something went wrong loading the team.");
  }
}
