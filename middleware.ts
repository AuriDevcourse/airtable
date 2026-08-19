// Password gate for the dashboard PAGES only.
//
// The read feeds under /api are deliberately NOT gated: techbbq.dk fetches them
// cross-origin from the Elementor embeds, and a browser fetch() cannot answer a Basic
// auth challenge. Gating them would take the speaker grids off the live site. They are
// already safe by design — each one returns an allow-listed, marketing-only slice.
//
// /api/sync-speakers is also skipped here because it carries its own CRON_SECRET check
// for the scheduler. The browser-facing sync lives at /api/admin/sync, which IS gated.

import { NextRequest, NextResponse } from "next/server";
import { isDashboardRequest } from "@/lib/dashboardAuth";

// Exact pathnames, not prefixes — "/api/speakers" is a prefix of "/api/speakers-2026",
// so a startsWith() check here would be a footgun the moment someone adds a route.
//
// ADDING A FEED? ADD IT HERE, AND KNOW THAT LOCAL DEV WILL NOT TELL YOU.
// A route missing from this list returns 401 with no CORS headers, and the browser reports it as
// "No 'Access-Control-Allow-Origin' header is present" — which sends you hunting through the CORS
// code instead of looking here. It cannot reproduce locally either: isDashboardRequest() allows
// everything when no DASHBOARD_PASSWORD is set, which is the normal `npm run dev` state.
// /api/policy-stage shipped without its entry and broke on techbbq.dk exactly this way (2026-08-05).
const PUBLIC_PATHS = new Set([
  "/api/speakers",
  "/api/speakers-2026",
  "/api/all-speakers",
  "/api/main-speakers",
  "/api/niss-speakers",
  "/api/niss-2025",
  "/api/nass-speakers",
  "/api/event-room-presenters",
  "/api/partner-events",
  "/api/investor-speakers",
  "/api/fintech-speakers",
  "/api/policy-stage",
  // Same reasoning as /api/policy-stage, and listed here the day the route was written rather than
  // after it broke: the WordPress embed fetches it cross-origin and a browser fetch() cannot answer
  // a Basic auth challenge. The unfinished rows it can also report (needsRole) are gated inside the
  // route on the dashboard password, exactly like ?pending=1 on /api/interns.
  "/api/board-summit",
  "/api/program",
  // The roster side of /api/program, and public for the same reason: the pasted grid on techbbq.dk
  // fetches it cross-origin. Listed the day the route shipped would have been better — it went out
  // without an entry on 2026-08-19 and 401'd on the deployed dashboard, which is exactly the failure
  // this comment block warns about.
  "/api/program-speakers",
  "/api/life-science",
  "/api/ls-startups",
  "/api/partners",
  "/api/team",
  // Static attendee information from lib/eventGuide.ts. No Airtable read, no token, no PII —
  // every word of it is meant to be on techbbq.dk.
  "/api/event-guide",
  // Public by the same reasoning as the rest: the WordPress embed fetches it cross-origin and a
  // browser fetch() cannot answer a Basic auth challenge. What makes it safe is that the strict
  // read only ever contains interns who ticked "Consent to publish" — the ?pending=1 variant that
  // shows the unfinished ones IS password-checked, inside the route.
  "/api/interns",
  // THE ONLY WRITE ROUTE IN THIS PROJECT, and the only PAGE in this list.
  //
  // The interns filling this in are not TechBBQ staff and have no dashboard password, so the form
  // and the endpoint behind it have to be reachable without one. That is a deliberate hole and it
  // is defended where a password would have been: a hard per-IP rate limit, every field length-
  // capped, the photo checked against its magic bytes, a honeypot, and — the part that matters —
  // `Put on web` and `Show until` are never read from the request, so a submission cannot publish
  // itself. See app/api/interns/apply/route.ts.
  "/api/interns/apply",
  "/interns/apply",
  "/api/sync-speakers", // guarded by CRON_SECRET instead
  // Airtable's Automation cannot answer a Basic auth challenge, so this bypasses the dashboard
  // password the same way /api/sync-speakers does — and is guarded the same way, by its own
  // bearer secret (REVALIDATE_SECRET), compared constant-time and failing closed when unset.
  // It writes nothing and reads nothing; it only drops this project's cache.
  "/api/revalidate",
  // Returns embed markup, not data. Every byte of it is already public in the source of any
  // page that has pasted the snippet, it reads no protected feed and it calls no paid API,
  // so gating it would protect nothing while making the snippet impossible to fetch from the
  // WordPress editor that needs it.
  "/api/embed",
]);

const REALM = 'Basic realm="TechBBQ Connector", charset="UTF-8"';

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

// The photo proxy is the one prefix exception: /api/photo/<feed>/<recordId> is a
// dynamic route, so it can't be listed exactly. The trailing slash keeps it from
// shadowing any future sibling ("/api/photos"), and the route itself rejects
// anything that isn't a registered feed + well-formed record id.
const PUBLIC_PREFIXES = ["/api/photo/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Shared with the feed routes' ?fresh= bypass — see lib/dashboardAuth.ts. It allows local
  // dev with no password set and fails closed in production when the env var is missing.
  if (isDashboardRequest(req.headers.get("authorization"))) return NextResponse.next();

  return unauthorized();
}

export const config = {
  // Everything except Next's own static output and the public files the pages need.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|backgrounds|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
