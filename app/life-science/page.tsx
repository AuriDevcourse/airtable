"use client";

import { useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// Same per-image shimmer loader as the other speaker pages: state lives here so parent
// re-renders (SWR revalidation) can't reset it back to shimmering.
function SpeakerPhoto({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={"s-card__media" + (loaded ? "" : " shimmer")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="s-card__img"
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  );
}

type LsPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
  role: string;
  // Which of the two stages this person speaks on, plus its colour (Deep Tech blue,
  // Life Science green). Set by /api/life-science; see lib/lifescience.ts.
  tag: string;
  tagColor: string | null;
};

// Display order for the stage filter pills. These are the exact Airtable select options from
// `Which LS DT stage? `. Deliberately duplicated rather than imported from lib/lifescience.ts:
// that module is server-only (it reads AIRTABLE_TOKEN at module scope), so importing it into a
// client component would pull the token read into the browser bundle. Keep the two in sync.
const LS_STAGES = ["Life Science x Deep Tech Stage", "Deep Tech Event Day"];

export default function LifeSciencePage() {
  const { url, refresh } = useFreshUrl("/api/life-science");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<LsPerson>("lifescience", url, "people");
  const all = data ?? [];

  // Random order at all times (Auri's rule). Seeded so a background revalidation cannot
  // reshuffle the grid while it is being read; a refresh re-rolls it. The API sorts
  // alphabetically only as a stable base — it cannot shuffle server-side because that
  // response is cached for an hour and every visitor would get the same "random" order.
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);
  const people = useMemo(() => {
    let x = seed;
    const rand = () => ((x = (x * 9301 + 49297) % 233280), x / 233280);
    const arr = all.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [all, seed]);

  // Stage filter, mirroring what the embed snippet does client-side (lib/embedSnippet.ts
  // `tagTabs`). "" is the All pill.
  const [stage, setStage] = useState("");
  // Built from the data, so a stage nobody is on never gets a pill and an unexpected new
  // Airtable option still shows up (appended after the two known ones).
  const stages = useMemo(() => {
    const seen = new Set(all.map((p) => p.tag).filter(Boolean));
    const ordered = LS_STAGES.filter((s) => seen.has(s));
    for (const s of seen) if (!ordered.includes(s)) ordered.push(s);
    return ordered;
  }, [all]);
  // Filtering the shuffled array keeps this load's order inside each pill.
  // Anyone whose stage column is blank in Airtable matches no pill and shows only under All.
  const visible = useMemo(
    () => (stage ? people.filter((p) => p.tag === stage) : people),
    [people, stage]
  );

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Life Science &amp; Deep Tech · Airtable “Speakers Library 2026”</p>
          <h1>
            Life Science &amp; Deep Tech <span className="text-tbbq-gradient">Speakers 2026</span>
          </h1>
          <p className="lede">
            Live from Airtable · gated on the curated{" "}
            <code>Speakers Library 2026</code> view <em>and</em> on having a stage set in{" "}
            <code>Which LS DT stage?</code> · served as JSON at <code>/api/life-science</code>.
          </p>

          {/* The button follows the pill above the grid: pick a stage and you copy an embed
              for exactly those speakers. `key` forces a fresh <CopyEmbed> per stage so its
              internal "Copied" state cannot carry over and claim the previous snippet was
              copied. The single-stage embed drops tagTabs — a one-stage list has nothing to
              filter, and a lone pill reading "Deep Tech Event Day" above only Deep Tech
              people looks broken. */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyEmbed
              key={stage || "all"}
              path={stage ? `/api/life-science?stage=${encodeURIComponent(stage)}` : "/api/life-science"}
              listKey="people"
              loadMore={false}
              gradient="ls"
              shuffle
              tagTabs={stage ? undefined : LS_STAGES}
              label={stage ? `Copy embed (${stage})` : "Copy embed code"}
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              {stage
                ? `Copies an Elementor snippet showing only the ${stage} speakers, with no filter pills.`
                : "Copies an Elementor snippet for this speaker grid, with the stage filter built in. Pick a stage above to copy just those speakers."}
            </span>
          </div>

          {/* The stage pills filter one cached list client-side, so this reads the whole
              Life Science feed live regardless of which pill is active. */}
          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey="lifescience"
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
          <>
            <p className="count-line">Loading…</p>
            <SkeletonGrid count={9} />
          </>
        ) : (
          <>
            {stages.length > 1 && (
              <div className="seg" role="tablist" aria-label="Filter by stage" style={{ marginBottom: 24 }}>
                <button
                  role="tab"
                  aria-selected={stage === ""}
                  onClick={() => setStage("")}
                >
                  All
                </button>
                {stages.map((s) => (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={stage === s}
                    onClick={() => setStage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <p className="count-line">
              {visible.length} speaker(s){stage ? ` on ${stage}` : ""}.
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>
            <div className="grid-cards">
              {visible.map((p) => {
                const meta = p.title + (p.company ? ` · ${p.company}` : "");
                const card = (
                  <>
                    {p.photo ? (
                      <SpeakerPhoto src={p.photo} alt={p.name} />
                    ) : (
                      <div className="s-card__media">
                        <div className="s-card__img--empty" />
                      </div>
                    )}
                    <div className="s-card__overlay">
                      {/* Stage sits first, directly under the photo, in that stage's colour. */}
                      {p.tag && (
                        <span
                          className="s-card__stage"
                          style={p.tagColor ? { color: p.tagColor } : undefined}
                        >
                          {p.tag}
                        </span>
                      )}
                      {p.role && <span className="s-card__role">{p.role}</span>}
                      <h3 className="s-card__name">{p.name}</h3>
                      <p className="s-card__meta">{meta}</p>
                    </div>
                  </>
                );
                return (
                  <article key={p.id} className="s-card s-card--ls">
                    {p.linkedin ? (
                      <a href={p.linkedin} target="_blank" rel="noopener noreferrer">
                        {card}
                      </a>
                    ) : (
                      card
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
