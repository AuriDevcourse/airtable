import { endpointDecl } from "@/lib/embedOriginGuard";
// Elementor snippet for the program/agenda — the schedule equivalent of
// lib/embedSnippet.ts. Fetches /api/program, renders rows: time · type pill · title.
// Design (Auri, 2026-07-29): glow border around the block, uppercase outlined tags
// (one color per theme, no dim variants), per-type Lucide icons, optional big title
// on the Opening. All styles scoped under the unique id.
// __ORIGIN__ is swapped for the live URL at copy time (see the page's copy button).

export type AgendaOptions = {
  // Unique element id so several embeds can share one WordPress page.
  uid?: string;
  // Which program feed to render, e.g. "/api/program?event=niss". Default = TechBBQ.
  path?: string;
  // Big orange date heading above the list (e.g. "August 26th"). For multi-day
  // programs leave unset — each day from the data gets its own heading instead.
  heading?: string;
  // Small pill note under the heading (e.g. the tickets-only notice).
  note?: string;
  // WHERE IT HAPPENS, beside the date rather than under it (e.g. "Event Room 1 & 2"). Muted and at
  // a third of the date's size, because a room is an answer to "where do I go", not a headline —
  // painting it with the same gradient would give it equal weight to the day itself.
  sub?: string;
  // Color theme. "orange" = the TechBBQ fire look (default, used by NISS/TechBBQ).
  // "blue" = the Future of Fintech look (blue border/tags on #111827).
  // "navy" = the Board Summit look: a deeper blue ground with a blue gradient.
  // "gold" = the Day 0 look: the fire gradient on a SOLID near-black, from the designed pages.
  // "beam" = the same, on Investor Day's blue-black ground.
  // "crimson" = NASS 2026: one flat #FF0028 instead of the fire gradient.
  // "amber" = AWS x NVIDIA: #f8991d highlights on a true black ground.
  theme?: "orange" | "blue" | "navy" | "gold" | "beam" | "crimson" | "amber";
  // Per-type Lucide icons in the titles. Default true; the Fintech design omits them.
  icons?: boolean;
  // Oversized title on Session Type = "Opening". Default true (the NISS look);
  // Fintech wants every title the same size, so it passes false.
  bigOpening?: boolean;
  // Show WHO IS ON STAGE under each session: the moderator first, then the speakers, each with their
  // face when the feed has one. Off by default, and that default is now the sharp edge here rather
  // than a safe choice: the dashboard renders `onStage` for EVERY event unconditionally, so any
  // programme that gains a line-up shows it on /program while its copied embed silently drops it.
  // NISS sat that way until 2026-08-17 (8 people on the page, none in the snippet).
  //
  // SO: when a programme starts naming people, set `people: true` on it in app/program/page.tsx.
  // Leaving it off on a feed that carries no `onStage` at all is still free — `people()` renders
  // nothing and the markup is unchanged.
  people?: boolean;
  // THE PARTNER'S OWN PROGRAMME DOCUMENT, as a link above the list. For an agenda that also exists
  // as a designed PDF the host sends out: the Board Summit's run of show, Creative Business Cup's
  // programme overview.
  //
  // ONE LINK PER EMBED, NOT ONE PER SESSION. The same document answers all fourteen rows, so a copy
  // under each one is the same sentence printed fourteen times — and on a page where every row
  // already carries a time, a tag and up to four faces, it is the line that gets skipped. Above the
  // list it is read once, before the reader starts scanning.
  //
  // The URL must be https and is dropped if it is not: see the guard in buildAgendaSnippet. This
  // snippet is pasted into WordPress by hand and lives there uncorrected, so a bad value has to fail
  // at copy time rather than on a public page.
  doc?: { url: string; label: string };
  // THE SIGN-UP BUTTON, for a programme whose session needs its own registration on top of a TechBBQ
  // ticket (Future of Fintech's networking breakfast, NISS's arrival). Rendered as a filled button in
  // the programme's accent colour, so it reads as the one thing on the panel you can click.
  //
  // `slot` is the timeSlot of the row it belongs under, matched loosely — the feed writes
  // "09:30 – 10:00" in one table and "09:00–09:30" in another, and a hand-typed slot should not have
  // to guess which dash and which spaces. Leave `slot` unset and the button sits above the list, next
  // to the note, as an event-wide call to action.
  //
  // Same https-only rule as `doc`: a bad URL is dropped at copy time rather than pasted into
  // WordPress and left there.
  cta?: { url: string; label: string; slot?: string };
};

/**
 * Escape for HTML built HERE rather than in the browser. The snippet's own esc() runs on feed data;
 * this runs on `doc`, which is a constant from app/program/page.tsx and gets baked into the markup.
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

// Everything that differs between the two looks lives here.
const THEMES = {
  // THE TECHBBQ FIRE GRADIENT, not a flat orange (Auri, 2026-08-05). Same three stops as
  // .text-tbbq-gradient in app/globals.css — orange to red — so the embed on techbbq.dk matches the
  // brand rather than approximating it with #ff6a2b.
  //
  // `acc` stays a SOLID for the things a gradient cannot paint: an SVG stroke and the note's dot.
  // #ff2600 is the gradient's middle stop, so those sit inside the same range instead of beside it.
  orange: {
    ink: "#f2f2f2",
    muted: "#9a9a9c",
    acc: "#ff2600",
    grad: "linear-gradient(120deg,#fa7000 0%,#ff2600 45%,#ce0f2e 100%)",
    tagInk: "#fff",
    tagBorder: "transparent",
    border: "rgba(255,38,0,.45)",
    docBorder: "transparent",
    glow: "rgba(255,38,0,.10)",
    bg: "transparent",
    rowBorder: "rgba(255,255,255,.09)",
    time: "#d8d0c7",
    noteInk: "#cfc6bd",
    // The register button is FILLED, so its ink needs 4.5:1 against the fill and the fire
    // gradient cannot give that (white on #fa7000 is 2.5:1). Hence a solid from the same brand range
    // instead of the gradient: white on #ce0f2e clears AA.
    ctaBg: "#ce0f2e",
    ctaInk: "#fff",
  },
  // Fintech keeps its flat blue. `grad` is a single-stop "gradient" so the shared CSS below can use
  // one variable unconditionally — background-clip:text over a solid paints exactly the solid.
  blue: {
    ink: "#F1F5F9",
    muted: "#94A3B8",
    acc: "#2563EB",
    grad: "linear-gradient(120deg,#2563EB,#2563EB)",
    tagInk: "#93C5FD",
    tagBorder: "rgba(37,99,235,.55)",
    border: "rgba(37,99,235,.45)",
    docBorder: "rgba(37,99,235,.55)",
    glow: "rgba(37,99,235,.10)",
    bg: "#111827",
    rowBorder: "#1E293B",
    time: "#CBD5E1",
    noteInk: "#CBD5E1",
    // The register button is FILLED, so its ink needs 4.5:1 against the fill and the fire
    // gradient cannot give that (white on #fa7000 is 2.5:1). Hence a solid from the same brand range
    // instead of the gradient: white on #2563EB clears AA.
    ctaBg: "#2563EB",
    ctaInk: "#fff",
  },
  // THE BOARD SUMMIT. Fintech's blue reads as a slide deck; a boardroom agenda wants weight, so the
  // ground drops to a near-black navy and the accent becomes a three-stop gradient like the orange
  // theme rather than the flat #2563EB. Same structure as the other two — only the values differ.
  //
  // `bg` is SOLID here, not transparent: the panel has to hold its own dark ground on techbbq.dk,
  // whose sections are light. The orange theme can be transparent because it is pasted onto a dark
  // section; this one cannot borrow.
  navy: {
    ink: "#EAF0FA",
    muted: "#8FA3C2",
    acc: "#60A5FA",
    grad: "linear-gradient(120deg,#7DB0FF 0%,#3B82F6 50%,#1E40AF 100%)",
    tagInk: "#fff",
    tagBorder: "transparent",
    border: "rgba(96,165,250,.32)",
    docBorder: "transparent",
    glow: "rgba(59,130,246,.16)",
    bg: "#0B1220",
    rowBorder: "rgba(147,180,232,.14)",
    time: "#C3D4EE",
    noteInk: "#C3D4EE",
    // The register button is FILLED, so its ink needs 4.5:1 against the fill and the fire
    // gradient cannot give that (white on #fa7000 is 2.5:1). Hence a solid from the same brand range
    // instead of the gradient: white on #1E40AF clears AA.
    ctaBg: "#1E40AF",
    ctaInk: "#fff",
  },
  // THE DAY 0 PROGRAMMES — LP Forum, the Pension & Insurance Summit and the Nordic Family Office
  // Summit. Their designed pages (program.css, `body.is-forum` / `is-pension` / `is-family`) are all
  // one look: the brand fire gradient over the gold-fluid backdrop on --garage #0a0a0a. So the accent
  // values here are the orange theme's, and the ink/rule values are lifted from that stylesheet's
  // --ink, --ink-muted and --rule tokens.
  //
  // What differs from `orange` is the GROUND. That theme is transparent, which works because it is
  // pasted into a section that is already dark; these four are their own dark panel and must bring
  // the black with them.
  gold: {
    ink: "#f5f5f5",
    muted: "#a29a94",
    acc: "#ff2600",
    grad: "linear-gradient(120deg,#fa7000 0%,#ff2600 45%,#ce0f2e 100%)",
    tagInk: "#fff",
    tagBorder: "transparent",
    border: "rgba(255,255,255,.14)",
    docBorder: "transparent",
    glow: "rgba(255,38,0,.12)",
    bg: "#0a0a0a",
    rowBorder: "rgba(255,255,255,.12)",
    time: "#e8ded3",
    noteInk: "#cfc6bd",
    // The register button is FILLED, so its ink needs 4.5:1 against the fill and the fire
    // gradient cannot give that (white on #fa7000 is 2.5:1). Hence a solid from the same brand range
    // instead of the gradient: white on #ce0f2e clears AA.
    ctaBg: "#ce0f2e",
    ctaInk: "#fff",
  },
  // NASS 2026 · Nordic Africa Startup Summit. ONE FLAT COLOUR, #FF0028 (Auri, 2026-08-12), not the
  // three-stop fire gradient every other Day 1/Day 2 programme uses. `grad` is therefore a
  // single-stop gradient, the same trick the `blue` theme uses: background-clip:text over a solid
  // paints exactly that solid, so the shared CSS below needs no branch.
  //
  // Ground stays TRANSPARENT, like `orange` and unlike `navy`/`gold`. This is the look the tab
  // already had before the colour changed, and it is pasted into a dark section on techbbq.dk, so
  // giving it its own black would draw a panel edge where there is none today.
  crimson: {
    ink: "#f2f2f2",
    muted: "#9a9a9c",
    acc: "#FF0028",
    grad: "linear-gradient(120deg,#FF0028,#FF0028)",
    tagInk: "#fff",
    tagBorder: "transparent",
    border: "rgba(255,0,40,.45)",
    docBorder: "transparent",
    glow: "rgba(255,0,40,.10)",
    bg: "transparent",
    rowBorder: "rgba(255,255,255,.09)",
    // Neutral greys rather than the fire theme's warm ones — beside #FF0028 a warm grey reads as a
    // second, muddier accent.
    time: "#d7d3d4",
    noteInk: "#c8c3c4",
    // The register button is FILLED, so its ink needs 4.5:1 against the fill and the fire
    // gradient cannot give that (white on #fa7000 is 2.5:1). Hence a solid from the same brand range
    // instead of the gradient: white on #CC0020 clears AA.
    ctaBg: "#CC0020",
    ctaInk: "#fff",
  },
  // TECHBBQ INVESTOR DAY, the one Day 0 page with a different backdrop: the blue beam
  // (`body.is-investor` swaps bg-program.jpg for bg-beam.jpg and scrims it with #04060e/#020308), so
  // its black reads cool rather than warm. Only the ground and the rules move — the accent stays the
  // fire gradient, because the brand does not change per venue.
  beam: {
    ink: "#f2f4f8",
    muted: "#98a0ae",
    acc: "#ff2600",
    grad: "linear-gradient(120deg,#fa7000 0%,#ff2600 45%,#ce0f2e 100%)",
    tagInk: "#fff",
    tagBorder: "transparent",
    border: "rgba(160,180,220,.18)",
    docBorder: "transparent",
    glow: "rgba(255,38,0,.12)",
    bg: "#04060e",
    rowBorder: "rgba(160,180,220,.14)",
    time: "#dfe4ec",
    noteInk: "#c6ccd8",
    // The register button is FILLED, so its ink needs 4.5:1 against the fill and the fire
    // gradient cannot give that (white on #fa7000 is 2.5:1). Hence a solid from the same brand range
    // instead of the gradient: white on #ce0f2e clears AA.
    ctaBg: "#ce0f2e",
    ctaInk: "#fff",
  },
  // AWS x NVIDIA · "The Agentic AI Era". BLACK GROUND, #f8991d HIGHLIGHTS (Auri, 2026-08-19: "for
  // specifically aws x nvidia event the program has to be black with this colour highlights f8991d").
  // The hosts' own colour, not a TechBBQ one — this is the first tab that drops the brand accent
  // entirely, which is right for a partner takeover carrying its own identity.
  //
  // `bg` is TRUE BLACK, not `gold`'s #0a0a0a --garage: Auri asked for black. Solid rather than
  // transparent for the same reason as navy/gold — the panel has to bring its own dark ground to a
  // techbbq.dk section that is light, and cannot borrow one.
  //
  // ONE FLAT COLOUR, so `grad` is a single-stop gradient — the trick `blue` and `crimson` already use.
  // background-clip:text over a solid paints exactly that solid, so the shared CSS below needs no
  // branch for it.
  //
  // THE TAG IS FILLED, NOT OUTLINED — see .tbbq-agenda__tag below, which paints `background-image:
  // var(--grad)` unconditionally for every theme. This was written as an outlined tag first, with
  // `tagInk` set to #f8991d, and the result was an orange label on an orange pill: the type of every
  // session was invisible on the page Auri pasted (2026-08-19, screenshot). The `blue` theme is the
  // only one that gets away with tinted tag ink, and only barely — #93C5FD on its #2563EB fill is
  // 1.7:1, which is not legible either.
  //
  // So the ink is near-black, as it is on the CTA and for the same reason: #f8991d cannot be darkened
  // without becoming a different colour than the one asked for, and white on it is 2.2:1. Near-black
  // gives 8.6:1 on the fill. Every other theme solves this by keeping white and darkening its own
  // fill, which is why this is the only entry here with dark tag ink.
  //
  // `tagBorder` is transparent because the pill is filled; the PDF LINK keeps its own visible outline
  // through `docBorder`, which is why that token exists. The two used to share `tagBorder`, so fixing
  // one broke the other.
  //
  // CONTRAST OF THE REST. #f8991d on black is 9.6:1, so the accent carries the date heading, the link
  // and the panel border with no lighter variant needed.
  amber: {
    ink: "#F5F5F5",
    muted: "#9C9691",
    acc: "#f8991d",
    grad: "linear-gradient(120deg,#f8991d,#f8991d)",
    tagInk: "#111111",
    tagBorder: "transparent",
    docBorder: "rgba(248,153,29,.55)",
    border: "rgba(248,153,29,.45)",
    glow: "rgba(248,153,29,.10)",
    bg: "#000000",
    rowBorder: "rgba(255,255,255,.10)",
    // Warm greys, as in `gold` and unlike `crimson`: beside an amber accent a cool grey reads as a
    // second, bluer colour.
    time: "#E6DFD6",
    noteInk: "#CFC7BD",
    ctaBg: "#f8991d",
    ctaInk: "#111111",
  },
} as const;

// Lucide icon paths per session type (stroke icons, inherit currentColor).
// Types not listed render without an icon.
const ICONS: Record<string, string> = {
  networking:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  // The Sessions table's own option is spelled "Networking & Drinks", and the lookup is on the exact
  // lowercased type — the bare "networking" above never matched it. Lucide: martini.
  "networking & drinks":
    '<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>',
  break:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  panel:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  showcase: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  pitch: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  // The hand-typed programmes (Policy Stage, Board Summit) use these four types. Without them a
  // 14-row agenda showed an icon on the two Break rows and nothing else, which reads as a bug
  // rather than as a design. Lucide: flame, mic, megaphone, flag.
  "fireside chat":
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>',
  keynote:
    '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
  "opening remarks":
    '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  "closing remarks":
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  "closing remarks & reflections":
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
};

export function buildAgendaSnippet({
  uid,
  path = "/api/program",
  heading,
  note,
  sub,
  theme = "orange",
  icons = true,
  bigOpening = true,
  people = false,
  doc,
  cta,
}: AgendaOptions = {}): string {
  const id = uid || "tbbq-program";
  const t = THEMES[theme];

  // HTTPS ONLY, and silently dropped otherwise — the same rule and the same reasoning as
  // lib/sessionProgrammes.ts: techbbq.dk is https, and an http PDF link is a mixed-content warning
  // on a page that is otherwise clean. Built here as finished markup so the client script only has
  // to print a constant.
  const docHref = doc && /^https:\/\//i.test(doc.url.trim()) ? doc.url.trim() : "";
  // Lucide `file-text`, inline for the same reason as ICONS above: the embed loads no external
  // scripts, so an icon font or a Lucide bundle is not an option on a WordPress page.
  const DOC_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>';
  const docHtml = docHref
    ? `<a class="tbbq-agenda__doc" href="${escapeHtml(docHref)}" target="_blank" rel="noopener noreferrer">${DOC_ICON}${escapeHtml(doc!.label)}</a>`
    : "";

  // THE REGISTER BUTTON. Same https guard as the document link above, and the same reason: this markup
  // is pasted into WordPress by hand, so a bad URL has to die here and not on techbbq.dk.
  const ctaHref = cta && /^https:\/\//i.test(cta.url.trim()) ? cta.url.trim() : "";
  // Lucide `ticket`, inline like every other icon in this embed (no external scripts on the page).
  const CTA_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/></svg>';
  const ctaHtml = ctaHref
    ? `<a class="tbbq-agenda__cta" href="${escapeHtml(ctaHref)}" target="_blank" rel="noopener noreferrer">${CTA_ICON}${escapeHtml(cta!.label)}</a>`
    : "";

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-agenda"><p class="tbbq-agenda__loading">Loading…</p></section>

<style>
  #${id}.tbbq-agenda{--fg:${t.ink};--muted:${t.muted};--acc:${t.acc};--grad:${t.grad};font-family:"Inter",ui-sans-serif,system-ui,sans-serif;max-width:1200px;margin:0 auto;border:1px solid ${t.border};border-radius:24px;padding:clamp(20px,4vw,44px);background:${t.bg};box-shadow:0 0 45px ${t.glow},inset 0 0 60px rgba(0,0,0,.3);color:var(--fg)}
  #${id} .tbbq-agenda__loading{color:var(--muted);margin:0}
  /* The date heading is PAINTED with the gradient, not coloured. background-clip:text needs a
     transparent fill, and the -webkit- prefix stays for Safari. text-shadow cannot apply to clipped
     text (it would draw behind the glyphs and show through), so the glow moves to a drop-shadow. */
  #${id} .tbbq-agenda__date{font-family:"Onest",sans-serif;font-weight:700;font-size:clamp(30px,4vw,42px);line-height:1.1;background-image:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 26px ${t.glow});margin:2px 6px 16px}
  #${id} .tbbq-agenda__date:not(:first-child){margin-top:34px}
  /* The room sits on the date's baseline. It is a SIBLING span inside the same block rather than a
     second line, so "August 27th · Event Room 1 & 2" reads as one answer. It must NOT inherit the
     clipped-gradient fill above, hence its own solid colour. */
  #${id} .tbbq-agenda__where{font-family:"Inter",ui-sans-serif,system-ui,sans-serif;font-weight:500;font-size:clamp(13px,1.4vw,16px);letter-spacing:.01em;background:none;color:${t.muted};-webkit-text-fill-color:${t.muted};white-space:nowrap}
  #${id} .tbbq-agenda__where::before{content:"·";margin:0 10px;opacity:.6}
  #${id} .tbbq-agenda__note{display:inline-flex;align-items:center;gap:9px;font-size:13px;font-weight:500;color:${t.noteInk};border:1px solid rgba(255,255,255,.16);border-radius:9999px;padding:7px 16px;margin:0 0 22px 6px}
  #${id} .tbbq-agenda__note::before{content:"";flex:none;width:7px;height:7px;border-radius:9999px;background-image:var(--grad)}
  /* THE PROGRAMME DOCUMENT. Shaped like the note pill so the block keeps one vocabulary, but in the
     accent colour and with a border that brightens on hover, because this one is clickable and the
     note is not. focus-visible is spelled out: WordPress themes routinely kill the default outline,
     and this is the only interactive thing in the embed. */
  #${id} .tbbq-agenda__doc{display:inline-flex;align-items:center;gap:9px;font-size:13px;font-weight:600;color:var(--acc);text-decoration:none;border:1px solid ${t.docBorder};border-radius:9999px;padding:8px 17px;margin:0 0 22px 6px;transition:border-color .15s,background-color .15s}
  #${id} .tbbq-agenda__doc:hover{border-color:var(--acc);background:rgba(255,255,255,.05)}
  #${id} .tbbq-agenda__doc:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
  #${id} .tbbq-agenda__doc svg{flex:none;width:16px;height:16px}
  /* THE REGISTER BUTTON, filled with the theme gradient like the type pill rather than outlined like
     the document link. It is the only thing on the panel a reader is asked to DO, so it carries the
     accent as a background instead of borrowing it for text. Sits inside its row, under the
     description, at the size of a real button. */
  #${id} .tbbq-agenda__cta{display:inline-flex;align-items:center;gap:9px;margin:14px 0 2px;font-family:"Onest",sans-serif;font-size:14px;font-weight:700;letter-spacing:.02em;color:${t.ctaInk};background:${t.ctaBg};border:0;border-radius:9999px;padding:11px 22px;text-decoration:none;transition:filter .15s,transform .15s}
  #${id} .tbbq-agenda__cta:hover{filter:brightness(1.12);transform:translateY(-1px)}
  #${id} .tbbq-agenda__cta:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
  #${id} .tbbq-agenda__cta svg{flex:none;width:16px;height:16px}
  #${id} .tbbq-agenda__row{display:grid;grid-template-columns:150px 1fr;gap:20px;padding:18px 6px;border-bottom:1px solid ${t.rowBorder};align-items:start}
  #${id} .tbbq-agenda__row:last-child{border-bottom:0}
  #${id} .tbbq-agenda__time{font-family:"Onest",sans-serif;font-weight:600;font-size:15px;color:${t.time};letter-spacing:.03em;padding-top:4px;white-space:nowrap}
  /* The type pill is FILLED with the gradient. An outlined gradient pill needs a solid padding-box to
     sit on, and this panel is deliberately transparent so it inherits whatever the WordPress page puts
     behind it — a filled pill needs no such assumption. */
  #${id} .tbbq-agenda__tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${t.tagInk};background-image:var(--grad);border:1px solid ${t.tagBorder};border-radius:9999px;padding:3px 12px;margin-bottom:8px}
  #${id} .tbbq-agenda__title{font-family:"Onest",sans-serif;font-weight:600;font-size:19px;line-height:1.3;color:var(--fg)}
  #${id} .tbbq-agenda__title--big{font-size:26px;font-weight:700;letter-spacing:-.01em}
  #${id} .tbbq-agenda__desc{margin:6px 0 0;color:var(--muted);font-size:14px;line-height:1.5;white-space:pre-line}
  #${id} .tbbq-agenda__ic{display:inline-block;width:19px;height:19px;vertical-align:-3px;margin-right:9px;color:var(--acc)}
  /* WHO IS ON STAGE. One row per person: a face, the name, then the title in the muted colour, so a
     four-person panel reads as a list of people rather than a paragraph of commas. */
  #${id} .tbbq-agenda__people{margin:12px 0 0;display:flex;flex-direction:column;gap:8px}
  #${id} .tbbq-agenda__person{display:flex;align-items:center;gap:10px;min-width:0}
  #${id} .tbbq-agenda__face{flex:none;width:34px;height:34px;border-radius:9999px;object-fit:cover;object-position:50% 30%;background:rgba(255,255,255,.06)}
  #${id} .tbbq-agenda__face--empty{display:grid;place-items:center;font-family:"Onest",sans-serif;font-size:13px;font-weight:700;color:var(--acc)}
  #${id} .tbbq-agenda__who{min-width:0;font-size:14px;line-height:1.35;color:var(--fg)}
  /* These two are a FALLBACK now. The person line is pinned inline with !important in person()
     below, because a scoped class rule loses to whatever the host theme does to a bare span — see
     the note there. Kept so the markup still reads correctly if that inline pinning is ever
     removed, and so the colours live beside the rest of the palette. */
  #${id} .tbbq-agenda__who b{font-weight:600}
  #${id} .tbbq-agenda__who span{color:var(--muted)}
  /* The role sits above its group, small and spaced, so "Moderator" is never mistaken for a name. */
  #${id} .tbbq-agenda__role{margin:14px 0 6px;font-family:"Onest",sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  @media(max-width:640px){#${id} .tbbq-agenda__row{grid-template-columns:1fr;gap:6px;padding:16px 2px}#${id} .tbbq-agenda__time{padding-top:0}#${id} .tbbq-agenda__title--big{font-size:21px}}
</style>

<script>
(function(){
${endpointDecl(path, "  ")}
  var HEADING = ${JSON.stringify(heading || "")};
  var NOTE = ${JSON.stringify(note || "")};
  var SUB = ${JSON.stringify(sub || "")};
  // Already-escaped markup, built and https-checked in buildAgendaSnippet. Empty when the programme
  // has no document.
  var DOC = ${JSON.stringify(docHtml)};
  // The register button, also finished markup. CTA_SLOT names the row it belongs under (empty = above
  // the list); CTA_URL is kept separately so the raw link the Airtable description already carries can
  // be dropped from the text — printed as well as buttoned, it is the same instruction twice.
  var CTA = ${JSON.stringify(ctaHtml)};
  var CTA_SLOT = ${JSON.stringify(ctaHtml ? (cta!.slot || "") : "")};
  var CTA_URL = ${JSON.stringify(ctaHref)};
  var ICONS = ${JSON.stringify(icons ? ICONS : {})};
  var BIG_OPENING = ${bigOpening ? "true" : "false"};
  var PEOPLE = ${people ? "true" : "false"};
  var root = document.getElementById("${id}");
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function icon(type){
    var p=ICONS[String(type||"").toLowerCase()];
    return p?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tbbq-agenda__ic">'+p+'</svg>':'';
  }
  // THE PERSON LINE IS PINNED INLINE WITH !important, AND IT HAS TO BE.
  //
  // The name sits in a <b> and the title + company in a bare <span>, and that span carries no class
  // of its own. On techbbq.dk that is enough for the host theme to win it: Elementor styles bare
  // descendant spans, so "Founder, ODIN" rendered in the heading font at ~19px beside a 14px name
  // (Auri, screenshot 2026-08-25): the job title shouting over the person holding it.
  //
  // The stylesheet above cannot defend this on its own. It is scoped to a class inside this widget,
  // which any host rule can match or beat, and there is no way to know what the page it is pasted
  // into does. An inline declaration with !important is the only thing that survives an unknown
  // stylesheet, so the three parts of the line each carry one. This is the ONE place in the snippet
  // that needs it: everything else is a class the theme has no reason to target.
  //
  // THE font SHORTHAND COMES FIRST, then the specific properties. It resets family, size, weight,
  // style, variant and line-height in one go, so a host rule cannot reach any of them through a
  // property this code forgot to name; the declarations after it put back the three that matter.
  // Order matters: the shorthand placed after font-size would undo the size.
  //
  // NO BACKTICKS IN THIS COMMENT, and that is not a style preference. Every line of this script is
  // inside a template literal, so one backtick here ends the literal and the file stops compiling.
  var WHO_CSS  = "font:inherit!important;font-size:14px!important;line-height:1.35!important;color:var(--fg)!important";
  var NAME_CSS = "font:inherit!important;font-size:14px!important;font-weight:600!important;letter-spacing:normal!important;text-transform:none!important;color:var(--fg)!important";
  var META_CSS = "font:inherit!important;font-size:14px!important;font-weight:400!important;letter-spacing:normal!important;text-transform:none!important;color:var(--muted)!important";
  // One person: face (or their initial when the row has no photo), name, then title.
  function person(p){
    var face = p.photo
      ? '<img class="tbbq-agenda__face" src="'+esc(p.photo)+'" alt="" loading="lazy">'
      : '<span class="tbbq-agenda__face tbbq-agenda__face--empty" aria-hidden="true">'+esc(String(p.name||"?").trim().charAt(0).toUpperCase())+'</span>';
    return '<div class="tbbq-agenda__person">'+face
      +'<div class="tbbq-agenda__who" style="'+WHO_CSS+'"><b style="'+NAME_CSS+'">'+esc(p.name)+'</b>'
      +(p.meta?'<span style="'+META_CSS+'">, '+esc(p.meta)+'</span>':'')+'</div></div>';
  }
  // Moderator first: they open the session, and on a panel of four the reader wants to know who is
  // steering before who is talking. Singular or plural label from the count, so one moderator is not
  // announced as "Moderators".
  function people(st){
    if(!PEOPLE||!st)return "";
    var out="";
    if(st.moderators&&st.moderators.length){
      out+='<div class="tbbq-agenda__role">'+(st.moderators.length>1?"Moderators":"Moderator")+'</div>'
        +'<div class="tbbq-agenda__people">'+st.moderators.map(person).join("")+'</div>';
    }
    if(st.speakers&&st.speakers.length){
      // A lone person carrying a role names it: the event host opens alone from Speaker Details and
      // is hosting, not speaking. The feed marks only that case (applyHostRole), so everything else
      // still reads Speaker/Speakers.
      var solo=st.speakers.length===1&&st.speakers[0].role;
      out+='<div class="tbbq-agenda__role">'+esc(solo||(st.speakers.length>1?"Speakers":"Speaker"))+'</div>'
        +'<div class="tbbq-agenda__people">'+st.speakers.map(person).join("")+'</div>';
    }
    return out;
  }
  // Loose timeslot match, so CTA_SLOT can be typed the way a human reads it. Everything but digits
  // and colons goes: "09:30 – 10:00", "09:30–10:00" and "9:30-10:00" all fold to the same key.
  function slotKey(v){return String(v==null?"":v).replace(/[^0-9:]/g,"");}
  // The Airtable description for the breakfast already ends in "please sign up here: <url>". With a
  // button beside it that is the same instruction twice, so the line carrying the CTA link is dropped
  // from the text and only the button remains.
  function desc(v){
    var d=String(v==null?"":v);
    if(CTA_URL&&d.indexOf(CTA_URL)!==-1){
      d=d.split(/\\r?\\n/).filter(function(l){return l.indexOf(CTA_URL)===-1;}).join("\\n");
    }
    return d.trim();
  }
  // A 429/502 still returns JSON ({error:...}), so without an r.ok check the page said
  // "Program coming soon." during an outage instead of admitting it could not load.
  fetch(ENDPOINT).then(function(r){
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(data){
    var list=(data&&data.sessions)||[];
    if(!list.length){root.innerHTML='<p class="tbbq-agenda__loading">Program coming soon.</p>';return;}
    var html="";
    // SUB rides on the fixed HEADING only. A multi-day feed draws one date per day from the data,
    // and a room repeated under every one of them would be noise — the rooms differ per day anyway.
    var where = SUB ? '<span class="tbbq-agenda__where">'+esc(SUB)+'</span>' : '';
    if(HEADING)html+='<div class="tbbq-agenda__date">'+esc(HEADING)+where+'</div>';
    if(NOTE)html+='<div class="tbbq-agenda__note">'+esc(NOTE)+'</div>';
    // Under the note, above the first row: read once, before the scanning starts. NOT esc()'d —
    // it is finished markup from the server, and escaping it would print the anchor as text.
    if(DOC)html+='<div>'+DOC+'</div>';
    // A CTA with no slot is event-wide and sits here, above the first row. With a slot it belongs to
    // one session and is printed inside that row instead — see the loop below.
    if(CTA&&!CTA_SLOT)html+='<div>'+CTA+'</div>';
    // A slot that matches nothing would silently swallow the button, so it falls back to the top.
    var ctaRow=CTA&&CTA_SLOT?list.some(function(x){return slotKey(x.timeSlot)===slotKey(CTA_SLOT);}):false;
    if(CTA&&CTA_SLOT&&!ctaRow)html+='<div>'+CTA+'</div>';
    var day="";
    for(var i=0;i<list.length;i++){
      var s=list[i];
      // Multi-day programs get a date heading per day (skipped when a fixed HEADING
      // is set, or for single-day feeds where day is empty).
      if(!HEADING&&s.day!==day){day=s.day;if(day)html+='<div class="tbbq-agenda__date">'+esc(day)+'</div>';}
      var t=String(s.type||"").toLowerCase();
      var big=(BIG_OPENING&&t==="opening")?" tbbq-agenda__title--big":"";
      html+='<div class="tbbq-agenda__row"><div class="tbbq-agenda__time">'+esc(s.timeSlot)+'</div><div>'
        +(s.type?'<span class="tbbq-agenda__tag">'+esc(s.type)+'</span>':'')
        +'<div class="tbbq-agenda__title'+big+'">'+icon(s.type)+esc(s.name)+'</div>'
        +(desc(s.description)?'<p class="tbbq-agenda__desc">'+esc(desc(s.description))+'</p>':'')
        +people(s.onStage)
        +(ctaRow&&slotKey(s.timeSlot)===slotKey(CTA_SLOT)?CTA:'')
        +'</div></div>';
    }
    root.innerHTML=html;
  }).catch(function(err){
    root.innerHTML='<p class="tbbq-agenda__loading">Could not load right now.</p>';
    /* Same reason as lib/embedSnippet.ts: swallowing the error made this message
       undebuggable from the browser console. Log the endpoint too — a stale paste is
       indistinguishable from a server fault without it. */
    if(window.console&&console.error)console.error("[tbbq-agenda] failed to load",ENDPOINT,err);
  });
})();
</script>`;
}
