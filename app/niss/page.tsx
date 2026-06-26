"use client";

import { useState } from "react";
import { OrbBackdrop } from "@/components/OrbBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";

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

const ROLES = ["all", "Speaker", "Moderator", "Team"] as const;
type Role = (typeof ROLES)[number];

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
        <OrbBackdrop />
        <div className="wrap hero__inner">
          <p className="eyebrow">Nordic India Startup Summit</p>
          <h1>
            NISS 2025 <span className="text-tbbq-gradient">speakers</span>
          </h1>
          <p className="lede">
            Live from Airtable · only records marked <code>Status = On website</code> ·
            served as JSON at <code>/api/niss-speakers</code>.
          </p>

          <div className="seg" role="tablist" aria-label="Filter by role" style={{ marginTop: 28 }}>
            {ROLES.map((r) => (
              <button key={r} role="tab" aria-selected={role === r} onClick={() => setRole(r)}>
                {r === "all" ? "All" : r}
              </button>
            ))}
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="s-card__img" src={p.photo} alt={p.name} loading="lazy" />
                    ) : (
                      <div className="s-card__img--empty" />
                    )}
                    <div className="s-card__body">
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
