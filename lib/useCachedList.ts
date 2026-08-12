"use client";

import { useEffect, useState } from "react";
import { ChangeSummary, diffList, NO_CHANGES } from "@/lib/diffList";

export type CachedState<T> = {
  data: T[] | null; // null = nothing to show yet (cold load)
  loading: boolean; // no data AND first fetch in flight → show skeletons
  revalidating: boolean; // showing cached data while a background fetch runs
  error: string | null; // only set when there's nothing cached to fall back to
  // A background refetch failed while cached data was still on screen. The list keeps
  // rendering (stale beats blank), but the refresh button needs this — otherwise a rejected
  // fetch leaves it waiting for a change report that will never arrive.
  revalidateError: string | null;
  updated: boolean; // last revalidation actually changed the data
  // When this hook last got an ANSWER from the feed, as epoch ms. null until one lands, and
  // reset on every tab switch so it can never describe the feed you just left.
  //
  // It is when the BROWSER was answered, which is not the same as when Airtable was read: on the
  // deployed site the CDN can answer with a copy up to its own s-maxage old. So anything printing
  // this has to say "checked", not "fresh as of", and name the cadence separately — that is where
  // the staleness actually comes from (lib/cachePolicy.ts).
  fetchedAt: number | null;
  // What the last completed revalidation changed, for the local refresh button to print.
  // null = no comparison was possible (cold load: everything is "new", which is noise, so
  // nothing is reported). total === 0 = compared and genuinely identical.
  changes: ChangeSummary | null;
};

/**
 * The URL for a feed plus the manual-sync trigger for it.
 *
 * Every dashboard page has a "Refresh from Airtable" button, and pressing it cannot just
 * refetch: on the deployed site the CDN answers a repeat GET of the same URL, so a plain
 * refetch would hand back the copy already on screen. `?fresh=<n>` is a URL neither the CDN
 * nor the server cache has seen, which is what makes the read reach Airtable. The counter
 * increments per press so no two presses share a URL.
 *
 * It resets when `base` changes, so switching tabs on a page like /niss goes back to an
 * ordinary cached read instead of firing an authenticated live read per tab.
 */
export function useFreshUrl(base: string): { url: string; refresh: () => void } {
  const [pressed, setPressed] = useState({ base, n: 0 });
  const n = pressed.base === base ? pressed.n : 0;
  const url = n ? `${base}${base.includes("?") ? "&" : "?"}fresh=${n}` : base;
  return { url, refresh: () => setPressed({ base, n: n + 1 }) };
}

// Stale-while-revalidate over localStorage:
// 1. Paint cached data instantly (no skeleton) if we have it.
// 2. Always fetch in the background.
// 3. Only re-render + rewrite cache if the fresh data differs from what's shown.
//
// nonce forces a refetch without changing cacheKey. Bumping it is how the local refresh
// button re-reads a feed in place: folding a counter into cacheKey instead would write a
// new localStorage entry on every press and leave the old ones behind forever.
export function useCachedList<T>(
  cacheKey: string,
  url: string,
  listKey: string,
  nonce = 0
): CachedState<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revalidateError, setRevalidateError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [changes, setChanges] = useState<ChangeSummary | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const storeKey = `tbbq-cache:${cacheKey}`;
    setUpdated(false);
    setError(null);
    setRevalidateError(null);
    // Clear first: a diff from the previous feed must not linger after a tab switch.
    setChanges(null);
    setFetchedAt(null);

    // 1. Hydrate from cache.
    let cached: T[] | null = null;
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) cached = JSON.parse(raw) as T[];
    } catch {
      cached = null;
    }

    if (cached) {
      setData(cached);
      setLoading(false);
      setRevalidating(true);
    } else {
      setData(null);
      setLoading(true);
      setRevalidating(false);
    }

    const cachedStr = cached ? JSON.stringify(cached) : null;

    // 2. Revalidate in the background.
    //
    // cache:"no-store" is load-bearing, not belt-and-braces. The feeds send
    // `stale-while-revalidate=3600` for techbbq.dk's benefit, and a BROWSER honours that too —
    // so the dashboard's own revalidation was being answered from Chrome's disk cache with a
    // copy up to an hour old, and this hook then wrote that stale copy into localStorage as if
    // it were fresh. Three caches stacked (HTTP, localStorage, the server's own) and the middle
    // one is ours: it already gives the instant paint, so the HTTP layer adds nothing here but
    // delay. Observed 2026-08-06 — a rename showed the old label on reload after reload while
    // the server was returning the new one.
    //
    // Only affects the dashboard. techbbq.dk keeps the stale-while-revalidate behaviour, which
    // is right for a public page nobody is editing against.
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load");
        return json;
      })
      .then((json) => {
        if (!active) return;
        // Stamped on ANY answer, changed or identical: the question it answers is "when did this
        // page last check", and "nothing differed" is a completed check.
        setFetchedAt(Date.now());
        const fresh = (Array.isArray(json[listKey]) ? json[listKey] : []) as T[];
        const freshStr = JSON.stringify(fresh);
        // 3. Update only if changed.
        if (freshStr !== cachedStr) {
          setData(fresh);
          setUpdated(cachedStr !== null); // only flag as "updated" if we replaced real cache
          // Only diffable against a real baseline. On a cold load `cached` is null and every
          // row would read as "added", which says nothing.
          if (cached) setChanges(diffList(cached, fresh));
          try {
            localStorage.setItem(storeKey, freshStr);
          } catch {
            /* storage full / disabled — ignore, in-memory still works */
          }
        } else if (cached) {
          // Byte-identical to what's on screen. Say so explicitly — silence would read as
          // "the refresh didn't run".
          setChanges(NO_CHANGES);
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        // Keep showing cached data on error; only surface error if nothing cached.
        const msg = e instanceof Error ? e.message : "Failed to load";
        if (cached) setRevalidateError(msg);
        else setError(msg);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRevalidating(false);
      });

    return () => {
      active = false;
    };
  }, [cacheKey, url, listKey, nonce]);

  return { data, loading, revalidating, error, revalidateError, updated, changes, fetchedAt };
}
