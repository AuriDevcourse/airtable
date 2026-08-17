"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";
import { MissingPhoto } from "@/components/MissingPhoto";

// THE BOARD SUMMIT — the roster hosted by Boardway, in Event Room 1 on Day 2.
//
// A copy of /policy-stage, deliberately: same table, same curated Role column, same role-tabbed
// embed. The two pages behaving identically is worth more than either being individually clever.
//
// The one thing this page adds is the WAITING LIST. Roles here are curated, not submitted — the
// overflow form these people arrive through never asks — so a row with no Role is not published.
// Four of the 31 are in that state today, and this page names them rather than leaving the answer to
// "why is our speaker not on the wall" in a server log. See lib/boardsummit.ts.

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

type BoardPerson = {
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

// The SAME switcher, inside the copied snippet: one pasted widget gets a visitor the whole roster
// with the Speakers / Moderators pills, swapped client-side without refetching. Keys must match the
// `groups` keys the feed returns, which are Airtable's own role values.
const EMBED_TABS = [
  { key: "Speaker", label: "Speakers", shuffle: true },
  { key: "Moderator", label: "Moderators", shuffle: true },
];

/**
 * The rows the feed decided not to publish.
 *
 * A SECOND, TINY REQUEST rather than a change to useCachedList, which every page in this dashboard
 * shares and which is deliberately about a list and nothing else. This one hits the same server
 * cache as the grid above it, so it costs an Airtable read of zero, and it is the only place the
 * dashboard password buys you something the public feed will not serve.
 */
function WaitingOnAirtable() {
  const [waiting, setWaiting] = useState<{ needsRole: string[]; needsPhoto: string[] } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/board-summit?role=all")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active || !j) return;
        setWaiting({ needsRole: j.needsRole ?? [], needsPhoto: j.needsPhoto ?? [] });
      })
      // Silent: this is a footnote to a page that already rendered. A failed fetch here must not
      // put an error where the roster is.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!waiting || (waiting.needsRole.length === 0 && waiting.needsPhoto.length === 0)) return null;

  return (
    <div className="notice" style={{ marginTop: 28 }}>
      <strong>Not on the wall yet</strong>
      {waiting.needsRole.length > 0 && (
        <p>
          {waiting.needsRole.length} row{waiting.needsRole.length === 1 ? "" : "s"} have no{" "}
          <code>Role</code>: {waiting.needsRole.join(", ")}. Set it to <strong>Speaker</strong> or{" "}
          <strong>Moderator</strong> on the Board Summit rows in Airtable and press Refresh.
        </p>
      )}
      {waiting.needsPhoto.length > 0 && (
        <p>
          {waiting.needsPhoto.length} row{waiting.needsPhoto.length === 1 ? "" : "s"} have no photo:{" "}
          {waiting.needsPhoto.join(", ")}.
        </p>
      )}
    </div>
  );
}

export default function BoardSummitPage() {
  const [role, setRole] = useState("Speaker");

  // RANDOM ORDER EVERY LOAD. Nobody on this roster carries a Hierarchy, so a fixed alphabetical
  // order would open the grid with the same faces at every event. The seed is fixed at MOUNT, not
  // per render: SWR revalidates in the background and a fresh seed there would re-jump the grid
  // under the reader's cursor. A real page refresh remounts, which is exactly when a new order is
  // wanted. Same rule as /policy-stage and /all-speakers-2026.
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);

  // `base` is the public URL a snippet may carry; `url` is what this page fetches and what the
  // refresh button turns into an authenticated live read. Never put ?fresh= in a snippet.
  const base = `/api/board-summit?role=${encodeURIComponent(role)}`;
  const { url, refresh } = useFreshUrl(base);
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<BoardPerson>(`board-summit:${role}`, url, "people");

  // Seeded Fisher-Yates, the same LCG the other shuffling pages use. Seeded rather than
  // Math.random() per pass so the order holds still across a revalidation; the server cannot do this
  // for us because its response is cached and the order would freeze with it.
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
          <p className="eyebrow">Board Summit · Event Room 1</p>
          <h1>
            The Board <span className="text-tbbq-gradient">Summit</span>
          </h1>
          <p className="lede">
            Live from Airtable · the Board Summit roster, hosted by Boardway · served as JSON at{" "}
            <code>/api/board-summit</code> (add <code>?role=Moderator</code>, or <code>?role=all</code>{" "}
            for everyone). The sessions themselves are a different feed:{" "}
            <code>/api/program?event=board</code>.
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
            {/* ONE snippet for both roles: it fetches /api/board-summit once, draws its own
                Speakers / Moderators pill switcher and swaps groups client-side. */}
            <CopyEmbed path="/api/board-summit" listKey="people" loadMore={false} transparent tabs={EMBED_TABS} />
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
              resetKey={`board-summit:${role}`}
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
              // A role with nobody in it is a data state, not a failure — say which role, so it does
              // not read as a broken page.
              <p className="muted">
                No {label.toLowerCase()} yet. Set <code>Role</code> to <strong>{role}</strong> on the
                Board Summit rows in Airtable and press Refresh.
              </p>
            ) : (
              // Few enough to centre on their own row rather than trail off the left of a five-wide
              // grid. Keyed on the COUNT, not the role, so it holds if a fifth moderator arrives.
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

            <WaitingOnAirtable />
          </>
        )}
      </div>
    </main>
  );
}
