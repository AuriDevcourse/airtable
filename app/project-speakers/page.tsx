"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { RefreshButton } from "@/components/RefreshButton";
import { CopyEmbed } from "@/components/CopyEmbed";
import { MissingPhoto } from "@/components/MissingPhoto";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { PROGRAMME_PROJECTS, type ProgrammePerson } from "@/lib/programPeople";
import type { ProgramSourceKey } from "@/lib/program";

// PROJECT SPEAKERS — the /program tab bar, answering the other half of the question.
//
// /program says WHAT is on at each project around the Summit. This says WHO, from the same rows: the
// people billed on those sessions, deduplicated, with the sessions they are on. See
// lib/programPeople.ts for why the agenda is the only roster some of these projects have — the
// Denmark-Sweden Summit's twelve are the organisers' guests and exist in no speaker table at all,
// which is what this page was built for (Auri, 2026-08-19).
//
// Built out of the same three parts as every roster page here: tabs, a copy-embed button and a
// refresh that forces a live Airtable read.

// Same per-image shimmer as the other feed pages: the loaded state lives in the card so a parent
// re-render (SWR revalidating) cannot reset it back to shimmering.
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

export default function ProjectSpeakersPage() {
  const [event, setEvent] = useState<ProgramSourceKey>("denmark-sweden");

  // ONE REQUEST, ONE GRID (`role=all`). Moderators are marked with a label on their card rather than
  // hidden behind a switch (Auri, 2026-08-19), so there is nothing left to filter client-side and the
  // page fetches exactly what the copied embed fetches.
  //
  // `base` is the public URL a snippet may carry; `url` is what this page fetches and what Refresh
  // turns into an authenticated live read. Never put ?fresh= in a snippet.
  const base = `/api/program-speakers?event=${event}&role=all`;
  const { url, refresh } = useFreshUrl(base);
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<ProgrammePerson>(`project-speakers:${event}`, url, "people");

  // KEEP THE OPEN PROJECT VISIBLE. The pill bar scrolls sideways (ten projects, one row), and
  // Denmark-Sweden is the last of them — landing on it left the selected pill off the right edge, so
  // the page opened looking like NISS was selected. `block: "nearest"` scrolls the pill strip only
  // and never the page.
  const activeTab = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [event]);

  const people = data ?? [];
  const project = PROGRAMME_PROJECTS.find((p) => p.key === event);
  const moderators = people.filter((p) => p.role === "Moderator").length;
  // How many still have no CRM row behind them, which is the difference between a card that carries a
  // job title and a LinkedIn link and a card that only carries what the agenda said. Counted from the
  // link, because that is the field only the CRM can supply.
  const noCrm = people.filter((p) => !p.linkedin).length;

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-2.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Project speakers · read off each project&apos;s own agenda</p>
          <h1>
            Project <span className="text-tbbq-gradient">Speakers</span>
          </h1>
          <p className="lede">
            Who is on stage at the events around TechBBQ. Built from the same session rows{" "}
            <Link href="/program" style={{ color: "var(--color-orange, #fa7000)" }}>
              Project Programs
            </Link>{" "}
            renders, so a name here is a name on that agenda. Served as JSON at{" "}
            <code>/api/program-speakers?event={event}</code> · everyone by default, add{" "}
            <code>&amp;role=Speaker</code> or <code>&amp;role=Moderator</code> to narrow it.
          </p>
          <p className="lede" style={{ fontSize: 14 }}>
            Names and roles come from the agenda · job title, company and LinkedIn come from the
            Marketing Project Overview row for that person, which is where they are maintained.
            Anyone with no CRM row keeps the line the agenda gives them.
          </p>

          {/* `seg--scroll` for the same reason /program uses it: ten projects do not fit one row. */}
          <div
            className="seg seg--scroll"
            role="tablist"
            aria-label="Project"
            style={{ marginTop: 28 }}
          >
            {PROGRAMME_PROJECTS.map((p) => (
              <button
                key={p.key}
                ref={event === p.key ? activeTab : null}
                role="tab"
                aria-selected={event === p.key}
                onClick={() => setEvent(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* ONE snippet per project, one grid, no switcher: the moderator is in it, labelled, the
                same as on this page. `key` remounts the button when the project changes, so the
                copied path can never be the previously selected one. */}
            <CopyEmbed
              key={event}
              path={`/api/program-speakers?event=${event}`}
              listKey="people"
              loadMore={false}
              transparent
            />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Copies the whole {project?.label} line-up, moderators labelled. Copy from the deployed
              dashboard, not localhost.
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <RefreshButton
              onRefresh={refresh}
              changes={changes}
              error={revalidateError}
              resetKey={`project-speakers:${event}`}
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
            <SkeletonGrid count={8} />
          </>
        ) : (
          <>
            <p className="count-line">
              {people.length} on stage · {project?.label}
              {moderators > 0 &&
                ` · ${moderators} moderator${moderators === 1 ? "" : "s"}, labelled`}
              {noCrm > 0 && ` · ${noCrm} with no CRM row yet`}.
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {people.length === 0 ? (
              // A data state, not a failure, so it says which cell to fill rather than reading as a
              // broken page. Both fields are on the session row in the Sessions table.
              <p className="muted">
                Nobody is billed on the {project?.label} agenda yet. Fill{" "}
                <code>Speaker Details</code> or <code>Moderator Details</code> on its session rows in
                Airtable and press Refresh · the sessions themselves are on{" "}
                <Link href="/program" style={{ color: "var(--color-orange, #fa7000)" }}>
                  Project Programs
                </Link>
                .
              </p>
            ) : (
              // Three people centred on their own row rather than trailing off the left of a
              // five-wide grid, the same rule /policy-stage uses. Keyed on the count, not the role.
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
                        {/* Only the moderator carries a label, above the name — the same
                            `.s-card__role` badge the other roster pages use, and the same place the
                            embed prints its tag, so the preview matches what gets pasted. */}
                        {p.tag && <span className="s-card__role">{p.tag}</span>}
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
