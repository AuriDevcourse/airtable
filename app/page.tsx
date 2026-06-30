"use client";

import { OrbBackdrop } from "@/components/OrbBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";

type Speaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
  website: string | null;
};

export default function Home() {
  const { data, loading, revalidating, error, updated } = useCachedList<Speaker>(
    "speakers",
    "/api/speakers",
    "speakers"
  );
  const speakers = data ?? [];

  return (
    <main>
      <section className="hero">
        <OrbBackdrop />
        <div className="wrap hero__inner">
          <p className="eyebrow">TechBBQ · Airtable connector</p>
          <h1>
            Speakers <span className="text-tbbq-gradient">preview</span>
          </h1>
          <p className="lede">
            Live from Airtable · only records with <code>On Website?</code> ticked ·
            the same data is served as JSON at <code>/api/speakers</code>.
          </p>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {error && !data ? (
          <div className="notice">
            <strong>Could not load speakers.</strong>
            <p>{error}</p>
            <p>
              Most likely the token is missing the <code>data.records:read</code> scope,
              or no record has <code>On Website?</code> ticked.
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
            <div className="grid-cards">
              {speakers.map((s) => {
                const meta = s.title + (s.company ? ` · ${s.company}` : "");
                const card = (
                  <>
                    <div className="s-card__media">
                      {s.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="s-card__img" src={s.photo} alt={s.name} loading="lazy" />
                      ) : (
                        <div className="s-card__img--empty" />
                      )}
                    </div>
                    <div className="s-card__overlay">
                      <h3 className="s-card__name">{s.name}</h3>
                      <p className="s-card__meta">{meta}</p>
                    </div>
                  </>
                );
                return (
                  <article key={s.id} className="s-card">
                    {s.linkedin ? (
                      <a href={s.linkedin} target="_blank" rel="noopener noreferrer">
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
