import { NextRequest, NextResponse } from "next/server";
import { fetchSpeakers, AirtableError } from "@/lib/airtable";
import { rateLimit, cached } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Which site is allowed to embed/fetch this. Set to your WordPress origin in prod.
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
    const speakers = await cached("speakers", fetchSpeakers);
    const res = NextResponse.json(
      { count: speakers.length, speakers },
      { status: 200 }
    );
    // Let Vercel's CDN serve repeat hits without re-running the function.
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return withCors(res);
  } catch (err) {
    const status = err instanceof AirtableError ? err.status : 500;
    const message =
      err instanceof AirtableError
        ? err.message
        : "Something went wrong loading speakers.";
    console.error("[/api/speakers]", err);
    return withCors(NextResponse.json({ error: message }, { status }));
  }
}
