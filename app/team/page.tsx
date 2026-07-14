"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// Public TechBBQ team directory: current staff grouped by department, with contact email and
// LinkedIn. Fed by /api/team (which also powers the techbbq.dk embed). Email is public by
// product decision.

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
  email?: string | null;
};

const DEPARTMENT_ORDER = [
  "Management",
  "Program",
  "Projects",
  "Partnerships",
  "Marketing",
  "PR and Communication",
  "Event",
  "Operations",
];
const OTHER = "Other";

function groupByDepartment(members: TeamMember[]): [string, TeamMember[]][] {
  const buckets = new Map<string, TeamMember[]>();
  for (const m of members) {
    const key = DEPARTMENT_ORDER.includes(m.department) ? m.department : OTHER;
    const list = buckets.get(key) ?? [];
    list.push(m);
    buckets.set(key, list);
  }
  const ordered: [string, TeamMember[]][] = [];
  for (const dept of DEPARTMENT_ORDER) {
    const list = buckets.get(dept);
    if (list && list.length) ordered.push([dept, list]);
  }
  const other = buckets.get(OTHER);
  if (other && other.length) ordered.push([OTHER, other]);
  return ordered;
}

function MemberCard({ m }: { m: TeamMember }) {
  const media = m.photo ? (
    <TeamPhoto src={m.photo} alt={m.name} />
  ) : (
    <div className="s-card__media">
      <div className="s-card__img--empty" />
    </div>
  );
  return (
    <article className="s-card">
      {/* Clicking the photo opens the person's LinkedIn (if they have one). */}
      {m.linkedin ? (
        <a
          href={m.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${m.name} on LinkedIn`}
        >
          {media}
        </a>
      ) : (
        media
      )}
      <div className="s-card__overlay">
        <h3 className="s-card__name">{m.name}</h3>
        <p className="s-card__meta">{m.title}</p>
        {m.email && (
          <div style={{ marginTop: 6, fontSize: 13 }}>
            <a href={`mailto:${m.email}`} style={{ textDecoration: "underline" }}>
              {m.email}
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

const TABS_ALL = "all";

export default function TeamPage() {
  const [active, setActive] = useState<string>(TABS_ALL);

  const { data, loading, revalidating, error, updated } = useCachedList<TeamMember>(
    "team:all",
    "/api/team",
    "team"
  );
  const members = data ?? [];
  const allSections = groupByDepartment(members);
  const sections =
    active === TABS_ALL ? allSections : allSections.filter(([dept]) => dept === active);
  const tabs = [TABS_ALL, ...allSections.map(([dept]) => dept)];

  // Embed snippet still targets the plain feed for the website.
  const embedUrl =
    active === TABS_ALL ? "/api/team" : `/api/team?department=${encodeURIComponent(active)}`;

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
            Current team only · grouped by department, with email and LinkedIn. Served as JSON at{" "}
            <code>/api/team</code> for the techbbq.dk embed.
          </p>

          {members.length > 0 && (
            <div className="seg" role="tablist" aria-label="Filter by department" style={{ marginTop: 28 }}>
              {tabs.map((d) => (
                <button key={d} role="tab" aria-selected={active === d} onClick={() => setActive(d)}>
                  {d === TABS_ALL ? "All" : d}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyEmbed path={embedUrl} listKey="team" />
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
              {members.length} team member(s) across {allSections.length} department(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>
            {sections.map(([dept, list]) => (
              <section key={dept} style={{ marginTop: 40 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    marginBottom: 16,
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                    paddingBottom: 8,
                  }}
                >
                  <h2 style={{ margin: 0 }}>{dept}</h2>
                  <span className="lede" style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
                    {list.length}
                  </span>
                </div>
                <div className="grid-cards">
                  {list.map((m) => (
                    <MemberCard key={m.id} m={m} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
