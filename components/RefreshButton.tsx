"use client";

import { useEffect, useState } from "react";
import type { ChangeSummary, ListChange } from "@/lib/diffList";
import { cadenceLabel } from "@/lib/cachePolicy";

// "Refresh from Airtable" for the dashboard. The feeds cache for half an hour during the
// event window and an hour outside it, which is right for techbbq.dk and useless while
// someone is editing a table, so this forces a live read and then reports what changed.
//
// It does not fetch anything itself. Pressing it calls onRefresh(), and the page re-runs
// useCachedList against `?fresh=<n>` — a URL neither the CDN nor the server cache has seen.
// That indirection is the whole reason this works on the deployed site and not just locally:
// an earlier version POSTed to a route that cleared the server's in-memory cache, which does
// nothing in production because the CDN, not the function, is what answers a visitor.
//
// The report distinguishes three states, and the middle one matters most:
//   changes === null      → still waiting on the refetch
//   changes.total === 0   → read Airtable, nothing differs. Say so; silence reads as broken.
//   changes.total > 0     → list what moved
const TONE: Record<ListChange["kind"], { color: string; word: string }> = {
  added: { color: "#5CBC8B", word: "New" },
  removed: { color: "#ff6b6b", word: "Removed" },
  changed: { color: "#fa7000", word: "Edited" },
};

// One-line headline: "2 edited, 1 new". Built from the counts, so it never names a category
// that has nothing in it.
function headline(c: ChangeSummary): string {
  const parts: string[] = [];
  if (c.added) parts.push(`${c.added} new`);
  if (c.changed) parts.push(`${c.changed} edited`);
  if (c.removed) parts.push(`${c.removed} removed`);
  return parts.join(", ");
}

function ChangeReport({ changes, source }: { changes: ChangeSummary; source: string }) {
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
        {empty ? `No changes. This page already matched ${source}.` : headline(changes)}
      </strong>

      {changes.items.map((c, i) => (
        <div key={`${c.kind}-${c.label}-${i}`} style={{ marginTop: 8 }}>
          {/* THE NAME READS FIRST. It used to be "Edited · <record id>", which put a colour-coded
              verb where the subject belongs and an id where the name belongs — unreadable at a
              glance (Auri, 2026-08-05). The verb is still there, just after the thing it happened
              to, and quieter. */}
          <span style={{ fontWeight: 600 }}>{c.label}</span>
          <span style={{ opacity: 0.5 }}> · </span>
          <span style={{ color: TONE[c.kind].color, fontSize: 12 }}>{TONE[c.kind].word.toLowerCase()}</span>
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

      {!empty && (
        // Refusing to overstate what the press did. The public copy on techbbq.dk is served
        // by the CDN under its own s-maxage, which this cannot purge. The lag comes from
        // cachePolicy, so this line stays true when the event window ends and the cadence
        // goes back to hourly.
        <div style={{ marginTop: 10, color: "var(--color-muted)", fontSize: 12 }}>
          This page is now live with {source}. techbbq.dk picks the change up {cadenceLabel()}.
        </div>
      )}
    </div>
  );
}

export function RefreshButton({
  onRefresh,
  changes,
  error,
  resetKey,
  source,
}: {
  // Bump the page's `fresh` counter. The refetch is the page's job, not this component's.
  onRefresh: () => void;
  changes?: ChangeSummary | null;
  // useCachedList's revalidateError, so a rejected refetch (a 401 on the bypass, Airtable
  // down) surfaces here instead of leaving the button waiting forever.
  error?: string | null;
  // Identifies which feed is on screen. When it changes the report is dropped, because a
  // diff for the tab you just left is worse than no diff at all.
  resetKey?: string;
  // Where this page's data comes from. Airtable for almost everything; /brella-program reads
  // Brella, and a button that claims to refresh Airtable on a page Airtable does not feed is
  // a small lie that costs someone ten minutes.
  source?: string;
}) {
  const from = source ?? "Airtable";

  // The report only appears in response to a press. useCachedList also fills `changes` on
  // ordinary background revalidation, and printing a diff nobody asked for on page load is
  // noise.
  const [pressed, setPressed] = useState(false);

  // A settled press stops being "in flight" once either a report or an error lands.
  const settled = pressed && (changes != null || error != null);

  // Keyed on the feed, NOT on `changes`. useCachedList nulls `changes` at the start of every
  // refetch, including the one this button just triggered, so clearing `pressed` whenever
  // `changes` is null would cancel the press immediately and the report would never show.
  useEffect(() => {
    setPressed(false);
  }, [resetKey]);

  function run() {
    setPressed(true);
    onRefresh();
  }

  return (
    <div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="copy-embed" onClick={run} disabled={pressed && !settled}>
          {pressed && !settled ? "Refreshing…" : `Refresh from ${from}`}
        </button>
        {pressed && !settled && (
          <span className="lede" style={{ margin: 0, fontSize: 13 }}>
            Reading {from}…
          </span>
        )}
        {pressed && error && (
          <span className="lede" style={{ margin: 0, fontSize: 13, color: "#ff6b6b" }}>
            {error}
          </span>
        )}
      </span>
      {pressed && !error && changes != null && <ChangeReport changes={changes} source={from} />}
    </div>
  );
}
