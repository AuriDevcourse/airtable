"use client";

import { useCallback, useRef, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";

// Ticket lookup for support. Someone emails asking to change the name on their ticket or
// hand it to a colleague; paste their email or name here and see whether a ticket exists,
// which event and type it is, and whether it can still be edited.
//
// This page is behind the dashboard password (middleware gates everything not in
// PUBLIC_PATHS) and shows attendee email addresses, so unlike the speaker pages it
// deliberately does NOT use useCachedList: nothing is written to localStorage, and each
// search hits the server fresh.

type Match = {
  id: number | string;
  event: string;
  eventSlug: string;
  name: string;
  email: string;
  company: string;
  jobTitle: string;
  release: string;
  state: string;
  void: boolean;
  changesLocked: boolean;
  reference: string;
  orderName: string;
  orderEmail: string;
  ticketUrl: string;
  createdAt: string;
  updatedAt: string;
};

type Payload = {
  count: number;
  matches: Match[];
  failedEvents: string[];
  truncatedEvents: string[];
};

const MIN_QUERY_LENGTH = 3;

// What each Tito state means for the person asking. The state alone ("incomplete") reads
// like a problem when it usually is not, so every row says what to do about it.
const STATE_HELP: Record<string, string> = {
  complete: "Registered and filled in.",
  incomplete: "Ticket exists, details not filled in yet.",
  unassigned: "Bought but not assigned to anyone yet.",
  void: "Refunded or cancelled. Not a valid ticket.",
  archived: "Archived by an organiser.",
};

function StateBadge({ m }: { m: Match }) {
  const dead = m.void || m.state === "archived";
  return (
    <span
      className="lk-badge"
      style={{
        borderColor: dead ? "#5a2a2a" : m.state === "complete" ? "#2a5a3a" : "#4a4a2a",
        color: dead ? "#ff9b9b" : m.state === "complete" ? "#8fe0ab" : "#e3d68a",
      }}
    >
      {m.state || "unknown"}
    </span>
  );
}

export default function LookupPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest search may write to state: typing fast otherwise lets a slow earlier
  // response overwrite a newer one.
  const runRef = useRef(0);

  const run = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setError(`Type at least ${MIN_QUERY_LENGTH} characters.`);
      return;
    }
    const run = ++runRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tito-lookup?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (runRef.current !== run) return;
      if (!res.ok) {
        setError(json?.error || `Search failed (${res.status}).`);
        setData(null);
      } else {
        setData(json as Payload);
      }
    } catch {
      if (runRef.current === run) {
        setError("Could not reach the server.");
        setData(null);
      }
    } finally {
      if (runRef.current === run) setLoading(false);
    }
  }, []);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-2.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Ticketing · Tito · internal</p>
          <h1>
            Ticket <span className="text-tbbq-gradient">lookup</span>
          </h1>
          <p className="lede">
            Search Tito by email, name or company across TechBBQ 2026, LP Forum, LP Dinner
            and Investor Dinner. Use it when someone writes in to change a name or hand
            their ticket to a colleague.
          </p>

          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              run(query);
            }}
          >
            <input
              type="search"
              className="search__input"
              placeholder="Email, name or company…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search Tito by email, name or company"
              autoComplete="off"
              maxLength={120}
            />
            <svg
              className="search__icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </form>
          <p className="lk-hint">
            Press Enter to search. Nothing is stored in this browser.
          </p>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {error && (
          <div className="notice">
            <strong>Search failed.</strong>
            <p>{error}</p>
          </div>
        )}

        {loading && <p className="count-line">Searching Tito…</p>}

        {!loading && data && (
          <>
            <p className="count-line">
              {data.count === 0
                ? "No ticket found."
                : `${data.count} ticket${data.count === 1 ? "" : "s"} found`}
            </p>

            {data.failedEvents.length > 0 && (
              <div className="notice">
                <strong>Partial result.</strong>
                <p>
                  {data.failedEvents.join(" + ")} could not be searched, so a ticket there
                  would not show up here. Try again before telling anyone they have no
                  ticket.
                </p>
              </div>
            )}

            {data.truncatedEvents.length > 0 && (
              <p className="lk-hint">
                More matches exist in {data.truncatedEvents.join(" + ")} than shown. Search
                the full email address to narrow it down.
              </p>
            )}

            {data.count === 0 && (
              <p className="lk-hint">
                Nothing in Tito matches that. Worth checking: the buyer may have used a
                different address, so try their company domain or their surname alone.
              </p>
            )}

            <div className="lk-list">
              {data.matches.map((m) => (
                <article key={`${m.eventSlug}-${m.id}`} className="lk-card">
                  <header className="lk-card__head">
                    <div>
                      <h2 className="lk-card__name">
                        {m.name || <span className="lk-muted">Unassigned ticket</span>}
                      </h2>
                      <p className="lk-card__meta">
                        {[m.jobTitle, m.company].filter(Boolean).join(" · ") || " "}
                      </p>
                    </div>
                    <StateBadge m={m} />
                  </header>

                  <dl className="lk-grid">
                    <div>
                      <dt>Email</dt>
                      <dd>{m.email || <span className="lk-muted">none yet</span>}</dd>
                    </div>
                    <div>
                      <dt>Event</dt>
                      <dd>{m.event}</dd>
                    </div>
                    <div>
                      <dt>Ticket type</dt>
                      <dd>{m.release || <span className="lk-muted">unknown</span>}</dd>
                    </div>
                    <div>
                      <dt>Reference</dt>
                      <dd>
                        <code>{m.reference || "—"}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Bought by</dt>
                      <dd>
                        {m.orderName || m.orderEmail ? (
                          <>
                            {m.orderName}
                            {m.orderName && m.orderEmail ? " · " : ""}
                            {m.orderEmail}
                          </>
                        ) : (
                          <span className="lk-muted">unknown</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Can they edit it</dt>
                      <dd>
                        {m.void || m.state === "archived"
                          ? "No, the ticket is not valid"
                          : m.changesLocked
                            ? "No, changes are locked. An organiser has to do it"
                            : "Yes, via their ticket link"}
                      </dd>
                    </div>
                  </dl>

                  <p className="lk-card__help">{STATE_HELP[m.state] ?? ""}</p>

                  {m.ticketUrl && !m.void && m.state !== "archived" && (
                    <a
                      className="lk-link"
                      href={m.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open ticket in Tito
                    </a>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
