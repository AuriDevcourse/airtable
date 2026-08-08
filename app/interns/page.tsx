"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyInternsEmbed } from "@/components/CopyInternsEmbed";

// The Intern Pool worklist.
//
// TechBBQ's interns, pitched to the recruiters reading techbbq.dk in August and September. This
// page is the DASHBOARD half: it reads ?pending=1, so it shows the people who are not live yet
// along with the reason, which is the only way "why is my card not up" has an answer.
//
// The public embed (lib/internsEmbedSnippet.ts) draws the same card from the same feed WITHOUT
// the pending rows — the route strips them for anyone who is not authenticated. Keep the two card
// layouts in step: the side-event grid drifted for weeks because nobody was looking at both.

type Intern = {
  id: string;
  name: string;
  role: string;
  department: string;
  photo: string | null;
  responsibilities: string;
  pitch: string;
  lookingFor: string;
  availableFrom: string | null;
  linkedin: string | null;
  // Dashboard only. Its presence means "not on techbbq.dk".
  pending?: "no-consent" | "not-on-web" | "no-photo" | "expired" | "no-date";
};

// What somebody has to DO, not what is wrong. A worklist that names the state rather than the
// action makes the reader do the translation every time.
const PENDING_LABEL: Record<NonNullable<Intern["pending"]>, string> = {
  "no-consent": "Waiting on their consent",
  "no-photo": "Needs a photo",
  "no-date": "Needs a “Show until” date",
  "not-on-web": "Ready · tick “Put on web”",
  expired: "Month is over",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "2026-10-01" → "1 October". Built from the parts rather than parsing to a Date: an ISO date
// string parses as UTC midnight, which renders as the previous day in a negative offset.
function niceDate(iso: string | null): string {
  if (!iso) return "";
  const p = iso.slice(0, 10).split("-");
  if (p.length !== 3) return "";
  const m = Number(p[1]);
  if (!(m >= 1 && m <= 12)) return "";
  return `${Number(p[2])} ${MONTHS[m - 1]}`;
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function InternCard({ p }: { p: Intern }) {
  const meta = [p.role, p.department].filter(Boolean).join(" · ");
  const from = niceDate(p.availableFrom);
  return (
    <article className={"ip-card" + (p.pending ? " ip-card--pending" : "")}>
      <div className="ip-card__head">
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ip-card__photo" src={p.photo} alt={p.name} loading="lazy" decoding="async" />
        ) : (
          <div className="ip-card__photo--empty" />
        )}
        <div style={{ minWidth: 0 }}>
          <h3 className="ip-card__name">{p.name}</h3>
          {meta && <p className="ip-card__role">{meta}</p>}
        </div>
      </div>

      {p.pitch && <p className="ip-card__pitch">{p.pitch}</p>}

      {p.lookingFor && (
        <div className="ip-card__ask">
          <span className="ip-card__askLabel">Looking for</span>
          <span className="ip-card__askText">{p.lookingFor}</span>
        </div>
      )}

      {p.responsibilities && (
        <p className="ip-card__does">
          <strong>At TechBBQ:</strong> {p.responsibilities}
        </p>
      )}

      {p.pending && (
        <span className={"ip-chip" + (p.pending === "no-consent" ? " ip-chip--consent" : "")}>
          {PENDING_LABEL[p.pending]}
        </span>
      )}

      <div className="ip-card__foot">
        <p className="ip-card__from">{from ? `Available from ${from}` : ""}</p>
        {p.linkedin && (
          <a
            className="ip-card__li"
            href={p.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${p.name} on LinkedIn`}
          >
            <LinkedInIcon />
            LinkedIn
          </a>
        )}
      </div>
    </article>
  );
}

const ALL = "all";

export default function InternsPage() {
  const [active, setActive] = useState<string>(ALL);

  // ?pending=1 is what makes this the worklist rather than a copy of the public page. It is
  // authenticated in the route, so on the deployed dashboard the browser's Basic credentials
  // carry it; locally, with no DASHBOARD_PASSWORD set, everything is allowed.
  const { url, refresh } = useFreshUrl("/api/interns?pending=1");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<Intern>("interns:all", url, "interns");

  const interns = data ?? [];
  const live = interns.filter((p) => !p.pending);
  const pending = interns.filter((p) => p.pending);

  const depts = Array.from(new Set(interns.map((p) => p.department).filter(Boolean)));
  const shown = active === ALL ? interns : interns.filter((p) => p.department === active);
  const shownLive = shown.filter((p) => !p.pending);
  const shownPending = shown.filter((p) => p.pending);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Talent pool · Airtable “Intern Pool”</p>
          <h1>
            Our <span className="text-tbbq-gradient">interns</span>
          </h1>
          <p className="lede">
            The interns running TechBBQ 2026, pitched to whoever is hiring. A card goes live when
            the intern has ticked <strong>Consent to publish</strong>, uploaded a photo and been
            given a <strong>Show until</strong> date, and someone here has ticked{" "}
            <strong>Put on web</strong>. It then takes itself down after that date, with no deploy
            and nothing to remember. Served as JSON at <code>/api/interns</code>.
          </p>

          {depts.length > 1 && (
            <div className="seg" role="tablist" aria-label="Filter by department" style={{ marginTop: 28 }}>
              {[ALL, ...depts].map((d) => (
                <button key={d} role="tab" aria-selected={active === d} onClick={() => setActive(d)}>
                  {d === ALL ? "All" : d}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyInternsEmbed department={active === ALL ? undefined : active} />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Pitch cards with a LinkedIn button. Copy from the deployed dashboard, not localhost.
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <RefreshButton onRefresh={refresh} changes={changes} error={revalidateError} resetKey="interns" />
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {error && !data ? (
          <div className="notice">
            <strong>Could not load.</strong>
            <p>{error}</p>
          </div>
        ) : loading ? (
          <p className="count-line">Loading…</p>
        ) : interns.length === 0 ? (
          <div className="notice">
            <strong>The pool is empty.</strong>
            <p>
              Nobody has filled in the form yet. Every row needs a name at minimum — the three blank
              rows Airtable creates with a new table are ignored on purpose.
            </p>
          </div>
        ) : (
          <>
            <p className="count-line">
              {live.length} live on techbbq.dk
              {pending.length > 0 && ` · ${pending.length} not yet`}
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {shownLive.length > 0 && (
              <div className="ip-grid" style={{ marginTop: 28 }}>
                {shownLive.map((p) => (
                  <InternCard key={p.id} p={p} />
                ))}
              </div>
            )}

            {shownPending.length > 0 && (
              <section style={{ marginTop: 48 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    marginBottom: 16,
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                    paddingBottom: 8,
                  }}
                >
                  <h2 style={{ margin: 0 }}>Not on the site yet</h2>
                  <span className="lede" style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
                    {shownPending.length}
                  </span>
                </div>
                {/* Said once, here, rather than on every card: a card that shows nothing but a name
                    is not broken, it is someone who has not agreed to be published yet. */}
                <p className="lede" style={{ marginTop: 0, fontSize: 13 }}>
                  Anyone still waiting on their own consent shows as a name and nothing else. Their
                  pitch and photo are not read from Airtable at all until they tick the box.
                </p>
                <div className="ip-grid">
                  {shownPending.map((p) => (
                    <InternCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
