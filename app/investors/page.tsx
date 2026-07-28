"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// Same per-image shimmer loader as the NISS/NASS pages: state lives here so parent
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

type InvestorSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  event: string;
  hierarchy: number;
};

const EVENTS = ["all", "pension-summit", "lp-forum"] as const;
type EventKey = (typeof EVENTS)[number];

const eventLabel = (e: string) =>
  e === "all" ? "All" : e === "pension-summit" ? "Pension & Insurance Summit" : "LP Forum";

export default function InvestorsPage() {
  const [event, setEvent] = useState<EventKey>("all");

  const url = event === "all" ? "/api/investor-speakers" : `/api/investor-speakers?event=${event}`;
  const { data, loading, revalidating, error, updated } = useCachedList<InvestorSpeaker>(
    `investors:${event}`,
    url,
    "people"
  );
  const people = data ?? [];

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">European Growth Pension &amp; Insurance Summit · LP Forum · 2026</p>
          <h1>
            Investor <span className="text-tbbq-gradient">speakers</span>
          </h1>
          <p className="lede">
            Live from Airtable · the Marketing Project Overview rows for both investor
            events · served as JSON at <code>/api/investor-speakers</code>.
          </p>

          <div className="seg" role="tablist" aria-label="Filter by event" style={{ marginTop: 28 }}>
            {EVENTS.map((e) => (
              <button key={e} role="tab" aria-selected={event === e} onClick={() => setEvent(e)}>
                {eventLabel(e)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Mobile defaults to the list-rows layout for every filter. */}
            <CopyEmbed path={url} listKey="people" />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet for the current filter (<code>{eventLabel(event)}</code>).
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
          <>
            <p className="count-line">Loading…</p>
            <SkeletonGrid count={10} />
          </>
        ) : (
          <>
            <p className="count-line">
              {people.length} person(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
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
                      {/* Show which event the person belongs to when viewing both. */}
                      {event === "all" && p.event && (
                        <span className="s-card__role">{eventLabel(p.event)}</span>
                      )}
                      <h3 className="s-card__name">{p.name}</h3>
                      <p className="s-card__meta">{meta}</p>
                    </div>
                  </>
                );
                return (
                  <article key={p.id} className="s-card">
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
