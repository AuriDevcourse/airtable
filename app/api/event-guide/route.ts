import { NextRequest } from "next/server";
import { GUIDE_SECTIONS, assertUniqueKeys, guideItems } from "@/lib/eventGuide";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";

// THE EVENT GUIDE feed: practical attendee information, from lib/eventGuide.ts.
//
// THE ONE FEED HERE THAT TOUCHES NO EXTERNAL SERVICE. The content is a TypeScript file compiled
// into the bundle, so there is no Airtable read, no token, no timeout and nothing that can 502.
// It still goes through the shared feedGate/feedResponse plumbing rather than returning a bare
// NextResponse, for two reasons: the pasted embed fetches it cross-origin and so needs exactly the
// same CORS treatment as every other feed, and the rate limiter is what stops a public URL being
// hammered for free bandwidth.
//
// `?fresh=` is honoured only because feedGate handles it centrally. It cannot do anything useful
// here — there is no cache to bust behind this, the data ships with the deploy — but the Refresh
// button is generic, and a route that 400s on a parameter every other feed accepts is a surprise.
//
// A COPY EDIT IS A DEPLOY. That is the trade Auri chose over an Airtable table (see lib/eventGuide.ts):
// the guide moves a few times a year, and the diff is worth more than the live editability.

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const KEY = "event-guide";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    // Item keys become element ids and aria-controls targets in both renderers. A duplicate would
    // wire a tab to the wrong panel and look like a CSS bug, so it fails loudly here instead.
    assertUniqueKeys();

    // `daily` caching: this content changes when someone deploys, not on a schedule, so the
    // ~30-minute summit cadence the other feeds use would buy nothing. /api/revalidate still
    // drops it if a correction has to go out immediately.
    return feedResponse(
      {
        count: guideItems().length,
        sections: GUIDE_SECTIONS,
      },
      gate,
      { daily: true }
    );
  } catch (err) {
    console.error("[/api/event-guide]", err);
    return errorResponse(err, "Something went wrong loading the event guide.", gate);
  }
}
