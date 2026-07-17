"use client";

import { useState } from "react";

// "Sync now": pulls the Speaker Hub into Airtable on demand, instead of waiting for the
// 6-hourly cron. The route is gated by the dashboard password (middleware.ts), so the
// browser's existing Basic auth session is what authorizes it — no secret lives here.
//
// On success the page hard-reloads: the server cache for this feed was just dropped, and
// the reload also clears the localStorage copy that useCachedList paints from. Without
// both, a successful sync would still show the stale grid.
export function SyncButton({ cacheKey }: { cacheKey: string }) {
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setState("running");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `Sync failed (${res.status})`);
      }
      try {
        localStorage.removeItem(`tbbq-cache:${cacheKey}`);
      } catch {
        /* storage disabled — the reload still refetches */
      }
      // Keep the added count visible for a beat, then repaint from the fresh feed.
      setMessage(json.added ? `Added ${json.added} — reloading…` : "Up to date — reloading…");
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Sync failed");
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button type="button" className="copy-embed" onClick={run} disabled={state === "running"}>
        {state === "running" ? "Syncing…" : "Sync now"}
      </button>
      {message && (
        <span
          className="lede"
          style={{ margin: 0, fontSize: 13, color: state === "error" ? "#ff6b6b" : undefined }}
        >
          {message}
        </span>
      )}
    </span>
  );
}
