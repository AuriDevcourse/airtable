// The intern pool's feed.
//
// TWO AUDIENCES, ONE FETCH, exactly like /api/partners: techbbq.dk gets the interns who are
// finished — consent given, photo uploaded, dated, ticked — and the dashboard also wants the
// unfinished ones so somebody can see what is missing. `?pending=1` keeps them and needs the
// dashboard password.
//
// THE ONE DIFFERENCE FROM EVERY OTHER FEED HERE, and it is not a detail: an intern who has not
// ticked "Consent to publish" is reduced to a bare name by lib/interns.ts before this route ever
// sees them — no pitch, no photo, no LinkedIn — even on the authenticated read. See the header
// there. Nothing in this file can undo that, which is the point of doing it there.
import { NextRequest } from "next/server";
import { fetchInterns, INTERN_DEPARTMENTS } from "@/lib/interns";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { isDashboardRequest } from "@/lib/dashboardAuth";
import { feedTtlMs } from "@/lib/cachePolicy";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const KEY = "interns";

// ─── ONE SHAPE FOR BOTH AUDIENCES (Auri, 2026-08-19) ────────────────────────────────────
// `pitchFull` and `managers` used to be stripped here so techbbq.dk could not draw them. Both now
// go out on the public read as well, because the embed renders both:
//
//   `pitchFull` backs the "Read full pitch" toggle. The card still LEADS with the 220-character
//   version — that is what keeps a row of cards the same height — and the full text is revealed
//   only when a reader presses for it.
//
//   `managers` is who the intern reports to at TechBBQ, with the manager's LinkedIn. Published on
//   Auri's call so the wall on techbbq.dk reads exactly like the dashboard. The name and profile
//   both come from #TechBBCuties, where /api/team already publishes them, so this exposes nothing
//   that is not already on the team wall.
//
// `Email` is still never requested at all — see lib/interns.ts. That gate has not moved.
//
// The consent gate has not moved either: an intern who has not ticked it is reduced to a bare name
// in lib/interns.ts before this route sees them, and pending rows never leave on a public read.

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  try {
    if (gate.fresh) invalidate(KEY);

    // Cached WITH the pending rows and narrowed below, so one Airtable read serves both audiences.
    // NOT cached per department: the filter is a slice of the same list, and caching each slice
    // separately would multiply the Airtable calls to say the same thing nine ways.
    const all = await cached(KEY, () => fetchInterns({ includePending: true }), feedTtlMs());

    const wantsPending =
      req.nextUrl.searchParams.get("pending") !== null &&
      isDashboardRequest(req.headers.get("authorization"));
    const live = wantsPending ? all : all.filter((i) => !("pending" in i && i.pending));

    // ?department=Marketing narrows to one team, validated against the known list so an unknown
    // value serves everyone rather than returning an empty page that looks like a broken feed.
    const deptParam = req.nextUrl.searchParams.get("department");
    const department = deptParam && INTERN_DEPARTMENTS.includes(deptParam) ? deptParam : undefined;
    const interns = department ? live.filter((i) => i.department === department) : live;

    // A pending read is authenticated, so it takes the same treatment as ?fresh=: never stored by
    // the CDN and never CORS-tagged, or a cached copy could answer a public visitor with the
    // records that have not cleared the gates.
    return feedResponse(
      {
        count: interns.length,
        department: department || "all",
        departments: INTERN_DEPARTMENTS,
        interns,
      },
      wantsPending ? { ...gate, fresh: true } : gate
    );
  } catch (err) {
    console.error("[/api/interns]", err);
    return errorResponse(err, "Something went wrong loading the intern pool.", gate);
  }
}
