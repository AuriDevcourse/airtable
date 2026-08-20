"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { fitLogosIn } from "@/lib/logoFit";
import { CopyPartnersEmbed } from "@/components/CopyPartnersEmbed";
import { CopyApiSnippet } from "@/components/CopyApiSnippet";

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
  // One partnership drawn as several tiles; same value means keep them side by side.
  group?: string;
  groupRank?: number;
  // Why this one is not live yet. Only ever present on this page's authenticated read.
  pending?: "no-logo" | "not-on-web" | "no-tier";
  // Whether the partner is paying. Same deal as `pending`: this page's authenticated read only,
  // stripped from the public feed in app/api/partners/route.ts, and never in a copied embed.
  paying?: "cash" | "barter";
};

// What a placeholder tile says it is waiting for. Short enough for a 5:3 tile.
const PENDING_LABEL: Record<NonNullable<Partner["pending"]>, string> = {
  "no-logo": "needs a white logo",
  "not-on-web": "needs Put on web ticked",
  // No tier means no BAND, so these cannot be drawn inside the wall at all — they get their own
  // section below it. The fix is in Airtable: a Company Link, or a Deal 2026 on the linked partner.
  "no-tier": "needs a Company Link",
};

// The paying label, INTERNAL ONLY. "Paid" is cash on the 2026 deal; "Barter" is no cash but a
// barter deal or an add-on, which Auri counts as value given. A partner with neither gets no
// badge, so the wall stays quiet and the badges mark the exceptions worth noticing.
const PAYING_LABEL: Record<NonNullable<Partner["paying"]>, string> = {
  cash: "Paid",
  barter: "Barter",
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
      {/* Top-left, because the waiting line already owns the bottom and a partner can be both
          paying and unticked. */}
      {p.paying && (
        <span className="lw-tile__pay" data-pay={p.paying}>
          {PAYING_LABEL[p.paying]}
        </span>
      )}
    </span>
  ) : (
    // No artwork at all. The partner still belongs on the DASHBOARD wall so the gap is visible,
    // and it looks unfinished on purpose: this tile is the request to go and get the logo. It
    // cannot reach techbbq.dk, which fetches the same feed without ?pending=1.
    <span className="lw-tile lw-tile--text" data-pending={p.pending ?? "no-logo"}>
      {p.company}
      <span className="lw-tile__wait">{PENDING_LABEL[p.pending ?? "no-logo"]}</span>
      {/* A paying partner with no artwork yet is the most useful badge on the page: it is the
          logo worth chasing first. */}
      {p.paying && (
        <span className="lw-tile__pay" data-pay={p.paying}>
          {PAYING_LABEL[p.paying]}
        </span>
      )}
    </span>
  );
}

function LogoWall({ items }: { items: Partner[] }) {
  // ORDER WITHIN A BAND IS RANDOM, re-rolled per page load — the same approach as the speaker
  // pages. The feed arrives alphabetically, which meant the same handful of companies owned the
  // top-left of their band on every render forever: a ranking inside a tier that nobody agreed
  // to and that the tier itself is supposed to express.
  //
  // The seed is fixed for this mount, so a background revalidation cannot reshuffle the wall
  // under the reader's eyes mid-scroll.
  //
  // CLIENT-SIDE ON PURPOSE — shuffling in the feed instead would be defeated by caching, twice
  // over: the response is memoised server-side and CDN-cached, so everyone inside one cache
  // window would get the SAME "random" order; and useCachedList compares the fetched JSON as a
  // STRING, so a reshuffled payload reads as changed and every revalidation would repaint the
  // wall and light up the "updated" badge over an unchanged partner list.
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);
  const ordered = useMemo(() => {
    let s = seed;
    const rand = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Shuffle THEN sort, because Array.sort is stable: both rules below still hold exactly, and
    // only the ties between them — which is most of the band — come out random.
    //
    // A wide logo is a STRIP of several marks (the EU co-funding frieze is 13:1). It spans the
    // whole row and goes first, which is both how techbbq.dk shows it and the only way it stays
    // legible: dropped into a normal 5:3 cell it would render at a fraction of the height.
    //
    // Anything unfinished sorts LAST inside its band, so each row reads as the live wall first
    // and the to-do list after it.
    //
    // A GROUP is one partnership drawn as several tiles (INCUBA x KITCHEN is four organisations
    // with four marks). The shuffle above would scatter them across the band, so they cluster on
    // the group key and lead the tier after any frieze. groupRank then fixes the order INSIDE the
    // cluster: a stable sort preserves the SHUFFLED order, not the feed's, so without it the four
    // marks came out in a different sequence on every load.
    return arr.sort(
      (a, b) =>
        Number(!!b.wide) - Number(!!a.wide) ||
        Number(!!a.pending) - Number(!!b.pending) ||
        Number(!!b.group) - Number(!!a.group) ||
        (a.group ?? "").localeCompare(b.group ?? "") ||
        (a.groupRank ?? 0) - (b.groupRank ?? 0)
    );
  }, [items, seed]);
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
  // No tier, so no band can hold them. Rendered on their own below the wall rather than dropped:
  // Crescita Partners had a ticked box and two uploaded logos and still appeared NOWHERE, which is
  // the failure this exists to prevent (Auri, 2026-08-05).
  const noTier = useMemo(() => all.filter((p) => p.pending === "no-tier"), [all]);

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

          {/* TWO WAYS TO HAND THE WALL TO AN OUTSIDE AGENCY, and the right one depends on what
              they are building with, not on how much they want to restyle.

              "Copy API code" is a few lines of fetch — they get the list and render it in their
              own framework. It is the short one, and it is what was already sent to the external
              designer for the main speakers.

              "Copy embed (unstyled)" ships finished markup that renders itself, for someone
              pasting into a CMS box with no build step. It is necessarily longer: fetching,
              escaping, URL resolution and error handling all have to travel with it. */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyApiSnippet feed="partners" label="Copy API code" />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              A few lines of fetch · for an agency building in their own framework. Start here.
            </span>
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyPartnersEmbed bare label="Copy embed (unstyled)" />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Finished markup, no CSS at all · only for pasting into a CMS box. Same localhost
              caveat.
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
                    noTier.length > 0 && `${noTier.length} needing a Company Link`,
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

            {/* NO TIER, SO NO BAND. These cannot be drawn inside the wall — a band is chosen by tier —
                so they get their own row underneath it. Before this they were dropped entirely and
                the only trace was a line in the Vercel log, which is how a partner with a ticked box
                and two uploaded logos came to appear nowhere at all. */}
            {noTier.length > 0 && (
              <section className="lw-row" style={{ "--row": "#9a9a9c" } as React.CSSProperties}>
                <h2 className="lw-row__label">Not placed in a tier yet</h2>
                <LogoWall items={noTier} />
              </section>
            )}

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
                  {noTier.length > 0 && (
                    <li>
                      <strong>{noTier.length} have no tier</strong>, so the wall has no band to draw
                      them in: {noTier.map((p) => p.company).join(", ")}. Fill in{" "}
                      <code>Company Link</code> on the row, or give the linked partner a{" "}
                      <code>Deal 2026</code> — the tier is derived from the deal, never typed. Their
                      logo and their ticked box do not matter until then.
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
