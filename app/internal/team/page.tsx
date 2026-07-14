"use client";

import { useEffect, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";

// INTERNAL team view. Behind Basic auth (middleware.ts). Shows staff email, so it must never
// be linked from or embedded on the public site. No localStorage caching here on purpose:
// emails should not persist on disk in a shared machine's browser.

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
  return (
    <article className="s-card">
      {m.photo ? (
        <TeamPhoto src={m.photo} alt={m.name} />
      ) : (
        <div className="s-card__media">
          <div className="s-card__img--empty" />
        </div>
      )}
      <div className="s-card__overlay">
        <h3 className="s-card__name">{m.name}</h3>
        <p className="s-card__meta">{m.title}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: 13 }}>
          {m.email && (
            <a href={`mailto:${m.email}`} style={{ textDecoration: "underline" }}>
              {m.email}
            </a>
          )}
          {m.linkedin && (
            <a href={m.linkedin} target="_blank" rel="noopener noreferrer" style={{ opacity: 0.8 }}>
              LinkedIn
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function InternalTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("all");

  useEffect(() => {
    let live = true;
    fetch("/api/internal/team")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load");
        return json;
      })
      .then((json) => {
        if (!live) return;
        setMembers(Array.isArray(json.team) ? json.team : []);
        setLoading(false);
      })
      .catch((e) => {
        if (!live) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const allSections = groupByDepartment(members);
  const sections =
    active === "all" ? allSections : allSections.filter(([dept]) => dept === active);
  const tabs = ["all", ...allSections.map(([dept]) => dept)];

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Internal · staff directory with contact details</p>
          <h1>
            Team <span className="text-tbbq-gradient">contacts</span>
          </h1>
          <p className="lede">
            Password-protected internal view. Shows email + LinkedIn per person. Not linked from the
            public site. Current team only.
          </p>

          {members.length > 0 && (
            <div className="seg" role="tablist" aria-label="Filter by department" style={{ marginTop: 28 }}>
              {tabs.map((d) => (
                <button key={d} role="tab" aria-selected={active === d} onClick={() => setActive(d)}>
                  {d === "all" ? "All" : d}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {error ? (
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
