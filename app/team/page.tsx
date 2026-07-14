"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// Same per-image shimmer loader as the speaker pages: state lives here so parent
// re-renders (SWR revalidation) can't reset it back to shimmering.
function TeamPhoto({ src, alt }: { src: string; alt: string }) {
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

type TeamMember = {
  id: string;
  name: string;
  title: string;
  photo: string | null;
  linkedin: string | null;
  department: string;
};

const DEPARTMENTS = [
  "all",
  "Management",
  "Event",
  "Marketing",
  "Operations",
  "Partnerships",
  "PR and Communication",
  "Program",
  "Projects",
] as const;
type Dept = (typeof DEPARTMENTS)[number];

export default function TeamPage() {
  const [dept, setDept] = useState<Dept>("all");

  const url = dept === "all" ? "/api/team" : `/api/team?department=${encodeURIComponent(dept)}`;
  const { data, loading, revalidating, error, updated } = useCachedList<TeamMember>(
    `team:${dept}`,
    url,
    "team"
  );
  const members = data ?? [];

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">TechBBQ team · Airtable “#TechBBCuties” directory</p>
          <h1>
            Our <span className="text-tbbq-gradient">team</span>
          </h1>
          <p className="lede">
            Current team only · gated on <code>Active</code> and not <code>Archived</code> · served
            as JSON at <code>/api/team</code>. No email or phone leaves the server.
          </p>

          <div className="seg" role="tablist" aria-label="Filter by department" style={{ marginTop: 28 }}>
            {DEPARTMENTS.map((d) => (
              <button key={d} role="tab" aria-selected={dept === d} onClick={() => setDept(d)}>
                {d === "all" ? "All" : d}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyEmbed path={url} listKey="team" />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet for the current filter (<code>{dept === "all" ? "All" : dept}</code>).
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
              {members.length} team member(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>
            <div className="grid-cards">
              {members.map((m) => {
                const card = (
                  <>
                    {m.photo ? (
                      <TeamPhoto src={m.photo} alt={m.name} />
                    ) : (
                      <div className="s-card__media">
                        <div className="s-card__img--empty" />
                      </div>
                    )}
                    <div className="s-card__overlay">
                      {m.department && <span className="s-card__role">{m.department}</span>}
                      <h3 className="s-card__name">{m.name}</h3>
                      <p className="s-card__meta">{m.title}</p>
                    </div>
                  </>
                );
                return (
                  <article key={m.id} className="s-card">
                    {m.linkedin ? (
                      <a href={m.linkedin} target="_blank" rel="noopener noreferrer">
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
