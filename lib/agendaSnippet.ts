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
  // Color theme. "orange" = the TechBBQ fire look (default, used by NISS/TechBBQ).
  // "blue" = the Future of Fintech look (blue border/tags on #111827).
  theme?: "orange" | "blue";
  // Per-type Lucide icons in the titles. Default true; the Fintech design omits them.
  icons?: boolean;
  // Oversized title on Session Type = "Opening". Default true (the NISS look);
  // Fintech wants every title the same size, so it passes false.
  bigOpening?: boolean;
};

// Everything that differs between the two looks lives here.
const THEMES = {
  orange: {
    ink: "#f2f2f2",
    muted: "#9a9a9c",
    acc: "#ff6a2b",
    tagInk: "#ff6a2b",
    tagBorder: "rgba(255,106,43,.5)",
    border: "rgba(255,106,43,.45)",
    glow: "rgba(255,106,43,.08)",
    bg: "transparent",
    rowBorder: "rgba(255,255,255,.09)",
    time: "#d8d0c7",
    noteInk: "#cfc6bd",
  },
  blue: {
    ink: "#F1F5F9",
    muted: "#94A3B8",
    acc: "#2563EB",
    tagInk: "#93C5FD",
    tagBorder: "rgba(37,99,235,.55)",
    border: "rgba(37,99,235,.45)",
    glow: "rgba(37,99,235,.10)",
    bg: "#111827",
    rowBorder: "#1E293B",
    time: "#CBD5E1",
    noteInk: "#CBD5E1",
  },
} as const;

// Lucide icon paths per session type (stroke icons, inherit currentColor).
// Types not listed render without an icon.
const ICONS: Record<string, string> = {
  networking:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  break:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  panel:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  showcase: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  pitch: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
};

export function buildAgendaSnippet({
  uid,
  path = "/api/program",
  heading,
  note,
  theme = "orange",
  icons = true,
  bigOpening = true,
}: AgendaOptions = {}): string {
  const id = uid || "tbbq-program";
  const t = THEMES[theme];

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-agenda"><p class="tbbq-agenda__loading">Loading…</p></section>

<style>
  #${id}.tbbq-agenda{--fg:${t.ink};--muted:${t.muted};--acc:${t.acc};font-family:"Inter",ui-sans-serif,system-ui,sans-serif;max-width:1200px;margin:0 auto;border:1px solid ${t.border};border-radius:24px;padding:clamp(20px,4vw,44px);background:${t.bg};box-shadow:0 0 45px ${t.glow},inset 0 0 60px rgba(0,0,0,.3);color:var(--fg)}
  #${id} .tbbq-agenda__loading{color:var(--muted);margin:0}
  #${id} .tbbq-agenda__date{font-family:"Onest",sans-serif;font-weight:700;font-size:clamp(30px,4vw,42px);line-height:1.1;color:var(--acc);text-shadow:0 0 26px ${t.glow};margin:2px 6px 16px}
  #${id} .tbbq-agenda__date:not(:first-child){margin-top:34px}
  #${id} .tbbq-agenda__note{display:inline-flex;align-items:center;gap:9px;font-size:13px;font-weight:500;color:${t.noteInk};border:1px solid rgba(255,255,255,.16);border-radius:9999px;padding:7px 16px;margin:0 0 22px 6px}
  #${id} .tbbq-agenda__note::before{content:"";flex:none;width:7px;height:7px;border-radius:9999px;background:var(--acc)}
  #${id} .tbbq-agenda__row{display:grid;grid-template-columns:150px 1fr;gap:20px;padding:18px 6px;border-bottom:1px solid ${t.rowBorder};align-items:start}
  #${id} .tbbq-agenda__row:last-child{border-bottom:0}
  #${id} .tbbq-agenda__time{font-family:"Onest",sans-serif;font-weight:600;font-size:15px;color:${t.time};letter-spacing:.03em;padding-top:4px;white-space:nowrap}
  #${id} .tbbq-agenda__tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${t.tagInk};border:1px solid ${t.tagBorder};border-radius:9999px;padding:3px 12px;margin-bottom:8px}
  #${id} .tbbq-agenda__title{font-family:"Onest",sans-serif;font-weight:600;font-size:19px;line-height:1.3;color:var(--fg)}
  #${id} .tbbq-agenda__title--big{font-size:26px;font-weight:700;letter-spacing:-.01em}
  #${id} .tbbq-agenda__desc{margin:6px 0 0;color:var(--muted);font-size:14px;line-height:1.5;white-space:pre-line}
  #${id} .tbbq-agenda__ic{display:inline-block;width:19px;height:19px;vertical-align:-3px;margin-right:9px;color:var(--acc)}
  @media(max-width:640px){#${id} .tbbq-agenda__row{grid-template-columns:1fr;gap:6px;padding:16px 2px}#${id} .tbbq-agenda__time{padding-top:0}#${id} .tbbq-agenda__title--big{font-size:21px}}
</style>

<script>
(function(){
  var ENDPOINT = "__ORIGIN__${path}";
  var HEADING = ${JSON.stringify(heading || "")};
  var NOTE = ${JSON.stringify(note || "")};
  var ICONS = ${JSON.stringify(icons ? ICONS : {})};
  var BIG_OPENING = ${bigOpening ? "true" : "false"};
  var root = document.getElementById("${id}");
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function icon(type){
    var p=ICONS[String(type||"").toLowerCase()];
    return p?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tbbq-agenda__ic">'+p+'</svg>':'';
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
    if(HEADING)html+='<div class="tbbq-agenda__date">'+esc(HEADING)+'</div>';
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
