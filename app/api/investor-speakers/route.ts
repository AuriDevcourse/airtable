import { NextRequest } from "next/server";
import { fetchInvestors, INVESTOR_EVENTS, InvestorEventKey } from "@/lib/investors";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { isDashboardRequest } from "@/lib/dashboardAuth";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";
// The filterByFormula scan of the wide Marketing table can be slow + retries once.
export const maxDuration = 30;

export const OPTIONS = corsPreflight;

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "investor-speakers");
  if (!gate.ok) return gate.res;

  // Optional ?event=pension-summit | lp-forum. Validated against the known keys.
  const eventParam = req.nextUrl.searchParams.get("event");
  const event =
    eventParam && eventParam in INVESTOR_EVENTS ? (eventParam as InvestorEventKey) : undefined;

  const key = `investors:${event || "all"}`;

  try {
    if (gate.fresh) invalidate(key);

    // Cached WITH the photoless rows, then narrowed below — one Airtable read serves both the
    // dashboard and the public feed, exactly as /api/partners does it. Caching the two lists
    // separately would double the calls to say the same thing twice.
    const all = await cached(key, () => fetchInvestors(event, true), feedTtlMs());

    // ?pending=1 keeps the rows with no Profile Picture, and it needs the dashboard password.
    // Without both, a person with no headshot is dropped, so nothing pasted on techbbq.dk can
    // render a faceless card. The check is the AND of the two on purpose: the param alone is
    // guessable, and this is the only thing standing between an unfinished row and the public site.
    const wantsPending =
      req.nextUrl.searchParams.get("pending") !== null &&
      isDashboardRequest(req.headers.get("authorization"));
    const people = wantsPending ? all : all.filter((p) => !p.pending);

    // A pending read is authenticated, so it is treated like a live-read: never stored by the CDN
    // and never CORS-tagged, or a cached copy could answer a techbbq.dk visitor with a faceless card.
    return feedResponse(
      { count: people.length, event: event || "all", people },
      wantsPending ? { ...gate, fresh: true } : gate
    );
  } catch (err) {
    console.error("[/api/investor-speakers]", err);
    return errorResponse(err, "Something went wrong loading investor speakers.", gate);
  }
}
