// Self-contained Elementor snippet for one section of the Brella program.
//
// Same contract as lib/eventEmbedSnippet.ts: one HTML block with its own #id-scoped styles
// and a small script, no build step, no framework, everything !important because WordPress
// themes restyle every generic tag. __ORIGIN__ is swapped for the live origin by the copy
// button, so copying from localhost bakes in localhost.
//
// The SECTION IS BAKED INTO THE URL (?section=…), not filtered here. That keeps the rules for
// what belongs in a section in exactly one place (lib/brellaSections.ts, applied by the API
// route) rather than shipping a second copy into every pasted snippet, where it could never be
// corrected once it is live on techbbq.dk.
//
// TWO LAYOUTS, chosen by section:
//   stages, grills → a TIMELINE. One column per stage, one day at a time, 09:00 origin, cards
//                    positioned by time. Mirrors app/brella-program/page.tsx.
//   rooms, side    → a card list. Side Events is filtered by day, since it has one track.
//
// On a phone the timeline shows ONE column with a native <select> to switch between them.
// Five columns in 360px is unreadable, and a native select is the one dropdown that behaves
// correctly inside an arbitrary WordPress theme.

import { originDecl } from "@/lib/embedOriginGuard";
import {
  BRELLA_SECTIONS,
  roomProgrammes,
  MORNING_BY_MIN,
  EVENING_FROM_MIN,
  findTimelineColumn,
  EVENT_DAYS,
  EVENT_YEAR,
  TIMELINE_COLUMNS,
  type BrellaSection,
} from "@/lib/brellaSections";
import {
  BREATHWORK_COLOR,
  BREATHWORK_ICON_PATHS,
  BREATHWORK_LABEL,
  BREATHWORK_RE,
  OPENING_ICON_PATHS,
  OPENING_LABEL,
  OPENING_RE,
  DEFAULT_TRACK_COLOR,
  HOST_ICON_PATHS,
  SECTION_COLORS,
  STAGE_ICON_PATHS,
  TRACK_STYLES,
} from "@/lib/brellaTheme";

export type BrellaEmbedOptions = {
  /** A single section, or "all" for the whole program with its own section switcher. */
  section: BrellaSection | "all";
  uid?: string;
  // Drop the panel's own background + padding, for a page that already provides them.
  transparent?: boolean;
  /**
   * ONE timeline column, by label: "Life Science x Deep Tech Stage".
   *
   * For a page that is about a single stage — the Life Science page on techbbq.dk wants its own
   * programme, not the five-column board with four columns a visitor there does not care about.
   * It overrides `section`, since a column already implies which section it belongs to.
   *
   * The result is a one-column timeline with the day pills and nothing else: the track pills and
   * the phone picker would both be a menu of one, so they disappear on their own (see
   * buildSectionControls — it skips them when there is a single column).
   */
  stage?: string;
};

// Vertical scale, shared with the dashboard: 30 minutes = 90px. It was 72px until the live
// page showed 18 of 41 cards clipping their own text — a real column on techbbq.dk is ~270px
// wide, narrower than any local preview, so titles wrap onto two lines far more often while a
// card's height still comes from its duration.
const PX_PER_MIN = 3;
const SLOT_MIN = 30;
const MIN_CARD_PX = 26;
// Breathwork gets its own floor and always wins the overlap. A break is three minutes, which is
// 9px of axis: too small for a label, and under the 24px target size WCAG 2.2 asks of anything you
// can press. So it is floored to 24 and drawn IN FRONT of its neighbours, because a break that is
// behind one card and in front of the next is worse than a small one (Auri, 2026-08-05). Drawing
// on top would hide the following talk's heading — the talk starts the same minute the break ends
// — so the overlap is measured and that card's text is pushed down past it (see `clearances`
// below). Kept identical to the dashboard's BREATH_MIN_PX / BREATH_CLEARANCE_PX in
// app/brella-program/page.tsx: the preview and the pasted embed have to agree.
const BREATH_MIN_PX = 24;
const BREATH_CLEARANCE_PX = 3;

export function buildBrellaEmbedSnippet({
  section,
  uid,
  transparent = true,
  stage,
}: BrellaEmbedOptions): string {
  const id = uid || "tbbq-brella";

  // A named stage decides everything: which section to fetch, and that the timeline has exactly
  // one column. An unknown name throws rather than falling back — silently handing someone the
  // five-column board for a page about one stage is worse than an error they can read.
  const single = stage ? findTimelineColumn(stage) : null;
  if (stage && !single) {
    throw new Error(
      `Unknown stage ${JSON.stringify(stage)}. Known: ${Object.values(TIMELINE_COLUMNS)
        .flat()
        .map((c) => c?.label)
        .filter(Boolean)
        .join(", ")}`
    );
  }

  const effectiveSection = single ? single.section : section;
  const path = `/api/program?event=brella&section=${effectiveSection}`;
  const isAll = !single && section === "all";
  // Every section's columns travel, keyed by section, because in "all" mode the visitor can
  // switch between them without another request. RegExp cannot be JSON.stringify'd, so the
  // source travels as a string and the snippet rebuilds it. Same list the dashboard uses, so
  // the two cannot disagree about which track belongs in which column.
  const serialiseCols = (defs?: { label: string; match: RegExp }[]) =>
    (defs ?? []).map((c) => ({ label: c.label, re: c.match.source }));
  const columnsBySection: Record<string, { label: string; re: string }[]> = {};
  for (const { key } of BRELLA_SECTIONS) columnsBySection[key] = serialiseCols(TIMELINE_COLUMNS[key]);
  // What runs in each room, for the sub-label under its column heading. Built from the same
  // ROOM_ALIASES table the page reads, so the two cannot disagree about where a programme is.
  const programmesByColumn: Record<string, string[]> = {};
  for (const defs of Object.values(TIMELINE_COLUMNS)) {
    for (const c of defs ?? []) {
      const ps = roomProgrammes(c.label);
      if (ps.length) programmesByColumn[c.label] = ps;
    }
  }
  const columnDefs = single
    ? [single.column]
    : isAll
      ? undefined
      : TIMELINE_COLUMNS[effectiveSection as BrellaSection];
  const isTimeline = isAll || Boolean(columnDefs);
  const columns = serialiseCols(columnDefs);
  // In single-stage mode the section's own full column list must not travel either: the only
  // list the snippet may ever draw from is the one column that was asked for.
  if (single) columnsBySection[effectiveSection] = columns;

  return `<!-- TechBBQ program (Brella${single ? ` · ${single.column.label}` : isTimeline ? " · timeline" : ""}) — paste into an Elementor HTML widget -->
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<div id="${id}" class="tbbq-bp">
  <div class="tbbq-bp__sections" role="tablist" aria-label="Program section"></div>
  <div class="tbbq-bp__controls">
    <div class="tbbq-bp__tracks" role="tablist" aria-label="Filter"></div>
    <label class="tbbq-bp__pickWrap">
      <span class="tbbq-bp__pickLabel"></span>
      <select class="tbbq-bp__pick" aria-label="Choose a column"></select>
    </label>
    <div class="tbbq-bp__days" role="tablist" aria-label="Day"></div>
  </div>
  <div class="tbbq-bp__search">
    <div class="tbbq-bp__searchBox">
      <svg class="tbbq-bp__searchIcon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="search" class="tbbq-bp__searchInput" placeholder="Search by speaker, company or title…" aria-label="Search sessions by speaker" autocomplete="off" spellcheck="false">
      <button type="button" class="tbbq-bp__searchClear" aria-label="Clear search" hidden><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <ul class="tbbq-bp__sugg" hidden></ul>
    <p class="tbbq-bp__searchHint" aria-live="polite"></p>
  </div>
  <div class="tbbq-bp__tags" hidden>
    <div class="tbbq-bp__tagRow" role="group" aria-label="Filter by topic"></div>
    <p class="tbbq-bp__tagHint" aria-live="polite"></p>
  </div>
  <div class="tbbq-bp__out"><p class="tbbq-bp__empty">Loading…</p></div>
  <div class="tbbq-bp__overlay" hidden>
    <div class="tbbq-bp__modal" role="dialog" aria-modal="true" aria-label="Session details"></div>
  </div>
</div>

<style>
  #${id}{--bg:#0d0d0d;--card:#131313;--card2:#191919;--fg:#f2f2f2;--muted:#9a9a9c;--border:#2a2a2a;
    --head:'Onest',ui-sans-serif,system-ui,sans-serif;--sans:'Inter',ui-sans-serif,system-ui,sans-serif;
    --gutter:74px;
    display:block!important;${transparent ? "" : "background:var(--bg)!important;padding:32px 24px!important;border-radius:20px!important;"}
    font-family:var(--sans)!important;color:var(--fg)!important;box-sizing:border-box}
  #${id} *{box-sizing:border-box}
  /* The theme uppercases headings, strong and card text. Everything in here is content, not
     chrome, so it is forced back to normal; the few places that SHOULD be uppercase (day
     labels, role tags, the all-day label) re-declare it themselves below. */
  #${id},#${id} *{text-transform:none!important;font-variant:normal!important;letter-spacing:normal!important;text-align:left}

  /* The section masthead. Big type, centred, the primary control on the page. */
  #${id} .tbbq-bp__sections{display:flex!important;flex-wrap:wrap!important;align-items:baseline!important;justify-content:center!important;gap:8px 28px!important;margin:0 0 20px!important;padding:0!important}
  #${id} .tbbq-bp__sections:empty{display:none!important}
  #${id} .tbbq-bp__sections button{appearance:none!important;padding:0!important;margin:0!important;border:0!important;background:none!important;box-shadow:none!important;cursor:pointer!important;font-family:var(--head)!important;font-size:clamp(24px,3.6vw,40px)!important;font-weight:600!important;letter-spacing:-.02em!important;line-height:1.1!important;text-transform:none!important;color:var(--muted)!important;transition:color .18s}
  #${id} .tbbq-bp__sections button:hover,#${id} .tbbq-bp__sections button[aria-selected="true"]{color:var(--fg)!important}
  #${id} .tbbq-bp__sections button:disabled{opacity:.35!important;cursor:default!important}
  #${id} .tbbq-bp__sections button:focus-visible{outline:2px solid #ce0f2e!important;outline-offset:4px!important}

  /* RESERVED HEIGHT. Sections have different numbers of control rows (a timeline has columns
     AND days, Event Rooms has only tracks), and without a floor the schedule jumped up and
     down every time a filter was pressed. */
  #${id} .tbbq-bp__controls{display:flex!important;flex-direction:column!important;align-items:center!important;gap:10px!important;margin:0 0 18px!important;min-height:${isAll ? 108 : 0}px!important}
  @media(max-width:760px){#${id} .tbbq-bp__controls{min-height:0!important}}

  /* Pills. Forced + scoped: WordPress themes give every <button> their own look. */
  #${id} .tbbq-bp__tracks,#${id} .tbbq-bp__days{display:flex!important;flex-wrap:wrap!important;justify-content:center!important;gap:6px!important;padding:5px!important;margin:0!important;border:1px solid var(--border)!important;border-radius:9999px!important;background:var(--card)!important;width:fit-content!important;max-width:100%!important}
  #${id} .tbbq-bp__tracks:empty,#${id} .tbbq-bp__days:empty{display:none!important}
  #${id} .tbbq-bp__tracks button,#${id} .tbbq-bp__days button{appearance:none!important;border:0!important;margin:0!important;padding:8px 16px!important;border-radius:9999px!important;background:transparent!important;color:var(--muted)!important;font-family:var(--head)!important;font-size:13px!important;font-weight:600!important;line-height:1.15!important;text-transform:none!important;letter-spacing:normal!important;cursor:pointer!important;box-shadow:none!important;transition:background .18s,color .18s}
  #${id} .tbbq-bp__days button{display:flex!important;flex-direction:column!important;align-items:center!important;gap:2px!important;padding:9px 22px!important}
  #${id} .tbbq-bp__dnum{font-weight:700!important;letter-spacing:.06em!important}
  #${id} .tbbq-bp__ddate{font-size:11px!important;font-weight:500!important;opacity:.72!important}
  #${id} .tbbq-bp__tracks button:hover,#${id} .tbbq-bp__days button:hover{color:var(--fg)!important}
  #${id} .tbbq-bp__tracks button[aria-selected="true"],#${id} .tbbq-bp__days button[aria-selected="true"]{background:var(--fg)!important;color:#0d0d0d!important}
  #${id} .tbbq-bp__tracks button:focus-visible,#${id} .tbbq-bp__days button:focus-visible{outline:2px solid #ce0f2e!important;outline-offset:2px!important}

  /* The phone's column switcher. A native select, because a hand-rolled dropdown inside an
     unknown theme is a portal/z-index fight that is not worth having.
     NOTE the explicit height: techbbq.dk sets a fixed height on every select, and because this
     rule declared padding but no height, the theme won and clipped the text inside the box. */
  #${id} .tbbq-bp__pickWrap{display:none!important;align-items:center!important;gap:8px!important;width:100%!important;max-width:420px!important;margin:0!important;padding:0!important}
  #${id} .tbbq-bp__pickLabel{flex:none!important;font-family:var(--head)!important;font-size:11px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--muted)!important}
  #${id} .tbbq-bp__pick{flex:1 1 auto!important;width:100%!important;min-width:0!important;height:auto!important;min-height:46px!important;max-height:none!important;line-height:1.25!important;appearance:none!important;-webkit-appearance:none!important;padding:11px 34px 11px 14px!important;border:1px solid var(--border)!important;border-radius:12px!important;background-color:var(--card)!important;color:var(--fg)!important;font-family:var(--head)!important;font-size:14px!important;font-weight:600!important;line-height:1.2!important;box-shadow:none!important;cursor:pointer!important;
    background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239a9a9c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")!important;
    background-repeat:no-repeat!important;background-position:right 12px center!important}
  #${id} .tbbq-bp__pick:focus-visible{outline:2px solid #ce0f2e!important;outline-offset:2px!important}

  #${id} .tbbq-bp__empty{margin:0!important;color:var(--muted)!important;font-size:14px!important}

  /* ── TIMELINE ── */
  /* padding-bottom: the last time label is centred on the final gridline and so hangs half
     below the body. Without this the 05:00 PM label sits flush against whatever follows and
     reads as cut off, which is how it looked in the Elementor editor. */
  #${id} .tbbq-bp__tl{margin:0!important;padding:0 0 22px!important}
  /* AN ALL-DAY SESSION IS THE WHOLE COLUMN. A wash rather than a fill, dashed rather than
     solid, so whatever sits on top of it stays readable. Height comes inline from the
     timeline's own height, so it always reaches the last gridline exactly. */
  #${id} .tbbq-bp__allDay{display:flex!important;flex-direction:column!important;gap:4px!important;margin:0!important;padding:8px 10px!important;border:1px dashed color-mix(in srgb,var(--track) 45%,transparent)!important;border-radius:8px!important;background:color-mix(in srgb,var(--track) 9%,transparent)!important;color:var(--fg)!important;text-align:left!important;font:inherit!important;cursor:pointer!important;overflow:hidden!important;box-shadow:none!important;appearance:none!important}
  #${id} .tbbq-bp__allDay:hover{background:color-mix(in srgb,var(--track) 16%,transparent)!important}
  /* The DERIVED band has nothing to open, so it takes no pointer and no hover. */
  #${id} .tbbq-bp__allDayProg{cursor:default!important;pointer-events:none!important}
  #${id} .tbbq-bp__allDayProg:hover{background:color-mix(in srgb,var(--track) 9%,transparent)!important}
  #${id} .tbbq-bp__allDay:focus-visible{outline:2px solid var(--track)!important;outline-offset:-2px!important}
  #${id} .tbbq-bp__allDayLabel{font-family:var(--head)!important;font-size:9.5px!important;font-weight:700!important;letter-spacing:.1em!important;text-transform:uppercase!important;line-height:1.3!important;color:var(--track)!important}
  /* Pinned at the TOP of a column that can be 2000px tall — centred it would sit off screen. */
  #${id} .tbbq-bp__allDayTitle{font-family:var(--head)!important;font-size:12.5px!important;font-weight:600!important;line-height:1.25!important;color:#fff!important;overflow-wrap:anywhere!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

  /* NO CSS GRID HERE. On techbbq.dk the theme blockified the grid container — the timeline
     collapsed, the gutter ran the full width and every card drew on top of the next. The
     columns are ABSOLUTELY POSITIONED instead, with their geometry written inline by the
     script: an absolutely positioned box ignores the parent's display entirely, so there is
     nothing left for a theme to override. */
  /* ── SPEAKER SEARCH ── Mirrors .bp-search on the dashboard. It DIMS rather than filters:
     removing the other cards collapses the columns and the clock stops lining up across
     stages, which is the only thing a timeline is for. */
  #${id} .tbbq-bp__search{margin:14px auto 0!important;max-width:460px!important;width:100%!important;padding:0!important}
  #${id} .tbbq-bp__searchBox{display:flex!important;align-items:center!important;gap:8px!important;margin:0!important;padding:0 10px!important;border:1px solid var(--border)!important;border-radius:10px!important;background:var(--card)!important;box-shadow:none!important}
  #${id} .tbbq-bp__searchBox:focus-within{border-color:#fa7000!important}
  #${id} .tbbq-bp__searchIcon{flex:none!important;color:var(--muted)!important}
  /* font-size 16px is NOT a style choice: iOS Safari zooms the whole page when a focused input
     is under 16px, and on a pasted embed that zoom is the visitor's problem to undo. */
  #${id} .tbbq-bp__searchInput{flex:1 1 auto!important;min-width:0!important;width:auto!important;margin:0!important;padding:10px 0!important;border:0!important;border-radius:0!important;outline:none!important;background:none!important;box-shadow:none!important;color:var(--fg)!important;font-family:var(--sans)!important;font-size:16px!important;font-weight:400!important;line-height:1.3!important;letter-spacing:0!important;text-transform:none!important;height:auto!important}
  #${id} .tbbq-bp__searchInput::placeholder{color:var(--muted)!important;opacity:1!important}
  #${id} .tbbq-bp__searchInput::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}
  #${id} .tbbq-bp__searchClear{flex:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:22px!important;height:22px!important;margin:0!important;padding:0!important;border:0!important;border-radius:9999px!important;background:none!important;color:var(--muted)!important;cursor:pointer!important;box-shadow:none!important}
  #${id} .tbbq-bp__searchClear:hover{background:rgba(255,255,255,.08)!important;color:var(--fg)!important}
  #${id} .tbbq-bp__searchHint{margin:6px 0 0!important;padding:0!important;font-family:var(--sans)!important;font-size:12.5px!important;font-weight:400!important;line-height:1.4!important;color:var(--muted)!important;text-align:center!important;text-transform:none!important;letter-spacing:0!important}

  /* Predicted PEOPLE, in flow rather than floating: a dropdown would cover the very cards the
     search is pointing at, and this is six rows at most. */
  #${id} .tbbq-bp__sugg{margin:6px 0 0!important;padding:4px!important;list-style:none!important;border:1px solid var(--border)!important;border-radius:10px!important;background:var(--card)!important}
  #${id} .tbbq-bp__sugg li{margin:0!important;padding:0!important;list-style:none!important}
  #${id} .tbbq-bp__sugg li::marker{content:""}
  #${id} .tbbq-bp__suggRow{display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;margin:0!important;padding:6px 7px!important;border:0!important;border-radius:7px!important;background:none!important;box-shadow:none!important;color:inherit!important;font:inherit!important;text-align:left!important;cursor:pointer!important}
  #${id} .tbbq-bp__suggRow:hover{background:rgba(255,255,255,.06)!important}
  #${id} .tbbq-bp__suggRow:focus-visible{outline:none!important;box-shadow:inset 0 0 0 1px #fa7000!important}
  #${id} .tbbq-bp__suggFace{flex:none!important;width:26px!important;height:26px!important;border-radius:9999px!important;object-fit:cover!important;margin:0!important;background:var(--card2)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-family:var(--head)!important;font-size:11px!important;font-weight:700!important;color:var(--muted)!important;line-height:1!important}
  #${id} .tbbq-bp__suggText{flex:1 1 auto!important;min-width:0!important;display:flex!important;flex-direction:column!important}
  #${id} .tbbq-bp__suggName{font-family:var(--sans)!important;font-size:13px!important;font-weight:600!important;line-height:1.3!important;color:var(--fg)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  #${id} .tbbq-bp__suggRole{font-family:var(--sans)!important;font-size:11.5px!important;font-weight:400!important;line-height:1.3!important;color:var(--muted)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  #${id} .tbbq-bp__suggWhere{flex:none!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:2px!important;font-family:var(--head)!important;font-size:10px!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important;line-height:1.3!important;color:#fa7000!important}
  #${id} .tbbq-bp__suggStage{font-size:9.5px!important;font-weight:600!important;letter-spacing:.04em!important;text-transform:none!important;color:var(--muted)!important;max-width:130px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}

  /* TOPIC TAGS. Chips that DIM rather than filter, like the search above them. */
  #${id} .tbbq-bp__tags{margin:12px auto 0!important;max-width:720px!important;width:100%!important;padding:0!important}
  #${id} .tbbq-bp__tagRow{display:flex!important;flex-wrap:wrap!important;justify-content:center!important;gap:6px!important;margin:0!important;padding:0!important}
  #${id} .tbbq-bp__tag{display:inline-flex!important;align-items:center!important;gap:6px!important;margin:0!important;padding:5px 11px!important;border:1px solid var(--border)!important;border-radius:9999px!important;background:var(--card)!important;color:var(--muted)!important;font-family:var(--head)!important;font-size:12px!important;font-weight:600!important;line-height:1.3!important;text-transform:none!important;letter-spacing:0!important;cursor:pointer!important;box-shadow:none!important;appearance:none!important}
  #${id} .tbbq-bp__tag:hover:not(:disabled){color:var(--fg)!important;border-color:var(--muted)!important}
  #${id} .tbbq-bp__tag[aria-pressed="true"]{border-color:#fa7000!important;background:color-mix(in srgb,#fa7000 16%,transparent)!important;color:var(--fg)!important}
  /* Faded, not hidden: a cap has to be visible to be understood. */
  #${id} .tbbq-bp__tag:disabled{opacity:.35!important;cursor:not-allowed!important}
  #${id} .tbbq-bp__tagN{font-size:10px!important;font-weight:700!important;color:var(--muted)!important}
  #${id} .tbbq-bp__tag[aria-pressed="true"] .tbbq-bp__tagN{color:#fa7000!important}
  #${id} .tbbq-bp__tagClear{margin:0!important;padding:5px 11px!important;border:0!important;background:none!important;color:var(--muted)!important;font-family:var(--sans)!important;font-size:12px!important;text-decoration:underline!important;cursor:pointer!important;box-shadow:none!important;appearance:none!important}
  #${id} .tbbq-bp__tagHint{margin:6px 0 0!important;padding:0!important;font-family:var(--sans)!important;font-size:12.5px!important;font-weight:400!important;line-height:1.4!important;color:var(--muted)!important;text-align:center!important;text-transform:none!important;letter-spacing:0!important}

  /* THE DIM. Opacity only — the card keeps its box, or the columns collapse. */
  #${id} .tbbq-bp__ev[data-dim]{opacity:.16!important;filter:saturate(.4)!important;transition:opacity .18s ease,filter .18s ease}
  #${id} .tbbq-bp__ev[data-dim]:hover{opacity:.55!important;filter:none!important}
  #${id} .tbbq-bp__card[data-dim]{opacity:.16!important;filter:saturate(.4)!important}
  #${id} .tbbq-bp__card[data-dim]:hover{opacity:.55!important;filter:none!important}

  /* "THEY ARE OVER HERE": the day you are not on, and the stage whose match is below the fold. */
  #${id} .tbbq-bp__days button[data-hasmatch]{position:relative!important;box-shadow:inset 0 0 0 1px #fa7000!important}
  #${id} .tbbq-bp__badge{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:16px!important;height:16px!important;padding:0 4px!important;border-radius:9999px!important;background:#fa7000!important;color:#fff!important;font-family:var(--head)!important;font-size:9.5px!important;font-weight:700!important;letter-spacing:0!important;line-height:1!important}
  #${id} .tbbq-bp__days button .tbbq-bp__badge{position:absolute!important;top:-6px!important;right:-6px!important}
  #${id} .tbbq-bp__colhead .tbbq-bp__badge{margin-left:6px!important}
  #${id} .tbbq-bp__colhead[data-hasmatch]{color:var(--track)!important;box-shadow:inset 0 -2px 0 var(--track)!important}
  #${id} .tbbq-bp__colhead[data-dim]{opacity:.3!important;transition:opacity .18s ease}

  #${id} .tbbq-bp__head,#${id} .tbbq-bp__body{display:block!important;position:relative!important;margin:0!important;padding:0!important}
  /* flex-wrap so the programme sub-label drops onto its own line under the room number. */
  #${id} .tbbq-bp__colhead{display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:46px!important;padding:8px 6px!important;margin:0!important;border-left:1px solid var(--border)!important;text-align:center!important;font-family:var(--head)!important;font-size:17px!important;font-weight:600!important;line-height:1.25!important;color:var(--fg)!important;overflow-wrap:anywhere!important}
  #${id} .tbbq-bp__gutterhead{border:0!important}
  #${id} .tbbq-bp__icon{flex:none!important;color:var(--track,currentColor)!important}

  #${id} .tbbq-bp__body{margin-top:10px!important}
  #${id} .tbbq-bp__tick{position:absolute!important;right:8px!important;transform:translateY(-50%)!important;font-size:11px!important;color:var(--muted)!important;white-space:nowrap!important}
  #${id} .tbbq-bp__tick[data-hour]{color:var(--fg)!important}
  /* Half-hour labels only appear on a phone, and they are dimmer and smaller than the hours so
     the gutter still reads as hours with marks between them. */
  @media(max-width:760px){#${id} .tbbq-bp__tick{font-size:10px!important;opacity:.75!important}
    #${id} .tbbq-bp__tick[data-hour]{font-size:11px!important;opacity:1!important;font-weight:600!important}}
  #${id} .tbbq-bp__line{position:absolute!important;left:var(--gutter)!important;right:0!important;height:1px!important;background:var(--border)!important;opacity:.45!important;pointer-events:none!important}
  #${id} .tbbq-bp__line[data-hour]{opacity:.9!important}
  #${id} .tbbq-bp__col{box-sizing:border-box!important;border-left:1px solid var(--border)!important}
  #${id} .tbbq-bp__col:last-child{border-right:1px solid var(--border)!important}
  #${id} .tbbq-bp__none{padding:8px!important;text-align:center!important;font-size:12px!important;color:var(--muted)!important;opacity:.6!important}

  #${id} .tbbq-bp__ev{position:absolute!important;display:flex!important;flex-direction:column!important;gap:2px!important;overflow:hidden!important;padding:6px 8px!important;margin:0!important;border:1px solid var(--border)!important;border-top:3px solid var(--track)!important;border-radius:5px!important;text-align:left!important;font:inherit!important;color:var(--fg)!important;appearance:none!important;box-shadow:none!important;
    background:linear-gradient(135deg,color-mix(in srgb,var(--track) 14%,var(--card)),color-mix(in srgb,var(--track2,var(--track)) 14%,var(--card)))!important}
  #${id} button.tbbq-bp__ev{cursor:pointer!important}
  #${id} button.tbbq-bp__ev:hover{background:linear-gradient(135deg,color-mix(in srgb,var(--track) 26%,var(--card)),color-mix(in srgb,var(--track2,var(--track)) 26%,var(--card)))!important}
  #${id} button.tbbq-bp__ev:focus-visible{outline:2px solid var(--track)!important;outline-offset:1px!important}
  /* overflow-wrap:anywhere, because overflow:hidden clips at the PADDING box, not the content
     box: a single long word ("#MadeInEU?", "Efficiencymaxxing") on a 117px column overflowed the
     40px reserved for the avatars and painted underneath them before being clipped at the card
     edge. Breaking the word is the only thing that keeps it inside the space it was given. */
  #${id} .tbbq-bp__evTitle{flex:none!important;margin:0!important;font-family:var(--head)!important;font-size:12.5px!important;font-weight:600!important;line-height:1.25!important;color:#fff!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere!important}
  #${id} .tbbq-bp__evTime{flex:none!important;margin:0!important;font-size:11px!important;color:var(--muted)!important}
  #${id} .tbbq-bp__faces{flex:none!important;display:inline-flex!important}
  /* THE AVATARS, ON EVERY CARD THAT HAS SPEAKERS.
     A timeline card shows FACES ONLY — no speaker names anywhere on the board (Auri,
     2026-08-06). The names, roles, titles and companies are all in the dialog, one click away.
     Pinned to the card's right edge so every card carries them however short its slot is.
     Vertically centred rather than top-aligned: a 5-minute card is one line tall and a top-
     aligned stack sat above its own title. */
  #${id} .tbbq-bp__evFaces{position:absolute!important;top:50%!important;right:7px!important;transform:translateY(-50%)!important;display:inline-flex!important;flex-direction:row-reverse!important;pointer-events:none!important;z-index:1!important}
  /* row-reverse, so the FIRST speaker is drawn last and therefore on top of the stack — the
     overlap has to read left-to-right the way the names do. */
  #${id} .tbbq-bp__evFaces .tbbq-bp__face+.tbbq-bp__face{margin-left:0!important;margin-right:-6px!important}
  /* Room for the stack, so a long title does not run underneath it. Two faces overlapping at
     6px is 26px, plus the 7px inset and a little air. */
  #${id} .tbbq-bp__ev[data-faces] .tbbq-bp__evTitle,
  #${id} .tbbq-bp__ev[data-faces] .tbbq-bp__evTime{padding-right:40px!important}
  /* The "+3" for the speakers the stack has no room for: the count the removed names used to
     carry. Auto width so a two-digit panel is not clipped. */
  /* MODERATOR, not speaker. A ring is enough at 16px, where a glyph would be mush. */
  #${id} .tbbq-bp__face[data-mod]{box-shadow:0 0 0 1.5px var(--card),0 0 0 3px var(--track)!important}
  #${id} .tbbq-bp__colprog{flex-basis:100%!important;margin-top:2px!important;font-family:var(--head)!important;font-size:10px!important;font-weight:600!important;letter-spacing:.06em!important;color:var(--muted)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  #${id} .tbbq-bp__face--more{width:auto!important;min-width:16px!important;padding:0 4px!important;background:var(--card2)!important;color:var(--fg)!important;font-size:8.5px!important;letter-spacing:-.02em!important}
  #${id} .tbbq-bp__face+.tbbq-bp__face{margin-left:-6px!important}
  #${id} .tbbq-bp__face{width:16px!important;height:16px!important;border-radius:9999px!important;object-fit:cover!important;box-shadow:0 0 0 1.5px var(--card)!important;background:var(--card2)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:8px!important;font-weight:700!important;color:var(--muted)!important;line-height:1!important;margin:0!important}
  #${id} .tbbq-bp__ev[data-compact]{padding:3px 8px!important}
  #${id} .tbbq-bp__ev[data-compact] .tbbq-bp__evTitle{-webkit-line-clamp:1;font-size:11.5px!important}
  #${id} .tbbq-bp__ev[data-compact] .tbbq-bp__evTime{display:none!important}

  /* ── BREATHWORK ── A break is 3 minutes, so its card is the 26px floor: the smallest thing on
     the board. --track is already violet by the time it lands here (sessionVars), so these rules
     only add WEIGHT — a stronger fill and a full violet edge instead of the 3px top rule every
     other card carries — so the eye finds it despite the size. */
  #${id} .tbbq-bp__ev[data-breathwork],
  #${id} .tbbq-bp__ev[data-opening]{border:1px solid color-mix(in srgb,var(--track) 55%,transparent)!important;border-top:3px solid var(--track)!important;background:color-mix(in srgb,var(--track) 26%,var(--card))!important;box-shadow:0 2px 10px rgba(0,0,0,.55)!important}
  #${id} button.tbbq-bp__ev[data-breathwork]:hover,
  #${id} button.tbbq-bp__ev[data-opening]:hover{background:color-mix(in srgb,var(--track) 40%,var(--card))!important}
  /* A 24px card would otherwise keep the 6px top padding and clip its own single line. */
  #${id} .tbbq-bp__ev[data-breathwork][data-compact],
  #${id} .tbbq-bp__ev[data-opening][data-compact]{padding-top:2px!important;padding-bottom:2px!important}
  #${id} .tbbq-bp__evTitle .tbbq-bp__bicon{display:inline-block!important;vertical-align:-2px!important;margin-right:4px!important;color:var(--track)!important}
  /* The pill on a list card and in the dialog: a label, not a button somebody forgot to wire up. */
  #${id} .tbbq-bp__breath{display:inline-flex!important;align-items:center!important;gap:5px!important;margin:10px 0 0!important;padding:3px 9px!important;border-radius:9999px!important;background:color-mix(in srgb,${BREATHWORK_COLOR} 20%,transparent)!important;color:${BREATHWORK_COLOR}!important;font-family:var(--head)!important;font-size:10.5px!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important;line-height:1.4!important}
  #${id} .tbbq-bp__open{display:inline-flex!important;align-items:center!important;gap:5px!important;margin:10px 0 0!important;padding:3px 9px!important;border-radius:9999px!important;background:color-mix(in srgb,var(--track) 20%,transparent)!important;color:var(--track)!important;font-family:var(--head)!important;font-size:10.5px!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important;line-height:1.4!important}

  /* ── CARD LIST (event rooms, side events) ── */
  #${id} .tbbq-bp__daylabel{margin:26px 0 12px!important;padding:0!important;font-family:var(--head)!important;font-size:12px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--muted)!important}
  /* FOUR ACROSS, matching the dashboard's .bp-grid (Auri, 2026-08-08). This was 3 and the
     dashboard was already 4, so the same board read differently in the two places. The
     breakpoint ladder below now matches too — 4 / 3 / 2 / 1 rather than 3 / 2 / 1. */
  #${id} .tbbq-bp__grid{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:14px!important}
  #${id} .tbbq-bp__card{position:relative!important;display:block!important;width:100%!important;text-align:left!important;appearance:none!important;background:var(--card)!important;border:1px solid var(--border)!important;border-radius:12px!important;padding:14px 14px 14px 16px!important;margin:0!important;overflow:hidden!important;font-family:var(--sans)!important;color:var(--fg)!important;box-shadow:none!important;transition:border-color .2s,background .2s}
  #${id} button.tbbq-bp__card{cursor:pointer!important}
  #${id} .tbbq-bp__card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:var(--track)}
  #${id} button.tbbq-bp__card:hover{border-color:var(--track)!important;background:var(--card2)!important}
  /* SIDE EVENT ARTWORK, full-bleed at the top of the card. Negative margins mirror the card's
     own 14/14/14/16 padding. The fixed 16:9 box stays — it is what stops the row jumping as
     twelve lazy images arrive from four CDNs at four sizes — but the fit is CONTAIN, not cover
     (Auri, 2026-08-08: "some of the thumbnails are cut"). The spine (::before) is absolutely
     positioned, so it still paints over this.

     Measured, which is the reason: 9 of the 12 posters are Luma's 800x420 (1.90), one is
     1920x1192 (1.61) and one is 5376x1920 (2.80). Against a 1.78 box, cover was shaving the
     edges off the Luma set and cutting a THIRD off the 2.80 one. These are posters with type
     on them, so a crop takes words, not background. Contain letterboxes onto the existing
     translucent wash instead, which reads as a frame rather than as damage. */
  #${id} .tbbq-bp__thumb{margin:-14px -14px 12px -16px!important;padding:0!important;aspect-ratio:16/9!important;overflow:hidden!important;background:rgba(255,255,255,.05)!important;border-radius:0!important}
  #${id} .tbbq-bp__thumb img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;margin:0!important;border-radius:0!important;max-width:none!important}
  #${id} .tbbq-bp__modal .tbbq-bp__thumb{margin:0 0 14px!important;border-radius:10px!important}
  #${id} .tbbq-bp__time{margin:0!important;padding:0!important;font-family:var(--head)!important;font-size:11px!important;font-weight:600!important;letter-spacing:.06em!important;color:var(--fg)!important}
  /* In the dialog the time gets the stage's colour as a bar on its left, and enough room on
     its right that the close button is not sitting on top of it. */
  #${id} .tbbq-bp__modal .tbbq-bp__time{border-left:3px solid var(--track)!important;padding:2px 52px 2px 10px!important;font-size:12px!important}
  #${id} .tbbq-bp__title{margin:10px 0 0!important;padding:0!important;font-family:var(--head)!important;font-size:15px!important;font-weight:600!important;line-height:1.3!important;color:#fff!important;text-transform:none!important;letter-spacing:normal!important}
  #${id} .tbbq-bp__room{display:flex!important;align-items:center!important;gap:5px!important;margin:10px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12px!important;line-height:1.4!important}
  #${id} .tbbq-bp__desc{margin:8px 0 0!important;padding:0!important;color:rgba(255,255,255,.72)!important;font-family:var(--sans)!important;font-size:12px!important;font-weight:400!important;line-height:1.5!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  #${id} .tbbq-bp__count{margin:10px 0 0!important;padding:0!important;color:var(--track)!important;font-family:var(--head)!important;font-size:11px!important;font-weight:600!important}

  /* THE SIGN-UP BUTTON LIVES IN THE DIALOG ONLY (Auri, 2026-08-04). A pill on every preview
     card turned Side Events into a wall of buttons, and a visitor should read what the event is
     before signing up. 10px radius rather than a pill, to sit with the cards around it instead
     of with the filter chips. background and text-decoration are forced because techbbq.dk
     styles every <a> inside content. */
  /* The private-event caveat: muted and small, a condition of attending rather than a pitch. */
  #${id} .tbbq-bp__note{margin:10px 0 0!important;padding:0!important;color:var(--muted)!important;font-family:var(--sans)!important;font-size:11px!important;font-weight:400!important;line-height:1.4!important;text-transform:none!important}
  #${id} .tbbq-bp__modal .tbbq-bp__note{font-size:12px!important;line-height:1.5!important}
  #${id} .tbbq-bp__cta{margin:22px 0 0!important;padding:0!important}
  #${id} .tbbq-bp__cta a{display:inline-flex!important;align-items:center!important;padding:11px 20px!important;border-radius:10px!important;background:var(--track)!important;background-image:none!important;color:#fff!important;font-family:var(--head)!important;font-size:14px!important;font-weight:600!important;line-height:1.2!important;text-decoration:none!important;text-transform:none!important;box-shadow:none!important;transition:filter .18s}
  #${id} .tbbq-bp__cta a:hover{filter:brightness(1.12)!important;color:#fff!important;text-decoration:none!important}
  #${id} .tbbq-bp__cta a:focus-visible{outline:2px solid #fff!important;outline-offset:2px!important}

  /* ── DIALOG ── position:fixed so it escapes whatever Elementor column it was pasted into. */
  #${id} .tbbq-bp__overlay{position:fixed!important;inset:0!important;z-index:99999!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;padding:5vh 16px!important;background:rgba(0,0,0,.72)!important;overflow-y:auto!important}
  #${id} .tbbq-bp__overlay[hidden]{display:none!important}
  /* The modal SCROLLS ITSELF. Before this it had no height limit and only the overlay could
     scroll, so on any screen shorter than the content the last speaker was simply unreachable —
     which is what Auri saw cut off. overscroll-behavior stops a scroll that reaches the end
     from carrying on into the page behind. */
  #${id} .tbbq-bp__modal{position:relative!important;width:100%!important;max-width:640px!important;max-height:90vh!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain!important;background:var(--card)!important;border:1px solid var(--border)!important;border-top:3px solid var(--track)!important;border-radius:16px!important;padding:28px!important}
  /* sticky + float, NOT absolute: the modal is now the scroll container, so an absolutely
     positioned close button scrolls out of reach on a long session. */
  #${id} .tbbq-bp__close{position:sticky!important;top:0!important;float:right!important;z-index:2!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:32px!important;height:32px!important;margin:-6px -6px 0 14px!important;padding:0!important;border:1px solid var(--border)!important;border-radius:9999px!important;background:var(--card2)!important;color:var(--muted)!important;cursor:pointer!important}
  #${id} .tbbq-bp__close:hover{color:var(--fg)!important}
  #${id} .tbbq-bp__modal h2{margin:8px 0 0!important;padding:0!important;font-family:var(--head)!important;font-size:22px!important;font-weight:600!important;line-height:1.25!important;color:#fff!important;text-transform:none!important}
  #${id} .tbbq-bp__meta{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:8px!important;margin:10px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:13px!important}
  #${id} .tbbq-bp__topic{padding:3px 9px!important;border-radius:9999px!important;background:var(--card2)!important;border:1px solid var(--border)!important;font-family:var(--head)!important;font-size:10px!important;font-weight:600!important;text-transform:uppercase!important;letter-spacing:.05em!important}
  /* HARSHER RESET INSIDE THE DIALOG. On techbbq.dk the description came out one word per
     line and every name was uppercased. Two theme habits cause that: a CSS multi-column rule
     on a content wrapper, which turns a paragraph into a narrow strip, and text-transform on
     headings. Both are stamped out here, along with the min-width:0 a flex child needs before
     it is allowed to be as wide as its text.
     (No backticks anywhere in this file: the whole snippet is a JS template literal.) */
  #${id} .tbbq-bp__modal,#${id} .tbbq-bp__modal *{min-width:0!important;max-width:100%!important;float:none!important;columns:auto!important;column-count:1!important;column-width:auto!important;letter-spacing:normal!important;word-break:normal!important;overflow-wrap:break-word!important;hyphens:none!important}
  #${id} .tbbq-bp__modal{max-width:640px!important;width:100%!important}
  #${id} .tbbq-bp__body,#${id} .tbbq-bp__body p{display:block!important;width:100%!important;text-align:left!important;text-transform:none!important;white-space:normal!important}
  #${id} .tbbq-bp__body p{margin:12px 0 0!important;padding:0!important;color:rgba(255,255,255,.8)!important;font-family:var(--sans)!important;font-size:14px!important;font-weight:400!important;line-height:1.6!important}
  /* The person row is a flex pair; the text side must be free to grow. */
  #${id} .tbbq-bp__person>div{flex:1 1 auto!important;width:100%!important;display:block!important}
  #${id} .tbbq-bp__pname,#${id} .tbbq-bp__prole,#${id} .tbbq-bp__pbio,#${id} .tbbq-bp__pmore{display:block!important;text-transform:none!important;white-space:normal!important}
  /* MUST come after the rule above and be at least as specific. display:block!important beats
     the UA style behind the hidden attribute, which is why every bio opened on load. */
  #${id} .tbbq-bp__modal [hidden],#${id} .tbbq-bp__pbio[hidden]{display:none!important}
  /* The blanket reset above sets float:none on everything in the dialog, which killed the
     close button's float:right and parked it on the LEFT, on top of the time. Same specificity,
     so it has to be re-declared after the reset rather than before it. */
  #${id} .tbbq-bp__close{float:right!important}
  /* THE DIALOG SITS IN A MULTI-COLUMN CONTEXT. Proven empirically on techbbq.dk: the speaker
     list reported ONE client rect's worth of CSS width (298px) while actually rendering as TWO
     fragments 612px apart, which is column fragmentation and nothing else. getComputedStyle
     insists column-count is 1 on every ancestor, so the container cannot be identified that
     way; what does work, tested live one property at a time, is column-span on the fragmenting
     element. Applied to each direct child of the modal, since any of them can fragment.
     column-span is simply ignored outside a multi-column context, so this costs nothing
     everywhere else. */
  #${id} .tbbq-bp__modal>*,#${id} .tbbq-bp__people,#${id} .tbbq-bp__body{column-span:all!important}
  #${id} .tbbq-bp__pmore{display:inline-flex!important}
  #${id} .tbbq-bp__ptag{text-transform:uppercase!important;display:inline-block!important}
  #${id} .tbbq-bp__modal h3{margin:24px 0 0!important;padding:0!important;font-family:var(--head)!important;font-size:12px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--muted)!important}
  /* BLOCK, not grid. As a grid this list measured 582px inside a 283px modal on a phone and
     made the whole dialog scroll sideways. Block flow cannot outgrow its parent, and this
     theme has already been caught mishandling grid containers elsewhere. */
  #${id} .tbbq-bp__people{list-style:none!important;margin:12px 0 0!important;padding:0!important;display:block!important;width:100%!important}
  #${id} .tbbq-bp__person{display:flex!important;flex-wrap:nowrap!important;align-items:flex-start!important;gap:12px!important;margin:0 0 14px!important;padding:0!important;width:100%!important;max-width:100%!important}
  #${id} .tbbq-bp__person:last-child{margin-bottom:0!important}
  #${id} .tbbq-bp__photo{flex:0 0 auto!important;width:52px!important;height:52px!important;border-radius:9999px!important;object-fit:cover!important;object-position:50% 30%!important;background:var(--card2)!important;display:grid!important;place-items:center!important;font-family:var(--head)!important;font-weight:700!important;color:var(--track)!important;margin:0!important}
  #${id} .tbbq-bp__ptoggle{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;width:100%!important;padding:0!important;border:0!important;background:none!important;cursor:pointer!important;font:inherit!important;text-align:left!important;color:inherit!important;appearance:none!important;box-shadow:none!important}
  #${id} .tbbq-bp__pname{margin:0!important;padding:0!important;font-family:var(--head)!important;font-size:13px!important;font-weight:600!important;color:#fff!important}
  #${id} .tbbq-bp__ptag{display:inline-block!important;margin-left:8px!important;padding:1px 7px!important;border:1px solid var(--border)!important;border-radius:9999px!important;font-family:var(--sans)!important;font-size:10px!important;font-weight:600!important;letter-spacing:.06em!important;text-transform:uppercase!important;color:var(--muted)!important;vertical-align:middle!important}
  #${id} .tbbq-bp__prole{margin:3px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12px!important;line-height:1.4!important}
  #${id} .tbbq-bp__pmore{display:inline-flex!important;align-items:center!important;gap:3px!important;margin-top:4px!important;font-size:11px!important;font-weight:600!important;letter-spacing:.04em!important;color:var(--track)!important}
  #${id} .tbbq-bp__chev{transition:transform .18s ease}
  #${id} .tbbq-bp__chev[data-open]{transform:rotate(180deg)}
  #${id} .tbbq-bp__pbio{margin:6px 0 0!important;padding:0!important;color:rgba(255,255,255,.7)!important;font-size:12px!important;line-height:1.5!important}

  @media(max-width:1100px){#${id} .tbbq-bp__grid{grid-template-columns:repeat(3,1fr)!important}}
  @media(max-width:820px){#${id} .tbbq-bp__grid{grid-template-columns:repeat(2,1fr)!important}}
  /* THE PHONE LAYOUT. One timeline column, chosen from the select; the pill row of columns is
     hidden because five of them wrap into a block taller than the schedule. The DAY pills stay:
     there are only two and they are the thing people switch most. */
  @media(max-width:760px){
    #${id}{--gutter:60px;padding-left:10px!important;padding-right:10px!important}
    #${id} .tbbq-bp__pickWrap{max-width:100%!important;gap:6px!important}
    #${id} .tbbq-bp__pickLabel{font-size:10px!important}
    #${id} .tbbq-bp__sections{gap:4px 16px!important}
    #${id} .tbbq-bp__sections button{font-size:22px!important}
    #${id} .tbbq-bp__tracks{display:none!important}
    #${id} .tbbq-bp__pickWrap{display:${isTimeline ? "flex" : "none"}!important}
    /* Two classes so this outranks the rule above it, whatever the source order. */
    #${id} .tbbq-bp__pickWrap.tbbq-bp__pickWrap--off{display:none!important}
    #${id} .tbbq-bp__colhead{font-size:15px!important;min-height:0!important}
    #${id} .tbbq-bp__grid{grid-template-columns:1fr!important}
  }
  @media(max-width:560px){
    #${id}{${transparent ? "" : "padding:20px 16px!important;border-radius:16px!important;"}}
    /* 95% of the screen, capped in height, scrolling only downwards. */
    #${id} .tbbq-bp__modal{width:95%!important;max-width:95%!important;padding:20px!important;max-height:92vh!important}
    #${id} .tbbq-bp__overlay{padding:3vh 0!important}
    #${id} .tbbq-bp__days button{padding:8px 16px!important}
  }
</style>

<script>
(function(){
  var root=document.getElementById("${id}");
  if(!root)return;
${originDecl("  ")}
  var ENDPOINT=ORIGIN+"${path}";
  var outEl=root.querySelector(".tbbq-bp__out");
  var pillsEl=root.querySelector(".tbbq-bp__tracks");
  var daysEl=root.querySelector(".tbbq-bp__days");
  var searchEl=root.querySelector(".tbbq-bp__searchInput");
  var suggEl=root.querySelector(".tbbq-bp__sugg");
  var hintEl=root.querySelector(".tbbq-bp__searchHint");
  var clearEl=root.querySelector(".tbbq-bp__searchClear");
  /* The live query, split into terms. Held OUTSIDE the render, because render() replaces the
     whole board with innerHTML and the search box is a sibling of it — the input keeps focus
     and the caret while you type. */
  var TERMS=[];
  /* Chosen topic tags, at most three — the three a session can carry. ANY, not ALL: the tags
     are mostly disjoint, so requiring all of them returns nothing the moment a second chip is
     on, which reads as a broken filter. */
  var TAGS=[];
  var tagsEl=root.querySelector(".tbbq-bp__tags");
  var tagRowEl=root.querySelector(".tbbq-bp__tagRow");
  var tagHintEl=root.querySelector(".tbbq-bp__tagHint");
  var pickWrap=root.querySelector(".tbbq-bp__pickWrap");
  var pickEl=root.querySelector(".tbbq-bp__pick");
  var overlay=root.querySelector(".tbbq-bp__overlay");
  var modal=root.querySelector(".tbbq-bp__modal");

  var IS_ALL=${isAll ? "true" : "false"};
  var SECTIONS=${JSON.stringify(BRELLA_SECTIONS)};
  var COLS_BY_SECTION=${JSON.stringify(columnsBySection)};
  var PROGRAMMES=${JSON.stringify(programmesByColumn)};
  var GROUPS={};              /* section -> sessions, only used in "all" mode */
  var SECTION=${JSON.stringify(isAll ? "stages" : effectiveSection)};
  var IS_TL=${isAll ? "true" : isTimeline ? "true" : "false"};
  /* One column to spare, so the two days sit side by side instead of behind a switcher. Only a
     single-stage snippet does this; the five-stage board already spends its width on stages. */
  var SPLIT_DAYS=${single ? "true" : "false"};
  var COLDEFS=${JSON.stringify(isAll ? columnsBySection["stages"] : columns)};
  var STYLES=${JSON.stringify(TRACK_STYLES)};
  var SECTION_COLORS=${JSON.stringify(SECTION_COLORS)};
  var ICONS=${JSON.stringify(STAGE_ICON_PATHS)};
  var HOST_ICON=${JSON.stringify(HOST_ICON_PATHS)};
  /* Breathwork breaks: violet, badged, and explained once above the board. They are the
     shortest sessions on the programme and so the smallest cards, which is the opposite of
     how important they are — see lib/brellaTheme.ts. */
  var BREATH_RX=new RegExp(${JSON.stringify(BREATHWORK_RE)},"i");
  var BREATH_COLOR=${JSON.stringify(BREATHWORK_COLOR)};
  var BREATH_LABEL=${JSON.stringify(BREATHWORK_LABEL)};
  var BREATH_ICON=${JSON.stringify(BREATHWORK_ICON_PATHS)};
  var OPEN_RX=new RegExp(${JSON.stringify(OPENING_RE)},"i");
  var OPEN_LABEL=${JSON.stringify(OPENING_LABEL)};
  var OPEN_ICON=${JSON.stringify(OPENING_ICON_PATHS)};
  var EVENT_DAYS=${JSON.stringify(EVENT_DAYS)};
  var EVENT_YEAR=${EVENT_YEAR};
  var PX=${PX_PER_MIN},SLOT=${SLOT_MIN},MINCARD=${MIN_CARD_PX};
  var BREATH_MIN=${BREATH_MIN_PX},BREATH_CLEAR=${BREATH_CLEARANCE_PX};
  /* Morning-to-evening, from lib/brellaSections.ts so the feed's own rule and this one cannot
     drift apart. */
  var MORNING_BY=${MORNING_BY_MIN},EVENING_FROM=${EVENING_FROM_MIN};

  /* Rebuilt here because a RegExp cannot survive JSON. */
  function compile(defs){return (defs||[]).map(function(c){return {label:c.label,rx:new RegExp(c.re,"i")};});}
  var COLS=compile(COLDEFS);
  var STYLE_RX=STYLES.map(function(t){return {rx:new RegExp(t.re,"i"),color:t.color,color2:t.color2};});

  var ALL=[],col="",dayIdx=0,sideDay="",lastFocus=null,narrow=false,prevBodyOverflow="";

  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  /* Only an absolute http(s) URL becomes a live src — never a javascript: or data: URL from
     upstream data. Brella photo URLs are plain public https links. */
  function safeUrl(u){var s=String(u==null?"":u).trim();return /^https?:\\/\\//i.test(s)?s:"";}
  /* HTTPS ONLY, unlike safeUrl. This goes into an <img src> on techbbq.dk, and an http image
     would downgrade a secure page to a mixed-content warning. The server already guarantees it
     (lib/eventPages.ts); this is the second gate, because a snippet pasted on someone else's
     site cannot be corrected afterwards. */
  function imgSrc(u){var s=String(u==null?"":u).trim();return /^https:\\/\\//i.test(s)?s:"";}
  /* alt="" on purpose: the title sits right beside it in text, so a screen reader would read
     the event twice. onerror drops the figure rather than leaving a broken-image glyph -- these
     are third-party CDNs and a partner can unpublish their page at any time.

     &#39; RATHER THAN AN APOSTROPHE. The handler lives inside a single-quoted JS string, and a
     raw quote closed it early -- the generated snippet died with "Unexpected identifier 'none'"
     and only in the browser, since nothing here typechecks a string. The browser decodes the
     entity when it parses the attribute, so the handler still receives 'none'. */
  function thumb(s){var u=imgSrc(s&&s.image);return u?'<figure class="tbbq-bp__thumb"><img src="'+esc(u)+'" alt="" loading="lazy" decoding="async" onerror="this.parentNode.style.display=&#39;none&#39;"></figure>':"";}
  function styleOf(room){for(var i=0;i<STYLE_RX.length;i++){if(STYLE_RX[i].rx.test(room||""))return STYLE_RX[i];}return {color:"${DEFAULT_TRACK_COLOR}"};}
  function trackVars(room){var t=styleOf(room);return "--track:"+t.color+(t.color2?";--track2:"+t.color2:"");}
  /* A SESSION's accent. Side Events must go through this: their room is the hosting partner
     ("Rockstart", "Google"), which matches no track rule and would take the orange default
     instead of the red these are supposed to be. */
  function sessionVars(s){
    /* Breathwork wins over both: the whole point of the violet is that it is NOT the colour of
       whichever stage happens to host the break. */
    if(isBreath(s))return "--track:"+BREATH_COLOR;
    var sc=s&&s.section?SECTION_COLORS[s.section]:null;
    return sc?("--track:"+sc):trackVars(s&&s.room);
  }
  /* Matched on the NAME: Brella leaves these sessions' type blank, and their track is a stage. */
  function isBreath(s){return BREATH_RX.test(s&&s.name||"");}
  function breathIcon(px){
    return '<svg class="tbbq-bp__bicon" viewBox="0 0 24 24" width="'+px+'" height="'+px+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +BREATH_ICON.map(function(d){return '<path d="'+d+'"/>';}).join("")+'</svg>';
  }
  /* The word as well as the mark. A colour on its own is a code the visitor has to learn, and a
     colour-blind visitor never learns it. */
  function breathBadge(){return '<span class="tbbq-bp__breath">'+breathIcon(12)+esc(BREATH_LABEL)+'</span>';}
  /* An opening keeps its STAGE's colour, so unlike isBreath() there is no sessionVars branch
     for it — the absence of an override is the feature. Breathwork is excluded so a session can
     never carry both marks. */
  function isOpen(s){var n=s&&s.name||"";return OPEN_RX.test(n)&&!BREATH_RX.test(n);}
  function openIcon(px){
    return '<svg class="tbbq-bp__breathIcon" viewBox="0 0 24 24" width="'+px+'" height="'+px+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +OPEN_ICON.map(function(d){return '<path d="'+d+'"/>';}).join("")+'</svg>';
  }
  /* Its own class, because .tbbq-bp__breath hard-codes the violet. This one reads var(--track),
     which is the stage's colour on an opening card. */
  function openBadge(){return '<span class="tbbq-bp__open">'+openIcon(12)+esc(OPEN_LABEL)+'</span>';}
  /* NO LEGEND ABOVE THE BOARD. There was one, naming the violet and counting the breaks; Auri cut
     it on 2026-08-05. The card says "Breathwork Break" on itself, which is what the legend stood
     in for while the card was too small to hold a word. */
  function hostIcon(){
    return '<svg class="tbbq-bp__icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +HOST_ICON.map(function(d){return '<path d="'+d+'"/>';}).join("")+'</svg>';
  }
  /* A stage or an event room is a PLACE, so it gets a pin. A side event's "room" is the
     hosting partner — Airtable has no venue field for these at all — and a pin beside a
     company name claims something untrue. */
  function venueLine(s){
    if(s.section!=="side")return s.room?('<p class="tbbq-bp__room">'+PIN+esc(s.room)+'</p>'):"";
    /* Two lines for a side event, because they answer different questions: who runs it, and
       where it is. The venue is read off the partner's Luma page and is absent for the private
       events and the non-Luma ticketing, so the pin line only appears when it is real. */
    return (s.room?('<p class="tbbq-bp__room">'+hostIcon()+esc("Hosted by "+s.room)+'</p>'):"")
      +(s.location?('<p class="tbbq-bp__room">'+PIN+esc(s.location)+'</p>'):"");
  }
  function columnOf(room){for(var i=0;i<COLS.length;i++){if(COLS[i].rx.test(room||""))return COLS[i].label;}return null;}
  function iconFor(label){
    var p=ICONS[label];if(!p)return "";
    return '<svg class="tbbq-bp__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +p.map(function(d){return '<path d="'+d+'"/>';}).join("")+'</svg>';
  }
  function dayNum(d){var m=/^Day\\s+(\\d+)/i.exec(d||"");return m?+m[1]:99;}
  /* "All day" and anything unparseable sort last within their day rather than to 00:00. */
  function mins(t){var m=/(\\d{1,2}):(\\d{2})/.exec(t||"");return m?(+m[1])*60+(+m[2]):1441;}
  function slot(t){
    var m=/(\\d{1,2}):(\\d{2})\\s*[-\\u2013\\u2014]\\s*(\\d{1,2}):(\\d{2})/.exec(t||"");
    if(!m)return null;
    var a=(+m[1])*60+(+m[2]),b=(+m[3])*60+(+m[4]);
    if(b<=a)b=a+30;
    return {start:a,end:b};
  }
  function hhmm(x){
    var h=Math.floor(x/60),m=x%60,ap=h<12?"AM":"PM",h12=(h%12)===0?12:(h%12);
    return (h12<10?"0":"")+h12+":"+(m<10?"0":"")+m+" "+ap;
  }
  function firstWords(t,n){
    var w=String(t||"").trim().split(/\\s+/);
    return w.length<=n?String(t||"").trim():w.slice(0,n).join(" ")+"\\u2026";
  }
  /* ── SPEAKER SEARCH ── Same rules as the dashboard, in plain ES5 for a pasted snippet.
     Accents stripped so "Jose" finds "Jose\u0301"; every term must hit, so adding a word
     narrows; the session NAME is not searched, or "opening" lights ten unrelated cards. */
  /* ESCAPING: this runs inside a template literal, so a regex needs its backslashes DOUBLED.
     Written singly it reaches the browser stripped: \s becomes a bare "s" and the query split
     on the letter instead of on whitespace. That shipped here, so the embed's search tokenised
     differently from the dashboard's until 2026-08-10. Line 670 had it right all along. */
  function norm(v){
    return String(v==null?"":v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  }
  function toTerms(q){var t=norm(q).split(/\\s+/),o=[],i;for(i=0;i<t.length;i++)if(t[i])o.push(t[i]);return o;}
  function hayOf(s){
    var sp=s&&s.speakers||[],i,out=[];
    for(i=0;i<sp.length;i++)out.push((sp[i].name||"")+" "+(sp[i].company||"")+" "+(sp[i].title||""));
    return norm(out.join(" "));
  }
  function matchesTags(s){
    if(!TAGS.length)return true;
    var own=(s&&s.tags)||[],i;
    for(i=0;i<TAGS.length;i++)if(own.indexOf(TAGS[i])>=0)return true;
    return false;
  }
  function matchesQ(s){
    if(!TERMS.length)return true;
    var h=hayOf(s),i;
    for(i=0;i<TERMS.length;i++)if(h.indexOf(TERMS[i])<0)return false;
    return true;
  }
  /* Predicted PEOPLE. Keyed on the NAME: Brella issues a fresh speaker id per session, so one
     person on three panels arrives as three records and would suggest three identical rows. */
  function speakerHits(){
    if(!TERMS.length)return [];
    var by={},order=[],i,j;
    for(i=0;i<ALL.length;i++){
      var s=ALL[i],sp=s.speakers||[];
      for(j=0;j<sp.length;j++){
        var p=sp[j];if(!p.name)continue;
        var h=norm((p.name||"")+" "+(p.company||"")+" "+(p.title||"")),k,ok=true;
        for(k=0;k<TERMS.length;k++)if(h.indexOf(TERMS[k])<0){ok=false;break;}
        if(!ok)continue;
        var hit=by[p.name];
        if(!hit){hit=by[p.name]={name:p.name,role:[p.title,p.company].filter(Boolean).join(", "),photo:safeUrl(p.photo),days:[],stages:[],count:0};order.push(p.name);}
        hit.count++;
        if(hit.days.indexOf(s.day)<0)hit.days.push(s.day);
        var col=colLabel(s.room);
        if(col&&hit.stages.indexOf(col)<0)hit.stages.push(col);
        if(!hit.photo&&p.photo)hit.photo=safeUrl(p.photo);
      }
    }
    var out=order.map(function(n){return by[n];});
    /* A name STARTING with what was typed first: "and" should offer Anders before someone
       whose company merely contains it. */
    out.sort(function(a,b){
      var pa=norm(a.name).indexOf(TERMS[0])===0?0:1,pb=norm(b.name).indexOf(TERMS[0])===0?0:1;
      return pa-pb||String(a.name).localeCompare(String(b.name));
    });
    return out.slice(0,6);
  }
  /* The timeline column a session sits in, or its room when the section is not a timeline. */
  function colLabel(room){
    if(!IS_TL||!COLS.length)return room||"";
    for(var i=0;i<COLS.length;i++)if(COLS[i].rx.test(room||""))return COLS[i].label;
    return room||"";
  }

  function isMod(p){return /moderator/i.test(p&&p.role||"");}
  function ordered(sp){return (sp||[]).slice().sort(function(a,b){return (isMod(a)?1:0)-(isMod(b)?1:0);});}
  /* cls lets the same builder emit the inline row (list cards, dialog) and the pinned stack on
     a timeline card, which needs its own class to be positioned. */
  function faces(sp,n,cls){
    var all=ordered(sp),o=all.slice(0,n);if(!o.length)return "";
    /* SHOW THE MODERATOR. ordered() puts them last, so on a two-face stack the chair was
       invisible on most panels and the ring below marked nothing. One speaker plus the chair is
       what the card is trying to say; the +N chip still carries everyone who did not fit. */
    var mods=all.filter(isMod);
    if(mods.length&&n>1&&!o.some(isMod)){
      o=all.filter(function(p){return !isMod(p);}).slice(0,n-1).concat([mods[0]]);
    }
    var rest=all.length-o.length;
    /* The chip is emitted FIRST because the stack is drawn row-reverse, which puts it at the
       far right — after the faces, reading left to right. */
    return '<span class="tbbq-bp__faces'+(cls?' '+cls:'')+'">'
      +(rest>0?'<span class="tbbq-bp__face tbbq-bp__face--more">+'+rest+'</span>':'')
      +o.map(function(p){
      var ph=safeUrl(p.photo);
      /* data-mod rings the chair; the title says it in words for anyone who cannot see a ring. */
      var md=isMod(p)?' data-mod="1" title="'+esc(p.name||"")+' \u2014 moderator"':' title="'+esc(p.name||"")+'"';
      return ph?'<img class="tbbq-bp__face"'+md+' src="'+esc(ph)+'" alt="" loading="lazy">'
        :'<span class="tbbq-bp__face"'+md+'>'+esc(String(p.name||"?").trim().charAt(0).toUpperCase())+'</span>';
    }).join("")+'</span>';
  }
  function summary(sp){
    if(!sp||!sp.length)return "";
    var mods=sp.filter(isMod).length,talk=sp.length-mods,out=[];
    if(talk)out.push(talk+" speaker"+(talk===1?"":"s"));
    if(mods)out.push(mods+" moderator"+(mods===1?"":"s"));
    return out.join(" \\u00b7 ");
  }
  /* Airtable's "Event type" has only Public / Private (invite only), so it cannot tell an
     invitation from an approval queue; the Luma pages behind the private ones show "Request to
     Join · Approval Required", and one uses Google RSVP where the mechanism is unknown. This
     copy covers both and claims neither — either way a visitor cannot just turn up. */
  var PRIVATE_NOTE="Private event · you need an invitation or the host's approval to attend";
  function hasDetail(s){return (s.speakers&&s.speakers.length)||String(s.description||"").length>150||Boolean(safeUrl(s.registerUrl));}
  /* A side event whose partner has not filled in a time shows its DATE instead of "Time TBC":
     the date is real information a visitor can plan around, the placeholder is not. Only the
     Side Events carry dateLabel, so every other section is unaffected. */
  function timeLabel(s){return s.timeSlot||s.dateLabel||"Time TBC";}
  var PIN='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';
  var CHEV='<svg class="tbbq-bp__chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  /* TechBBQ's day numbering, serialized from EVENT_DAYS so the snippet cannot drift from the
     dashboard. Brella's own "Day N" counts whichever dates exist in the feed and shifts when
     one is deleted, so it is never shown. */
  function dayLabel(d){
    d=String(d||"");
    var known=null;
    for(var i=0;i<EVENT_DAYS.length;i++){if(d.indexOf(EVENT_DAYS[i].date)>=0){known=EVENT_DAYS[i];break;}}
    var m=/(\\d+)\\s+(\\w{3})/.exec(d);
    var date=m?(m[1]+" "+m[2].toUpperCase()):d.toUpperCase();
    return known?(known.label+", "+date):date;
  }
  /* Brella's day string carries no year, and a weekday needs one. */
  function weekday(d){
    var m=/(\\d{1,2})\\s+([A-Za-z]+)/.exec(String(d||""));
    if(!m)return String(d||"").toUpperCase();
    var mo=new Date(m[2]+" 1, "+EVENT_YEAR).getMonth();
    var dt=new Date(EVENT_YEAR,mo,+m[1]);
    var wd=dt.toLocaleDateString("en-GB",{weekday:"short"}).toUpperCase();
    return wd+"|"+m[1]+" "+m[2].slice(0,3).toUpperCase();
  }
  /* Day 2 once it is actually the 27th. Computed on every call, never captured once. */
  function defaultDay(){
    var n=new Date(),d=EVENT_DAYS[1];
    if(!d||!d.monthDay)return 0;
    return (n.getMonth()===d.monthDay[0]&&n.getDate()>=d.monthDay[1])?1:0;
  }

  /* ── TIMELINE ── */
  function renderTimeline(){
    var date=EVENT_DAYS[dayIdx]?EVENT_DAYS[dayIdx].date:"";
    /* SPLIT DAYS. A single-stage embed has one column to spare, so the two days go side by side
       instead of behind a day switcher — Day 1 left, Day 2 right, one shared time gutter, which
       is how a two-day programme is read (Auri, 2026-08-04). Not on a phone: two columns in
       360px is the unreadability the five-stage board already avoids, so there the day pills come
       back and it shows one day at a time. */
    var SPLIT=SPLIT_DAYS&&!narrow;
    var cols,colKey;
    if(SPLIT){
      cols=EVENT_DAYS.map(function(d){return d.label;});
      colKey=function(s){
        for(var i=0;i<EVENT_DAYS.length;i++){
          if(String(s.day||"").indexOf(EVENT_DAYS[i].date)>=0)return EVENT_DAYS[i].label;
        }
        return null;
      };
    } else {
      cols=col?[col]:COLS.map(function(c){return c.label;});
      /* One column on a phone: five in 360px is unreadable. */
      if(narrow&&cols.length>1)cols=[cols[0]];
      colKey=function(s){return columnOf(s.room)||s.room;};
    }
    var STAGE=COLS.length?COLS[0].label:"";
    var mine=ALL.filter(function(s){
      /* In split mode the COLUMN is the day, so the stage is what narrows the list — there is
         exactly one column in a single-stage snippet, which is the only mode that splits. */
      if(SPLIT)return columnOf(s.room)===STAGE && colKey(s)!==null;
      return String(s.day||"").indexOf(date)>=0 && cols.indexOf(colKey(s))>=0;
    });

    var timed=[],allday=[];
    mine.forEach(function(s){var t=slot(s.timeSlot);if(t){timed.push({s:s,start:t.start,end:t.end});}else{allday.push(s);}});

    /* A phone keeps the same type size in a column a third as wide, so titles wrap onto more
       lines and were being cut off by a card whose height comes from its DURATION. Stretching
       the minute scale gives that text somewhere to go, and leaves room to label every half
       hour instead of every hour, which a phone has space for once the rows are this tall. */
    var PXN=narrow?4.2:PX;
    /* START WHERE THE PROGRAMME STARTS. This used to floor at 09:00, which drew nearly two hours
       of empty grid above a stage that opens at 10:45 — that reads as a broken embed, not as a
       free morning (Auri, 2026-08-04). 09:00 survives only as the fallback for a column with
       nothing timed in it, so it still has a sane height. */
    var start=null,end=null;
    timed.forEach(function(x){
      if(start===null||x.start<start)start=x.start;
      if(end===null||x.end>end)end=x.end;
    });
    if(start===null){start=9*60;end=start+60;}
    /* EVENT ROOMS OPEN AT 09:00 REGARDLESS. Their first session is 09:25-09:30, so the board
       began flush against it and the whole-day band's label sat behind the first card. Half an
       hour of grid above gives the label somewhere to be and shows the 09:00 gridline. Min, not
       a replacement, so a room that ever starts at 08:30 still shows 08:30 — and stages keep
       starting at whatever is on first, which is the 2026-08-04 rule. */
    if(SECTION==="rooms"&&start>9*60)start=9*60;
    if(end-start<60)end=start+60;
    var from=Math.floor(start/SLOT)*SLOT,to=Math.ceil(end/SLOT)*SLOT;
    var height=(to-from)*PXN;

    var ticks=[];for(var t=from;t<=to;t+=SLOT)ticks.push(t);

    var html="";
    /* The all-day strip that used to sit here is gone. An all-day session now SPANS ITS COLUMN
       (see the per-column block below): a room booked open-to-close is a different fact from a
       room with gaps in it, and a chip in a strip said neither. */
    /* Written inline, not left to the stylesheet. On techbbq.dk the timeline collapsed to
       block flow — the gutter ran the full width with its times pinned right, and every card
       positioned against the BODY instead of its column, so they all drew full width on top of
       each other. Inline styles cannot be lost the way a stylesheet rule can, and they also
       avoid depending on the --cols custom property surviving the paste. */
    var GUT=narrow?60:74;
    /* Breathing room either side of every card, so one column's card does not run up against
       its neighbour (Auri, 2026-08-04). Declared HERE rather than inside the per-card loop:
       the all-day card in the column loop needs it too, and a var inside a callback is not
       visible to its caller. (No backticks in this file — it is one JS template literal.) Tighter on a phone, where there is one column and the width is
       all text. */
    var INSET=narrow?6:12;
    var N=cols.length;
    /* One column's width, and the left edge of column i, as calc() so they still track a
       fluid container. 4px of side padding inside each column stands in for the grid gap. */
    var CW='calc((100% - '+GUT+'px) / '+N+')';
    function CL(i){return 'calc('+GUT+'px + '+i+' * ((100% - '+GUT+'px) / '+N+'))';}
    var HEADH=narrow?46:58;
    html+='<div class="tbbq-bp__tl" style="--cols:'+N+'">'
      +'<div class="tbbq-bp__head" style="position:relative;display:block;height:'+HEADH+'px">'
      +cols.map(function(c,i){
        var vars=SPLIT?trackVars(STAGE):trackVars(c);
        /* A day column has no track name to draw an icon from, so it prints the day and its date;
           the date is inline-styled rather than classed because a theme cannot lose an inline
           style (the same reasoning as the geometry below). */
        var inner=SPLIT
          ? '<span>'+esc(c)+'</span><span style="opacity:.62;font-weight:500;font-size:12px;margin-left:7px">'+esc((EVENT_DAYS[i]||{}).date||"")+'</span>'
          : iconFor(c)+'<span>'+esc(c)+'</span>';
        /* The heading row is the one part of the board always on screen — the timeline is tall
           and scrolls sideways on a phone — so a match far down a column you are not looking at
           is otherwise invisible. */
        var hits=0;
        var filtering=TERMS.length||TAGS.length;
        if(filtering)for(var hi=0;hi<timed.length;hi++)if(colKey(timed[hi].s)===c&&matchesQ(timed[hi].s)&&matchesTags(timed[hi].s))hits++;
        var hAttr=(hits>0?' data-hasmatch="1"':(filtering?' data-dim="1"':''));
        /* "Event Room 2" is a place and says nothing on its own; "NISS · NASS" is what a
           visitor is looking for. Empty on the stages, which are named after their programme. */
        /* Only on a single-column board (Auri, 2026-08-06). Across six columns the sub-labels
           were six lines of small print competing with the room numbers. */
        /* What is ACTUALLY in the column, not every programme registered to the room: Event
           Room 2 is registered to NISS and NASS, but NASS has no track in Brella and no
           sessions. Falls back to the registration only when the column is empty — the one case
           where the registration is all there is to say. */
        var prog=null;
        if(cols.length===1){
          var here=mine.filter(function(x){return colKey(x)===c;});
          var live=[];
          here.forEach(function(x){if(x.programme&&live.indexOf(x.programme)<0)live.push(x.programme);});
          prog=live.length?live:(here.length?null:PROGRAMMES[c]);
        }
        return '<span class="tbbq-bp__colhead"'+hAttr+' style="position:absolute;top:0;height:'+HEADH+'px;left:'+CL(i)+';width:'+CW+';'+vars+'">'+inner
          +(hits>0?'<span class="tbbq-bp__badge">'+hits+'</span>':'')
          +(prog?'<span class="tbbq-bp__colprog">'+esc(prog.join(" \u00b7 "))+'</span>':'')
          +'</span>';
      }).join("")
      +'</div>'
      +'<div class="tbbq-bp__body" style="position:relative;display:block;height:'+height+'px">'
      +'<div class="tbbq-bp__gutter" style="position:absolute;left:0;top:0;width:'+GUT+'px;height:100%">'
      +ticks.map(function(x){var onHour=(x%60===0);
        return '<span class="tbbq-bp__tick"'+(onHour?' data-hour="1"':'')+' style="position:absolute;right:8px;top:'+((x-from)*PXN)+'px">'+((onHour||narrow)?hhmm(x):"")+'</span>';}).join("")
      +'</div>'
      +ticks.map(function(x){return '<span class="tbbq-bp__line"'+((x%60===0)?' data-hour="1"':'')+' style="position:absolute;left:'+GUT+'px;right:0;top:'+((x-from)*PXN)+'px"></span>';}).join("");

    cols.forEach(function(c,ci){
      var items=timed.filter(function(x){return colKey(x.s)===c;})
        .sort(function(a,b){return a.start-b.start||String(a.s.name).localeCompare(String(b.s.name));});
      /* No padding on the column: the cards inside are absolutely positioned, and an
         abs-positioned child resolves left/width against the PADDING box — padding included —
         so padding here moves nothing. The inset is applied to each card below instead. */
      html+='<div class="tbbq-bp__col" style="position:absolute;top:0;height:100%;left:'+CL(ci)+';width:'+CW+';box-sizing:border-box">';
      /* Behind the timed cards (z-index 0 against their 1+), because the two are NESTED: a room
         runs its sessions inside its all-day booking. A lane beside them would halve every card
         on the column and say the opposite. */
      /* A PROGRAMME THAT RUNS THE WHOLE DAY with no umbrella session to say so. NISS occupies
         Event Room 2 from 09:30 to 17:30 — it has taken the room for the day as surely as Board
         Summit has taken Room 1 — but Brella has only its eleven sessions. So the band is
         derived from the programme plus the span of its own sessions, and the sessions draw
         inside it. Skipped when a real all-day row already says it, and not a button: there is
         no session behind it to open. */
      var mineC=timed.filter(function(x){return colKey(x.s)===c;});
      var adC=allday.filter(function(x){return colKey(x)===c;});
      var prog2=[];
      mineC.forEach(function(x){if(x.s.programme&&prog2.indexOf(x.s.programme)<0)prog2.push(x.s.programme);});
      if(prog2.length&&!adC.length&&mineC.length>1){
        var lo=Math.min.apply(null,mineC.map(function(x){return x.start;}));
        var hi=Math.max.apply(null,mineC.map(function(x){return x.end;}));
        if(lo<=MORNING_BY&&hi>=EVENING_FROM){
          html+='<div class="tbbq-bp__allDay tbbq-bp__allDayProg" aria-hidden="true"'
            +' style="position:absolute;left:'+INSET+'px;right:'+INSET+'px;top:0;height:'+height+'px;z-index:0;pointer-events:none;'+trackVars(c)+'">'
            +'<span class="tbbq-bp__allDayLabel">All day</span>'
            +'<span class="tbbq-bp__allDayTitle">'+esc(prog2.join(" \u00b7 "))+'</span>'
            +'</div>';
        }
      }
      adC.forEach(function(s){
        html+='<button type="button" class="tbbq-bp__allDay" data-id="'+esc(s.id)+'"'
          +' style="position:absolute;left:'+INSET+'px;right:'+INSET+'px;top:0;height:'+height+'px;z-index:0;'+sessionVars(s)+'"'
          +' title="'+esc(s.name)+'">'
          +'<span class="tbbq-bp__allDayLabel">All day</span>'
          +'<span class="tbbq-bp__allDayTitle">'+esc(s.name)+'</span>'
          +'</button>';
      });
      /* Near the top rather than vertically centred: the column is as tall as the whole day,
         so a centred label sits below the fold on a stage with nothing on it. Placed inline
         because place-items does nothing once a theme blockifies the grid. */
      if(!items.length)html+='<p class="tbbq-bp__none" style="position:absolute;left:0;right:0;top:14px;text-align:center;margin:0">'+(SPLIT?"Nothing on this day":(/^event room/i.test(c)?"Information coming soon":(/campfire/i.test(c)?"Program coming soon":"Nothing scheduled")))+'</p>';
      /* Lanes per CLUSTER of overlapping sessions, compared on the DRAWN extent: a 5-minute
         slot is floored to a minimum height and so covers the next card even though the clock
         says it has finished. Counting per column would halve every card on the stage. */
      var laneEnds=[],cluster=[],clusterEnd=-1e9,placed=[];
      function flush(){var n=Math.max(1,laneEnds.length);cluster.forEach(function(p){p.lanes=n;});placed=placed.concat(cluster);cluster=[];laneEnds=[];clusterEnd=-1e9;}
      items.forEach(function(x){
        /* Lanes are decided on the SCHEDULED end, not the drawn one. Padding the end so a
           floored-height card could not cover the next one meant a 3-minute Breathwork Break
           counted as a clash and was banished to a half-width side lane, when what it should
           do is sit in sequence at full width. A few pixels of overlap below its text is the
           better trade. */
        var drawnEnd=x.end;
        if(x.start>=clusterEnd)flush();
        var lane=-1;
        for(var i=0;i<laneEnds.length;i++){if(laneEnds[i]<=x.start){lane=i;break;}}
        if(lane<0){lane=laneEnds.length;laneEnds.push(drawnEnd);}else{laneEnds[lane]=drawnEnd;}
        if(drawnEnd>clusterEnd)clusterEnd=drawnEnd;
        cluster.push({x:x,lane:lane,lanes:1});
      });
      flush();

      /* GEOMETRY FIRST, MARKUP SECOND, because the cards have to know about each other. A
         breathwork break is floored to 24px over a 9px slot and drawn in front, so it lands on
         the heading of the talk that starts the minute it ends. Measure that overlap here and the
         covered card can start its text below the break instead of behind it.
         Only a break covering another card's TOP is cleared: padding cannot clear a card's
         middle, and no break in the schedule sits anywhere but between two sessions. */
      var geo=placed.map(function(p){
        var s=p.x.s,breath=isBreath(s),opening=isOpen(s),band=breath||opening;
        /* band drives the GEOMETRY, breath/opening only the look: a 5-minute opening is
           floored over a slot that does not pay for it, exactly like a 3-minute break.
           (No backticks anywhere in this file — it is all one JS template literal.) */
        return {
          p:p,s:s,breath:breath,opening:opening,band:band,
          top:(p.x.start-from)*PXN,
          h:band?Math.max(BREATH_MIN,(p.x.end-p.x.start)*PXN)
                :Math.max(MINCARD,(p.x.end-p.x.start)*PXN-4),
          pad:0
        };
      });
      geo.forEach(function(band){
        if(!band.band)return;
        var bl=band.p.lane/band.p.lanes,br=(band.p.lane+1)/band.p.lanes,bBot=band.top+band.h;
        geo.forEach(function(o){
          if(o===band||o.band)return;
          var ol=o.p.lane/o.p.lanes,or=(o.p.lane+1)/o.p.lanes;
          if(bl>=or||ol>=br)return;               /* side by side, never touching */
          if(band.top>o.top||bBot<=o.top)return;  /* does not cover its top edge */
          o.pad=Math.max(o.pad,bBot-o.top+BREATH_CLEAR);
        });
      });

      geo.forEach(function(g){
        var s=g.s,p=g.p,h=g.h,breath=g.breath,opening=g.opening;
        /* The padding costs the card room, so it counts against what the card can show:
           otherwise a cleared card claims space for a time it has no room to print. */
        var usable=h-g.pad;
        var compact=usable<46;
        /* The old data-tight tier meant "room for the title and time but not the faces". The
           faces are pinned to the card's edge now and the names are gone entirely, so it had
           nothing left to hide and was removed. (No backticks in this file — template literal.) */
        /* Breathing room either side of every card, so one column's card does not run up
           against its neighbour (Auri, 2026-08-04). These columns are adjacent boxes with no
           channel of their own, so 12px a side gives the ~24px between cards that the dashboard
           gets from 8px plus its 8px grid gap — the preview and the pasted embed have to match.
           Tighter on a phone, where there is one column and the width is all text. */
        /* INSET is hoisted above the column loop — see the declaration near GUT. It used to be
           declared here, which is inside the per-card callback, so the all-day card in the
           column loop could not see it and threw a ReferenceError that killed the whole
           column's markup. */
        var st="position:absolute;top:"+g.top+"px;height:"+h+"px;left:calc("+((p.lane*100)/p.lanes)+"% + "+INSET+"px);width:calc("+(100/p.lanes)+"% - "+(INSET*2)+"px);"+sessionVars(s)
          /* ALWAYS in front: every card around a break is drawn taller than its own slot, so
             without this the break is behind one and in front of the next. */
          +(g.band?";z-index:3":"")
          /* !important on an INLINE style, which looks wrong and is not: this snippet's own
             stylesheet sets "padding:6px 8px!important" on every card (and 3px on a compact one)
             to survive an arbitrary WordPress theme, and a plain inline value loses to an
             important declaration. Without this the clearance is silently dropped and the
             heading goes back under the break. */
          +(g.pad?";padding-top:"+g.pad+"px!important":"");
        /* The mark goes INSIDE the title rather than on a row of its own: a break's card is 24px
           and a second row would push the title out of the box it has. */
        var bAttr=(breath?' data-breathwork="1"':'')+(opening?' data-opening="1"':'')
          /* Dimmed, never removed: pulling the card would collapse the column and the clock
             would stop lining up across stages. tabindex -1 so keyboard focus skips the faded
             ones instead of walking through forty of them. */
          +((TERMS.length&&!matchesQ(s))||!matchesTags(s)?' data-dim="1" tabindex="-1"':'');
        /* The face stack is OUTSIDE the who-row and always rendered, so a compact or tight card
           still shows who is on it — those two hide the who-row, and they cover most of the
           board. data-faces tells the title to leave room for it. */
        var stack=faces(s.speakers,2,"tbbq-bp__evFaces");
        if(stack)bAttr+=' data-faces="1"';
        var inner='<span class="tbbq-bp__evTitle">'+(breath?breathIcon(12):'')+(opening?openIcon(12):'')+esc(firstWords(s.name,5))+'</span>'
          +'<span class="tbbq-bp__evTime">'+esc(s.timeSlot||"")+'</span>'
          +stack;
        html+=hasDetail(s)
          ? '<button type="button" class="tbbq-bp__ev" data-id="'+esc(s.id)+'"'+(compact?' data-compact="1"':'')+bAttr+' title="'+esc(s.name)+'" style="'+st+'">'+inner+'</button>'
          : '<div class="tbbq-bp__ev"'+(compact?' data-compact="1"':'')+bAttr+' title="'+esc(s.name)+'" style="'+st+'">'+inner+'</div>';
      });
      html+='</div>';
    });
    html+='</div></div>';
    outEl.innerHTML=html;
  }

  /* ── CARD LIST ── */
  function renderList(){
    var list=ALL;
    if(SECTION==="side"&&sideDay)list=list.filter(function(s){return s.day===sideDay;});
    else if(col)list=list.filter(function(s){return s.room===col;});
    if(!list.length){outEl.innerHTML='<p class="tbbq-bp__empty">Nothing scheduled here yet.</p>';return;}
    var byDay={},order=[];
    list.forEach(function(s){if(!byDay[s.day]){byDay[s.day]=[];order.push(s.day);}byDay[s.day].push(s);});
    order.sort(function(a,b){return dayNum(a)-dayNum(b);});
    outEl.innerHTML=order.map(function(d){
      var rows=byDay[d].slice().sort(function(a,b){return mins(a.timeSlot)-mins(b.timeSlot)||String(a.name).localeCompare(String(b.name));});
      return '<h3 class="tbbq-bp__daylabel">'+esc(dayLabel(d))+'</h3><div class="tbbq-bp__grid">'
        +rows.map(function(s){
          var sum=summary(s.speakers);
          /* Above the title, where a kicker goes: it says what KIND of thing this is, which is
             the question the violet is asking the visitor to notice. */
          var inner=thumb(s)+'<p class="tbbq-bp__time">'+esc(timeLabel(s))+'</p>'
            +(isBreath(s)?breathBadge():'')
      +(isOpen(s)?openBadge():'')
            +'<p class="tbbq-bp__title">'+esc(s.name)+'</p>'
            +venueLine(s)
            +(s.description?'<p class="tbbq-bp__desc">'+esc(s.description)+'</p>':'')
            +(sum?'<p class="tbbq-bp__count">'+esc(sum)+'</p>':'')
            /* Last line on the card: it is a caveat, not a headline. */
            +(s.access==="private-invite"?'<p class="tbbq-bp__note">'+esc(PRIVATE_NOTE)+'</p>':'');
          var st=' style="'+sessionVars(s)+'"'+((TERMS.length&&!matchesQ(s))||!matchesTags(s)?' data-dim="1"':'');
          /* No Register button on the preview (Auri, 2026-08-04): a pill on every card turned
             this section into a wall of buttons, and someone should read what an event is
             before signing up. The sign-up page lives in the dialog, and hasDetail() counts a
             registerUrl so every side event can be opened. */
          return hasDetail(s)
            ? '<button type="button" class="tbbq-bp__card" data-id="'+esc(s.id)+'"'+st+'>'+inner+'</button>'
            : '<div class="tbbq-bp__card"'+st+'>'+inner+'</div>';
        }).join("")+'</div>';
    }).join("");
  }

  /* Restoring the scroll position only works if the page is still tall enough to hold it.
     Side Events is a fraction of the height of the timeline, so switching to it from
     mid-page let the browser clamp scrollTop and the view jumped ~200px despite the anchor.
     The output keeps a floor equal to the TALLEST section seen; it only grows, so it cannot
     oscillate. Measured from the children, because reading the container after the floor is
     applied would just return the floor. */
  var floor=0;
  function applyFloor(){
    var total=0;
    for(var i=0;i<outEl.children.length;i++)total+=outEl.children[i].getBoundingClientRect().height;
    if(total>floor)floor=Math.ceil(total);
    if(floor)outEl.style.minHeight=floor+"px";
  }
  /* Day tabs are rebuilt only when the SECTION changes, so the badges are painted onto the
     existing buttons rather than by re-rendering them — re-rendering would drop the badge the
     moment anything else re-rendered. */
  function paintDayBadges(){
    var btns=daysEl.querySelectorAll("button[data-d]"),i;
    for(i=0;i<btns.length;i++){
      var b=btns[i],di=Number(b.getAttribute("data-d"));
      var old=b.querySelector(".tbbq-bp__badge");
      if(old)old.parentNode.removeChild(old);
      b.removeAttribute("data-hasmatch");
      if(!TERMS.length||di===dayIdx)continue;
      var date=(EVENT_DAYS[di]||{}).date||"",n=0,k;
      for(k=0;k<ALL.length;k++){
        var s=ALL[k];
        /* ALL already holds only the active section, so there is nothing more to narrow by. */
        if(String(s.day).indexOf(date)>=0&&matchesQ(s))n++;
      }
      /* Only the tab you are NOT on lights up — the whole point is "they are over here". */
      if(n>0){
        b.setAttribute("data-hasmatch","1");
        var sp=document.createElement("span");
        sp.className="tbbq-bp__badge";sp.textContent=String(n);
        b.appendChild(sp);
      }
    }
  }

  function renderSuggestions(){
    var hits=speakerHits(),q=(searchEl.value||"").trim();
    /* Hidden once the box holds exactly the one suggestion's name: the visitor has chosen, and
       a list repeating that back just covers the board. */
    var only1=hits.length===1&&hits[0].name.toLowerCase()===q.toLowerCase();
    if(!q||!hits.length||only1){suggEl.hidden=true;suggEl.innerHTML="";return;}
    suggEl.hidden=false;
    suggEl.innerHTML=hits.map(function(h){
      var face=h.photo
        ? '<img class="tbbq-bp__suggFace" src="'+esc(h.photo)+'" alt="" loading="lazy">'
        : '<span class="tbbq-bp__suggFace">'+esc(String(h.name).trim().charAt(0).toUpperCase())+'</span>';
      var where=h.days.map(function(d){return String(dayLabel(d)).split(",")[0];}).join(" + ");
      var stage=h.stages.length===1?h.stages[0]:(h.stages.length>1?h.stages.length+" stages":"");
      return '<li><button type="button" class="tbbq-bp__suggRow" data-name="'+esc(h.name)+'" data-days="'+esc(h.days.join("|"))+'">'
        +face
        +'<span class="tbbq-bp__suggText"><span class="tbbq-bp__suggName">'+esc(h.name)+'</span>'
        +(h.role?'<span class="tbbq-bp__suggRole">'+esc(h.role)+'</span>':'')+'</span>'
        +'<span class="tbbq-bp__suggWhere">'+esc(where)
        +(stage?'<span class="tbbq-bp__suggStage">'+esc(stage)+'</span>':'')+'</span>'
        +'</button></li>';
    }).join("");
  }

  function paintHint(){
    var q=(searchEl.value||"").trim();
    clearEl.hidden=!q;
    if(!q){hintEl.textContent="Type a name to spotlight that speaker's sessions";return;}
    var n=0,i;
    for(i=0;i<ALL.length;i++){
      var s=ALL[i];
      if(!matchesQ(s))continue;
      if(IS_TL&&!SPLIT_DAYS){var date=(EVENT_DAYS[dayIdx]||{}).date||"";if(String(s.day).indexOf(date)<0)continue;}
      n++;
    }
    hintEl.textContent=n>0
      ? n+" session"+(n===1?"":"s")+" here \u00b7 everything else dimmed"
      : "Nothing on this day \u2014 the highlighted tab has them";
  }

  /* The tags actually present on what is showing, with counts — never a fixed vocabulary. A
     chip for a topic that is not on today is a dead end, and Brella's tag list is edited
     without warning. Rooms only: a stage is a named programme and the tag adds little. */
  function renderTags(){
    if(!tagsEl)return;
    if(SECTION!=="rooms"){tagsEl.hidden=true;tagRowEl.innerHTML="";TAGS=[];return;}
    var date=(EVENT_DAYS[dayIdx]||{}).date||"",counts={},order=[],i,j;
    for(i=0;i<ALL.length;i++){
      var s=ALL[i];
      if(IS_TL&&!SPLIT_DAYS&&String(s.day||"").indexOf(date)<0)continue;
      /* columnOf, not colKey: colKey is a local of renderTimeline and invisible here. Reaching
         for it threw a ReferenceError that aborted the pill handler before render() ran, so
         choosing a room appeared to do nothing at all. */
      if(col&&(columnOf(s.room)||s.room)!==col)continue;
      var tg=s.tags||[];
      for(j=0;j<tg.length;j++){if(!counts[tg[j]]){counts[tg[j]]=0;order.push(tg[j]);}counts[tg[j]]++;}
    }
    if(!order.length){tagsEl.hidden=true;tagRowEl.innerHTML="";return;}
    order.sort(function(a,b){return counts[b]-counts[a]||a.localeCompare(b);});
    var full=TAGS.length>=3;
    tagsEl.hidden=false;
    tagRowEl.innerHTML=order.map(function(t){
      var on=TAGS.indexOf(t)>=0;
      /* Disabled only once three are on AND this is not one of them, so the cap can never stop
         you turning a chosen tag back off. */
      return '<button type="button" class="tbbq-bp__tag" data-t="'+esc(t)+'" aria-pressed="'+on+'"'
        +((!on&&full)?' disabled':'')+'>'+esc(t)+'<span class="tbbq-bp__tagN">'+counts[t]+'</span></button>';
    }).join("")+(TAGS.length?'<button type="button" class="tbbq-bp__tagClear">Clear</button>':'');
    tagHintEl.textContent=!TAGS.length
      ? "Filter by topic \u00b7 pick up to three"
      : (full?"Three topics is the maximum \u00b7 everything else is dimmed"
             :TAGS.length+" of 3 topics \u00b7 everything else is dimmed");
  }
  if(tagRowEl){
    tagRowEl.addEventListener("click",function(e){
      var c=e.target&&e.target.closest?e.target.closest(".tbbq-bp__tagClear"):null;
      if(c){TAGS=[];renderTags();render();return;}
      var b=e.target&&e.target.closest?e.target.closest(".tbbq-bp__tag"):null;
      if(!b||b.disabled)return;
      var t=b.getAttribute("data-t"),i=TAGS.indexOf(t);
      if(i>=0)TAGS.splice(i,1); else if(TAGS.length<3)TAGS.push(t);
      renderTags(); render();
    });
  }

  function onSearch(){
    TERMS=toTerms(searchEl.value);
    renderSuggestions();
    render();
    paintDayBadges();
    paintHint();
  }

  if(searchEl){
    searchEl.addEventListener("input",onSearch);
    clearEl.addEventListener("click",function(){searchEl.value="";onSearch();searchEl.focus();});
    /* Delegated, because the rows are rebuilt on every keystroke. Picking a person SWITCHES THE
       DAY when none of their sessions are on the one showing: choosing a name and being handed
       an empty board is the outcome this list exists to prevent. */
    suggEl.addEventListener("click",function(e){
      var row=e.target&&e.target.closest?e.target.closest(".tbbq-bp__suggRow"):null;
      if(!row)return;
      searchEl.value=row.getAttribute("data-name")||"";
      var days=(row.getAttribute("data-days")||"").split("|");
      if(IS_TL&&!(SPLIT_DAYS&&!narrow)){
        var here=(EVENT_DAYS[dayIdx]||{}).date||"",onThisDay=false,i;
        for(i=0;i<days.length;i++)if(here&&days[i].indexOf(here)>=0)onThisDay=true;
        if(!onThisDay){
          for(i=0;i<EVENT_DAYS.length;i++){
            var d=EVENT_DAYS[i].date,found=false,j;
            for(j=0;j<days.length;j++)if(days[j].indexOf(d)>=0)found=true;
            if(found){
              dayIdx=i;
              /* Same bookkeeping the day-pill click handler does, so the tab visibly follows. */
              Array.prototype.forEach.call(daysEl.children,function(x){
                x.setAttribute("aria-selected",String(Number(x.getAttribute("data-d"))===dayIdx));
              });
              break;
            }
          }
        }
      }
      onSearch();
    });
  }

  function render(){ if(IS_TL)renderTimeline(); else renderList(); applyFloor(); paintDayBadges(); }

  /* Switch section without refetching: "all" mode already holds every group. The masthead is
     the anchor — its distance from the top of the viewport is measured before the swap and
     restored after, so pressing a section never moves what you are looking at. */
  function setSection(key){
    var bar=root.querySelector(".tbbq-bp__sections");
    var before=bar?bar.getBoundingClientRect().top:null;
    SECTION=key;
    ALL=GROUPS[key]||[];
    COLS=compile(COLS_BY_SECTION[key]);
    TAGS=[];
    IS_TL=COLS.length>0;
    col="";sideDay="";
    buildSectionControls();
    syncNarrow();
    render();
    if(before!=null&&bar){
      var delta=bar.getBoundingClientRect().top-before;
      if(delta)window.scrollBy(0,delta);
    }
  }

  /* ── DIALOG ── */
  function byId(id){for(var i=0;i<ALL.length;i++){if(String(ALL[i].id)===String(id))return ALL[i];}return null;}
  function openModal(s){
    if(!s)return;
    lastFocus=document.activeElement;
    modal.setAttribute("style",sessionVars(s));
    /* Brella's location often repeats the track name verbatim, so it is only appended when it
       says something new. */
    var meta=[s.room,s.location!==s.room?s.location:""].filter(Boolean).join(" \\u00b7 ");
    var stageIcon=iconFor(columnOf(s.room)||"")||PIN;
    var people=ordered(s.speakers).map(function(p,i){
      var ph=safeUrl(p.photo);
      var img=ph?'<img class="tbbq-bp__photo" src="'+esc(ph)+'" alt="" loading="lazy">'
        :'<span class="tbbq-bp__photo" aria-hidden="true">'+esc(String(p.name||"?").trim().charAt(0).toUpperCase())+'</span>';
      var head='<span class="tbbq-bp__pname">'+esc(p.name)+(p.role?'<span class="tbbq-bp__ptag">'+esc(p.role)+'</span>':'')+'</span>'
        +((p.title||p.company)?'<span class="tbbq-bp__prole">'+esc([p.title,p.company].filter(Boolean).join(" \\u00b7 "))+'</span>':'');
      /* The bio is behind a press: several Brella bios run a full screen each and six stacked
         bury the session's own description. */
      var body=p.bio
        ? '<button type="button" class="tbbq-bp__ptoggle" data-bio="'+i+'" aria-expanded="false">'+head
          +'<span class="tbbq-bp__pmore">Read bio'+CHEV+'</span></button>'
          +'<p class="tbbq-bp__pbio" data-biobody="'+i+'" hidden>'+esc(p.bio)+'</p>'
        : '<div>'+head+'</div>';
      return '<li class="tbbq-bp__person">'+img+'<div>'+body+'</div></li>';
    }).join("");
    modal.innerHTML='<button type="button" class="tbbq-bp__close" aria-label="Close">'
      +'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
      +thumb(s)
      +'<p class="tbbq-bp__time">'+esc(timeLabel(s))+'</p>'
      +(isBreath(s)?breathBadge():'')
      +(isOpen(s)?openBadge():'')
      +'<h2>'+esc(s.name)+'</h2>'
      +'<p class="tbbq-bp__meta">'+(s.section==="side"?hostIcon():stageIcon)+esc(s.section==="side"?[("Hosted by "+s.room),s.location].filter(Boolean).join(" · "):meta)+(s.type?'<span class="tbbq-bp__topic">'+esc(s.type)+'</span>':'')+'</p>'
      +(s.description?'<div class="tbbq-bp__body">'+String(s.description).split("\\n").filter(Boolean).map(function(p){return '<p>'+esc(p)+'</p>';}).join("")+'</div>':'')
      /* Above the speaker list on purpose: whoever opened a side event came to sign up, and a
         CTA below six bios is off the bottom of a phone screen. */
      +(safeUrl(s.registerUrl)?'<p class="tbbq-bp__cta"><a href="'+esc(safeUrl(s.registerUrl))+'" target="_blank" rel="noopener noreferrer">Register for this event</a></p>':'')
      +(s.access==="private-invite"?'<p class="tbbq-bp__note">'+esc(PRIVATE_NOTE)+'</p>':'')
      +(people?'<h3>'+esc(summary(s.speakers)||"Speakers")+'</h3><ul class="tbbq-bp__people">'+people+'</ul>':'');
    overlay.hidden=false;
    /* Lock the page behind. Without this a scroll gesture over the dialog moves the article
       underneath instead, which reads as the dialog being cut off at the bottom. */
    prevBodyOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    modal.scrollTop=0;
    modal.querySelector(".tbbq-bp__close").focus();
  }
  function closeModal(){
    overlay.hidden=true;
    document.body.style.overflow=prevBodyOverflow;
    /* Send focus back where it came from, or a keyboard user is dumped at the top of the
       document every time they close a session. */
    if(lastFocus&&lastFocus.focus)lastFocus.focus();
  }

  outEl.addEventListener("click",function(e){
    var b=e.target.closest?e.target.closest("[data-id]"):null;
    if(b)openModal(byId(b.getAttribute("data-id")));
  });
  overlay.addEventListener("click",function(e){if(e.target===overlay)closeModal();});
  modal.addEventListener("click",function(e){
    if(e.target.closest(".tbbq-bp__close")){closeModal();return;}
    var t=e.target.closest?e.target.closest("[data-bio]"):null;
    if(!t)return;
    var body=modal.querySelector('[data-biobody="'+t.getAttribute("data-bio")+'"]');
    if(!body)return;
    var open=body.hasAttribute("hidden");
    if(open)body.removeAttribute("hidden");else body.setAttribute("hidden","");
    t.setAttribute("aria-expanded",String(open));
    var more=t.querySelector(".tbbq-bp__pmore");
    if(more)more.childNodes[0].nodeValue=open?"Hide bio":"Read bio";
    var chev=t.querySelector(".tbbq-bp__chev");
    if(chev){if(open)chev.setAttribute("data-open","1");else chev.removeAttribute("data-open");}
  });
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!overlay.hidden)closeModal();});

  /* Below 760px the timeline shows one column, so a column must be CHOSEN. Re-rendering on
     the breakpoint keeps the two layouts in step when the phone is rotated. */
  function syncNarrow(){
    var was=narrow;
    narrow=window.matchMedia("(max-width:760px)").matches;
    if(IS_TL&&narrow&&!col)col=COLS.length?COLS[0].label:"";
    if(pickEl)pickEl.value=col;
    if(was!==narrow){
      /* In split mode the controls themselves change across the breakpoint — day pills on a
         phone, none on a wide screen — so rebuild them, not just the schedule. */
      if(SPLIT_DAYS)buildSectionControls();
      render();
    }
  }

  /* The phone picker mirrors whatever the pill row holds for the CURRENT section. It used to
     be filled only for the timeline sections, so switching to Event Rooms left an empty box
     still labelled "Stage" — and since the pills are hidden on a phone, there was then no way
     to filter rooms at all. Side Events is filtered by DAY, so it gets no picker. */
  function fillPicker(label, allLabel, items){
    var wrap=root.querySelector(".tbbq-bp__pickWrap");
    var lbl=root.querySelector(".tbbq-bp__pickLabel");
    if(!pickEl||!wrap)return;
    if(!items||!items.length){wrap.classList.add("tbbq-bp__pickWrap--off");pickEl.innerHTML="";return;}
    wrap.classList.remove("tbbq-bp__pickWrap--off");
    if(lbl)lbl.textContent=label;
    pickEl.innerHTML='<option value="">'+esc(allLabel)+'</option>'
      +items.map(function(t){return '<option value="'+esc(t)+'">'+esc(t)+'</option>';}).join("");
    pickEl.value=col;
  }

  function buildSectionControls(){
    pillsEl.innerHTML="";daysEl.innerHTML="";if(pickEl)pickEl.innerHTML="";
    if(IS_TL){
      /* ONE COLUMN NEEDS NO FILTER. A single-stage embed would otherwise show "All stages" next
         to the one stage it contains, and a phone picker with one option — a menu of one is
         noise. Both containers hide themselves when empty (the :empty rule on .tbbq-bp__tracks
         and the --off class on the picker), so leaving them unbuilt is all it takes. The DAY
         pills stay: a single stage still runs on two days. */
      if(COLS.length>1){
        pillsEl.innerHTML='<button type="button" role="tab" aria-selected="true" data-t="">'
          +(SECTION==="grills"?"All Grill Sessions":SECTION==="rooms"?"All rooms":"All stages")+'</button>'
          +COLS.map(function(c){return '<button type="button" role="tab" aria-selected="false" data-t="'+esc(c.label)+'">'+esc(c.label)+'</button>';}).join("");
        fillPicker(SECTION==="grills"?"Grill":SECTION==="rooms"?"Room":"Stage",
                   SECTION==="grills"?"All Grill Sessions":SECTION==="rooms"?"All rooms":"All stages",
                   COLS.map(function(c){return c.label;}));
      } else {
        fillPicker("Stage","",[]);
      }
      /* Both days are already columns in split mode, so a day switcher would switch nothing.
         On a phone split mode is off and these come back. */
      daysEl.innerHTML=(SPLIT_DAYS&&!narrow)?"":EVENT_DAYS.map(function(d,i){
        return '<button type="button" role="tab" aria-selected="'+(i===dayIdx)+'" data-d="'+i+'">'
          +'<span class="tbbq-bp__dnum">'+esc(d.label)+'</span>'
          +'<span class="tbbq-bp__ddate">'+esc(d.date)+'</span></button>';
      }).join("");
    } else if(SECTION==="side"){
      /* One track and three dates, so a track filter would filter nothing; the day chips are
         the control here and the picker is hidden. */
      fillPicker("Day","",[]);
      var seen=[];
      ALL.forEach(function(s){if(s.day&&seen.indexOf(s.day)<0)seen.push(s.day);});
      seen.sort(function(a,b){return dayNum(a)-dayNum(b);});
      /* Opens on ALL so the section reads as one list running down the page, like the track
         filters elsewhere (Auri, 2026-08-04). renderList already treats an empty sideDay as
         "every day", grouped under its own day heading. */
      sideDay="";
      daysEl.innerHTML='<button type="button" role="tab" aria-selected="true" data-sd="">'
          +'<span class="tbbq-bp__dnum">ALL</span>'
          +'<span class="tbbq-bp__ddate">'+esc(ALL.length+" events")+'</span></button>'
        +seen.map(function(d){
        var w=weekday(d).split("|");
        return '<button type="button" role="tab" aria-selected="false" data-sd="'+esc(d)+'">'
          +'<span class="tbbq-bp__dnum">'+esc(w[0])+'</span>'
          +'<span class="tbbq-bp__ddate">'+esc(w[1]||"")+'</span></button>';
      }).join("");
    } else {
      var rooms=[];
      ALL.forEach(function(s){if(s.room&&rooms.indexOf(s.room)<0)rooms.push(s.room);});
      rooms.sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
      pillsEl.innerHTML='<button type="button" role="tab" aria-selected="true" data-t="">All</button>'
        +rooms.map(function(t){return '<button type="button" role="tab" aria-selected="false" data-t="'+esc(t)+'">'+esc(t)+'</button>';}).join("");
      fillPicker("Room","All rooms",rooms);
    }

    /* Listeners are attached ONCE, outside this function: it re-runs on every section
       switch, and re-adding them each time would fire the handler N times per click. */
  }

  function wireControls(){
    pillsEl.addEventListener("click",function(e){
      var b=e.target.closest?e.target.closest("button[data-t]"):null;
      if(!b)return;
      col=b.getAttribute("data-t");
      Array.prototype.forEach.call(pillsEl.children,function(x){x.setAttribute("aria-selected",String(x===b));});
      renderTags();
      if(pickEl)pickEl.value=col;
      render();
    });
    daysEl.addEventListener("click",function(e){
      var b=e.target.closest?e.target.closest("button[data-d],button[data-sd]"):null;
      if(!b)return;
      if(b.hasAttribute("data-d"))dayIdx=+b.getAttribute("data-d");
      else sideDay=b.getAttribute("data-sd");
      Array.prototype.forEach.call(daysEl.children,function(x){x.setAttribute("aria-selected",String(x===b));});
      /* The chips list what is on TODAY, so a day change rebuilds them. */
      renderTags();
      render();
    });
    if(pickEl)pickEl.addEventListener("change",function(){
      col=pickEl.value;
      Array.prototype.forEach.call(pillsEl.children,function(x){x.setAttribute("aria-selected",String(x.getAttribute("data-t")===col));});
      render();
    });
    var secEl=root.querySelector(".tbbq-bp__sections");
    if(secEl)secEl.addEventListener("click",function(e){
      var b=e.target.closest?e.target.closest("button[data-s]"):null;
      if(!b||b.disabled)return;
      Array.prototype.forEach.call(secEl.children,function(x){x.setAttribute("aria-selected",String(x===b));});
      setSection(b.getAttribute("data-s"));
    });
  }

  /* r.ok matters: a 429 or 502 still returns JSON with no list in it, which without this check
     reads as "no sessions" rather than "could not load". */
  fetch(ENDPOINT).then(function(r){
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(data){
    if(IS_ALL){
      /* One request, every group. The SECTION RULES stayed on the server: this snippet never
         decides what belongs where, so a track renamed in Brella cannot strand a pasted copy. */
      GROUPS=(data&&data.groups)||{};
      var secEl=root.querySelector(".tbbq-bp__sections");
      secEl.innerHTML=SECTIONS.map(function(x,i){
        var n=(GROUPS[x.key]||[]).length;
        return '<button type="button" role="tab" data-s="'+esc(x.key)+'" aria-selected="'+(i===0)+'"'+(n?'':' disabled')+'>'+esc(x.label)+'</button>';
      }).join("");
      ALL=GROUPS[SECTION]||[];
    } else {
      ALL=(data&&data.sessions)||[];
    }
    if(!ALL.length&&!IS_ALL){outEl.innerHTML='<p class="tbbq-bp__empty">No sessions to show yet.</p>';return;}
    dayIdx=defaultDay();
    buildSectionControls();
    wireControls();
    syncNarrow();
    render();
    renderTags();
    /* The resting hint. Without this the line is blank until the first keystroke, so the box
       looks like it might not do anything. */
    paintHint();
    var t;window.addEventListener("resize",function(){clearTimeout(t);t=setTimeout(syncNarrow,150);});
  }).catch(function(err){
    outEl.innerHTML='<p class="tbbq-bp__empty">Could not load the program.</p>';
    if(window.console)console.error("[tbbq brella embed]",err);
  });
})();
</script>`;
}
