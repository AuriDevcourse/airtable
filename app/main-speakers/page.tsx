"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { CopyEmbed } from "@/components/CopyEmbed";
import { useCachedList } from "@/lib/useCachedList";

// The 12 speakers marketing tick as "Main Page = YES" in Airtable, in curated order.
// Photos + name + title·company only — no bio, no modal. Same card/row look as the other
// feeds so the techbbq.dk embed matches. Fed by /api/main-speakers.

function SpeakerPhoto({
  src,
  alt,
  mediaClassName = "s-card__media",
}: {
  src: string;
  alt: string;
  mediaClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={mediaClassName + (loaded ? "" : " shimmer")}>
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

type Speaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  hierarchy: number | null;
};

export default function MainSpeakers() {
  const { data, loading, revalidating, error, updated } = useCachedList<Speaker>(
    "main-speakers",
    "/api/main-speakers",
    "speakers"
  );
  const speakers = data ?? [];

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Main page picks · Airtable “Main Page = YES”</p>
          <h1>
            Main page <span className="text-tbbq-gradient">speakers</span>
          </h1>
          <p className="lede">
            The 12 speakers marketing features on the techbbq.dk front page · photos and
            details only, in curated order · served as JSON at{" "}
            <code>/api/main-speakers</code>.
          </p>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Fixed set of 12: no load-more, no detail pop-up (no bio), keep curated order. */}
            <CopyEmbed path="/api/main-speakers" listKey="speakers" loadMore={false} columns={4} />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet for this 12-speaker grid.
            </span>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {error && !data ? (
          <div className="notice">
            <strong>Could not load main-page speakers.</strong>
            <p>{error}</p>
            <p>
              Most likely no record has <code>Main Page</code> set to <code>YES</code>, or the
              token can&apos;t read the Marketing Project Overview table.
            </p>
          </div>
        ) : loading ? (
          <>
            <p className="count-line">Loading…</p>
            <SkeletonGrid count={12} />
          </>
        ) : (
          <>
            <p className="count-line">
              {speakers.length} speaker(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {speakers.length === 0 ? (
              <p className="muted">Nobody is marked for the main page yet.</p>
            ) : (
              <>
                {/* Desktop: card grid, 4 per row (grid-cards--4). */}
                <div className="grid-cards grid-cards--4">
                  {speakers.map((s) => {
                    const meta = s.title + (s.company ? ` · ${s.company}` : "");
                    const inner = (
                      <>
                        {s.photo ? (
                          <SpeakerPhoto src={s.photo} alt={s.name} />
                        ) : (
                          <div className="s-card__media">
                            <div className="s-card__img--empty" />
                          </div>
                        )}
                        <div className="s-card__overlay">
                          <h3 className="s-card__name">{s.name}</h3>
                          <p className="s-card__meta">{meta}</p>
                        </div>
                      </>
                    );
                    return (
                      <article key={s.id} className="s-card">
                        {s.linkedin ? (
                          <a
                            href={s.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${s.name} on LinkedIn`}
                          >
                            {inner}
                          </a>
                        ) : (
                          inner
                        )}
                      </article>
                    );
                  })}
                </div>

                {/* Mobile: list rows (photo left, name right) */}
                <ul className="list-rows">
                  {speakers.map((s) => {
                    const meta = s.title + (s.company ? ` · ${s.company}` : "");
                    const inner = (
                      <>
                        {s.photo ? (
                          <SpeakerPhoto
                            src={s.photo}
                            alt={s.name}
                            mediaClassName="row__media"
                          />
                        ) : (
                          <div className="row__media">
                            <div className="s-card__img--empty" />
                          </div>
                        )}
                        <div className="row__text">
                          <h3 className="row__name">{s.name}</h3>
                          <p className="row__meta">{meta}</p>
                        </div>
                      </>
                    );
                    return (
                      <li key={s.id} className="row">
                        {s.linkedin ? (
                          <a
                            href={s.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="row__link"
                            aria-label={`${s.name} on LinkedIn`}
                          >
                            {inner}
                          </a>
                        ) : (
                          <div className="row__link">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
