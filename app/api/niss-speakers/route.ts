import { NextRequest, NextResponse } from "next/server";
import { fetchNiss, NissError } from "@/lib/niss";
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

  // Optional ?role=Speaker | Moderator | Team. Validated against an allow-list.
  const roleParam = req.nextUrl.searchParams.get("role");
  const ALLOWED_ROLES = ["Speaker", "Moderator", "Team"];
  const role = roleParam && ALLOWED_ROLES.includes(roleParam) ? roleParam : undefined;

  try {
    const people = await cached(`niss:${role || "all"}`, () => fetchNiss(role));
    const res = NextResponse.json({ count: people.length, role: role || "all", people }, { status: 200 });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return withCors(res);
  } catch (err) {
    const status = err instanceof NissError ? err.status : 500;
    const message = err instanceof NissError ? err.message : "Something went wrong loading NISS people.";
    console.error("[/api/niss-speakers]", err);
    return withCors(NextResponse.json({ error: message }, { status }));
  }
}
