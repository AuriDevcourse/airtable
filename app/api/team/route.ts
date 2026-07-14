import { NextRequest, NextResponse } from "next/server";
import { fetchTeam, TeamError, DEPARTMENTS } from "@/lib/team";
import { rateLimit, cached } from "@/lib/rate-limit";

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
    const members = await cached(`team:${department || "all"}`, () => fetchTeam(department));
    const res = NextResponse.json(
      { count: members.length, department: department || "all", team: members },
      { status: 200 }
    );
    res.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return withCors(res);
  } catch (err) {
    const status = err instanceof TeamError ? err.status : 500;
    const message = err instanceof TeamError ? err.message : "Something went wrong loading the team.";
    console.error("[/api/team]", err);
    return withCors(NextResponse.json({ error: message }, { status }));
  }
}
