"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { fitLogosIn } from "@/lib/logoFit";
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
//
// `total` is the number of startups each category will hold once every confirmation is in
// (Auri, 2026-08-13). The wall always draws that many tiles: the confirmed logos first, then
// dashed "More soon" slots for the ones still to come. So the row never changes shape as it
// fills — a slot just turns into a logo — and the three rows are always 15 / 16 / 15.
//
// Every row lands in exactly three lines. 15 is 5 + 5 + 5. 16 would spill a lone tile onto a
// fourth line, so its last line runs six across instead (see .lw-grid--16 in globals.css).
const ROWS: { name: string; color: string; total: number }[] = [
  { name: "Planetary Health", color: "#00c11a", total: 15 }, // fully green
  { name: "Human Health", color: "#10c8a7", total: 16 }, // green into blue
  { name: "Deep Tech", color: "#2BB4E1", total: 15 }, // blue
];

function Mark({ s }: { s: Startup }) {
  // Tile = the fixed box, img = the content fitLogo() scales. See .lw-tile in globals.css for
  // why those cannot be the same element.
  return s.logo ? (
    <span className="lw-tile">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lw-logo"
        src={s.logo}
        // Lets useLogoRatios() read this file's shape back to the startup it belongs to.
        data-id={s.id}
        // The name is not shown, but it still has to be readable by a screen reader and it is
        // what appears if the image itself fails.
        alt={s.company}
        // NOT lazy. A lazily-loaded logo below the fold has no naturalWidth until it is
        // scrolled into view, and the whole layout depends on those measurements: packWideFirst
        // would sit on its hands and then reshuffle the row under the reader's eyes as they
        // scroll. Forty-odd small marks are worth loading up front to avoid that.
        loading="eager"
      />
    </span>
  ) : (
    // No renderable logo (an .ai or .cdr upload — see lib/lsstartups.ts). Without a stand-in
    // the company would silently vanish from a wall that shows no names, so its name is set
    // as a plain wordmark instead. Fix the upload in Airtable and it becomes a logo.
    <span className="lw-tile lw-tile--text">{s.company}</span>
  );
}

// Measures the SHAPE of every logo actually on the page: naturalWidth / naturalHeight, keyed by
// startup id. Only the browser knows this — the feed carries a URL, not the file's dimensions —
// so it has to be read after the images decode and fed back into the next render.
function useLogoRatios(deps: unknown[]) {
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img.lw-logo[data-id]"));

    const collect = () => {
      const next: Record<string, number> = {};
      for (const img of imgs) {
        if (img.naturalWidth && img.naturalHeight) {
          next[img.dataset.id!] = img.naturalWidth / img.naturalHeight;
        }
      }
      // Same measurements, same object: a fresh object every time would re-render forever,
      // because this hook's own output is what the render depends on.
      setRatios((prev) => {
        const keys = Object.keys(next);
        const same =
          keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === next[k]);
        return same ? prev : next;
      });
    };

    collect(); // anything already in the browser cache is measurable right now
    const pending = imgs.filter((img) => !img.complete);
    pending.forEach((img) => img.addEventListener("load", collect));
    return () => pending.forEach((img) => img.removeEventListener("load", collect));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ratios;
}

// WHICH logo goes on the last line, for the 16-tile row only.
//
// That line is six across, so its tiles are narrower than the ten above them. A long wordmark
// dropped there has to shrink to fit its width and ends up floating in a tile that looks
// half-empty — which is what made Human Health read as ragged. The compact marks (a droplet, a
// square monogram, a short name) lose nothing at six across: they were height-limited anyway.
//
// So the narrowest marks are moved to the end of the row and the wide wordmarks stay on the
// five-across lines. Measured, not a hand-kept list, because the wall is live Airtable data and
// a list would be wrong the next time a startup confirms. Auri, 2026-08-13.
//
// A name tile (no renderable logo) counts as wide: it is a line of text and wants the room.
function packWideFirst(items: Startup[], ratios: Record<string, number>, lastLine: number) {
  if (lastLine <= 0 || lastLine >= items.length) return items;
  const shape = (s: Startup) => (s.logo ? ratios[s.id] : 3);
  // Nothing is reordered until every logo has been measured, so the wall cannot visibly
  // reshuffle one tile at a time as the images arrive.
  if (items.some((s) => !shape(s))) return items;

  const narrowest = new Set(
    [...items]
      .sort((a, b) => shape(a)! - shape(b)!)
      .slice(0, lastLine)
      .map((s) => s.id)
  );
  // Two passes over the original array rather than one sort, so everything keeps the feed's
  // order within its group and only the chosen few actually move.
  return [...items.filter((s) => !narrowest.has(s.id)), ...items.filter((s) => narrowest.has(s.id))];
}

function LogoWall({
  items,
  total,
  ratios,
}: {
  items: Startup[];
  total: number;
  ratios: Record<string, number>;
}) {
  // One dashed slot per startup still to be confirmed, so the row is drawn at its final size
  // from day one. Never negative: if a category overshoots its target the slots simply stop.
  const soon = Math.max(0, total - items.length);
  const tiles = items.length + soon;

  // The slots already sit at the end of the last line, so the logos that share it are however
  // many of the six are left over.
  const ordered = useMemo(
    () => (tiles === 16 ? packWideFirst(items, ratios, 6 - soon) : items),
    [items, ratios, tiles, soon]
  );

  return (
    <div className={`lw-grid lw-grid--fixed${tiles === 16 ? " lw-grid--16" : ""}`}>
      {ordered.map((s) =>
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

      {/* The empty slots sit IN the grid rather than as a line under the wall, because the
          point is that these rows are still filling up. A gap in the run of logos says that;
          a sentence underneath reads as a footnote. Real text, not decoration, so a screen
          reader announces it — but only once per row: the rest are the same message repeated,
          which is noise in a screen reader and nothing extra on screen. */}
      {Array.from({ length: soon }, (_, i) => (
        <span key={`soon-${i}`} className="lw-soon" aria-hidden={i > 0 || undefined}>
          More soon
        </span>
      ))}
    </div>
  );
}

export default function LsStartupsPage() {
  const { url, refresh } = useFreshUrl("/api/ls-startups");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<Startup>("lsstartups", url, "startups");
  const all = useMemo(() => data ?? [], [data]);

  // Shapes drive which logos land on a six-across last line (see packWideFirst).
  const ratios = useLogoRatios([all]);

  // Even out how BIG each logo looks. object-fit only matches bounding boxes, and these range
  // from square to 5:1, so without this a square mark reads as half the size of a wordmark.
  // Re-runs on `ratios` too: a reorder moves logos into tiles of a different width, and every
  // scale is computed against the tile it sits in.
  useEffect(() => fitLogosIn(document), [all, ratios]);

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

          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey="lsstartups"
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
            <p className="count-line">
              {all.length} confirmed startup(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {rows.map(({ name, color, total, items }) => (
              <section
                key={name}
                className="lw-row"
                // 5 across, Auri: seven is too many. A 16-tile row overrides its last line to
                // six in CSS so it still finishes in three lines.
                style={{ "--row": color, "--cols": 5 } as React.CSSProperties}
              >
                <h2 className="lw-row__label">{name}</h2>
                {items.length ? (
                  <LogoWall items={items} total={total} ratios={ratios} />
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
