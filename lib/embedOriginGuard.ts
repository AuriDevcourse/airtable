/**
 * A runtime guard baked into every pasted embed, so a snippet on techbbq.dk can never call a
 * loopback address or a fat-fingered URL.
 *
 * WHY THIS EXISTS ON TOP OF lib/embedOrigin.ts. That module fixes the COPY: the button can no
 * longer emit "http://localhost:3000". This one fixes the PASTE, which is a different problem:
 *   · snippets copied before that fix are already sitting in WordPress widgets, and each is a
 *     frozen copy nobody re-generates until it visibly breaks
 *   · the line gets hand-edited, and a semicolon inside the quotes
 *     (`var ORIGIN="https://…app;"`) produces an invalid hostname and a dead fetch. Happened
 *     on the partners page, 2026-08-10.
 *
 * So the snippet repairs itself: trailing punctuation and slashes are trimmed, and a loopback
 * origin is replaced with the deployed connector. A visitor's browser cannot reach the machine
 * a snippet was copied from, so localhost is never a value worth honouring at render time —
 * unlike at copy time, where it is at least a real dev server.
 *
 * Emitted as JS text rather than shared as a function, because these builders produce strings
 * that run inside someone else's page with no bundler and no imports.
 */

/** The connector the guard falls back to. Override with NEXT_PUBLIC_EMBED_ORIGIN at build time. */
const FALLBACK = process.env.NEXT_PUBLIC_EMBED_ORIGIN || "https://airtable-woad.vercel.app";

/**
 * A `var ORIGIN=...` declaration plus the guard, for the builders that keep an ORIGIN variable
 * and use it for both the fetch and for absolutising `/api/photo/...` paths.
 *
 * `indent` matches the surrounding snippet so the pasted code stays readable in the widget.
 */
export function originDecl(indent = "  "): string {
  return [
    `${indent}var ORIGIN="__ORIGIN__";`,
    `${indent}/* Self-repair, see lib/embedOriginGuard.ts: strip a stray ";" or trailing slash a`,
    `${indent}   hand-edit may have left inside the quotes, then refuse a loopback origin — a`,
    `${indent}   visitor's browser cannot reach the machine this was copied from. */`,
    `${indent}ORIGIN=String(ORIGIN).trim().replace(/[;,\\s]+$/,"").replace(/\\/+$/,"");`,
    `${indent}if(!/^https?:\\/\\//i.test(ORIGIN)||/^https?:\\/\\/(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1\\])(:|\\/|$)/i.test(ORIGIN)){`,
    `${indent}  ORIGIN="${FALLBACK}";`,
    `${indent}}`,
  ].join("\n");
}

/**
 * The same guard for the builders that inline the origin straight into an ENDPOINT string and
 * keep no ORIGIN variable. Declares ORIGIN, repairs it, then rebuilds ENDPOINT from it.
 */
export function endpointDecl(path: string, indent = "  "): string {
  return [
    originDecl(indent),
    `${indent}var ENDPOINT=ORIGIN+${JSON.stringify(path)};`,
  ].join("\n");
}
