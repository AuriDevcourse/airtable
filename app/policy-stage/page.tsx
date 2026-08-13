"use client";

import { useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";
import { MissingPhoto } from "@/components/MissingPhoto";

// THE POLICY STAGE — the Policy Stage roster, which runs across Event Rooms 5, 6 and 7.
//
// Built on the same three parts every project page here has: a role tab switcher, a copy-embed button
// for the Elementor widget, and a refresh that forces a live Airtable read. Modelled on
// /fintech-speakers, which is the other role-tabbed roster, so the two behave identically.
//
// Roles are CURATED, not submitted: the overflow form the people arrive through never asks, so Auri
// filled the Role column by hand. A row with no role is not published and is named in the server log
// — see lib/policystage.ts.

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

// The SAME switcher, inside the copied snippet. Auri asked for the tab pills on the live page too,
// "just like Speakers 2026" — that embed renders its own pill switcher and swaps groups client-side
// without refetching, and this is that mode. Keys must match the `groups` keys the feed returns, which
// are Airtable's own role values.
//
// One snippet now covers both roles, so there is no per-role copy button: pasting one HTML widget gets
// a visitor the whole roster with the switch. Shuffled per tab, for the same reason the page shuffles.
const EMBED_TABS = [
  { key: "Speaker", label: "Speakers", shuffle: true },
  { key: "Moderator", label: "Moderators", shuffle: true },
];

export default function PolicyStagePage() {
  const [role, setRole] = useState("Speaker");

  // RANDOM ORDER EVERY LOAD (Auri, 2026-08-05). Nobody on this roster is ranked, and a fixed
  // alphabetical order means the same ministers open the grid at every event — fair exposure is the
  // same rule /all-speakers-2026 and the Event Room tab already follow.
  //
  // The seed is fixed at MOUNT, not per render: SWR revalidates in the background and a fresh seed
  // there would re-jump the grid under the reader's cursor. A real page refresh remounts, so it
  // re-rolls then, which is exactly when a new order is wanted.
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);

  // `base` is the public URL a snippet may carry; `url` is what this page fetches and what the
  // refresh button turns into an authenticated live read. Never put ?fresh= in a snippet.
  const base = `/api/policy-stage?role=${encodeURIComponent(role)}`;
  const { url, refresh } = useFreshUrl(base);
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<PolicyPerson>(`policy-stage:${role}`, url, "people");

  // Seeded Fisher-Yates, the same LCG the other shuffling pages use. Seeded rather than
  // Math.random() per pass so the order holds still across a revalidation; the server cannot do this
  // for us because its response is cached for an hour and the order would freeze with it.
  const people = useMemo(() => {
    const list = [...(data ?? [])];
    let s = seed;
    const rand = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }, [data, seed]);

  const label = ROLES.find((r) => r.value === role)?.label ?? role;

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Policy Stage · Event Rooms 5, 6 &amp; 7</p>
          <h1>
            The Policy <span className="text-tbbq-gradient">Stage</span>
          </h1>
          <p className="lede">
            Live from Airtable · the Policy Stage roster, ministers, MEPs and ecosystem leaders ·
            served as JSON at <code>/api/policy-stage</code> (add <code>?role=Moderator</code>, or{" "}
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
            {/* ONE snippet for both roles: it fetches /api/policy-stage once, draws its own Speakers /
                Moderators pill switcher and swaps groups client-side. No `key` per role needed any
                more, because the button no longer depends on which tab this page is showing. */}
            <CopyEmbed
              path="/api/policy-stage"
              listKey="people"
              loadMore={false}
              transparent
              tabs={EMBED_TABS}
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              One snippet with the Speakers / Moderators switch built in. Copy from the deployed
              dashboard, not localhost.
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey={`policy-stage:${role}`}
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
              // Three moderators centred on their own row instead of trailing off the left of a
              // five-wide grid. Keyed on the COUNT, not the role, so it holds if a fourth moderator
              // arrives (the rule stops applying) or a role ends up with two.
              <div className={"grid-cards" + (people.length <= 3 ? " grid-cards--few" : "")}>
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
