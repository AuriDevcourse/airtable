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

import {
  BRELLA_SECTIONS,
  EVENT_DAYS,
  EVENT_YEAR,
  TIMELINE_COLUMNS,
  type BrellaSection,
} from "@/lib/brellaSections";
import {
  DEFAULT_TRACK_COLOR,
  STAGE_ICON_PATHS,
  TRACK_STYLES,
} from "@/lib/brellaTheme";

export type BrellaEmbedOptions = {
  /** A single section, or "all" for the whole program with its own section switcher. */
  section: BrellaSection | "all";
  uid?: string;
  // Drop the panel's own background + padding, for a page that already provides them.
  transparent?: boolean;
};

// Vertical scale, shared with the dashboard: 30 minutes = 90px. It was 72px until the live
// page showed 18 of 41 cards clipping their own text — a real column on techbbq.dk is ~270px
// wide, narrower than any local preview, so titles wrap onto two lines far more often while a
// card's height still comes from its duration.
const PX_PER_MIN = 3;
const SLOT_MIN = 30;
const MIN_CARD_PX = 26;

export function buildBrellaEmbedSnippet({
  section,
  uid,
  transparent = true,
}: BrellaEmbedOptions): string {
  const id = uid || "tbbq-brella";
  const path = `/api/program?event=brella&section=${section}`;
  const isAll = section === "all";
  // Every section's columns travel, keyed by section, because in "all" mode the visitor can
  // switch between them without another request. RegExp cannot be JSON.stringify'd, so the
  // source travels as a string and the snippet rebuilds it. Same list the dashboard uses, so
  // the two cannot disagree about which track belongs in which column.
  const serialiseCols = (defs?: { label: string; match: RegExp }[]) =>
    (defs ?? []).map((c) => ({ label: c.label, re: c.match.source }));
  const columnsBySection: Record<string, { label: string; re: string }[]> = {};
  for (const { key } of BRELLA_SECTIONS) columnsBySection[key] = serialiseCols(TIMELINE_COLUMNS[key]);
  const columnDefs = isAll ? undefined : TIMELINE_COLUMNS[section as BrellaSection];
  const isTimeline = isAll || Boolean(columnDefs);
  const columns = serialiseCols(columnDefs);

  return `<!-- TechBBQ program (Brella${isTimeline ? " · timeline" : ""}) — paste into an Elementor HTML widget -->
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<div id="${id}" class="tbbq-bp">
  <div class="tbbq-bp__sections" role="tablist" aria-label="Program section"></div>
  <div class="tbbq-bp__controls">
    <div class="tbbq-bp__tracks" role="tablist" aria-label="Filter"></div>
    <label class="tbbq-bp__pickWrap">
      <span class="tbbq-bp__pickLabel">Stage</span>
      <select class="tbbq-bp__pick" aria-label="Choose a column"></select>
    </label>
    <div class="tbbq-bp__days" role="tablist" aria-label="Day"></div>
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
  #${id} .tbbq-bp__allday{display:flex!important;align-items:center!important;gap:12px!important;margin:0 0 12px!important;padding:8px 10px!important;border:1px solid var(--border)!important;border-radius:10px!important}
  #${id} .tbbq-bp__alldayLabel{flex:none!important;font-size:11px!important;letter-spacing:.1em!important;text-transform:uppercase!important;color:var(--muted)!important}
  #${id} .tbbq-bp__alldayList{display:flex!important;flex-wrap:wrap!important;gap:6px!important}
  #${id} .tbbq-bp__chip{appearance:none!important;border:0!important;border-left:3px solid var(--track)!important;background:var(--card)!important;color:var(--fg)!important;padding:5px 9px!important;border-radius:4px!important;font-size:12px!important;cursor:pointer!important;text-align:left!important}

  /* NO CSS GRID HERE. On techbbq.dk the theme blockified the grid container — the timeline
     collapsed, the gutter ran the full width and every card drew on top of the next. The
     columns are ABSOLUTELY POSITIONED instead, with their geometry written inline by the
     script: an absolutely positioned box ignores the parent's display entirely, so there is
     nothing left for a theme to override. */
  #${id} .tbbq-bp__head,#${id} .tbbq-bp__body{display:block!important;position:relative!important;margin:0!important;padding:0!important}
  #${id} .tbbq-bp__colhead{display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:46px!important;padding:8px 6px!important;margin:0!important;border-left:1px solid var(--border)!important;text-align:center!important;font-family:var(--head)!important;font-size:17px!important;font-weight:600!important;line-height:1.25!important;color:var(--fg)!important;overflow-wrap:anywhere!important}
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
  #${id} .tbbq-bp__evTitle{flex:none!important;margin:0!important;font-family:var(--head)!important;font-size:12.5px!important;font-weight:600!important;line-height:1.25!important;color:#fff!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  #${id} .tbbq-bp__evTime{flex:none!important;margin:0!important;font-size:11px!important;color:var(--muted)!important}
  #${id} .tbbq-bp__evWho{flex:none!important;margin-top:auto!important;display:flex!important;align-items:center!important;gap:5px!important;min-width:0!important;font-size:10.5px!important;color:var(--muted)!important}
  #${id} .tbbq-bp__evNames{min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  #${id} .tbbq-bp__faces{flex:none!important;display:inline-flex!important}
  #${id} .tbbq-bp__face+.tbbq-bp__face{margin-left:-6px!important}
  #${id} .tbbq-bp__face{width:16px!important;height:16px!important;border-radius:9999px!important;object-fit:cover!important;box-shadow:0 0 0 1.5px var(--card)!important;background:var(--card2)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:8px!important;font-weight:700!important;color:var(--muted)!important;line-height:1!important;margin:0!important}
  #${id} .tbbq-bp__ev[data-compact]{padding:3px 8px!important}
  #${id} .tbbq-bp__ev[data-compact] .tbbq-bp__evTitle{-webkit-line-clamp:1;font-size:11.5px!important}
  #${id} .tbbq-bp__ev[data-compact] .tbbq-bp__evTime,#${id} .tbbq-bp__ev[data-compact] .tbbq-bp__evWho{display:none!important}
  /* Short but not tiny: keep the title and the time, drop the faces. */
  #${id} .tbbq-bp__ev[data-tight] .tbbq-bp__evWho{display:none!important}

  /* ── CARD LIST (event rooms, side events) ── */
  #${id} .tbbq-bp__daylabel{margin:26px 0 12px!important;padding:0!important;font-family:var(--head)!important;font-size:12px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--muted)!important}
  #${id} .tbbq-bp__grid{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:14px!important}
  #${id} .tbbq-bp__card{position:relative!important;display:block!important;width:100%!important;text-align:left!important;appearance:none!important;background:var(--card)!important;border:1px solid var(--border)!important;border-radius:12px!important;padding:14px 14px 14px 16px!important;margin:0!important;overflow:hidden!important;font-family:var(--sans)!important;color:var(--fg)!important;box-shadow:none!important;transition:border-color .2s,background .2s}
  #${id} button.tbbq-bp__card{cursor:pointer!important}
  #${id} .tbbq-bp__card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:var(--track)}
  #${id} button.tbbq-bp__card:hover{border-color:var(--track)!important;background:var(--card2)!important}
  #${id} .tbbq-bp__time{margin:0!important;padding:0!important;font-family:var(--head)!important;font-size:11px!important;font-weight:600!important;letter-spacing:.06em!important;color:var(--fg)!important}
  /* In the dialog the time gets the stage's colour as a bar on its left, and enough room on
     its right that the close button is not sitting on top of it. */
  #${id} .tbbq-bp__modal .tbbq-bp__time{border-left:3px solid var(--track)!important;padding:2px 52px 2px 10px!important;font-size:12px!important}
  #${id} .tbbq-bp__title{margin:10px 0 0!important;padding:0!important;font-family:var(--head)!important;font-size:15px!important;font-weight:600!important;line-height:1.3!important;color:#fff!important;text-transform:none!important;letter-spacing:normal!important}
  #${id} .tbbq-bp__room{display:flex!important;align-items:center!important;gap:5px!important;margin:10px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12px!important;line-height:1.4!important}
  #${id} .tbbq-bp__desc{margin:8px 0 0!important;padding:0!important;color:rgba(255,255,255,.72)!important;font-size:12px!important;line-height:1.5!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  #${id} .tbbq-bp__count{margin:10px 0 0!important;padding:0!important;color:var(--track)!important;font-family:var(--head)!important;font-size:11px!important;font-weight:600!important}

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
  #${id} .tbbq-bp__body p{margin:12px 0 0!important;padding:0!important;color:rgba(255,255,255,.8)!important;font-size:14px!important;line-height:1.6!important}
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

  @media(max-width:1100px){#${id} .tbbq-bp__grid{grid-template-columns:repeat(2,1fr)!important}}
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
  var ORIGIN="__ORIGIN__";
  var ENDPOINT=ORIGIN+"${path}";
  var outEl=root.querySelector(".tbbq-bp__out");
  var pillsEl=root.querySelector(".tbbq-bp__tracks");
  var daysEl=root.querySelector(".tbbq-bp__days");
  var pickWrap=root.querySelector(".tbbq-bp__pickWrap");
  var pickEl=root.querySelector(".tbbq-bp__pick");
  var overlay=root.querySelector(".tbbq-bp__overlay");
  var modal=root.querySelector(".tbbq-bp__modal");

  var IS_ALL=${isAll ? "true" : "false"};
  var SECTIONS=${JSON.stringify(BRELLA_SECTIONS)};
  var COLS_BY_SECTION=${JSON.stringify(columnsBySection)};
  var GROUPS={};              /* section -> sessions, only used in "all" mode */
  var SECTION=${JSON.stringify(isAll ? "stages" : section)};
  var IS_TL=${isAll ? "true" : isTimeline ? "true" : "false"};
  var COLDEFS=${JSON.stringify(isAll ? columnsBySection["stages"] : columns)};
  var STYLES=${JSON.stringify(TRACK_STYLES)};
  var ICONS=${JSON.stringify(STAGE_ICON_PATHS)};
  var EVENT_DAYS=${JSON.stringify(EVENT_DAYS)};
  var EVENT_YEAR=${EVENT_YEAR};
  var PX=${PX_PER_MIN},SLOT=${SLOT_MIN},MINCARD=${MIN_CARD_PX};

  /* Rebuilt here because a RegExp cannot survive JSON. */
  function compile(defs){return (defs||[]).map(function(c){return {label:c.label,rx:new RegExp(c.re,"i")};});}
  var COLS=compile(COLDEFS);
  var STYLE_RX=STYLES.map(function(t){return {rx:new RegExp(t.re,"i"),color:t.color,color2:t.color2};});

  var ALL=[],col="",dayIdx=0,sideDay="",lastFocus=null,narrow=false,prevBodyOverflow="";

  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  /* Only an absolute http(s) URL becomes a live src — never a javascript: or data: URL from
     upstream data. Brella photo URLs are plain public https links. */
  function safeUrl(u){var s=String(u==null?"":u).trim();return /^https?:\\/\\//i.test(s)?s:"";}
  function styleOf(room){for(var i=0;i<STYLE_RX.length;i++){if(STYLE_RX[i].rx.test(room||""))return STYLE_RX[i];}return {color:"${DEFAULT_TRACK_COLOR}"};}
  function trackVars(room){var t=styleOf(room);return "--track:"+t.color+(t.color2?";--track2:"+t.color2:"");}
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
  function isMod(p){return /moderator/i.test(p&&p.role||"");}
  function ordered(sp){return (sp||[]).slice().sort(function(a,b){return (isMod(a)?1:0)-(isMod(b)?1:0);});}
  function names(sp,n){
    var o=ordered(sp);if(!o.length)return "";
    var s=o.slice(0,n).map(function(p){return p.name;});
    var rest=o.length-s.length;
    return s.join(", ")+(rest>0?" +"+rest:"");
  }
  function faces(sp,n){
    var o=ordered(sp).slice(0,n);if(!o.length)return "";
    return '<span class="tbbq-bp__faces">'+o.map(function(p){
      var ph=safeUrl(p.photo);
      return ph?'<img class="tbbq-bp__face" src="'+esc(ph)+'" alt="" loading="lazy">'
        :'<span class="tbbq-bp__face">'+esc(String(p.name||"?").trim().charAt(0).toUpperCase())+'</span>';
    }).join("")+'</span>';
  }
  function summary(sp){
    if(!sp||!sp.length)return "";
    var mods=sp.filter(isMod).length,talk=sp.length-mods,out=[];
    if(talk)out.push(talk+" speaker"+(talk===1?"":"s"));
    if(mods)out.push(mods+" moderator"+(mods===1?"":"s"));
    return out.join(" \\u00b7 ");
  }
  function hasDetail(s){return (s.speakers&&s.speakers.length)||String(s.description||"").length>150;}
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
    var cols=col?[col]:COLS.map(function(c){return c.label;});
    /* One column on a phone: five in 360px is unreadable. */
    if(narrow&&cols.length>1)cols=[cols[0]];
    var mine=ALL.filter(function(s){
      return String(s.day||"").indexOf(date)>=0 && cols.indexOf(columnOf(s.room)||s.room)>=0;
    });

    var timed=[],allday=[];
    mine.forEach(function(s){var t=slot(s.timeSlot);if(t){timed.push({s:s,start:t.start,end:t.end});}else{allday.push(s);}});

    /* A phone keeps the same type size in a column a third as wide, so titles wrap onto more
       lines and were being cut off by a card whose height comes from its DURATION. Stretching
       the minute scale gives that text somewhere to go, and leaves room to label every half
       hour instead of every hour, which a phone has space for once the rows are this tall. */
    var PXN=narrow?4.2:PX;
    var start=9*60,end=start+60;
    timed.forEach(function(x){if(x.start<start)start=x.start;if(x.end>end)end=x.end;});
    var from=Math.floor(start/SLOT)*SLOT,to=Math.ceil(end/SLOT)*SLOT;
    var height=(to-from)*PXN;

    var ticks=[];for(var t=from;t<=to;t+=SLOT)ticks.push(t);

    var html="";
    if(allday.length){
      html+='<div class="tbbq-bp__allday"><span class="tbbq-bp__alldayLabel">All day</span><div class="tbbq-bp__alldayList">'
        +allday.map(function(s){return '<button type="button" class="tbbq-bp__chip" data-id="'+esc(s.id)+'" style="'+trackVars(s.room)+'">'+esc(s.name)+'</button>';}).join("")
        +'</div></div>';
    }
    /* Written inline, not left to the stylesheet. On techbbq.dk the timeline collapsed to
       block flow — the gutter ran the full width with its times pinned right, and every card
       positioned against the BODY instead of its column, so they all drew full width on top of
       each other. Inline styles cannot be lost the way a stylesheet rule can, and they also
       avoid depending on the --cols custom property surviving the paste. */
    var GUT=narrow?60:74;
    var N=cols.length;
    /* One column's width, and the left edge of column i, as calc() so they still track a
       fluid container. 4px of side padding inside each column stands in for the grid gap. */
    var CW='calc((100% - '+GUT+'px) / '+N+')';
    function CL(i){return 'calc('+GUT+'px + '+i+' * ((100% - '+GUT+'px) / '+N+'))';}
    var HEADH=narrow?46:58;
    html+='<div class="tbbq-bp__tl" style="--cols:'+N+'">'
      +'<div class="tbbq-bp__head" style="position:relative;display:block;height:'+HEADH+'px">'
      +cols.map(function(c,i){return '<span class="tbbq-bp__colhead" style="position:absolute;top:0;height:'+HEADH+'px;left:'+CL(i)+';width:'+CW+';'+trackVars(c)+'">'+iconFor(c)+'<span>'+esc(c)+'</span></span>';}).join("")
      +'</div>'
      +'<div class="tbbq-bp__body" style="position:relative;display:block;height:'+height+'px">'
      +'<div class="tbbq-bp__gutter" style="position:absolute;left:0;top:0;width:'+GUT+'px;height:100%">'
      +ticks.map(function(x){var onHour=(x%60===0);
        return '<span class="tbbq-bp__tick"'+(onHour?' data-hour="1"':'')+' style="position:absolute;right:8px;top:'+((x-from)*PXN)+'px">'+((onHour||narrow)?hhmm(x):"")+'</span>';}).join("")
      +'</div>'
      +ticks.map(function(x){return '<span class="tbbq-bp__line"'+((x%60===0)?' data-hour="1"':'')+' style="position:absolute;left:'+GUT+'px;right:0;top:'+((x-from)*PXN)+'px"></span>';}).join("");

    cols.forEach(function(c,ci){
      var items=timed.filter(function(x){return (columnOf(x.s.room)||x.s.room)===c;})
        .sort(function(a,b){return a.start-b.start||String(a.s.name).localeCompare(String(b.s.name));});
      html+='<div class="tbbq-bp__col" style="position:absolute;top:0;height:100%;left:'+CL(ci)+';width:'+CW+';box-sizing:border-box;padding:0 4px">';
      /* Near the top rather than vertically centred: the column is as tall as the whole day,
         so a centred label sits below the fold on a stage with nothing on it. Placed inline
         because place-items does nothing once a theme blockifies the grid. */
      if(!items.length)html+='<p class="tbbq-bp__none" style="position:absolute;left:0;right:0;top:14px;text-align:center;margin:0">'+(/campfire/i.test(c)?"Program coming soon":"Nothing scheduled")+'</p>';
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
      placed.forEach(function(p){
        var s=p.x.s;
        var h=Math.max(MINCARD,(p.x.end-p.x.start)*PXN-4);
        var compact=h<46;
        /* Between the two: enough room for the title and the time, not for a row of faces.
           78px is measured, not guessed: two lines of title (32) + the time (14) + the faces
           (16) + padding (12) is what a full card needs. */
        var tight=!compact&&h<78;
        var st="position:absolute;top:"+((p.x.start-from)*PXN)+"px;height:"+h+"px;left:"+((p.lane*100)/p.lanes)+"%;width:"+(100/p.lanes)+"%;"+trackVars(s.room);
        var who=names(s.speakers,2);
        var inner='<span class="tbbq-bp__evTitle">'+esc(firstWords(s.name,5))+'</span>'
          +'<span class="tbbq-bp__evTime">'+esc(s.timeSlot||"")+'</span>'
          +(who?'<span class="tbbq-bp__evWho">'+faces(s.speakers,2)+'<span class="tbbq-bp__evNames">'+esc(who)+'</span></span>':'');
        html+=hasDetail(s)
          ? '<button type="button" class="tbbq-bp__ev" data-id="'+esc(s.id)+'"'+(compact?' data-compact="1"':'')+(tight?' data-tight="1"':'')+' title="'+esc(s.name)+'" style="'+st+'">'+inner+'</button>'
          : '<div class="tbbq-bp__ev"'+(compact?' data-compact="1"':'')+(tight?' data-tight="1"':'')+' title="'+esc(s.name)+'" style="'+st+'">'+inner+'</div>';
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
          var inner='<p class="tbbq-bp__time">'+esc(s.timeSlot||"Time TBC")+'</p>'
            +'<p class="tbbq-bp__title">'+esc(s.name)+'</p>'
            +(s.room?'<p class="tbbq-bp__room">'+PIN+esc(s.room)+'</p>':'')
            +(s.description?'<p class="tbbq-bp__desc">'+esc(s.description)+'</p>':'')
            +(sum?'<p class="tbbq-bp__count">'+esc(sum)+'</p>':'');
          var st=' style="'+trackVars(s.room)+'"';
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
  function render(){ if(IS_TL)renderTimeline(); else renderList(); applyFloor(); }

  /* Switch section without refetching: "all" mode already holds every group. The masthead is
     the anchor — its distance from the top of the viewport is measured before the swap and
     restored after, so pressing a section never moves what you are looking at. */
  function setSection(key){
    var bar=root.querySelector(".tbbq-bp__sections");
    var before=bar?bar.getBoundingClientRect().top:null;
    SECTION=key;
    ALL=GROUPS[key]||[];
    COLS=compile(COLS_BY_SECTION[key]);
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
    modal.setAttribute("style",trackVars(s.room));
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
      +'<p class="tbbq-bp__time">'+esc(s.timeSlot||"Time TBC")+'</p>'
      +'<h2>'+esc(s.name)+'</h2>'
      +'<p class="tbbq-bp__meta">'+stageIcon+esc(meta)+(s.type?'<span class="tbbq-bp__topic">'+esc(s.type)+'</span>':'')+'</p>'
      +(s.description?'<div class="tbbq-bp__body">'+String(s.description).split("\\n").filter(Boolean).map(function(p){return '<p>'+esc(p)+'</p>';}).join("")+'</div>':'')
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
    if(was!==narrow)render();
  }

  function buildSectionControls(){
    pillsEl.innerHTML="";daysEl.innerHTML="";if(pickEl)pickEl.innerHTML="";
    if(IS_TL){
      pillsEl.innerHTML='<button type="button" role="tab" aria-selected="true" data-t="">'
        +(SECTION==="grills"?"All grills":"All stages")+'</button>'
        +COLS.map(function(c){return '<button type="button" role="tab" aria-selected="false" data-t="'+esc(c.label)+'">'+esc(c.label)+'</button>';}).join("");
      pickEl.innerHTML='<option value="">'+(SECTION==="grills"?"All grills":"All stages")+'</option>'
        +COLS.map(function(c){return '<option value="'+esc(c.label)+'">'+esc(c.label)+'</option>';}).join("");
      daysEl.innerHTML=EVENT_DAYS.map(function(d,i){
        return '<button type="button" role="tab" aria-selected="'+(i===dayIdx)+'" data-d="'+i+'">'
          +'<span class="tbbq-bp__dnum">'+esc(d.label)+'</span>'
          +'<span class="tbbq-bp__ddate">'+esc(d.date)+'</span></button>';
      }).join("");
    } else if(SECTION==="side"){
      /* One track and three dates, so a track filter would filter nothing. */
      var seen=[];
      ALL.forEach(function(s){if(s.day&&seen.indexOf(s.day)<0)seen.push(s.day);});
      seen.sort(function(a,b){return dayNum(a)-dayNum(b);});
      if(seen.length)sideDay=seen[0];
      daysEl.innerHTML=seen.map(function(d,i){
        var w=weekday(d).split("|");
        return '<button type="button" role="tab" aria-selected="'+(i===0)+'" data-sd="'+esc(d)+'">'
          +'<span class="tbbq-bp__dnum">'+esc(w[0])+'</span>'
          +'<span class="tbbq-bp__ddate">'+esc(w[1]||"")+'</span></button>';
      }).join("");
    } else {
      var rooms=[];
      ALL.forEach(function(s){if(s.room&&rooms.indexOf(s.room)<0)rooms.push(s.room);});
      rooms.sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
      pillsEl.innerHTML='<button type="button" role="tab" aria-selected="true" data-t="">All</button>'
        +rooms.map(function(t){return '<button type="button" role="tab" aria-selected="false" data-t="'+esc(t)+'">'+esc(t)+'</button>';}).join("");
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
      if(pickEl)pickEl.value=col;
      render();
    });
    daysEl.addEventListener("click",function(e){
      var b=e.target.closest?e.target.closest("button[data-d],button[data-sd]"):null;
      if(!b)return;
      if(b.hasAttribute("data-d"))dayIdx=+b.getAttribute("data-d");
      else sideDay=b.getAttribute("data-sd");
      Array.prototype.forEach.call(daysEl.children,function(x){x.setAttribute("aria-selected",String(x===b));});
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
    var t;window.addEventListener("resize",function(){clearTimeout(t);t=setTimeout(syncNarrow,150);});
  }).catch(function(err){
    outEl.innerHTML='<p class="tbbq-bp__empty">Could not load the program.</p>';
    if(window.console)console.error("[tbbq brella embed]",err);
  });
})();
</script>`;
}
