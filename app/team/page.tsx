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
  // A HAND-PICKED team, as record ids IN CLICK ORDER. Auri's ask (2026-08-10): a page wanted six
  // named people who sit in Management, Partnerships and Marketing, so no ?department= could
  // express them. Click order, not page order, because whoever picks six people is choosing the
  // order the cards appear in — the feed honours the order it is given.
  const [picked, setPicked] = useState<string[]>([]);

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

  function togglePick(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  // Name lookup for the "who is selected" line, so it reads as names rather than rec ids.
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const customUrl = `/api/team?ids=${picked.join(",")}`;

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
              // The label names the tab, because the button ALWAYS copied the selected
              // department and nothing said so — it read as one generic "copy the team" and
              // the per-department embeds went unnoticed (Auri asked for them, 2026-08-10).
              label={active === TABS_ALL ? "Copy embed (all + tabs)" : `Copy embed (${active})`}
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              {active === TABS_ALL
                ? "Everyone, with a centered department filter · mailto under each name."
                : `${active} only, no filter row · mailto under each name.`}
            </span>
          </div>

          {/* NAMES, PHOTOS AND TITLES ONLY — for a "meet the team" block that is not also a
              contact directory (Auri, 2026-08-06).
              It points at ?email=0 as well as passing email={false}: the flag alone only stops
              the snippet DRAWING the address, while the feed keeps shipping all 27 of them in
              the JSON, one devtools panel away. Two changes, because "do not show" and "do not
              send" are different promises and only the second one holds up. */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyEmbed
              path={embedUrl + (embedUrl.includes("?") ? "&" : "?") + "email=0"}
              listKey="team"
              shuffle={active === TABS_ALL}
              loadMore={false}
              email={false}
              deptTabs={active === TABS_ALL ? DEPARTMENT_ORDER : undefined}
              label={
                active === TABS_ALL
                  ? "Copy embed (no emails)"
                  : `Copy embed (${active}, no emails)`
              }
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Name, photo, job title and LinkedIn · addresses never reach the page.
            </span>
          </div>

          {/* A TEAM THAT IS NOT A DEPARTMENT. The six people Auri wanted on one block sit in
              Management, Partnerships and Marketing, so ?department= cannot express them and the
              only honest answer is to name them (2026-08-10).

              Picked by CLICK ORDER, and the feed returns them in that order — choosing six people
              is choosing a layout, so shuffle is off here and the first name is the first card.

              Grouped by department rather than alphabetically, because that is how someone thinks
              about who to include. Chips reuse .bp-tags__chip from the programme board's topic
              filter, so this introduces no new toggle style. */}
          {members.length > 0 && (
            <div style={{ marginTop: 26, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>Build a custom team</h2>
                <span className="lede" style={{ margin: 0, fontSize: 13 }}>
                  Pick anyone from any department · the cards keep the order you click.
                </span>
              </div>

              <div className="bp-tags" style={{ maxWidth: "none", margin: "14px 0 0" }}>
                {allSections.map(([dept, list]) => (
                  <div key={dept} style={{ marginTop: 10 }}>
                    <p
                      className="eyebrow"
                      style={{ margin: "0 0 6px", textAlign: "left", fontSize: 11, opacity: 0.75 }}
                    >
                      {dept}
                    </p>
                    <div className="bp-tags__row" style={{ justifyContent: "flex-start" }}>
                      {list.map((m) => {
                        const at = picked.indexOf(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className="bp-tags__chip"
                            aria-pressed={at >= 0}
                            onClick={() => togglePick(m.id)}
                            title={m.title}
                          >
                            {/* The position, so the order being built is visible while building
                                it — without it a click reorders nothing you can see. */}
                            {at >= 0 && (
                              <span style={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
                                {at + 1}
                              </span>
                            )}
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {/* Disabled until something is picked: an empty ?ids= would copy a snippet that
                    renders the WHOLE team, which is the opposite of what the button says. */}
                {picked.length === 0 ? (
                  <span className="lede" style={{ margin: 0, fontSize: 13 }}>
                    Nobody picked yet.
                  </span>
                ) : (
                  <>
                    <CopyEmbed
                      path={customUrl}
                      listKey="team"
                      shuffle={false}
                      loadMore={false}
                      email
                      label={`Copy embed (${picked.length} picked)`}
                    />
                    {/* Same two promises as above: the flag stops the snippet DRAWING an
                        address, ?email=0 stops the feed sending one. */}
                    <CopyEmbed
                      path={`${customUrl}&email=0`}
                      listKey="team"
                      shuffle={false}
                      loadMore={false}
                      email={false}
                      label={`Copy embed (${picked.length} picked, no emails)`}
                    />
                    <button type="button" className="copy-embed" onClick={() => setPicked([])}>
                      Clear
                    </button>
                  </>
                )}
              </div>

              {picked.length > 0 && (
                <p className="lede" style={{ margin: "10px 0 0", fontSize: 13 }}>
                  {picked.map((id, i) => (
                    <span key={id}>
                      {i > 0 && " · "}
                      {byId.get(id)?.name ?? id}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}

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
