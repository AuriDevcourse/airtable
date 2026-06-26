"use client";

import { useEffect, useState } from "react";

export type CachedState<T> = {
  data: T[] | null; // null = nothing to show yet (cold load)
  loading: boolean; // no data AND first fetch in flight → show skeletons
  revalidating: boolean; // showing cached data while a background fetch runs
  error: string | null; // only set when there's nothing cached to fall back to
  updated: boolean; // last revalidation actually changed the data
};

// Stale-while-revalidate over localStorage:
// 1. Paint cached data instantly (no skeleton) if we have it.
// 2. Always fetch in the background.
// 3. Only re-render + rewrite cache if the fresh data differs from what's shown.
export function useCachedList<T>(cacheKey: string, url: string, listKey: string): CachedState<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;
    const storeKey = `tbbq-cache:${cacheKey}`;
    setUpdated(false);
    setError(null);

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
    fetch(url)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load");
        return json;
      })
      .then((json) => {
        if (!active) return;
        const fresh = (Array.isArray(json[listKey]) ? json[listKey] : []) as T[];
        const freshStr = JSON.stringify(fresh);
        // 3. Update only if changed.
        if (freshStr !== cachedStr) {
          setData(fresh);
          setUpdated(cachedStr !== null); // only flag as "updated" if we replaced real cache
          try {
            localStorage.setItem(storeKey, freshStr);
          } catch {
            /* storage full / disabled — ignore, in-memory still works */
          }
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        // Keep showing cached data on error; only surface error if nothing cached.
        if (!cached) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRevalidating(false);
      });

    return () => {
      active = false;
    };
  }, [cacheKey, url, listKey]);

  return { data, loading, revalidating, error, updated };
}
