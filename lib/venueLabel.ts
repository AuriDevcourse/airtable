/**
 * The venue line on a partner-hosted event card, or undefined when there is nothing worth
 * printing.
 *
 * A host who runs the event at their own office puts their own name in Luma's location field, so
 * a card would read "Hosted by Rockstart" and then "Rockstart · København" underneath. When the
 * venue only repeats the host, the city carries the line on its own.
 *
 * SHARED ON PURPOSE. This started life inside lib/sideEvents.ts, serving Program 2026 only, and
 * /partner-events grew its own near-copy that lacked the same-as-host rule — which is exactly how
 * the two pages printed different second lines for the same event (Auri, 2026-08-10). One
 * function, imported by both, so a change to the rule cannot land on one page and not the other.
 *
 * Pure and dependency-free, so a client component can import it without pulling a fetch path
 * into the browser bundle.
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function venueLabel(
  venue: string | null | undefined,
  city: string | null | undefined,
  company: string | null | undefined
): string | undefined {
  const v = (venue || "").trim();
  const c = (city || "").trim();
  const sameAsHost = v && company && fold(v) === fold(company);
  // A venue that already names the city does not need it appended: one Luma page gives
  // "København, Denmark", which joined to its own city read "København, Denmark · København".
  const cityIsInVenue = v && c && fold(v).includes(fold(c));
  return [sameAsHost ? "" : v, cityIsInVenue ? "" : c].filter(Boolean).join(" · ") || undefined;
}
