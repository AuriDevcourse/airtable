// Server-only: attendee lookup against Tito (ti.to), the ticketing system.
//
// This is the support-desk feed, not a marketing feed. Someone emails info@techbbq.org
// asking to change the name on their ticket or reassign it, and the question is always
// the same: does this person actually have a ticket, which one, and can it still be
// changed? Everything else in this repo is public and marketing-safe. This one is NOT:
// Tito rows carry email, phone and the buyer's details.
//
// So, unlike every other route here:
//   - /api/tito-lookup is deliberately absent from middleware's PUBLIC_PATHS, i.e. it
//     sits behind the dashboard password and can never be embedded on techbbq.dk,
//   - responses are `no-store` and nothing is cached (support needs live state, and
//     caching attendee PII buys nothing),
//   - nothing about the query or the people found is ever logged.
//
// Tito's own search does the matching: `search[q]` spans first/last name, email and
// company, which is exactly the set a support email gives us.

import { fetchWithTimeout } from "@/lib/http";
import { str } from "@/lib/fields";

const API = "https://api.tito.io/v3";
const ACCOUNT = "techbbq";

// The events a lookup covers. A ticket holder writing in could hold any of these, and
// the answer changes per event, so every one is searched and every hit says which one.
// Add a slug here when a new Tito event opens.
// A MISSING SLUG IS A SILENT WRONG ANSWER, not an error: the other events are searched, nothing
// matches, and support tells a real ticket holder they have no ticket. `investor-day-2026` was
// absent here until 2026-08-11 while holding 227 tickets. Check this list against
// `GET /v3/techbbq/events` whenever a new event opens, and note that Tito's slug and its title
// differ (slug `investor-dinner-2026` is titled "TechBBQ Investor x Founder Dinner").
export const TITO_EVENTS: { slug: string; label: string }[] = [
  { slug: "2026", label: "TechBBQ 2026" },
  { slug: "investor-day-2026", label: "Investor Day 2026" },
  { slug: "lp-forum-2026", label: "LP Forum 2026" },
  { slug: "lp-dinner-2026", label: "LP Dinner 2026" },
  { slug: "investor-dinner-2026", label: "Investor Dinner 2026" },
];

// Tito hides void + archived tickets by default. Support needs to see them: "your ticket
// was refunded in March" is a real answer, and a silent omission looks like "no ticket".
const ALL_STATES = [
  "complete",
  "incomplete",
  "unassigned",
  "void",
  "archived",
  "changes_locked",
  "changes_allowed",
];

// Per event. A support query that matches more than this is too vague to act on anyway,
// and the UI says so rather than pretending the list is complete.
const PER_EVENT_LIMIT = 25;

// Four events are searched in parallel; each gets its own budget.
const TIMEOUT_MS = 12_000;

// Only the fields a support reply actually needs. Tito also returns phone_number,
// discount codes, price and metadata — deliberately not mapped, so they cannot leak
// into a response by accident.
export type TitoMatch = {
  id: number | string;
  event: string; // display label, e.g. "TechBBQ 2026"
  eventSlug: string;
  name: string;
  email: string;
  company: string;
  jobTitle: string;
  // Ticket type, e.g. "GENERAL PASS", "SPEAKER", "INVESTOR".
  release: string;
  // Tito's own state: complete / incomplete / unassigned / void / archived.
  state: string;
  void: boolean;
  // True when the organiser locked edits: the holder cannot rename or reassign it
  // themselves, someone with admin access has to.
  changesLocked: boolean;
  // Ticket reference, the code the attendee quotes in an email ("TIHL-2").
  reference: string;
  // Who bought it. Often a colleague or an assistant, which is usually the answer to
  // "why can't I find my confirmation email".
  orderName: string;
  orderEmail: string;
  // The ticket's own edit link. Sending this is normally the whole fix: the holder
  // changes their own name or hands the ticket to someone else, no admin needed.
  ticketUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type TitoLookupResult = {
  matches: TitoMatch[];
  // Events whose search failed, so a partial result is never silently presented as
  // "this person has no ticket".
  failedEvents: string[];
  // Events where the hit count was cut to PER_EVENT_LIMIT.
  truncatedEvents: string[];
};

export class TitoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RawTicket = {
  id?: number | string;
  name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  company_name?: unknown;
  job_title?: unknown;
  release_title?: unknown;
  state?: unknown;
  void?: unknown;
  changes_locked?: unknown;
  reference?: unknown;
  registration_name?: unknown;
  registration_email?: unknown;
  unique_url?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function mapTicket(t: RawTicket, event: { slug: string; label: string }): TitoMatch {
  // `name` is empty on unassigned tickets, where first/last are also blank — those still
  // matter (an unassigned ticket is exactly what gets reassigned), so the UI labels them
  // rather than this dropping them.
  const name = str(t.name) || [str(t.first_name), str(t.last_name)].filter(Boolean).join(" ");
  return {
    id: t.id ?? "",
    event: event.label,
    eventSlug: event.slug,
    name,
    email: str(t.email),
    company: str(t.company_name),
    jobTitle: str(t.job_title),
    release: str(t.release_title),
    state: str(t.state),
    void: t.void === true,
    changesLocked: t.changes_locked === true,
    reference: str(t.reference),
    orderName: str(t.registration_name),
    orderEmail: str(t.registration_email),
    ticketUrl: str(t.unique_url),
    createdAt: str(t.created_at),
    updatedAt: str(t.updated_at),
  };
}

async function searchEvent(
  token: string,
  event: { slug: string; label: string },
  query: string
): Promise<{ matches: TitoMatch[]; truncated: boolean }> {
  const params = new URLSearchParams();
  params.set("search[q]", query);
  for (const s of ALL_STATES) params.append("search[states][]", s);
  params.set("page[size]", String(PER_EVENT_LIMIT));

  const res = await fetchWithTimeout(
    `${API}/${ACCOUNT}/${event.slug}/tickets?${params.toString()}`,
    {
      headers: {
        Authorization: `Token token=${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
    TIMEOUT_MS
  );

  if (!res.ok) {
    // Status only. The body can echo the query, which is someone's email address.
    throw new TitoError(`Tito search failed for ${event.slug} (${res.status})`, 502);
  }

  const data = (await res.json()) as {
    tickets?: RawTicket[];
    meta?: { total_count?: number };
  };
  const tickets = Array.isArray(data.tickets) ? data.tickets : [];
  const total = typeof data.meta?.total_count === "number" ? data.meta.total_count : tickets.length;

  return {
    matches: tickets.map((t) => mapTicket(t, event)),
    truncated: total > tickets.length,
  };
}

// Shortest query worth running. Two characters would match hundreds of people and the
// result would be useless for support anyway.
export const MIN_QUERY_LENGTH = 3;

export async function lookupTito(query: string): Promise<TitoLookupResult> {
  const token = process.env.TITO_API_TOKEN;
  // Fails closed: a misconfigured deploy must say so, not answer "no ticket found" for
  // every real attendee.
  if (!token) {
    throw new TitoError("Tito is not configured on the server (TITO_API_TOKEN missing).", 503);
  }

  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) {
    throw new TitoError(`Search for at least ${MIN_QUERY_LENGTH} characters.`, 400);
  }

  const results = await Promise.allSettled(
    TITO_EVENTS.map((event) => searchEvent(token, event, q))
  );

  const matches: TitoMatch[] = [];
  const failedEvents: string[] = [];
  const truncatedEvents: string[] = [];

  results.forEach((r, i) => {
    const event = TITO_EVENTS[i];
    if (r.status === "fulfilled") {
      matches.push(...r.value.matches);
      if (r.value.truncated) truncatedEvents.push(event.label);
    } else {
      failedEvents.push(event.label);
      // Event slug only, never the query or the reason's body.
      console.error("[tito] search failed for event", event.slug);
    }
  });

  // Every event down is an error, not an empty result: "no ticket" would be a wrong
  // answer someone then acts on.
  if (failedEvents.length === TITO_EVENTS.length) {
    throw new TitoError("Could not reach Tito.", 502);
  }

  // Live tickets before void/archived ones, then newest first. A refunded ticket is
  // useful context but should never be the first thing read.
  matches.sort((a, b) => {
    const aDead = a.void || a.state === "archived" ? 1 : 0;
    const bDead = b.void || b.state === "archived" ? 1 : 0;
    if (aDead !== bDead) return aDead - bDead;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return { matches, failedEvents, truncatedEvents };
}
