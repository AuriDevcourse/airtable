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
  theme?: "orange" | "blue" | "navy" | "gold" | "beam" | "crimson";
  // Per-type Lucide icons in the titles. Default true; the Fintech design omits them.
  icons?: boolean;
  // Oversized title on Session Type = "Opening". Default true (the NISS look);
  // Fintech wants every title the same size, so it passes false.
  bigOpening?: boolean;
  // Show WHO IS ON STAGE under each session: the moderator first, then the speakers, each with their
  // face when the feed has one. Off by default, because only the Policy Stage feed carries `onStage`
  // and turning it on for the others would render nothing while changing their markup.
  people?: boolean;
};

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
    glow: "rgba(255,38,0,.10)",
    bg: "transparent",
    rowBorder: "rgba(255,255,255,.09)",
    time: "#d8d0c7",
    noteInk: "#cfc6bd",
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
    glow: "rgba(37,99,235,.10)",
    bg: "#111827",
    rowBorder: "#1E293B",
    time: "#CBD5E1",
    noteInk: "#CBD5E1",
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
    glow: "rgba(59,130,246,.16)",
    bg: "#0B1220",
    rowBorder: "rgba(147,180,232,.14)",
    time: "#C3D4EE",
    noteInk: "#C3D4EE",
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
    glow: "rgba(255,38,0,.12)",
    bg: "#0a0a0a",
    rowBorder: "rgba(255,255,255,.12)",
    time: "#e8ded3",
    noteInk: "#cfc6bd",
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
    glow: "rgba(255,0,40,.10)",
    bg: "transparent",
    rowBorder: "rgba(255,255,255,.09)",
    // Neutral greys rather than the fire theme's warm ones — beside #FF0028 a warm grey reads as a
    // second, muddier accent.
    time: "#d7d3d4",
    noteInk: "#c8c3c4",
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
    glow: "rgba(255,38,0,.12)",
    bg: "#04060e",
    rowBorder: "rgba(160,180,220,.14)",
    time: "#dfe4ec",
    noteInk: "#c6ccd8",
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
}: AgendaOptions = {}): string {
  const id = uid || "tbbq-program";
  const t = THEMES[theme];

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
  var ICONS = ${JSON.stringify(icons ? ICONS : {})};
  var BIG_OPENING = ${bigOpening ? "true" : "false"};
  var PEOPLE = ${people ? "true" : "false"};
  var root = document.getElementById("${id}");
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function icon(type){
    var p=ICONS[String(type||"").toLowerCase()];
    return p?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tbbq-agenda__ic">'+p+'</svg>':'';
  }
  // One person: face (or their initial when the row has no photo), name, then title.
  function person(p){
    var face = p.photo
      ? '<img class="tbbq-agenda__face" src="'+esc(p.photo)+'" alt="" loading="lazy">'
      : '<span class="tbbq-agenda__face tbbq-agenda__face--empty" aria-hidden="true">'+esc(String(p.name||"?").trim().charAt(0).toUpperCase())+'</span>';
    return '<div class="tbbq-agenda__person">'+face
      +'<div class="tbbq-agenda__who"><b>'+esc(p.name)+'</b>'+(p.meta?'<span>, '+esc(p.meta)+'</span>':'')+'</div></div>';
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
      out+='<div class="tbbq-agenda__role">'+(st.speakers.length>1?"Speakers":"Speaker")+'</div>'
        +'<div class="tbbq-agenda__people">'+st.speakers.map(person).join("")+'</div>';
    }
    return out;
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
        +(s.description?'<p class="tbbq-agenda__desc">'+esc(s.description)+'</p>':'')
        +people(s.onStage)
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
