"use client";

import { useMemo, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { RefreshButton } from "@/components/RefreshButton";
import { useCachedList, useFreshUrl } from "@/lib/useCachedList";
import { CopyInternsEmbed } from "@/components/CopyInternsEmbed";

// The Intern Pool worklist.
//
// TechBBQ's interns, pitched to the recruiters reading techbbq.dk in August and September. This
// page is the DASHBOARD half: it reads ?pending=1, so it shows the people who are not live yet
// along with the reason, which is the only way "why is my card not up" has an answer.
//
// The public embed (lib/internsEmbedSnippet.ts) draws the same card from the same feed WITHOUT
// the pending rows — the route strips them for anyone who is not authenticated. Keep the two card
// layouts in step: the side-event grid drifted for weeks because nobody was looking at both.

type Intern = {
  id: string;
  name: string;
  role: string;
  department: string;
  photo: string | null;
  responsibilities: string;
  pitch: string;
  // Only ever present on the dashboard read: the route strips it from the public feed. The card
  // below prefers it, so this page shows the pitch as written while the embed keeps the 220-char
  // version. Optional in the type because a cached payload from before this shipped will not have it.
  pitchFull?: string;
  lookingFor: string;
  availableFrom: string | null;
  linkedin: string | null;
  // Dashboard only, like pitchFull: the route strips it from the public feed and the embed never
  // sees it. Optional in the type because a cached payload from before this shipped will not have
  // it, and a list because the Airtable link field allows more than one.
  managers?: { id: string; name: string; linkedin: string | null }[];
  // Dashboard only. Its presence means "not on techbbq.dk".
  pending?: "no-consent" | "not-on-web" | "no-photo" | "expired" | "no-date";
};

// What somebody has to DO, not what is wrong. A worklist that names the state rather than the
// action makes the reader do the translation every time.
const PENDING_LABEL: Record<NonNullable<Intern["pending"]>, string> = {
  "no-consent": "Waiting on their consent",
  "no-photo": "Needs a photo",
  "no-date": "Needs a “Show until” date",
  "not-on-web": "Ready · tick “Put on web”",
  expired: "Month is over",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "2026-10-01" → "1 October". Built from the parts rather than parsing to a Date: an ISO date
// string parses as UTC midnight, which renders as the previous day in a negative offset.
function niceDate(iso: string | null): string {
  if (!iso) return "";
  const p = iso.slice(0, 10).split("-");
  if (p.length !== 3) return "";
  const m = Number(p[1]);
  if (!(m >= 1 && m <= 12)) return "";
  return `${Number(p[2])} ${MONTHS[m - 1]}`;
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

// Stroke icons, drawn through one wrapper so weight and joins cannot drift icon to icon — the same
// arrangement as app/page.tsx. Lucide geometry: chevron-right, table, arrow-up-right.
function Icon({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ChevronRight({ size = 14 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

function TableIcon({ size = 14 }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18M3 15h18M12 3v18" />
    </Icon>
  );
}

// Lucide user-round. The manager line is the one thing on the card that is about US rather than the
// intern, so it carries a mark that says "a person here" without a second label.
function UserIcon({ size = 12 }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </Icon>
  );
}

function ArrowUpRight({ size = 14 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M7 17 17 7M7 7h10v10" />
    </Icon>
  );
}

// ─── FORMATTED THE WAY IT WAS TYPED ──────────────────────────────────────────────────────────
// Interns write their responsibilities as a list: a title line, then one bullet per thing they do,
// with whatever glyph their keyboard offered ("●", "-", "*", "1."). Rendered as one paragraph, six
// bullets read as a single run-on sentence with punctuation scattered through it, which is what was
// on the page before (Auri, 2026-08-17: "difficult to understand because it's not formatted").
//
// So the text is parsed back into blocks. This is a deliberately small subset of Markdown — bullet
// lines, a **bold** heading, paragraphs — and it is rendered as REACT NODES, never as HTML. There is
// no dangerouslySetInnerHTML anywhere near it: this is text a person typed into Airtable, and
// running it through an HTML parser would make a form field into a script tag.
const BULLET = /^(?:[-–—*•●○▪‣·]|\d+[.)])\s+/;
const BOLD_LINE = /^\*\*(.+)\*\*$/;

type Block =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; items: string[] };

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];

  for (const line of raw.split("\n")) {
    const text = line.trim();
    if (!text) continue;

    // Consecutive bullets join the list already open, so a run of them is one <ul> rather than six.
    if (BULLET.test(text)) {
      const item = text.replace(BULLET, "").trim();
      if (!item) continue;
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "list") last.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
      continue;
    }

    const bold = text.match(BOLD_LINE);
    blocks.push(bold ? { kind: "heading", text: bold[1].trim() } : { kind: "para", text });
  }

  // A short first line with no closing punctuation is a job title, not a sentence: "SPEAKER AND
  // MEDIA LEAD", "Partnerships & Marketing Coordinator". Promoted to a heading only when something
  // follows it, so a one-line entry ("Program curation and stage management") stays plain text
  // instead of becoming a heading for nothing.
  const first = blocks[0];
  if (blocks.length > 1 && first && first.kind === "para" && first.text.length <= 60 && !/[.!?:,]$/.test(first.text)) {
    blocks[0] = { kind: "heading", text: first.text };
  }

  return blocks;
}

// **bold** inside a line, as nodes. Anything else Markdown can do is left as the characters the
// intern typed: half-rendered Markdown is worse than none.
function inline(text: string): React.ReactNode {
  const parts = text.split("**");
  if (parts.length < 3) return text;
  return parts.map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return null;
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === "list") {
          return (
            <ul key={i} className="ip-rt__list">
              {b.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={b.kind === "heading" ? "ip-rt__heading" : "ip-rt__para"}>
            {inline(b.text)}
          </p>
        );
      })}
    </div>
  );
}

function InternCard({ p }: { p: Intern }) {
  const meta = [p.role, p.department].filter(Boolean).join(" · ");
  const from = niceDate(p.availableFrom);
  // Defaulted here rather than at every use: a payload cached before this field existed has no
  // `managers` key at all, and the footer asks for its length.
  const managers = p.managers ?? [];
  return (
    <article className={"ip-card" + (p.pending ? " ip-card--pending" : "")}>
      <div className="ip-card__head">
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ip-card__photo" src={p.photo} alt={p.name} loading="lazy" decoding="async" />
        ) : (
          <div className="ip-card__photo--empty" />
        )}
        {/* LinkedIn sits with the NAME (Auri, 2026-08-17), not in the footer. It identifies the
            person, so it belongs where you read who they are; the footer keeps the one thing that is
            about availability rather than identity. */}
        <div className="ip-card__who">
          <h3 className="ip-card__name">{p.name}</h3>
          {meta && <p className="ip-card__role">{meta}</p>}
          {p.linkedin && (
            <a
              className="ip-card__li ip-card__li--head"
              href={p.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${p.name} on LinkedIn`}
            >
              <LinkedInIcon />
              LinkedIn
            </a>
          )}
        </div>
      </div>

      {/* The pitch AS WRITTEN on the dashboard, not the 220-character card version. This page is
          where somebody reads a pitch to judge it, and a judgement made on a sentence ending in an
          ellipsis is a judgement about the wrong text. techbbq.dk still gets the capped one. */}
      <RichText className="ip-card__pitch" text={p.pitchFull || p.pitch} />

      {p.lookingFor && (
        <div className="ip-card__ask">
          <span className="ip-card__askLabel">Looking for</span>
          <span className="ip-card__askText">{p.lookingFor}</span>
        </div>
      )}

      {/* Responsibilities are the long field and the one nobody reads on every card, so the card
          says only that they EXIST and opens on a press. A native <details> rather than useState:
          it is keyboard-operable, announces its own expanded state, and survives a re-render. */}
      {p.responsibilities && (
        <details className="ip-does">
          <summary className="ip-does__summary">
            <span>Responsibilities</span>
            <ChevronRight />
          </summary>
          <RichText className="ip-does__body" text={p.responsibilities} />
        </details>
      )}

      {p.pending && (
        <span className={"ip-chip" + (p.pending === "no-consent" ? " ip-chip--consent" : "")}>
          {PENDING_LABEL[p.pending]}
        </span>
      )}

      {/* Rendered only when there is something to put in it. With LinkedIn moved up to the name, a
          card with neither a date nor a manager would otherwise draw an empty padded strip along its
          bottom edge. The margin-top:auto lives on this element, so cards without one simply end
          after their content.

          The MANAGER is internal (Auri, 2026-08-17) and sits here rather than up with the name for
          that reason: this card is the intern's pitch, and who they report to is TechBBQ's own note
          in the margin. It is the answer to "who chases them for the missing photo", which is what
          this page is for. techbbq.dk never receives the field — see app/api/interns/route.ts. */}
      {(from || managers.length > 0) && (
        <div className="ip-card__foot">
          {from ? <p className="ip-card__from">Available from {from}</p> : <span />}
          {managers.length > 0 && (
            <p className="ip-card__mgr">
              <UserIcon />
              <span className="ip-card__mgrLabel">Manager</span>
              {managers.map((m, i) => (
                <span key={m.id || i}>
                  {i > 0 && <span className="ip-card__mgrSep"> · </span>}
                  {/* Pressable only when we HAVE a profile. A styled span that looks like a link
                      and does nothing is the worse failure, so the no-LinkedIn case renders as
                      plain text rather than a dead <a>. The label says whose profile it is, because
                      "Manager" repeated down a screen tells a screen reader nothing. */}
                  {m.linkedin ? (
                    <a
                      className="ip-card__mgrLink"
                      href={m.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${m.name} on LinkedIn`}
                    >
                      {m.name}
                    </a>
                  ) : (
                    m.name
                  )}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

const ALL = "all";

// Straight to the table this page reads. Pinned here rather than built from AIRTABLE_BASE_ID,
// for the same reason the table id is pinned in lib/interns.ts: a stale env value would send
// somebody to a base that is not this one. Neither id is a credential — without the token they
// open nothing you were not already logged into.
const AIRTABLE_URL = "https://airtable.com/appgXNjXJqpk9Ebxd/tbl5VhWYQ6FeXfoJy";

export default function InternsPage() {
  const [active, setActive] = useState<string>(ALL);

  // ?pending=1 is what makes this the worklist rather than a copy of the public page. It is
  // authenticated in the route, so on the deployed dashboard the browser's Basic credentials
  // carry it; locally, with no DASHBOARD_PASSWORD set, everything is allowed.
  const { url, refresh } = useFreshUrl("/api/interns?pending=1");
  const { data, loading, revalidating, error, revalidateError, updated, changes } =
    useCachedList<Intern>("interns:all", url, "interns");

  // ─── A DIFFERENT ORDER EVERY REFRESH (Auri, 2026-08-17) ──────────────────────────────────
  // Whoever is first on the wall gets read the most, and the feed's department-then-name sort made
  // that the same person every single time. So the order is re-rolled on each page load. Same
  // approach as Speakers 2026, NASS and the investor pages, and the embed on techbbq.dk shuffles
  // too — that is the copy that recruiters actually see.
  //
  // The seed is fixed for this MOUNT, not per render: a revalidation landing while somebody reads,
  // or a press on a department pill, must not re-jump the grid under them. A refresh re-rolls it.
  // The server cannot do this — /api/interns is cached and CDN-cached, so a shuffle up there would
  // freeze one order for every visitor until the cache expired.
  const [seed] = useState(() => Math.floor(Math.random() * 233280) || 1);
  const interns = useMemo(() => {
    let s = seed;
    const rand = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    const shuffle = (arr: Intern[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    const all = data ?? [];
    // The two blocks shuffle SEPARATELY and stay in that order, because the page draws them as two
    // sections: the live grid first, "Not on the site yet" under it. Shuffling the whole list would
    // not mix them into one grid, it would just scramble which pending card leads the second block.
    return [...shuffle(all.filter((p) => !p.pending)), ...shuffle(all.filter((p) => p.pending))];
  }, [data, seed]);

  const live = interns.filter((p) => !p.pending);
  const pending = interns.filter((p) => p.pending);

  // Sorted for the tab row only. The GRID is deliberately random, but a filter row that reshuffles
  // its own pills every load is just hard to hit twice.
  const depts = Array.from(new Set(interns.map((p) => p.department).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const shown = active === ALL ? interns : interns.filter((p) => p.department === active);
  const shownLive = shown.filter((p) => !p.pending);
  const shownPending = shown.filter((p) => p.pending);

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Talent pool · Airtable “Intern Pool”</p>
          <h1>
            Our <span className="text-tbbq-gradient">interns</span>
          </h1>

          {/* This dashboard is read-only. Every fix it names — a missing photo, an unticked box —
              is made in Airtable, so the door to Airtable belongs next to the title rather than at
              the bottom of a page somebody has to scroll to find it. */}
          <a className="ip-atlink" href={AIRTABLE_URL} target="_blank" rel="noopener noreferrer">
            <TableIcon />
            Open the Intern Pool in Airtable
            <ArrowUpRight />
          </a>

          <p className="lede">
            The interns running TechBBQ 2026, pitched to whoever is hiring. A card goes live when
            the intern has ticked <strong>Consent to publish</strong>, uploaded a photo and been
            given a <strong>Show until</strong> date, and someone here has ticked{" "}
            <strong>Put on web</strong>. It then takes itself down after that date, with no deploy
            and nothing to remember. Served as JSON at <code>/api/interns</code>.
          </p>

          {depts.length > 1 && (
            <div className="seg" role="tablist" aria-label="Filter by department" style={{ marginTop: 28 }}>
              {[ALL, ...depts].map((d) => (
                <button key={d} role="tab" aria-selected={active === d} onClick={() => setActive(d)}>
                  {d === ALL ? "All" : d}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CopyInternsEmbed department={active === ALL ? undefined : active} />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              Pitch cards with a LinkedIn button. Copy from the deployed dashboard, not localhost.
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <RefreshButton onRefresh={refresh} changes={changes} error={revalidateError} resetKey="interns" />
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
          <p className="count-line">Loading…</p>
        ) : interns.length === 0 ? (
          <div className="notice">
            <strong>The pool is empty.</strong>
            <p>
              Nobody has filled in the form yet. Every row needs a name at minimum — the three blank
              rows Airtable creates with a new table are ignored on purpose.
            </p>
          </div>
        ) : (
          <>
            <p className="count-line">
              {live.length} live on techbbq.dk
              {pending.length > 0 && ` · ${pending.length} not yet`}
              {revalidating && <span className="reval"> · checking for updates…</span>}
              {updated && <span className="reval"> · updated</span>}
            </p>

            {shownLive.length > 0 && (
              <div className="ip-grid" style={{ marginTop: 28 }}>
                {shownLive.map((p) => (
                  <InternCard key={p.id} p={p} />
                ))}
              </div>
            )}

            {shownPending.length > 0 && (
              <section style={{ marginTop: 48 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    marginBottom: 16,
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                    paddingBottom: 8,
                  }}
                >
                  <h2 style={{ margin: 0 }}>Not on the site yet</h2>
                  <span className="lede" style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
                    {shownPending.length}
                  </span>
                </div>
                {/* Said once, here, rather than on every card: a card that shows nothing but a name
                    is not broken, it is someone who has not agreed to be published yet. */}
                <p className="lede" style={{ marginTop: 0, fontSize: 13 }}>
                  Anyone still waiting on their own consent shows as a name and nothing else. Their
                  pitch and photo are not read from Airtable at all until they tick the box.
                </p>
                <div className="ip-grid">
                  {shownPending.map((p) => (
                    <InternCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
