"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// Same per-image shimmer loader as the main Speakers page: state lives here so parent
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

type NissPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
  role: string;
};

const ROLES = ["all", "Speaker", "Moderator", "Team Member"] as const;
type Role = (typeof ROLES)[number];

// Display label only — the underlying value stays "Speaker" so the Airtable role filter
// (Role = "Speaker") keeps working. This event calls speakers "presenters".
const roleLabel = (r: string) => (r === "all" ? "All" : r === "Speaker" ? "Presenter" : r);

export default function NissPage() {
  const [role, setRole] = useState<Role>("Speaker");

  const url = role === "all" ? "/api/niss-speakers" : `/api/niss-speakers?role=${role}`;
  const { data, loading, revalidating, error, updated } = useCachedList<NissPerson>(
    `niss:${role}`,
    url,
    "people"
  );
  const people = data ?? [];

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Nordic India Startup Summit · Airtable 2026 grid</p>
          <h1>
            NISS 2026 <span className="text-tbbq-gradient">presenters</span>
          </h1>
          <p className="lede">
            Live from Airtable · the curated 2026 grid (presenters, moderators, team) ·
            served as JSON at <code>/api/niss-speakers</code>.
          </p>

          <div className="seg" role="tablist" aria-label="Filter by role" style={{ marginTop: 28 }}>
            {ROLES.map((r) => (
              <button key={r} role="tab" aria-selected={role === r} onClick={() => setRole(r)}>
                {roleLabel(r)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyEmbed path={url} listKey="people" />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet for the current filter (<code>{roleLabel(role)}</code>).
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
                      {p.role && <span className="s-card__role">{p.role}</span>}
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
