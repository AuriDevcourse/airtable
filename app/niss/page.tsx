"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";
import { MissingPhoto } from "@/components/MissingPhoto";

// Manual per-person crop overrides. Default card crop is object-position 50% 30% (see
// globals.css). Some portraits sit too high/low in the square; nudge the vertical % here.
// Lower Y = image pushed DOWN (more headroom shown); higher Y = pushed up. Keyed by the
// exact "Full Name" from Airtable.
const PHOTO_POSITION: Record<string, string> = {
  "Dr Nikhil Agarwal": "50% 8%",
};

// Same per-image shimmer loader as the main Speakers page: state lives here so parent
// re-renders (SWR revalidation) can't reset it back to shimmering.
function SpeakerPhoto({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const position = PHOTO_POSITION[alt.trim()];
  return (
    <div className={"s-card__media" + (loaded ? "" : " shimmer")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="s-card__img"
        src={src}
        alt={alt}
        loading="lazy"
        style={position ? { objectPosition: position } : undefined}
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

const ROLES = ["all", "Speaker", "Moderator", "Brand Ambassadors", "Team Member"] as const;
type Role = (typeof ROLES)[number];

// Display label only — the underlying value stays "Speaker" so the Airtable role filter
// (Role = "Speaker") keeps working. This event calls speakers "presenters".
const roleLabel = (r: string) => (r === "all" ? "All" : r === "Speaker" ? "Presenter" : r);

export default function NissPage() {
  const [role, setRole] = useState<Role>("Speaker");

  // `base` is the public URL the embed snippet must carry. The page itself fetches `url`,
  // which the refresh button turns into an authenticated ?fresh= read. Baking that into an
  // Elementor snippet would 401 for every visitor, so the two stay separate.
  const base = role === "all" ? "/api/niss-speakers" : `/api/niss-speakers?role=${role}`;
  const { url, refresh } = useFreshUrl(base);
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<NissPerson>(`niss:${role}`, url, "people");
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
            {/* Mobile defaults to the list-rows layout for every role now. The Brand
                Ambassadors embed pins desktop to 3 per row (only 3 people). */}
            <CopyEmbed
              path={base}
              listKey="people"
              columns={role === "Brand Ambassadors" ? 3 : undefined}
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet for the current filter (<code>{roleLabel(role)}</code>).
            </span>
          </div>

          {/* Reads the open role live from Airtable. Switching tabs resets it to an ordinary
              cached read. */}
          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey={`niss:${role}`}
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
              {people.length} person(s).
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>
            {/* Brand Ambassadors are only 3 people: pin the grid to 3 per row so they
                sit as one full row instead of a lonely auto-fill 5-wide grid. */}
            <div className={"grid-cards" + (role === "Brand Ambassadors" ? " grid-cards--3" : "")}>
              {people.map((p) => {
                const meta = p.title + (p.company ? ` · ${p.company}` : "");
                const card = (
                  <>
                    {p.photo ? (
                      <SpeakerPhoto src={p.photo} alt={p.name} />
                    ) : (
                      <div className="s-card__media">
                        <MissingPhoto />
                      </div>
                    )}
                    <div className="s-card__overlay">
                      {p.role && <span className="s-card__role">{roleLabel(p.role)}</span>}
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
