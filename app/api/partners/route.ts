// The partner wall's feed.
//
// TWO AUDIENCES, ONE FETCH. techbbq.dk gets only the partners that are finished: "Put on web"
// ticked and a logo the wall can draw. The dashboard also wants the unfinished ones, drawn as named
// placeholder tiles, because that is the list of logos still to chase (Auri, 2026-08-05).
//
// So Airtable is read ONCE, pending rows included, and the public response filters them out.
// `?pending=1` keeps them, and it needs the dashboard password: an unannounced partnership has no
// business on a public endpoint. Strict is the DEFAULT, so a pasted snippet that never heard of this
// parameter keeps behaving exactly as it does today.
import { NextRequest } from "next/server";
import { fetchPartners, PARTNER_TIERS } from "@/lib/partners";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { isDashboardRequest } from "@/lib/dashboardAuth";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const TIERS: readonly string[] = PARTNER_TIERS.map((t) => t.name);

const KEY = "partners";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    // Cached WITH the pending rows, then narrowed below. One Airtable read serves both audiences;
    // caching the two lists separately would double the calls to say the same thing twice.
    // KEY is passed so the per-feed cadence overrides in lib/cachePolicy.ts apply — this feed is
    // in NEAR_LIVE_FEEDS. Without it the call gets the default and the override does nothing,
    // silently.
    const all = await cached(KEY, () => fetchPartners({ includePending: true }), feedTtlMs(KEY));

    const wantsPending =
      req.nextUrl.searchParams.get("pending") !== null &&
      isDashboardRequest(req.headers.get("authorization"));
    // ROW filtering and FIELD stripping are two different jobs, and only the first was here.
    //
    // `pending` marks a row as not-live, so dropping those rows is enough for it. `paying` is
    // different: it sits on rows that ARE live, so filtering cannot remove it and the commercial
    // data would ride along into the public feed and out to the wall pasted on techbbq.dk. Auri
    // asked for that label on /partners only (2026-08-20: "make sure it doesnt copy to embed").
    //
    // So the public list is REBUILT without it rather than filtered. Any future internal-only
    // field goes in this list too — the default in this route is public, and the embeds fetching
    // without `?pending=1` is not a safeguard, it is a coincidence of how they are written.
    const live = wantsPending
      ? all
      : all
          .filter((p) => !p.pending)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ paying, ...pub }) => pub);

    // ?tier=Prime|Main|… narrows to one tier, so a page can embed a single band. Filtered
    // after the cache, like every other feed, so all variants share one Airtable fetch.
    // An unknown value serves everyone, matching ?kind=, ?stage=, ?section= and ?category=.
    const tier = req.nextUrl.searchParams.get("tier");
    const partners = tier && TIERS.includes(tier) ? live.filter((p) => p.tier === tier) : live;

    // A pending read is authenticated, so it takes the same treatment as ?fresh=: never stored by
    // the CDN and never CORS-tagged. Otherwise a cached copy could answer a public visitor with the
    // partners we have not announced.
    return feedResponse(
      { count: partners.length, tiers: PARTNER_TIERS, partners },
      wantsPending ? { ...gate, fresh: true } : gate,
      { key: KEY }
    );
  } catch (err) {
    console.error("[/api/partners]", err);
    return errorResponse(err, "Something went wrong loading partners.", gate);
  }
}
