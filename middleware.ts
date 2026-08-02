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
  "/api/program",
  "/api/life-science",
  "/api/team",
  "/api/sync-speakers", // guarded by CRON_SECRET instead
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
