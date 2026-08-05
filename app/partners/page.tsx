"use client";

import { useEffect, useMemo } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { fitLogosIn } from "@/lib/logoFit";
import { CopyPartnersEmbed } from "@/components/CopyPartnersEmbed";

// The TechBBQ 2026 partner logo wall, one row per partnership tier. Same construction as
// /ls-startups (it reuses the .lw-* styles), just nine rows instead of three.
//
// Logos come from Airtable — see lib/partners.ts for why, and scripts/sync-partner-logos.mjs for
// the fallback copy.
//
// THIS PAGE SHOWS MORE THAN techbbq.dk DOES, on purpose. It reads `?pending=1`, so the partners the
// publish rules turned away are here too, as named placeholder tiles: that is the worklist of logos
// still to chase and boxes still to tick (Auri, 2026-08-05). The embed snippet fetches the same feed
// WITHOUT that parameter, so nothing unfinished can reach the live site.
type Partner = {
  id: string;
  company: string;
  tier: string;
  logo: string | null;
  website: string | null;
  wide?: boolean;
  scale?: number;
  // Why this one is not live yet. Only ever present on this page's authenticated read.
  pending?: "no-logo" | "not-on-web";
};

// What a placeholder tile says it is waiting for. Short enough for a 5:3 tile.
const PENDING_LABEL: Record<NonNullable<Partner["pending"]>, string> = {
  "no-logo": "needs a white logo",
  "not-on-web": "needs Put on web ticked",
};

// Tier order and colour come from the feed (lib/partners.ts owns them), so the page cannot
// drift from the API. Falls back to nothing if the feed is older than this page.
type Tier = { name: string; color: string; cols: number };

function Mark({ p }: { p: Partner }) {
  // The TILE is the fixed box and the IMG is the content inside it. Not one element: fitLogo()
  // scales the img, and when that scale reached 2.9 on a single element it grew the tile's
  // background and rounded corners too, so hovering one logo opened a hover card several times
  // the size of its neighbours. Same split the embed uses.
  return p.logo ? (
    <span
      className={p.wide ? "lw-tile lw-tile--wide" : "lw-tile"}
      // A partner whose artwork is ready and whose box is not ticked: the logo is shown, dimmed,
      // with what it is waiting for underneath. Hiding it would lose the useful half of the fact.
      data-pending={p.pending ?? undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lw-logo"
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
      {p.pending && <span className="lw-tile__wait">{PENDING_LABEL[p.pending]}</span>}
    </span>
  ) : (
    // No artwork at all. The partner still belongs on the DASHBOARD wall so the gap is visible,
    // and it looks unfinished on purpose: this tile is the request to go and get the logo. It
    // cannot reach techbbq.dk, which fetches the same feed without ?pending=1.
    <span className="lw-tile lw-tile--text" data-pending={p.pending ?? "no-logo"}>
      {p.company}
      <span className="lw-tile__wait">{PENDING_LABEL[p.pending ?? "no-logo"]}</span>
    </span>
  );
}

function LogoWall({ items }: { items: Partner[] }) {
  // A wide logo is a STRIP of several marks (the EU co-funding frieze is 13:1). It spans the
  // whole row and goes first, which is both how techbbq.dk shows it and the only way it stays
  // legible: dropped into a normal 5:3 cell it would render at a fraction of the height.
  //
  // Anything unfinished sorts LAST inside its band, so each row reads as the live wall first and
  // the to-do list after it.
  const ordered = [...items].sort(
    (a, b) => Number(!!b.wide) - Number(!!a.wide) || Number(!!a.pending) - Number(!!b.pending)
  );
  return (
    <div className="lw-grid lw-grid--fixed">
      {ordered.map((p) =>
        p.website ? (
          <a
            key={p.id}
            className="lw-link"
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
  // ?pending=1 asks for the unfinished rows too. It needs the dashboard password, which this page
  // already has (middleware gates it), and the request is same-origin so the browser sends it.
  const { url, refresh } = useFreshUrl("/api/partners?pending=1");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<Partner>("partners", url, "partners");
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

  // The two worklists, and what actually goes live. `live` is exactly what the embed will fetch.
  const live = useMemo(() => all.filter((p) => !p.pending), [all]);
  const missingLogo = useMemo(() => all.filter((p) => p.pending === "no-logo"), [all]);
  const notTicked = useMemo(() => all.filter((p) => p.pending === "not-on-web"), [all]);

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
            Live from Airtable, one row per tier · served as JSON at <code>/api/partners</code>{" "}
            (add <code>?tier=Prime</code>).
          </p>
          {/* WHAT IS ON THIS WALL, said on the page. "Partner Deliverables 2026" holds 126 rows and
              the wall shows 99 of them, and until this was written down the only way to find out
              why a partner was missing was to read lib/partners.ts. The band is the other
              surprise: it comes from the DEAL, so a row whose Partnership Type says Community can
              sit in Core, and the wall has no Prime band even though three rows say Prime. */}
          <p className="lede" style={{ fontSize: 14 }}>
            A partner is on the wall when all four hold: <strong>Put on web</strong> is ticked, the{" "}
            <strong>Logo</strong> cell holds a white SVG (or a white PNG), the partnership type is
            not <em>Investor</em>, <em>Academic</em> or <em>Tailored</em>, and a tier resolves from
            their deal. The <strong>band is the deal size</strong>, not{" "}
            <code>Partnership Type 2026</code> · anyone turned away is named in the server log with
            the reason.
          </p>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyPartnersEmbed />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies every tier as one block. Copy from the deployed dashboard, not localhost.
            </span>
          </div>

          {/* Manual sync: a live Airtable read past both caches, with a report of what
              changed. Gated by the dashboard password. */}
          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey="partners"
            />
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
            {/* The number that matters is what the EMBED will ship, so it leads. The rest is this
                page's own worklist and is named as such. */}
            <p className="count-line">
              {live.length} partner(s) live on techbbq.dk
              {all.length > live.length && (
                <span className="muted">
                  {" · "}
                  {all.length - live.length} not yet:{" "}
                  {[
                    missingLogo.length > 0 && `${missingLogo.length} needing a logo`,
                    notTicked.length > 0 && `${notTicked.length} needing a tick`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
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

            {/* Internal notes for whoever maintains the wall, not for a techbbq.dk visitor. Both
                lists are the placeholder tiles above, spelled out so they can be worked through
                and pasted to whoever owns the row. */}
            {(missingLogo.length > 0 || notTicked.length > 0) && (
              <section className="ev-gaps" style={{ marginTop: 40 }}>
                <h2>Not on techbbq.dk yet</h2>
                <ul>
                  {missingLogo.length > 0 && (
                    <li>
                      <strong>{missingLogo.length} need a logo</strong>, and show their name on the
                      wall above instead: {missingLogo.map((p) => p.company).join(", ")}. Upload a{" "}
                      <strong>white SVG</strong> (a white PNG at worst) into the row&apos;s{" "}
                      <code>Logo</code> cell in Partner Deliverables 2026. Nothing else is needed —
                      the wall reads Airtable directly.
                    </li>
                  )}
                  {notTicked.length > 0 && (
                    <li>
                      <strong>{notTicked.length} have a logo but no tick</strong>:{" "}
                      {notTicked.map((p) => p.company).join(", ")}. Tick{" "}
                      <code>Put on web</code> on their row and they appear.
                    </li>
                  )}
                  <li className="muted">
                    Whiteness is not checked here, because this feed cannot rasterise every logo on
                    every request. Run <code>node scripts/check-logo-tone.mjs</code> after an upload
                    to catch a dark or boxed file.
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
