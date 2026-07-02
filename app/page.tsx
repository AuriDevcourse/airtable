"use client";

import { useState, useEffect } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { useCachedList } from "@/lib/useCachedList";
import { buildEmbedSnippet } from "@/lib/embedSnippet";

const PAGE_SIZE = 20;

// Shimmers only until its own photo loads. State lives here, so parent re-renders
// (e.g. SWR revalidation) can't reset it back to shimmering. mediaClassName lets the
// same loader serve both the card (square) and the mobile row (small thumbnail).
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
  website: string | null;
};

export default function Home() {
  const { data, loading, revalidating, error, updated } = useCachedList<Speaker>(
    "speakers",
    "/api/speakers",
    "speakers"
  );
  const speakers = data ?? [];
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showTop, setShowTop] = useState(false);

  // Show the back-to-top button after the user scrolls down a bit.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function copyEmbed() {
    const code = buildEmbedSnippet({ path: "/api/speakers", listKey: "speakers" }).replace(
      /__ORIGIN__/g,
      window.location.origin
    );
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? speakers.filter((s) =>
        `${s.name} ${s.title} ${s.company}`.toLowerCase().includes(q)
      )
    : speakers;
  const visible = filtered.slice(0, visibleCount);

  function onSearch(value: string) {
    setQuery(value);
    setVisibleCount(PAGE_SIZE); // reset paging when the filter changes
  }

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-2.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">TechBBQ main speakers · Airtable “Speakers” table</p>
          <h1>
            Speakers <span className="text-tbbq-gradient">preview</span>
          </h1>
          <p className="lede">
            Live from Airtable · only records with <code>On Website?</code> ticked ·
            the same data is served as JSON at <code>/api/speakers</code>.
          </p>
        </div>
      </section>

      <div className="wrap">
        <details className="howto">
          <summary>How to put this on a WordPress page (Elementor Pro)</summary>
          <p className="howto__intro">
            The <strong>snippet</strong> is a ready-made block of HTML, CSS and JavaScript
            that draws this exact speaker grid. You don&apos;t write any code. Click the
            button to copy it, with your feed URL already filled in.
          </p>
          <button type="button" className="howto__copy" onClick={copyEmbed}>
            {copied ? "Copied to clipboard" : "Copy embed code"}
          </button>
          <ol className="howto__steps">
            <li>Click <strong>Copy embed code</strong> above.</li>
            <li>
              In WordPress, edit the page with <strong>Elementor</strong>, then drag an{" "}
              <strong>HTML</strong> widget to where you want the speakers.
            </li>
            <li>
              Paste the copied code into the widget&apos;s content box and click{" "}
              <strong>Update</strong>.
            </li>
            <li>
              On Vercel, set <code>ALLOWED_ORIGIN</code> to your site, e.g.{" "}
              <code>https://techbbq.dk</code>, so the browser is allowed to fetch the feed.
            </li>
          </ol>
          <p className="howto__note">
            Copy this from your <strong>deployed</strong> dashboard (the Vercel URL), so the
            feed URL inside the code points at production and not <code>localhost</code>.
            NISS speakers use the same flow with <code>/api/niss-speakers</code>.
          </p>
        </details>
      </div>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {error && !data ? (
          <div className="notice">
            <strong>Could not load speakers.</strong>
            <p>{error}</p>
            <p>
              Most likely the token is missing the <code>data.records:read</code> scope,
              or no record has <code>On Website?</code> ticked.
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
                        {s.linkedin ? (
                          <a href={s.linkedin} target="_blank" rel="noopener noreferrer">
                            {card}
                          </a>
                        ) : (
                          card
                        )}
                      </article>
                    );
                  })}
                </div>

                {/* Mobile: list rows (photo left, name right) */}
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
                        {s.linkedin ? (
                          <a href={s.linkedin} target="_blank" rel="noopener noreferrer">
                            {inner}
                          </a>
                        ) : (
                          <div className="row__link">{inner}</div>
                        )}
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
