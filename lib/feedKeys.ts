// FEED NAME → SERVER CACHE KEY.
//
// The names on the left are what an Airtable Automation sends to /api/revalidate; the strings on
// the right are the `cached(...)` keys the feed routes actually use (lib/rate-limit.ts).
//
// It is a map rather than "just send the key" on purpose: the keys are internal and several are
// non-obvious (`partnerevents` with no separator, `program:policy` with one), and an Automation
// built by someone in the Airtable UI should not have to know them. A wrong name here fails
// loudly with a list of valid ones instead of silently purging nothing.
//
// WHEN YOU ADD A FEED: add its `const KEY = "..."` value here too, or the webhook will not be
// able to refresh it and nobody will notice until an edit fails to appear.

// A key ending in ":" is a PREFIX and clears every variant under it. Several feeds cache per
// query parameter — `niss:all` alongside `niss:Speaker`, `team:all` alongside `team:Marketing`,
// `investors:all` alongside `investors:lp-forum` — and clearing one variant while leaving the
// others is worse than not refreshing: the same edit then shows on one view of a page and not
// another. Anything without a trailing ":" is matched exactly.
export const FEED_KEYS: Record<string, string[]> = {
  speakers: ["speakers"],
  "speakers-2026": ["speakers-2026"],
  "main-speakers": ["main-speakers"],
  partners: ["partners"],
  "partner-events": ["partnerevents"],
  "policy-stage": ["policy-stage"],
  "life-science": ["lifescience:"],
  "ls-startups": ["ls-startups"],
  "fintech-speakers": ["fintech-speakers"],
  "event-room-presenters": ["eventrooms"],
  interns: ["interns"],
  niss: ["niss:"],
  nass: ["nass:"],
  investors: ["investors:"],
  team: ["team:"],
  // Composite feeds own no key of their own — they are assembled from the sources below, so
  // purging "all-speakers" has to purge what it is built from. Same list as SOURCE_KEYS in
  // app/api/all-speakers/route.ts; if that changes, change this.
  "all-speakers": [
    "speakers-2026",
    "niss:",
    "nass:",
    "eventrooms",
    "fintech-speakers",
    "investors:",
  ],
  // Every agenda source: policy, brella, niss, fintech. One prefix rather than four literals,
  // because `program:${source}` is built from a variable in app/api/program/route.ts and a new
  // source would otherwise be missed here.
  program: ["program:"],
  "side-events": ["luma:"],
  hierarchy: ["hierarchy-2026"],
  "summit-extras": ["summit-extras"],
};

/** Every key this project caches, for `{"all": true}`. */
export const ALL_FEED_KEYS: string[] = [
  ...new Set(Object.values(FEED_KEYS).flat()),
];

export const FEED_NAMES: string[] = Object.keys(FEED_KEYS).sort();

/**
 * Resolve the requested feed names to cache keys.
 *
 * Unknown names are returned separately rather than ignored: an Automation with a typo would
 * otherwise report success while refreshing nothing, which is the failure mode that makes people
 * stop trusting the webhook.
 */
export function resolveFeeds(names: string[]): { keys: string[]; unknown: string[] } {
  const keys = new Set<string>();
  const unknown: string[] = [];
  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    const mapped = FEED_KEYS[name];
    if (!mapped) {
      unknown.push(raw);
      continue;
    }
    for (const k of mapped) keys.add(k);
  }
  return { keys: [...keys], unknown };
}
