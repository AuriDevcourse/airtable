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

// Exact pathnames, not prefixes — "/api/speakers" is a prefix of "/api/speakers-2026",
// so a startsWith() check here would be a footgun the moment someone adds a route.
const PUBLIC_PATHS = new Set([
  "/api/speakers",
  "/api/speakers-2026",
  "/api/main-speakers",
  "/api/niss-speakers",
  "/api/niss-2025",
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

export function middleware(req: NextRequest) {
  if (PUBLIC_PATHS.has(req.nextUrl.pathname)) return NextResponse.next();

  const expected = process.env.DASHBOARD_PASSWORD;

  // No password configured: fine locally, but never let a misconfigured deploy quietly
  // publish the dashboard. Fails closed in production, the same way /api/sync-speakers does.
  if (!expected) {
    if (process.env.NODE_ENV === "development") return NextResponse.next();
    return unauthorized();
  }

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6)); // Edge runtime has atob, not Buffer
    } catch {
      return unauthorized();
    }
    // Username is cosmetic — any name works, the password is the secret.
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (password && password === expected) return NextResponse.next();
  }

  return unauthorized();
}

export const config = {
  // Everything except Next's own static output and the public files the pages need.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|backgrounds|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
