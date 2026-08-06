// The dashboard password check, in one place.
//
// middleware.ts gates the dashboard PAGES with it. The feed routes need the same check for
// their `?fresh=` bypass, which forces a live Airtable read and so must not be open to the
// internet (SECURITY r5: never leave a route that costs an external API call unauthenticated).
// Two copies of an auth check drift, and a drifting auth check fails open, so both callers
// import this.
//
// Runtime-agnostic on purpose: middleware runs on Edge, the routes run on Node. `atob` and
// plain string maths exist in both; Buffer and node:crypto do not.

const REALM_PASSWORD_ENV = "DASHBOARD_PASSWORD";

// Length-checked XOR rather than `===`. A plain compare returns as soon as two bytes differ,
// which leaks the length of the shared prefix to anyone timing the responses. Not a
// realistic attack over the public internet at this scale, but it costs two lines.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Does this request carry the dashboard password?
 *
 * Returns true in local development when no password is configured — that matches what
 * middleware already does, so `npm run dev` needs no secrets. In production a missing
 * password FAILS CLOSED: a misconfigured deploy must never quietly publish an
 * Airtable-hitting bypass.
 */
export function isDashboardRequest(authorization: string | null): boolean {
  const expected = process.env[REALM_PASSWORD_ENV];

  if (!expected) return process.env.NODE_ENV === "development";
  if (!authorization?.startsWith("Basic ")) return false;

  let decoded = "";
  try {
    decoded = atob(authorization.slice(6));
  } catch {
    return false;
  }

  // Username is cosmetic — any name works, the password is the secret.
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return password.length > 0 && safeEqual(password, expected);
}
