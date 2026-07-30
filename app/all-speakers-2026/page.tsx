"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";

// The tab set the embed snippet renders — keys match the /api/all-speakers groups.
// Speakers + Event Room shuffle per page load (fair exposure). The snippet's shuffle
// exempts anyone with a numeric `hierarchy`, so the curated Speakers 1..30 stay pinned
// at the top and only the tail re-rolls.
// Speakers is the only group with bios, so it alone opens the detail pop-up; the other
// groups' cards link straight to LinkedIn.
const EMBED_TABS = [
  { key: "speakers", label: "Speakers", modal: true, shuffle: true },
  { key: "eventRoom", label: "Event Room Speakers", shuffle: true },
  { key: "investors", label: "Investor Speakers" },
];

// Same per-image shimmer loader as the NISS/NASS/Investors pages: state lives here so
// parent re-renders (SWR revalidation) can't reset it back to shimmering.
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

// The raw feed shapes overlap on exactly the fields this page renders; extra
// fields (bio, role, hierarchy…) ride along in the JSON and are ignored.
type FeedPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  // Only the Speakers 2026 hub feed carries a bio; it powers the detail pop-up.
  bio?: string;
  role?: string;
  // Speakers group only: curated Airtable order (1..30). null/absent = unranked, which the
  // page shuffles in behind the ranked block.
  hierarchy?: number | null;
  event?: string;
  // Partner event room presenters only: which partner's event room they present at,
  // and the assigned room label ("Event Room 1".."6") once marketing sets it.
  host?: string;
  room?: string | null;
};

// What a card renders: a feed person plus which source it came from.
type Card = FeedPerson & { tag?: string };

const GROUPS = ["speakers", "event-room", "investors"] as const;
type GroupKey = (typeof GROUPS)[number];

const GROUP_LABELS: Record<GroupKey, string> = {
  speakers: "Speakers",
  "event-room": "Event Room Speakers",
  investors: "Investor Speakers",
};

// Investor event short keys → display names (mirrors /investors).
const INVESTOR_EVENT_LABELS: Record<string, string> = {
  "pension-summit": "Pension & Insurance Summit",
  "lp-forum": "LP Forum",
  "investor-day": "Investor Day",
};

// Detail pop-up for the Speakers group — same look/behavior as /speakers-2026
// (photo · name · title · company · bio · LinkedIn button; Escape/backdrop/X close).
function SpeakerModal({ speaker, onClose }: { speaker: Card; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const meta = speaker.title + (speaker.company ? ` · ${speaker.company}` : "");

  return (
    <div className="modal" role="presentation" onMouseDown={onClose}>
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="all-speaker-modal-name"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="modal__media">
          {speaker.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={speaker.photo} alt={speaker.name} />
          ) : (
            <div className="s-card__img--empty" />
          )}
        </div>

        <div className="modal__body">
          <h2 id="all-speaker-modal-name" className="modal__name">
            {speaker.name}
          </h2>
          {meta && <p className="modal__meta">{meta}</p>}
          {speaker.bio ? (
            <p className="modal__bio">{speaker.bio}</p>
          ) : (
            <p className="modal__bio modal__bio--empty">No description available yet.</p>
          )}
          {speaker.linkedin && (
            <a
              className="modal__linkedin"
              href={speaker.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.34 18.34V9.9H5.67v8.44h2.67zM7 8.5a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1zm11.34 9.84v-4.63c0-2.48-1.32-3.63-3.09-3.63-1.42 0-2.06.78-2.42 1.33V9.9h-2.67v8.44h2.67v-4.47c0-.24.02-.47.09-.64.19-.47.62-.96 1.34-.96.95 0 1.32.72 1.32 1.77v4.3h2.67z" />
              </svg>
              View LinkedIn profile
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AllSpeakers2026Page() {
  const [group, setGroup] = useState<GroupKey>("speakers");
  // Speakers-group detail pop-up (the only group with bios).
  const [selected, setSelected] = useState<Card | null>(null);

  // All four sources load on mount so switching groups is instant. Cache keys are
  // shared with the standalone pages, so a warm localStorage entry paints instantly.
  const speakers = useCachedList<FeedPerson>("speakers-2026", "/api/speakers-2026", "speakers");
  const niss = useCachedList<FeedPerson>("niss:all", "/api/niss-speakers", "people");
  const nass = useCachedList<FeedPerson>("nass:all", "/api/nass-speakers", "people");
  const rooms = useCachedList<FeedPerson>("eventrooms", "/api/event-room-presenters", "people");
  const investors = useCachedList<FeedPerson>("investors:all", "/api/investor-speakers", "people");

  // Mount-fixed seed so revalidation/tab-switching doesn't re-jump the shuffled order;
  // a real refresh remounts → new seed → new order (same pattern as /investors).
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);

  const people = useMemo<Card[]>(() => {
    // Seeded LCG shuffle, shared by the groups that randomize. Seed is mount-fixed so the
    // order holds during SWR revalidation and tab switching; a refresh re-rolls it.
    let s = seed;
    const rand = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    const shuffle = <T,>(arr: T[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    if (group === "speakers") {
      // Speakers ranked in Airtable (hierarchy 1..30) hold that exact order at the top;
      // everyone else is randomized per page load, same rule as /speakers-2026. The API
      // sorts the tail alphabetically because its response is cached for an hour — the
      // re-roll has to happen client-side.
      const all = speakers.data ?? [];
      const ranked = all.filter((x) => typeof x.hierarchy === "number");
      const unranked = all.filter((x) => typeof x.hierarchy !== "number");
      // Shuffle then sort: Array.sort is stable, so hierarchy ties keep the shuffled order.
      shuffle(ranked).sort((a, b) => (a.hierarchy as number) - (b.hierarchy as number));
      return [...ranked, ...shuffle(unranked)];
    }
    if (group === "event-room") {
      // NISS 2026 + NASS 2026 (only actual speakers, Auri's rule: the feeds also carry
      // Moderators, Team Members, Brand Ambassadors and blank-role rows) + the partner
      // event room presenters. Tags are the ROOM: per the planning sheet NISS (India,
      // day 1) and NASS (Afrika, day 2) both run in Event Room 2. Same merge lives in
      // /api/all-speakers for the embed; keep them in sync.
      const fromNiss: Card[] = (niss.data ?? [])
        .filter((p) => p.role === "Speaker")
        .map((p) => ({ ...p, tag: "Event Room 2" }));
      const fromNass: Card[] = (nass.data ?? [])
        .filter((p) => p.role === "Speaker")
        .map((p) => ({ ...p, tag: "Event Room 2" }));
      // Room label ("Event Room 1".."6") once known; the hosting partner until then.
      const fromRooms: Card[] = (rooms.data ?? []).map((p) => ({ ...p, tag: p.room ?? p.host }));
      // Random order per page load (Auri's rule); nobody here is ranked.
      return shuffle([...fromNiss, ...fromNass, ...fromRooms]);
    }
    // Investor speakers: Pension & Insurance Summit + LP Forum + Investor Day.
    return (investors.data ?? []).map((p) => ({
      ...p,
      tag: p.event ? INVESTOR_EVENT_LABELS[p.event] ?? p.event : undefined,
    }));
  }, [group, speakers.data, niss.data, nass.data, rooms.data, investors.data, seed]);

  // A source feed down while the others render would silently show a partial roster;
  // surface it instead (completion-auditor finding).
  const roomFeeds = [
    { label: "NISS 2026", state: niss },
    { label: "NASS 2026", state: nass },
    { label: "Partner event rooms", state: rooms },
  ];
  const failedFeeds = roomFeeds.filter((f) => f.state.error && !f.state.data);
  const partialWarning =
    group === "event-room" && failedFeeds.length > 0 && failedFeeds.length < roomFeeds.length
      ? failedFeeds.map((f) => f.label).join(" + ") + " could not load · showing the rest"
      : null;

  // The active group's load state. Event room is "loading" until all three feeds
  // landed and "failed" only if all did (any healthy feed still renders).
  const active =
    group === "speakers"
      ? {
          loading: speakers.loading,
          revalidating: speakers.revalidating,
          error: speakers.error,
          empty: !speakers.data,
        }
      : group === "event-room"
        ? {
            loading: niss.loading || nass.loading || rooms.loading,
            revalidating: niss.revalidating || nass.revalidating || rooms.revalidating,
            error: failedFeeds.length === roomFeeds.length ? niss.error : null,
            empty: !niss.data && !nass.data && !rooms.data,
          }
        : {
            loading: investors.loading,
            revalidating: investors.revalidating,
            error: investors.error,
            empty: !investors.data,
          };

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Speakers · Event Rooms · Investor events · 2026</p>
          <h1>
            All speakers <span className="text-tbbq-gradient">2026</span>
          </h1>
          <p className="lede">
            Every 2026 roster in one place. Speakers is the Speaker Hub grid; Event Room
            Speakers combines NISS 2026 and NASS 2026; Investor Speakers covers the
            Pension &amp; Insurance Summit, LP Forum and Investor Day.
          </p>

          <div className="seg" role="tablist" aria-label="Speaker group" style={{ marginTop: 28 }}>
            {GROUPS.map((g) => (
              <button key={g} role="tab" aria-selected={group === g} onClick={() => setGroup(g)}>
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* One snippet carries all three groups: it fetches /api/all-speakers once and
                renders its own centered tab switcher, so the WordPress visitor can flip
                between Speakers / Event Room / Investors inside the embed. */}
            <CopyEmbed path="/api/all-speakers" listKey="people" tabs={EMBED_TABS} />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies one Elementor snippet with the tab switcher built in.
            </span>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {active.error && active.empty ? (
          <div className="notice">
            <strong>Could not load.</strong>
            <p>{active.error}</p>
          </div>
        ) : active.loading ? (
          <>
            <p className="count-line">Loading…</p>
            <SkeletonGrid count={10} />
          </>
        ) : (
          <>
            <p className="count-line">
              {people.length} person(s).
              {partialWarning && <span className="reval"> · {partialWarning}</span>}
              {active.revalidating && <span className="reval"> · checking for updates…</span>}
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
                      {p.tag && <span className="s-card__role">{p.tag}</span>}
                      <h3 className="s-card__name">{p.name}</h3>
                      <p className="s-card__meta">{meta}</p>
                    </div>
                  </>
                );
                return (
                  <article key={`${group}:${p.id}`} className="s-card">
                    {group === "speakers" ? (
                      // Only Speakers have bios: click opens the detail pop-up.
                      <button type="button" className="s-card__button" onClick={() => setSelected(p)}>
                        {card}
                      </button>
                    ) : p.linkedin ? (
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

      {selected && <SpeakerModal speaker={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
