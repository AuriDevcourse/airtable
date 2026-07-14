// Basic-auth wall for the INTERNAL surface only (/internal pages + /api/internal API).
// These expose staff emails, which must never be world-readable. The public speaker/team
// feeds (/api/team, /team, etc.) are untouched and stay open for the website embed.
//
// Fails CLOSED: if INTERNAL_USER / INTERNAL_PASS are not set on the server, every internal
// request is denied. A misconfigured deploy can never leave the email view open.

import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/internal/:path*", "/api/internal/:path*"],
};

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="TechBBQ internal", charset="UTF-8"' },
  });
}

export function middleware(req: NextRequest) {
  const USER = process.env.INTERNAL_USER;
  const PASS = process.env.INTERNAL_PASS;
  if (!USER || !PASS) return unauthorized(); // fail closed

  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return unauthorized();

  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(":");
  const user = idx >= 0 ? decoded.slice(0, idx) : "";
  const pass = idx >= 0 ? decoded.slice(idx + 1) : "";

  if (user !== USER || pass !== PASS) return unauthorized();
  return NextResponse.next();
}
