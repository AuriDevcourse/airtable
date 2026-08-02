"use client";

import { useState } from "react";
import type { ChangeSummary, ListChange } from "@/lib/diffList";

const TONE: Record<ListChange["kind"], { color: string; word: string }> = {
  added: { color: "#5CBC8B", word: "New" },
  removed: { color: "#ff6b6b", word: "Removed" },
  changed: { color: "#fa7000", word: "Edited" },
};

// One-line headline: "2 edited, 1 new". Built from the counts so it never claims a category
// that has nothing in it.
function headline(c: ChangeSummary): string {
  const parts: string[] = [];
  if (c.added) parts.push(`${c.added} new`);
  if (c.changed) parts.push(`${c.changed} edited`);
  if (c.removed) parts.push(`${c.removed} removed`);
  return parts.join(", ");
}

function ChangeReport({ changes }: { changes: ChangeSummary }) {
  const empty = changes.total === 0;
  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 16px",
        background: "var(--color-card, #131313)",
        borderRadius: 12,
        borderLeft: `3px solid ${empty ? "#6b7280" : "#fa7000"}`,
        fontSize: 13,
        lineHeight: 1.6,
        maxWidth: 720,
      }}
    >
      <strong style={{ color: empty ? "var(--color-muted)" : undefined }}>
        {empty ? "No changes. This page already matched Airtable." : headline(changes)}
      </strong>

      {changes.items.map((c, i) => (
        <div key={`${c.kind}-${c.label}-${i}`} style={{ marginTop: 8 }}>
          <span style={{ color: TONE[c.kind].color, fontWeight: 600 }}>{TONE[c.kind].word}</span>
          <span style={{ opacity: 0.5 }}> · </span>
          <span>{c.label}</span>
          {c.fields?.map((f) => (
            <div
              key={f.field}
              style={{ marginLeft: 14, color: "var(--color-muted)", fontSize: 12.5 }}
            >
              {f.field}: <span style={{ color: "#e6e6e6" }}>{f.to}</span>{" "}
              <span style={{ opacity: 0.7 }}>(was {f.from})</span>
            </div>
          ))}
        </div>
      ))}

      {changes.hidden > 0 && (
        <div style={{ marginTop: 8, color: "var(--color-muted)" }}>
          and {changes.hidden} more not listed.
        </div>
      )}
    </div>
  );
}

// LOCAL-ONLY "Refresh from Airtable". The feeds cache for an hour (lib/rate-limit.ts), which
// is right for the live site but useless while someone is actively editing a table. This
// drops the cache and repaints, so an Airtable edit shows up in seconds.
//
// Clears the server's in-memory feed cache (POST /api/admin/refresh), then makes the page
// refetch. Pass onCleared (bump a nonce into useCachedList) to refetch in place; without it
// the component falls back to a full reload, which on a page with tabs also throws the user
// back to the default tab.
//
// The onCleared path deliberately leaves this browser's localStorage copy ALONE. That copy
// is the baseline useCachedList diffs the fresh data against to report what changed —
// deleting it would leave nothing to compare and every refresh would report nothing. The
// reload path still clears it, because a reload repaints from localStorage before fetching
// and would otherwise flash the stale list.
//
// Renders nothing unless NODE_ENV is development. That check is inlined at build time, so
// the markup is not merely hidden in a production bundle, it is absent. The route enforces
// the same rule server-side — do not rely on this component alone.
export function DevRefreshButton({
  cacheKey,
  onCleared,
  changes,
}: {
  cacheKey?: string;
  onCleared?: () => void;
  // Pass useCachedList's `changes` to get a report of what the refresh actually altered.
  changes?: ChangeSummary | null;
}) {
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // The report only appears in response to a press. useCachedList also fills `changes` on
  // ordinary background revalidation, and printing a diff nobody asked for on page load is
  // noise.
  const [pressed, setPressed] = useState(false);

  if (process.env.NODE_ENV === "production") return null;

  async function run() {
    setState("running");
    setMessage(null);
    setPressed(true);
    try {
      const res = await fetch("/api/admin/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cacheKey ? { key: cacheKey } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `Refresh failed (${res.status})`);

      if (onCleared) {
        // Keep localStorage: it's the baseline for the change report.
        onCleared();
        setState("idle");
        setMessage(null);
        return;
      }

      try {
        if (cacheKey) localStorage.removeItem(`tbbq-cache:${cacheKey}`);
        else {
          // No key given → the server dropped every feed, so drop every local copy too.
          for (const k of Object.keys(localStorage)) {
            if (k.startsWith("tbbq-cache:")) localStorage.removeItem(k);
          }
        }
      } catch {
        /* storage disabled — the reload still refetches, it just repaints twice */
      }
      setMessage("Cache cleared — reloading…");
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setState("error");
      setPressed(false); // nothing was refetched, so there is no report to wait for
      setMessage(err instanceof Error ? err.message : "Refresh failed");
    }
  }

  // changes stays null until the refetch finishes, and is reset to null on a tab switch —
  // which is also how the report disappears when the user moves to another feed.
  const report = pressed && onCleared ? changes ?? null : null;

  return (
    <div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="copy-embed" onClick={run} disabled={state === "running"}>
          {state === "running" ? "Refreshing…" : "Refresh from Airtable"}
        </button>
        {message && (
          <span
            className="lede"
            style={{ margin: 0, fontSize: 13, color: state === "error" ? "#ff6b6b" : undefined }}
          >
            {message}
          </span>
        )}
        {pressed && !report && state !== "error" && (
          <span className="lede" style={{ margin: 0, fontSize: 13 }}>
            Checking Airtable…
          </span>
        )}
      </span>
      {report && <ChangeReport changes={report} />}
    </div>
  );
}
