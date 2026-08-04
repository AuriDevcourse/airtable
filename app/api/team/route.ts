import { NextRequest } from "next/server";
import { fetchTeam, DEPARTMENTS } from "@/lib/team";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { dailyTtlMs } from "@/lib/cachePolicy";

// The team list changes a few times a year, so outside the event window it refreshes ONCE A
// DAY rather than hourly like the speaker feeds (Auri's rule, 2026-07-30). Two layers, both
// set from lib/cachePolicy.ts: the in-memory cache and the CDN's s-maxage. Consequence to
// know about: an Airtable edit can take up to 24h to appear.
//
// Until the end of August 27th the policy shortens both to the event cadence, so a late
// team edit lands within the half hour like everything else; the daily rule comes back on
// its own on the 28th. Either way the refresh button on /team forces a live read now.
export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "team");
  if (!gate.ok) return gate.res;

  // Optional ?department=Marketing etc. Validated against the known allow-list.
  const deptParam = req.nextUrl.searchParams.get("department");
  const department = deptParam && DEPARTMENTS.includes(deptParam) ? deptParam : undefined;

  const key = `team:${department || "all"}`;

  try {
    if (gate.fresh) invalidate(key);

    const members = await cached(key, () => fetchTeam(department), dailyTtlMs());
    return feedResponse(
      { count: members.length, department: department || "all", team: members },
      gate,
      { daily: true }
    );
  } catch (err) {
    console.error("[/api/team]", err);
    return errorResponse(err, "Something went wrong loading the team.");
  }
}
