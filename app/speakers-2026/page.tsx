"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { CopyEmbed } from "@/components/CopyEmbed";
import { useCachedList } from "@/lib/useCachedList";

const PAGE_SIZE = 20;

// Shimmers until its own photo loads. State lives here so parent re-renders (SWR
// revalidation) can't reset it. mediaClassName serves both card + mobile row.
function SpeakerPhoto({
  src,
  alt,
  mediaClassName = "s-card__media",
}: {
  src: string;
  alt: string;
  mediaClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={mediaClassName + (loaded ? "" : " shimmer")}>
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

type Speaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
  location: string;
  role: string;
};

// Detail pop-up: photo, name, title · company, short bio and a LinkedIn link.
// Opens when a card/row is clicked. Closes on Escape, backdrop click or the X.
function SpeakerModal({
  speaker,
  onClose,
}: {
  speaker: Speaker;
  onClose: () => void;
}) {
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
        aria-labelledby="speaker-modal-name"
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
          <h2 id="speaker-modal-name" className="modal__name">
            {speaker.name}
          </h2>
          {meta && <p className="modal__meta">{meta}</p>}
          {speaker.bio ? (
            <p className="modal__bio">{speaker.bio}</p>
          ) : (
            <p className="modal__bio modal__bio--empty">
              No description available yet.
            </p>
          )}
          {speaker.linkedin && (
            <a
              className="modal__linkedin"
              href={speaker.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
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

export default function Speakers2026() {
  const { data, loading, revalidating, error, updated } = useCachedList<Speaker>(
    "speakers-2026",
    "/api/speakers-2026",
    "speakers"
  );
  const speakers = data ?? [];
  // Random order, re-rolled on every page load. The seed is fixed for this mount so the
  // order stays put while you search or paginate; a refresh remounts → a new seed → new
  // order. (A small LCG keeps it deterministic within the mount even if data revalidates.)
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);
  const shuffled = useMemo(() => {
    const arr = [...speakers];
    let s = seed;
    const rand = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [speakers, seed]);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showTop, setShowTop] = useState(false);
  const [selected, setSelected] = useState<Speaker | null>(null);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? shuffled.filter((s) =>
        `${s.name} ${s.title} ${s.company}`.toLowerCase().includes(q)
      )
    : shuffled;
  const visible = filtered.slice(0, visibleCount);

  function onSearch(value: string) {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-1.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Live 2026 roster · Speaker Hub (Supabase)</p>
          <h1>
            TechBBQ Speakers <span className="text-tbbq-gradient">2026</span>
          </h1>
          <p className="lede">
            Live from the Speaker Hub · public directory profiles only (RLS-gated) ·
            served as JSON at <code>/api/speakers-2026</code>.
          </p>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyEmbed path="/api/speakers-2026" listKey="speakers" modal shuffle />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies an Elementor snippet for this speaker grid.
            </span>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {error && !data ? (
          <div className="notice">
            <strong>Could not load 2026 speakers.</strong>
            <p>{error}</p>
            <p>
              Most likely the token can&apos;t read the{" "}
              <code>Speaker Hub 1:1</code> base, or no record has name + photo + bio
              filled in yet.
            </p>
          </div>
        ) : loading ? (
          <>
            <p className="count-line">Loading…</p>
            <SkeletonGrid count={12} />
          </>
        ) : (
          <>
            <div className="search">
              <input
                type="search"
                className="search__input"
                placeholder="Search by name…"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                aria-label="Search speakers by name"
              />
              <svg
                className="search__icon"
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            <p className="count-line">
              {filtered.length} speaker(s){q ? ` for “${query.trim()}”` : ""}.
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {filtered.length === 0 ? (
              <p className="muted">No speakers match that search.</p>
            ) : (
              <>
                {/* Desktop: card grid */}
                <div className="grid-cards">
                  {visible.map((s) => {
                    const meta = s.title + (s.company ? ` · ${s.company}` : "");
                    const card = (
                      <>
                        {s.photo ? (
                          <SpeakerPhoto src={s.photo} alt={s.name} />
                        ) : (
                          <div className="s-card__media">
                            <div className="s-card__img--empty" />
                          </div>
                        )}
                        <div className="s-card__overlay">
                          <h3 className="s-card__name">{s.name}</h3>
                          <p className="s-card__meta">{meta}</p>
                        </div>
                      </>
                    );
                    return (
                      <article key={s.id} className="s-card">
                        <button
                          type="button"
                          className="s-card__button"
                          onClick={() => setSelected(s)}
                          aria-haspopup="dialog"
                        >
                          {card}
                        </button>
                      </article>
                    );
                  })}
                </div>

                {/* Mobile: list rows */}
                <ul className="list-rows">
                  {visible.map((s) => {
                    const meta = s.title + (s.company ? ` · ${s.company}` : "");
                    const inner = (
                      <>
                        {s.photo ? (
                          <SpeakerPhoto
                            src={s.photo}
                            alt={s.name}
                            mediaClassName="row__media"
                          />
                        ) : (
                          <div className="row__media">
                            <div className="s-card__img--empty" />
                          </div>
                        )}
                        <div className="row__text">
                          <h3 className="row__name">{s.name}</h3>
                          <p className="row__meta">{meta}</p>
                        </div>
                      </>
                    );
                    return (
                      <li key={s.id} className="row">
                        <button
                          type="button"
                          className="row__link row__button"
                          onClick={() => setSelected(s)}
                          aria-haspopup="dialog"
                        >
                          {inner}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {visibleCount < filtered.length && (
                  <div className="loadmore-wrap">
                    <button
                      type="button"
                      className="loadmore"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    >
                      Load More
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {selected && (
        <SpeakerModal speaker={selected} onClose={() => setSelected(null)} />
      )}

      {showTop && (
        <button
          type="button"
          className="scrolltop"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      )}
    </main>
  );
}
