"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyEmbed } from "@/components/CopyEmbed";
import { CopyApiSnippet } from "@/components/CopyApiSnippet";
import { MissingPhoto } from "@/components/MissingPhoto";

// Same per-image shimmer loader as the NISS/NASS pages: state lives here so parent
// re-renders (SWR revalidation) can't reset it back to shimmering.
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

type InvestorSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  photo: string | null;
  linkedin: string | null;
  event: string;
  // Every event this person speaks at. One card per person, however many events they appear at —
  // Yoram Wijngaarde is at both the LP Forum and the Pension & Insurance Summit and used to be two
  // cards with two uploads of the same face. Optional so an older cached payload still renders.
  events?: string[];
  // The API's Infinity (unranked) serializes to null in JSON.
  hierarchy: number | null;
  // Set when the Airtable row has no Profile Picture. Only ?pending=1 returns these, so this
  // page shows them and techbbq.dk never can.
  pending?: "no-photo";
};

const EVENTS = ["all", "pension-summit", "lp-forum", "investor-day", "family-office"] as const;
type EventKey = (typeof EVENTS)[number];

const LABELS: Record<string, string> = {
  all: "All",
  "pension-summit": "Pension & Insurance Summit",
  "lp-forum": "LP Forum",
  "investor-day": "Investor Day",
  "family-office": "Nordic Family Office Summit",
};
const eventLabel = (e: string) => LABELS[e] ?? e;

// SHORTER ON THE CARD ONLY. The event's full name wraps to two lines inside a card's tag line,
// which makes those cards taller than every other card in the grid. Tabs, the nav and prose keep
// the full name — this override exists for the tag line and nowhere else (Auri, 2026-08-13).
const CARD_LABELS: Record<string, string> = {
  "family-office": "Family Office Summit",
};
const cardLabel = (e: string) => CARD_LABELS[e] ?? eventLabel(e);

// useSearchParams needs a Suspense boundary on a prerendered page, so the view lives in its
// own component below and this wrapper provides it.
export default function InvestorsPage() {
  return (
    <Suspense fallback={null}>
      <InvestorsView />
    </Suspense>
  );
}

function InvestorsView() {
  // The URL is the single source of truth for the active tab, NOT local state. The TopNav
  // links straight to one event (/investors?event=lp-forum), and Next does not remount this
  // component on a query-only navigation — with useState the URL changed while the tab
  // stayed put. Reading the param on every render fixes that, and makes the back button work.
  const searchParams = useSearchParams();
  const router = useRouter();
  const param = searchParams.get("event");
  // Validated against the known list: an unknown value falls back to "all" rather than
  // querying a nonexistent event.
  const event: EventKey =
    param && (EVENTS as readonly string[]).includes(param) ? (param as EventKey) : "all";

  // Clicking a tab rewrites the URL, which re-renders this with the new param. replace, not
  // push: flipping tabs should not fill the back button.
  const selectEvent = (next: EventKey) => {
    router.replace(next === "all" ? "/investors" : `/investors?event=${next}`, { scroll: false });
  };

  // `base` for the embed snippet, `url` for this page's own fetch (see /niss).
  //
  // THIS PAGE SHOWS MORE THAN techbbq.dk DOES, on purpose. `base` is what gets copied into
  // Elementor and stays clean; the page's own fetch adds ?pending=1, which returns the speakers
  // whose Airtable row has no Profile Picture. They render as a "no photo in Airtable" tile with
  // their name and title, so the gap is a worklist rather than a silent omission — same idea as
  // the partner wall's name tiles. ?pending=1 needs the dashboard password, which this page
  // already has (middleware gates it) and the browser sends on a same-origin request.
  const base =
    event === "all" ? "/api/investor-speakers" : `/api/investor-speakers?event=${event}`;
  const { url, refresh } = useFreshUrl(base + (base.includes("?") ? "&" : "?") + "pending=1");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<InvestorSpeaker>(`investors:${event}`, url, "people");
  // Random order, re-rolled on every page load (same approach as Speakers 2026 / NASS).
  // Anyone with a curated numeric Hierarchy keeps that order at the top; only the rest is
  // shuffled (today everyone is unranked, so everything shuffles). The seed is fixed for
  // this mount so revalidation or tab-switching doesn't re-jump the order mid-view.
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);
  const people = useMemo(() => {
    let s = seed;
    const rand = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    const shuffle = (arr: InvestorSpeaker[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    const all = data ?? [];
    // Anyone with no photo goes LAST, whatever their hierarchy: the grid should read as the
    // finished roster first and the chase-list after it. They shuffle among themselves.
    const live = all.filter((x) => !x.pending);
    const missing = all.filter((x) => x.pending);
    // Infinity serializes to null in JSON, so unranked arrive as null, not a number.
    const ranked = live.filter((x) => typeof x.hierarchy === "number");
    const unranked = live.filter((x) => typeof x.hierarchy !== "number");
    // Shuffle then sort: Array.sort is stable, so hierarchy ties keep the shuffled order.
    shuffle(ranked).sort((a, b) => (a.hierarchy as number) - (b.hierarchy as number));
    return [...ranked, ...shuffle(unranked), ...shuffle(missing)];
  }, [data, seed]);

  // What the embed will actually ship, which is the number that matters for techbbq.dk.
  const missingPhoto = useMemo(() => people.filter((p) => p.pending), [people]);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-4.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">
            Pension &amp; Insurance Summit · LP Forum · Investor Day · Nordic Family Office Summit · 2026
          </p>
          <h1>
            Investor <span className="text-tbbq-gradient">speakers</span>
          </h1>
          <p className="lede">
            Live from Airtable · the Marketing Project Overview rows for the four
            investor events · served as JSON at <code>/api/investor-speakers</code>.
          </p>

          <div className="seg" role="tablist" aria-label="Filter by event" style={{ marginTop: 28 }}>
            {EVENTS.map((e) => (
              <button key={e} role="tab" aria-selected={event === e} onClick={() => selectEvent(e)}>
                {eventLabel(e)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Mobile defaults to the list-rows layout for every filter. `key` forces a fresh
                CopyEmbed per tab so its internal "Copied" state cannot carry over and claim the
                previous filter's snippet was the one copied. */}
            <CopyEmbed key={event} path={base} listKey="people" shuffle />
            <CopyApiSnippet feed="investor-speakers" label="Copy API code" />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet for the current filter (<code>{eventLabel(event)}</code>).
            </span>
          </div>

          {/* One button per event, so any single event's snippet can be grabbed without
              switching tabs to it first — four events means four separate Elementor widgets
              on techbbq.dk, and switching tab / copy / switch back for each was the slow way.
              Each button carries its OWN path, so what it copies is fixed by the button and not
              by whichever tab happens to be active. Secondary styling: the gradient button above
              stays the primary action. */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Or copy one event directly:
            </span>
            {EVENTS.map((e) => (
              <CopyEmbed
                key={e}
                path={
                  e === "all" ? "/api/investor-speakers" : `/api/investor-speakers?event=${e}`
                }
                listKey="people"
                shuffle
                className="copy-embed--api"
                label={eventLabel(e)}
              />
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey={`investors:${event}`}
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
            {/* The number that LEADS is what the embed ships, because that is what techbbq.dk
                shows. The photoless ones are counted separately and named below the grid. */}
            <p className="count-line">
              {people.length - missingPhoto.length} person(s) live on techbbq.dk
              {missingPhoto.length > 0 && (
                <span className="muted">
                  {" · "}
                  {missingPhoto.length} more waiting on a photo, below
                </span>
              )}
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
                        <MissingPhoto />
                      </div>
                    )}
                    <div className="s-card__overlay">
                      {/* Which event, or events, the person speaks at — shown when the view is not
                          already filtered to one. Someone at two of them gets both names on the one
                          card rather than a second card. */}
                      {event === "all" && (p.events?.length || p.event) && (
                        <span className="s-card__role">
                          {(p.events?.length ? p.events : [p.event]).map(cardLabel).join(" · ")}
                        </span>
                      )}
                      <h3 className="s-card__name">{p.name}</h3>
                      <p className="s-card__meta">{meta}</p>
                    </div>
                  </>
                );
                return (
                  <article key={p.id} className="s-card" data-pending={p.pending || undefined}>
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

            {/* The worklist, spelled out so it can be pasted to whoever owns the row. Reuses the
                /partner-events gaps panel rather than inventing a second look for the same job. */}
            {missingPhoto.length > 0 && (
              <section className="ev-gaps" style={{ marginTop: 40 }}>
                <h2>Not on techbbq.dk yet</h2>
                <ul>
                  <li>
                    <strong>
                      {missingPhoto.length} {missingPhoto.length === 1 ? "needs" : "need"} a photo
                    </strong>
                    , and {missingPhoto.length === 1 ? "shows" : "show"} as a placeholder
                    tile in the grid above instead:{" "}
                    {missingPhoto.map((p) => p.name + (p.company ? ` (${p.company})` : "")).join(", ")}
                    . Upload a portrait into the row&apos;s <code>Profile Picture</code> cell in
                    Marketing Project Overview. Nothing else is needed — the feed reads Airtable
                    directly, and they join the embed the moment the picture lands.
                  </li>
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
