import { NextRequest, NextResponse } from "next/server";
import { fetchHubSpeakers, HubError } from "@/lib/hub";
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
    const res = NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(limit.retryAfter));
    return withCors(res);
  }

  try {
    const speakers = await cached("speakers-2026", fetchHubSpeakers);
    const res = NextResponse.json(
      { count: speakers.length, speakers },
      { status: 200 }
    );
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return withCors(res);
  } catch (err) {
    const status = err instanceof HubError ? err.status : 500;
    const message =
      err instanceof HubError
        ? err.message
        : "Something went wrong loading 2026 speakers.";
    console.error("[/api/speakers-2026]", err);
    return withCors(NextResponse.json({ error: message }, { status }));
  }
}
