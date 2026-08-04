"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// Same per-image shimmer loader as the other feed pages.
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

type FintechSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  hierarchy: number | null;
  role: string;
};

// The three roles the Future of Fintech view holds. The moderators and the keynote were in
// Airtable all along and filtered out of the feed; these tabs are what "separate them" means
// (Auri, 2026-08-04). Airtable's own value is the tab's identity, the label is just display.
const ROLES: { value: string; label: string }[] = [
  { value: "Speaker", label: "Speakers" },
  { value: "Moderator", label: "Moderators" },
  { value: "Keynote Speaker", label: "Keynote" },
];

export default function FintechSpeakersPage() {
  const [role, setRole] = useState("Speaker");

  // `base` is the public URL a snippet may carry; `url` is what this page fetches and what the
  // refresh button turns into an authenticated live read. Never put ?fresh= in a snippet.
  const base = `/api/fintech-speakers?role=${encodeURIComponent(role)}`;
  const { url, refresh } = useFreshUrl(base);
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<FintechSpeaker>(`fintech-speakers:${role}`, url, "people");
  // Curated hierarchy order comes from the API (1..9 for speakers, 1.1/1.2 for moderators); no
  // shuffle on purpose.
  const people = data ?? [];

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Future of Fintech · Airtable speaker submissions</p>
          <h1>
            Fintech <span className="text-tbbq-gradient">speakers</span>
          </h1>
          <p className="lede">
            Live from Airtable · the Future of Fintech roster in curated Hierarchy order ·
            served as JSON at <code>/api/fintech-speakers</code> (add{" "}
            <code>?role=Moderator</code>, or <code>?role=all</code> for everyone).
          </p>

          <div className="seg" role="tablist" aria-label="Filter by role" style={{ marginTop: 28 }}>
            {ROLES.map((r) => (
              <button
                key={r.value}
                role="tab"
                aria-selected={role === r.value}
                onClick={() => setRole(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* transparent: no dark panel behind the grid — the Fintech page on
                techbbq.dk brings its own background.
                `key` so the button's internal "Copied" state cannot carry across a role switch
                and claim the previous snippet was copied (same fix as /life-science). */}
            <CopyEmbed
              key={role}
              path={base}
              listKey="people"
              loadMore={false}
              transparent
              label={role === "Speaker" ? "Copy embed code" : `Copy embed (${ROLES.find((r) => r.value === role)?.label})`}
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet with the{" "}
              {ROLES.find((r) => r.value === role)?.label.toLowerCase()} in Hierarchy order.
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey={`fintech-speakers:${role}`}
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
            <SkeletonGrid count={9} />
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
