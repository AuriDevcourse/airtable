"use client";

import { useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// The tab set the embed snippet renders — keys match the /api/all-speakers groups.
const EMBED_TABS = [
  { key: "speakers", label: "Speakers" },
  { key: "eventRoom", label: "Event Room Speakers" },
  { key: "investors", label: "Investor Speakers" },
];

// Same per-image shimmer loader as the NISS/NASS/Investors pages: state lives here so
// parent re-renders (SWR revalidation) can't reset it back to shimmering.
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

// The raw feed shapes overlap on exactly the fields this page renders; extra
// fields (bio, role, hierarchy…) ride along in the JSON and are ignored.
type FeedPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  role?: string;
  event?: string;
};

// What a card renders: a feed person plus which source it came from.
type Card = FeedPerson & { tag?: string };

const GROUPS = ["speakers", "event-room", "investors"] as const;
type GroupKey = (typeof GROUPS)[number];

const GROUP_LABELS: Record<GroupKey, string> = {
  speakers: "Speakers",
  "event-room": "Event Room Speakers",
  investors: "Investor Speakers",
};

// Investor event short keys → display names (mirrors /investors).
const INVESTOR_EVENT_LABELS: Record<string, string> = {
  "pension-summit": "Pension & Insurance Summit",
  "lp-forum": "LP Forum",
  "investor-day": "Investor Day",
};

export default function AllSpeakers2026Page() {
  const [group, setGroup] = useState<GroupKey>("speakers");

  // All four sources load on mount so switching groups is instant. Cache keys are
  // shared with the standalone pages, so a warm localStorage entry paints instantly.
  const speakers = useCachedList<FeedPerson>("speakers-2026", "/api/speakers-2026", "speakers");
  const niss = useCachedList<FeedPerson>("niss:all", "/api/niss-speakers", "people");
  const nass = useCachedList<FeedPerson>("nass:all", "/api/nass-speakers", "people");
  const investors = useCachedList<FeedPerson>("investors:all", "/api/investor-speakers", "people");

  const people = useMemo<Card[]>(() => {
    if (group === "speakers") {
      // Speakers 2026 hub feed, already hierarchy-ordered by the API.
      return speakers.data ?? [];
    }
    if (group === "event-room") {
      // NISS 2026 + NASS 2026 merged, only actual speakers (Auri's rule): the feeds
      // also carry Moderators, Team Members, Brand Ambassadors and blank-role rows.
      // Same filter lives in /api/all-speakers for the embed; keep them in sync.
      const fromNiss: Card[] = (niss.data ?? [])
        .filter((p) => p.role === "Speaker")
        .map((p) => ({ ...p, tag: "NISS 2026" }));
      const fromNass: Card[] = (nass.data ?? [])
        .filter((p) => p.role === "Speaker")
        .map((p) => ({ ...p, tag: "NASS 2026" }));
      return [...fromNiss, ...fromNass].sort((a, b) => a.name.localeCompare(b.name));
    }
    // Investor speakers: Pension & Insurance Summit + LP Forum + Investor Day.
    return (investors.data ?? []).map((p) => ({
      ...p,
      tag: p.event ? INVESTOR_EVENT_LABELS[p.event] ?? p.event : undefined,
    }));
  }, [group, speakers.data, niss.data, nass.data, investors.data]);

  // One event-room feed down while the other renders would silently show half the
  // roster; surface it instead (completion-auditor finding).
  const partialWarning =
    group === "event-room"
      ? niss.error && !niss.data && nass.data
        ? "NISS 2026 could not load · showing NASS 2026 only"
        : nass.error && !nass.data && niss.data
          ? "NASS 2026 could not load · showing NISS 2026 only"
          : null
      : null;

  // The active group's load state. Event room is "loading" until both feeds landed
  // and "failed" only if both did (one healthy feed still renders).
  const active =
    group === "speakers"
      ? {
          loading: speakers.loading,
          revalidating: speakers.revalidating,
          error: speakers.error,
          empty: !speakers.data,
        }
      : group === "event-room"
        ? {
            loading: niss.loading || nass.loading,
            revalidating: niss.revalidating || nass.revalidating,
            error: niss.error && nass.error ? niss.error : null,
            empty: !niss.data && !nass.data,
          }
        : {
            loading: investors.loading,
            revalidating: investors.revalidating,
            error: investors.error,
            empty: !investors.data,
          };

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Speakers · Event Rooms · Investor events · 2026</p>
          <h1>
            All speakers <span className="text-tbbq-gradient">2026</span>
          </h1>
          <p className="lede">
            Every 2026 roster in one place. Speakers is the Speaker Hub grid; Event Room
            Speakers combines NISS 2026 and NASS 2026; Investor Speakers covers the
            Pension &amp; Insurance Summit, LP Forum and Investor Day.
          </p>

          <div className="seg" role="tablist" aria-label="Speaker group" style={{ marginTop: 28 }}>
            {GROUPS.map((g) => (
              <button key={g} role="tab" aria-selected={group === g} onClick={() => setGroup(g)}>
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* One snippet carries all three groups: it fetches /api/all-speakers once and
                renders its own centered tab switcher, so the WordPress visitor can flip
                between Speakers / Event Room / Investors inside the embed. */}
            <CopyEmbed path="/api/all-speakers" listKey="people" tabs={EMBED_TABS} />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies one Elementor snippet with the tab switcher built in.
            </span>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {active.error && active.empty ? (
          <div className="notice">
            <strong>Could not load.</strong>
            <p>{active.error}</p>
          </div>
        ) : active.loading ? (
          <>
            <p className="count-line">Loading…</p>
            <SkeletonGrid count={10} />
          </>
        ) : (
          <>
            <p className="count-line">
              {people.length} person(s).
              {partialWarning && <span className="reval"> · {partialWarning}</span>}
              {active.revalidating && <span className="reval"> · checking for updates…</span>}
            </p>
            <div className="grid-cards">
              {people.map((p) => {
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
                      {p.tag && <span className="s-card__role">{p.tag}</span>}
                      <h3 className="s-card__name">{p.name}</h3>
                      <p className="s-card__meta">{meta}</p>
                    </div>
                  </>
                );
                return (
                  <article key={`${group}:${p.id}`} className="s-card">
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
