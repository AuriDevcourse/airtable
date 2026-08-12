"use client";

import { useEffect, useState } from "react";
import { cadenceLabel } from "@/lib/cachePolicy";

// WHERE THIS TAB'S DATA COMES FROM, AND HOW STALE IT CAN BE. One muted line above the content.
//
// Asked for by Auri, 2026-08-12: "show where the information is gotten from just above, as well as
// how often it updates. I want to just understand if we are always up to date." On a page whose
// tabs read DIFFERENT SOURCES that is not a footnote — /partner-events reads Airtable for Side
// Events and Brella for Event Rooms, and the hero eyebrow can only name one of them, so it is
// wrong half the time you are looking at it.
//
// DASHBOARD ONLY. This is explicitly NOT part of any embed snippet (Auri, same message): it is an
// indication for the TechBBQ team about the plumbing, and a techbbq.dk visitor has no use for the
// name of an Airtable view. Nothing here belongs in lib/*EmbedSnippet.ts.
//
// THE HONESTY RULES, because a freshness label that overstates freshness is worse than none:
//   - `cadence` comes from cadenceLabel() in lib/cachePolicy.ts, never a number typed in here.
//     That file owns the TTLs and flips to the calm cadence on August 28th on its own; a hardcoded
//     "within 30 minutes" would quietly become a lie that day.
//   - `fetchedAt` is when the BROWSER was answered, so it prints as "checked", not as "live".
//     On the deployed site the CDN can answer from a copy up to its own s-maxage old, which is
//     exactly what the cadence clause next to it is describing.

// Lucide "database" and "refresh-cw", inlined the same way this repo inlines every other icon (no
// lucide-react here, and two icons do not justify the dependency).
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="feed-source__icon"
    >
      {children}
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <Icon>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </Icon>
  );
}

// Lucide "columns-3": the row it marks lists COLUMNS, which is what a reader goes looking for.
function ColumnsIcon() {
  return (
    <Icon>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </Icon>
  );
}

function RefreshIcon() {
  return (
    <Icon>
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3H21" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3H3" />
      <path d="M3 21v-5h5" />
    </Icon>
  );
}

// "10:46". 24-hour ON PURPOSE, not the reader's locale default: every other time on these pages is
// a 24-hour range out of Airtable ("09:00-11:00"), and one 12-hour stamp among them reads as a
// different kind of number. Client-side only (see mounted below), so a server-rendered time in one
// zone can never hydrate against a browser in another.
function clockTime(ms: number): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(ms);
  } catch {
    return new Date(ms).toTimeString().slice(0, 5);
  }
}

export function FeedSource({
  source,
  detail,
  href,
  reads,
  feedKey,
  fetchedAt,
  note,
}: {
  /** The system of record, in the words the team uses for it: "Airtable", "Brella". */
  source: string;
  /** Which table, view or board inside it. The part that makes the source findable. */
  detail?: string;
  /**
   * Deep link to the rows themselves, so "where does this come from" is one click rather than a
   * search through Airtable. Built by airtableUrl() in lib/airtableSources.ts from the same ids
   * the feed reads with, so it cannot name a view the feed stopped using.
   */
  href?: string;
  /**
   * The columns this feed actually reads, in the words the source shows them in. Anything NOT in
   * this list is either ignored or comes from somewhere else — which is the question a reader is
   * really asking when a card shows something they cannot find in the table.
   */
  reads?: readonly string[];
  /**
   * The feed's cache key, so the cadence comes from the same place the route does. Omitted means
   * the ordinary cadence, which is what most feeds run on.
   */
  feedKey?: string;
  /** useCachedList's `fetchedAt`. Absent while the first read is still in flight. */
  fetchedAt?: number | null;
  /** One extra clause for a second source feeding the same tab, e.g. the scraped posters. */
  note?: string;
}) {
  // The clock is the one thing here that differs between server and client, so it waits for the
  // mount rather than rendering a time the server guessed.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // TWO ROWS, ALWAYS, rather than one line that wraps when it runs out of room. As one wrapping
  // line the divider between the halves ended up stranded at the end of the first line pointing at
  // nothing, and where the break fell depended on how long an Airtable view happened to be named.
  return (
    <div className="feed-source">
      <p className="feed-source__row">
        <DatabaseIcon />
        <span>
          <span className="feed-source__label">Source</span> <strong>{source}</strong>
          {detail ? (
            <span className="feed-source__detail">
              {" · "}
              {/* The DETAIL is the link, not a separate "open" word: the table and view name is
                  already the thing you want to click. rel=noreferrer as well as noopener —
                  Airtable has no business knowing which internal page linked it. */}
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="feed-source__link">
                  {detail}
                </a>
              ) : (
                detail
              )}
            </span>
          ) : null}
          {note ? <span className="feed-source__detail"> · {note}</span> : null}
        </span>
      </p>
      {reads && reads.length > 0 && (
        <p className="feed-source__row">
          <ColumnsIcon />
          <span>
            <span className="feed-source__label">Reads</span>{" "}
            <span className="feed-source__detail">{reads.join(", ")}</span>
          </span>
        </p>
      )}
      <p className="feed-source__row">
        <RefreshIcon />
        <span>
          <span className="feed-source__label">Updates</span> an edit reaches this page{" "}
          {cadenceLabel(feedKey)}
          {mounted && fetchedAt ? (
            <span className="feed-source__detail"> · checked {clockTime(fetchedAt)}</span>
          ) : null}
        </span>
      </p>
    </div>
  );
}
