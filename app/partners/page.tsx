"use client";

import { useEffect, useMemo } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { useCachedList } from "@/lib/useCachedList";
import { fitLogosIn } from "@/lib/logoFit";
import { CopyPartnersEmbed } from "@/components/CopyPartnersEmbed";

// The TechBBQ 2026 partner logo wall, one row per partnership tier. Same construction as
// /ls-startups (it reuses the .lw-* styles), just nine rows instead of three.
//
// Logos are served from public/partner-logos/, NOT from Airtable — see lib/partners.ts for
// why, and scripts/sync-partner-logos.mjs for how they get there.
type Partner = {
  id: string;
  company: string;
  tier: string;
  logo: string | null;
  website: string | null;
  wide?: boolean;
  scale?: number;
};

// Tier order and colour come from the feed (lib/partners.ts owns them), so the page cannot
// drift from the API. Falls back to nothing if the feed is older than this page.
type Tier = { name: string; color: string; cols: number };

function Mark({ p }: { p: Partner }) {
  return p.logo ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      className={p.wide ? "lw-logo lw-logo--wide" : "lw-logo"}
      src={p.logo}
      alt={p.company}
      loading="lazy"
      // Read by fitLogo(); plain attributes rather than props so the embed, which builds raw
      // HTML strings, can carry the same values in the same places.
      data-scale={p.scale ?? undefined}
      // A frieze is not one mark, so the equal-area rule does not apply to it: it should run
      // the full width of its row, and letting the fitter shrink it to a "fair" area would
      // defeat the point of giving it the row.
      data-nofit={p.wide ? "1" : undefined}
    />
  ) : (
    // No logo matched by the sync script. The partner still belongs on the DASHBOARD wall so
    // the gap is visible, and it looks unfinished on purpose. These name tiles are
    // deliberately absent from the embed — see lib/partnersEmbedSnippet.ts.
    <span className="lw-logo lw-logo--text">{p.company}</span>
  );
}

function LogoWall({ items }: { items: Partner[] }) {
  // A wide logo is a STRIP of several marks (the EU co-funding frieze is 13:1). It spans the
  // whole row and goes first, which is both how techbbq.dk shows it and the only way it stays
  // legible: dropped into a normal 5:3 cell it would render at a fraction of the height.
  const ordered = [...items].sort((a, b) => Number(!!b.wide) - Number(!!a.wide));
  return (
    <div className="lw-grid lw-grid--fixed">
      {ordered.map((p) =>
        p.website ? (
          <a
            key={p.id}
            className={p.wide ? "lw-link lw-link--wide" : "lw-link"}
            href={p.website}
            target="_blank"
            rel="noopener noreferrer"
            // The link's only content is an image, so it needs its own accessible name.
            aria-label={`${p.company} website`}
          >
            <Mark p={p} />
          </a>
        ) : (
          // Some partners never filled in a website. They stay on the wall unlinked, rather
          // than being dropped or pointed somewhere invented.
          <Mark key={p.id} p={p} />
        )
      )}
    </div>
  );
}

export default function PartnersPage() {
  const { data, loading, revalidating, error, updated } = useCachedList<Partner>(
    "partners",
    "/api/partners",
    "partners"
  );
  const all = useMemo(() => data ?? [], [data]);

  // Even out how BIG each logo looks. object-fit only matches bounding boxes, and these range
  // from square to 5:1, so without this a square mark reads as half the size of a wordmark.
  useEffect(() => fitLogosIn(document), [all]);

  // The tier list is served alongside the partners, but useCachedList only surfaces the list
  // itself, so the order is derived from the data in the order the feed emitted it.
  const rows = useMemo(() => {
    const order: Tier[] = TIERS;
    return order
      .map((t) => ({ ...t, items: all.filter((p) => p.tier === t.name) }))
      .filter((r) => r.items.length > 0);
  }, [all]);

  const missingLogo = useMemo(() => all.filter((p) => !p.logo), [all]);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-2.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Partnerships · Airtable “Partner Deliverables 2026”</p>
          <h1>
            TechBBQ <span className="text-tbbq-gradient">Partners 2026</span>
          </h1>
          <p className="lede">
            Live from Airtable, one row per tier · <em>Investor</em>, <em>Academic</em> and <em>Tailored</em>
            are excluded · served as JSON at <code>/api/partners</code> (add{" "}
            <code>?tier=Prime</code>).
          </p>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyPartnersEmbed />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies every tier as one block. Copy from the deployed dashboard, not localhost.
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
              {all.length} partner(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {rows.map(({ name, color, cols, items }) => (
              <section
                key={name}
                className="lw-row"
                style={{ "--row": color, "--cols": cols } as React.CSSProperties}
              >
                <h2 className="lw-row__label">{name}</h2>
                <LogoWall items={items} />
              </section>
            ))}

            {/* Internal note for whoever maintains the wall, not for a techbbq.dk visitor. */}
            {missingLogo.length > 0 && (
              <section className="ev-gaps" style={{ marginTop: 40 }}>
                <h2>No logo matched</h2>
                <ul>
                  <li>
                    <strong>{missingLogo.length} partner(s)</strong> show their name instead of a
                    logo: {missingLogo.map((p) => p.company).join(", ")}. Either the company name
                    in Airtable does not match any file in the tbbqvisualgen logo library, or the
                    library has no logo for them. Fix the name or add the file, then run{" "}
                    <code>node scripts/sync-partner-logos.mjs --write</code>.
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

// Kept in step with PARTNER_TIERS in lib/partners.ts. Duplicated rather than imported because
// that module is server-only (it reads AIRTABLE_TOKEN at module scope) and importing it into a
// client component would pull the token read into the browser bundle.
const TIERS: Tier[] = [
  { name: "Prime", color: "#CE0F2E", cols: 4 },
  { name: "Main", color: "#FF2600", cols: 4 },
  { name: "Conqueror", color: "#FA7000", cols: 4 },
  { name: "Pioneer", color: "#fd9d04", cols: 5 },
  { name: "Core", color: "#10c8a7", cols: 5 },
  { name: "Challenger", color: "#2BB4E1", cols: 5 },
  { name: "International", color: "#7C9CFF", cols: 5 },
  { name: "Community", color: "#9a9a9c", cols: 6 },
];
