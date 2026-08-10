// The origin baked into a copied embed snippet (__ORIGIN__).
//
// Every copy button used `window.location.origin`, which is correct on the deployed
// dashboard and silently wrong on localhost: the snippet then fetches
// http://localhost:3000/api/... from techbbq.dk, which resolves to the visitor's own
// machine and never loads. That is exactly how the 2026 partners page broke — the wall
// sat on "Loading…" for anyone but the person who copied it.
//
// So: never hand out a loopback origin. If the dashboard is running locally, fall back to
// the deployed connector, which is the only origin a snippet on someone else's site can
// usefully call. Override with NEXT_PUBLIC_EMBED_ORIGIN if the deploy URL ever changes.
const FALLBACK_ORIGIN =
  process.env.NEXT_PUBLIC_EMBED_ORIGIN || "https://airtable-woad.vercel.app";

const LOOPBACK = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;

export function embedOrigin(): string {
  if (typeof window === "undefined") return FALLBACK_ORIGIN;
  return LOOPBACK.test(window.location.hostname)
    ? FALLBACK_ORIGIN
    : window.location.origin;
}

// True when the copy button is about to hand out FALLBACK_ORIGIN instead of the page's own
// origin, so the UI can say so rather than letting it be a surprise.
export function isLocalDashboard(): boolean {
  return typeof window !== "undefined" && LOOPBACK.test(window.location.hostname);
}
