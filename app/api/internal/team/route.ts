// INTERNAL team feed WITH email. Guarded by middleware.ts Basic auth (matcher covers
// /api/internal/*). Never embed this on the public site. No CORS/cache headers on purpose:
// this must not be cacheable by a CDN or callable cross-origin.

import { NextRequest, NextResponse } from "next/server";
import { fetchTeam, TeamError, DEPARTMENTS } from "@/lib/team";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const limit = rateLimit(ip);
  if (!limit.ok) {
    const res = NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    res.headers.set("Retry-After", String(limit.retryAfter));
    return res;
  }

  const deptParam = req.nextUrl.searchParams.get("department");
  const department = deptParam && DEPARTMENTS.includes(deptParam) ? deptParam : undefined;

  try {
    const members = await fetchTeam(department, true); // includeEmail = true
    const res = NextResponse.json(
      { count: members.length, department: department || "all", team: members },
      { status: 200 }
    );
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    const status = err instanceof TeamError ? err.status : 500;
    const message = err instanceof TeamError ? err.message : "Something went wrong loading the team.";
    console.error("[/api/internal/team]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
