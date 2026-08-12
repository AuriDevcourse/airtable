// WHERE A FEED'S DATA PHYSICALLY LIVES, in a form the dashboard can link to.
//
// CLIENT-SAFE BY DESIGN. This module is imported by a "use client" page (see
// components/FeedSource.tsx), so it holds nothing but ids and column names. No token, no
// process.env, no fetching. **Never add a credential here** — the Airtable PAT stays in
// lib/*.ts server modules reading process.env, which is rule 3 of the security playbook.
//
// An Airtable base/table/view id is not a credential. It appears in the URL of every share link
// and opens nothing without a token, which is the same reasoning lib/niss.ts already uses for
// pinning table ids in code instead of env.
//
// WHY THE BASE ID IS PINNED HERE while the server libs read AIRTABLE_BASE_ID from env: every table
// id in lib/* is already hardcoded, so a base id pointing somewhere else would break all of them
// anyway. This adds no coupling that was not there. If the base ever really moves, these ids are
// part of the same sweep.
export const AIRTABLE_BASE_ID = "appgXNjXJqpk9Ebxd"; // TechBBQ

/** The URL a human opens to see the rows a feed reads. View is optional; table alone is valid. */
export function airtableUrl(table: string, view?: string): string {
  return `https://airtable.com/${AIRTABLE_BASE_ID}/${table}${view ? `/${view}` : ""}`;
}

// ─── PARTNER EVENTS ─────────────────────────────────────────────────────────────────────
// Imported by lib/partnerevents.ts so the ids have ONE definition. The feed used to declare its
// own copies and the dashboard would have needed a second pair to build a link with, which is
// exactly how a link ends up pointing at a view that was renamed six weeks ago.
export const PARTNER_EVENTS_TABLE = "tbllvkwLhB4Omdphd"; // Partnership Success
export const PARTNER_EVENTS_VIEW = "viwcC25ENg2ELGszH"; // 2026 Side event and event room info

/**
 * The columns this feed actually reads, in the words Airtable shows in the header row, so a
 * reader can look for them. Kept in step with FIELDS in lib/partnerevents.ts — that map is
 * keyed by field ID (three columns share the name "Date of Event "), which is unreadable to
 * anyone who has not opened the file.
 *
 * "Date of Event" is listed once even though the feed coalesces two duplicate columns of that
 * name: the reader is being pointed at a column to check, not at a schema bug.
 */
export const PARTNER_EVENTS_FIELDS = [
  "Session Title",
  "Session Description",
  "Type of Event",
  "Event type",
  "Date of Event",
  "Time slot",
  "Link to register",
  "Company",
  "Company Logo",
] as const;
