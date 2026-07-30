import { NextRequest, NextResponse } from "next/server";
import { fetchTeam, TeamError, DEPARTMENTS } from "@/lib/team";
import { rateLimit, cached, DAY_MS } from "@/lib/rate-limit";

// The team list changes a few times a year, so it refreshes ONCE A DAY rather than hourly
// like the speaker feeds (Auri's rule, 2026-07-30). Two layers, both set to a day:
// the in-memory cache below and the CDN's s-maxage. Consequence to know about: an Airtable
// edit can take up to 24h to appear. A deploy resets the in-memory cache instantly, so an
// empty commit is the way to force it sooner.
export const dynamic = "force-dynamic";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function withCors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.headers.set("Vary", "Origin");
  return res;
}

export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return withCors(res);
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const limit = rateLimit(ip);
  if (!limit.ok) {
    const res = NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    res.headers.set("Retry-After", String(limit.retryAfter));
    return withCors(res);
  }

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
    res.headers.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
    return withCors(res);
  } catch (err) {
    const status = err instanceof TeamError ? err.status : 500;
    const message = err instanceof TeamError ? err.message : "Something went wrong loading the team.";
    console.error("[/api/team]", err);
    return withCors(NextResponse.json({ error: message }, { status }));
  }
}
