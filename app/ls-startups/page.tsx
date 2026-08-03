"use client";

import { useMemo } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { useCachedList } from "@/lib/useCachedList";
import { CopyLsStartupsEmbed } from "@/components/CopyLsStartupsEmbed";

// A logo wall of the confirmed Life Science & Deep Tech startups exhibiting at TechBBQ 2026,
// in three rows: Planetary Health, Human Health, Deep Tech.
//
// Logos only, by Auri's instruction — no company names, no pitch, no website, no country.
// The feed still carries those fields for other consumers; this page just ignores them.
//
// The "only confirmed" rule is a SERVER-side gate in lib/lsstartups.ts (status contains
// "Confirmed startup"), not a filter here — a rejected or waiting-list applicant must never
// reach the browser at all.
type Startup = {
  id: string;
  company: string;
  pitch: string;
  website: string | null;
  logo: string | null;
  categories: string[];
  country: string;
  verticals: string[];
};

// Row order and colour, as Auri specified: Planetary fully green, Human Health between green
// and blue, Deep Tech blue. Read as a scale from nature to technology, which is why the three
// sit on one green-teal-blue axis rather than being three unrelated hues.
//
// All three are existing house tokens, not new colours: --color-success, --color-teal, and the
// #2BB4E1 already used as Deep Tech on /life-science. Each clears 7:1 against the #0d0d0d
// background, so the labels stay legible (WCAG AA wants 4.5:1).
//
// The names are the exact `LS Type` select options. Duplicated from lib/lsstartups.ts rather
// than imported: that module is server-only (it reads AIRTABLE_TOKEN at module scope), so
// importing it into a client component would pull the token read into the browser bundle.
// Keep the two in sync.
//
// LS Type is a MULTI-select, so a startup in two categories appears in both rows. That is
// correct, not a duplicate: it is exhibiting under both. Confirmed with Auri 2026-08-03.
const ROWS: { name: string; color: string }[] = [
  { name: "Planetary Health", color: "#00c11a" }, // fully green
  { name: "Human Health", color: "#10c8a7" }, // green into blue
  { name: "Deep Tech", color: "#2BB4E1" }, // blue
];

function Mark({ s }: { s: Startup }) {
  return s.logo ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      className="lw-logo"
      src={s.logo}
      // The name is not shown, but it still has to be readable by a screen reader and it is
      // what appears if the image itself fails.
      alt={s.company}
      loading="lazy"
    />
  ) : (
    // No renderable logo (an .ai or .cdr upload — see lib/lsstartups.ts). Without a stand-in
    // the company would silently vanish from a wall that shows no names, so its name is set
    // as a plain wordmark instead. Fix the upload in Airtable and it becomes a logo.
    <span className="lw-logo lw-logo--text">{s.company}</span>
  );
}

function LogoWall({ items }: { items: Startup[] }) {
  return (
    <div className="lw-grid">
      {items.map((s) =>
        s.website ? (
          <a
            key={s.id}
            className="lw-link"
            href={s.website}
            target="_blank"
            rel="noopener noreferrer"
            // The link's only content is an image, so it needs its own accessible name —
            // "opens the startup's site" has to be sayable without seeing the logo.
            aria-label={`${s.company} website`}
          >
            <Mark s={s} />
          </a>
        ) : (
          // Some startups never filled in a Website. They still belong on the wall, just
          // without a link, rather than being dropped or linked somewhere invented.
          <Mark key={s.id} s={s} />
        )
      )}

      {/* Sits IN the grid as the last tile rather than as a line under the wall, because the
          point is that these rows are still filling up. An empty slot in the run of logos
          says that; a sentence underneath reads as a footnote. Real text, not decoration, so
          a screen reader announces it with the row it belongs to. */}
      <span className="lw-soon">More soon</span>
    </div>
  );
}

export default function LsStartupsPage() {
  const { data, loading, revalidating, error, updated } = useCachedList<Startup>(
    "lsstartups",
    "/api/ls-startups",
    "startups"
  );
  const all = useMemo(() => data ?? [], [data]);

  const rows = useMemo(
    () =>
      ROWS.map((row) => ({
        ...row,
        items: all.filter((s) => s.categories.includes(row.name)),
      })),
    [all]
  );

  // Confirmed startups with no LS Type set belong to no row and would drop off the page
  // entirely, so they are counted and named rather than silently lost.
  const uncategorised = useMemo(() => all.filter((s) => s.categories.length === 0), [all]);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-1.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Life Science &amp; Deep Tech · Airtable startup applications</p>
          <h1>
            Startups <span className="text-tbbq-gradient">Exhibiting 2026</span>
          </h1>
          <p className="lede">
            Live from Airtable · <strong>confirmed startups only</strong> (<code>status</code> ={" "}
            <em>Confirmed startup</em>, not merely <em>Selected</em>) · served as JSON at{" "}
            <code>/api/ls-startups</code> (add <code>?category=Deep Tech</code>).
          </p>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyLsStartupsEmbed />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies the whole three-row wall. Copy from the deployed dashboard, not localhost.
            </span>
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
        ) : (
          <>
            <p className="count-line">
              {all.length} confirmed startup(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {rows.map(({ name, color, items }) => (
              <section
                key={name}
                className="lw-row"
                style={{ "--row": color } as React.CSSProperties}
              >
                <h2 className="lw-row__label">{name}</h2>
                {items.length ? (
                  <LogoWall items={items} />
                ) : (
                  <p className="count-line" style={{ textAlign: "left", margin: 0 }}>
                    Nobody in this category yet.
                  </p>
                )}
              </section>
            ))}

            {/* Internal note for whoever maintains the table, not something a techbbq.dk
                visitor would ever see — this page is the dashboard preview. */}
            {uncategorised.length > 0 && (
              <section className="ev-gaps" style={{ marginTop: 40 }}>
                <h2>Not in any row</h2>
                <ul>
                  <li>
                    <strong>{uncategorised.length} confirmed startup(s)</strong> have no{" "}
                    <code>LS Type</code> set, so they appear in none of the three rows:{" "}
                    {uncategorised.map((s) => s.company).join(", ")}.
                  </li>
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
