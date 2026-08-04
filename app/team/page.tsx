"use client";

import { useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// Public TechBBQ team directory: current staff grouped by department, with contact email and
// LinkedIn. Fed by /api/team (which also powers the techbbq.dk embed). Email is public by
// product decision.

function TeamPhoto({ src, alt, focus }: { src: string; alt: string; focus?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={"s-card__media" + (loaded ? "" : " shimmer")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="s-card__img"
        src={src}
        alt={alt}
        loading="lazy"
        // Per-person vertical crop from the feed; without one the stylesheet's 50% 30% applies.
        style={focus ? { objectPosition: `50% ${focus}` } : undefined}
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
  // Set by /api/team for chief officers only (1 = CEO, 2 = other chiefs). See lib/team.ts.
  hierarchy: number | null;
  // Per-person object-position Y for the card photo (e.g. "40%"); null = stylesheet default.
  focus: string | null;
};

// Tab order. Anything not listed lands in "Other", so keep this in step with the Department
// select in Airtable and with DEPARTMENTS in lib/team.ts.
const DEPARTMENT_ORDER = [
  "Management",
  "Program",
  "Projects",
  "Partnerships",
  "Marketing",
  "PR and Communication",
  "Event",
  "Operations",
  "Finance",
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
    <TeamPhoto src={m.photo} alt={m.name} focus={m.focus} />
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

  const { url, refresh } = useFreshUrl("/api/team");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<TeamMember>("team:all", url, "team");
  const members = data ?? [];
  const allSections = groupByDepartment(members);
  // Department tabs still come from the grouping, but "All" no longer renders those groups.
  const tabs = [TABS_ALL, ...allSections.map(([dept]) => dept)];
  const sections = active === TABS_ALL ? [] : allSections.filter(([dept]) => dept === active);

  // "All" is one flat list, not department sections (Auri's rule): chief officers first, then
  // everyone else in a random order that re-rolls on every page load. The seed is fixed for
  // this mount so switching tabs or a background revalidation can't reshuffle mid-view.
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);
  const flat = useMemo(() => {
    let s = seed;
    const rand = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    const shuffle = (arr: TeamMember[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    const chiefs = members.filter((m) => typeof m.hierarchy === "number");
    const rest = members.filter((m) => typeof m.hierarchy !== "number");
    // Shuffle then sort: Array.sort is stable, so the CEO (rank 1) leads and the other chiefs
    // (all rank 2) keep the shuffled order instead of one of them always being listed first.
    shuffle(chiefs).sort((a, b) => (a.hierarchy as number) - (b.hierarchy as number));
    return [...chiefs, ...shuffle(rest)];
  }, [members, seed]);

  // Embed snippet targets the plain feed for the website. On "All" it carries the same
  // chiefs-first random order: the snippet's shuffle exempts anyone with a numeric hierarchy,
  // which is exactly the chiefs. A pasted snippet never self-updates, so re-copy it after this.
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
            Current team only, long term volunteers excluded. All shows everyone together with
            the chief officers first and the rest in a random order; pick a department to see
            just that team. Served as JSON at <code>/api/team</code> for the techbbq.dk embed.
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
            {/* Team-specific: the whole team shows at once (no Load more — it is 27 people,
                not 179 speakers), every card carries its email, photos honour the per-person
                crop from the feed, and the embed gets its own centered department filter.
                deptTabs only on the All copy: a single-department embed has nothing to filter. */}
            <CopyEmbed
              path={embedUrl}
              listKey="team"
              shuffle={active === TABS_ALL}
              loadMore={false}
              email
              deptTabs={active === TABS_ALL ? DEPARTMENT_ORDER : undefined}
            />
          </div>

          {/* This feed is the slowest to refresh on its own — daily outside the event window
              — so the manual read matters most here. */}
          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey="team"
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
            <SkeletonGrid count={10} />
          </>
        ) : (
          <>
            <p className="count-line">
              {active === TABS_ALL
                ? `${members.length} team member(s) across ${allSections.length} department(s).`
                : `${sections[0]?.[1].length ?? 0} in ${active}.`}
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {/* All: one flat grid, chiefs first, everyone else random. */}
            {active === TABS_ALL && (
              <div className="grid-cards" style={{ marginTop: 28 }}>
                {flat.map((m) => (
                  <MemberCard key={m.id} m={m} />
                ))}
              </div>
            )}

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
