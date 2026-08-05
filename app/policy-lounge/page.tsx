"use client";

import { useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// THE POLICY LOUNGE — the Policy Stage roster, which runs across Event Rooms 5, 6 and 7.
//
// Built on the same three parts every project page here has: a role tab switcher, a copy-embed button
// for the Elementor widget, and a refresh that forces a live Airtable read. Modelled on
// /fintech-speakers, which is the other role-tabbed roster, so the two behave identically.
//
// Roles are CURATED, not submitted: the overflow form the people arrive through never asks, so Auri
// filled the Role column by hand. A row with no role is not published and is named in the server log
// — see lib/policylounge.ts.

// Same per-image shimmer loader as the other feed pages: state lives here so parent re-renders
// (SWR revalidation) cannot reset it back to shimmering.
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

type PolicyPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  role: string;
  hierarchy: number | null;
};

// Airtable's own values are the tabs' identity; the labels are display only. Speakers first, because
// that is what a visitor came for and what the bare feed URL serves.
const ROLES: { value: string; label: string }[] = [
  { value: "Speaker", label: "Speakers" },
  { value: "Moderator", label: "Moderators" },
];

export default function PolicyLoungePage() {
  const [role, setRole] = useState("Speaker");

  // `base` is the public URL a snippet may carry; `url` is what this page fetches and what the
  // refresh button turns into an authenticated live read. Never put ?fresh= in a snippet.
  const base = `/api/policy-lounge?role=${encodeURIComponent(role)}`;
  const { url, refresh } = useFreshUrl(base);
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<PolicyPerson>(`policy-lounge:${role}`, url, "people");
  const people = data ?? [];

  const label = ROLES.find((r) => r.value === role)?.label ?? role;

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Policy Stage · Event Rooms 5, 6 &amp; 7</p>
          <h1>
            The Policy <span className="text-tbbq-gradient">Lounge</span>
          </h1>
          <p className="lede">
            Live from Airtable · the Policy Stage roster, ministers, MEPs and ecosystem leaders ·
            served as JSON at <code>/api/policy-lounge</code> (add <code>?role=Moderator</code>, or{" "}
            <code>?role=all</code> for everyone).
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
            {/* `key` so the button's internal "Copied" state cannot survive a role switch and claim
                the previous snippet was copied (same fix as /fintech-speakers and /life-science). */}
            <CopyEmbed
              key={role}
              path={base}
              listKey="people"
              loadMore={false}
              transparent
              label={role === "Speaker" ? "Copy embed code" : `Copy embed (${label})`}
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet with the {label.toLowerCase()}. Copy from the deployed
              dashboard, not localhost.
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey={`policy-lounge:${role}`}
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
              {people.length} {label.toLowerCase()}.
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {people.length === 0 ? (
              // Only reachable when a role has nobody in it, which is a data state rather than a
              // failure — say which role, so it does not read as a broken page.
              <p className="muted">
                No {label.toLowerCase()} yet. Set <code>Role</code> to{" "}
                <strong>{role}</strong> on the Event Room 5,6,7 rows in Airtable and press Refresh.
              </p>
            ) : (
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
            )}
          </>
        )}
      </div>
    </main>
  );
}
