// Elementor snippet for the program/agenda — the schedule equivalent of
// lib/embedSnippet.ts. Fetches /api/program, renders rows: time · type pill · title.
// Design (Auri, 2026-07-29): orange glow border around the block, uppercase orange
// outlined tags, dim treatment for Break/Networking rows, per-type Lucide icons,
// big title on the Opening. All styles scoped under the unique id.
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
};

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

export function buildAgendaSnippet({ uid, path = "/api/program", heading, note }: AgendaOptions = {}): string {
  const id = uid || "tbbq-program";

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-agenda"><p class="tbbq-agenda__loading">Loading…</p></section>

<style>
  .tbbq-agenda{--fg:#f2f2f2;--muted:#9a9a9c;--acc:#ff6a2b;font-family:"Inter",ui-sans-serif,system-ui,sans-serif;max-width:1200px;margin:0 auto;border:1px solid rgba(255,106,43,.45);border-radius:24px;padding:clamp(20px,4vw,44px);box-shadow:0 0 45px rgba(255,106,43,.08),inset 0 0 60px rgba(0,0,0,.35);color:var(--fg)}
  .tbbq-agenda__loading{color:var(--muted);margin:0}
  .tbbq-agenda__date{font-family:"Onest",sans-serif;font-weight:700;font-size:clamp(30px,4vw,42px);line-height:1.1;color:var(--acc);text-shadow:0 0 26px rgba(255,106,43,.4);margin:2px 6px 16px}
  .tbbq-agenda__date:not(:first-child){margin-top:34px}
  .tbbq-agenda__note{display:inline-flex;align-items:center;gap:9px;font-size:13px;font-weight:500;color:#cfc6bd;border:1px solid rgba(255,255,255,.16);border-radius:9999px;padding:7px 16px;margin:0 0 22px 6px}
  .tbbq-agenda__note::before{content:"";flex:none;width:7px;height:7px;border-radius:9999px;background:var(--acc)}
  .tbbq-agenda__row{display:grid;grid-template-columns:150px 1fr;gap:20px;padding:18px 6px;border-bottom:1px solid rgba(255,255,255,.09);align-items:start}
  .tbbq-agenda__row:last-child{border-bottom:0}
  .tbbq-agenda__time{font-family:"Onest",sans-serif;font-weight:600;font-size:15px;color:#d8d0c7;letter-spacing:.03em;padding-top:4px;white-space:nowrap}
  .tbbq-agenda__tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);border:1px solid rgba(255,106,43,.5);border-radius:9999px;padding:3px 12px;margin-bottom:8px}
  .tbbq-agenda__tag--dim{color:var(--muted);border-color:rgba(255,255,255,.18)}
  .tbbq-agenda__title{font-family:"Onest",sans-serif;font-weight:600;font-size:19px;line-height:1.3;color:var(--fg)}
  .tbbq-agenda__title--dim{color:#b3aba2;font-weight:500;font-size:16px}
  .tbbq-agenda__title--big{font-size:27px;font-weight:700;letter-spacing:-.01em}
  .tbbq-agenda__desc{margin:6px 0 0;color:var(--muted);font-size:14px;line-height:1.5;white-space:pre-line}
  .tbbq-agenda__ic{display:inline-block;width:19px;height:19px;vertical-align:-3px;margin-right:9px;color:var(--acc)}
  .tbbq-agenda__title--dim .tbbq-agenda__ic{color:#b3aba2}
  @media(max-width:640px){.tbbq-agenda__row{grid-template-columns:1fr;gap:6px;padding:16px 2px}.tbbq-agenda__time{padding-top:0}.tbbq-agenda__title--big{font-size:21px}}
</style>

<script>
(function(){
  var ENDPOINT = "__ORIGIN__${path}";
  var HEADING = ${JSON.stringify(heading || "")};
  var NOTE = ${JSON.stringify(note || "")};
  var ICONS = ${JSON.stringify(ICONS)};
  var root = document.getElementById("${id}");
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function icon(type){
    var p=ICONS[String(type||"").toLowerCase()];
    return p?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tbbq-agenda__ic">'+p+'</svg>':'';
  }
  fetch(ENDPOINT).then(function(r){return r.json();}).then(function(data){
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
      var dim=(t==="break"||t==="networking")?"--dim":"";
      var big=(t==="opening")?" tbbq-agenda__title--big":"";
      html+='<div class="tbbq-agenda__row"><div class="tbbq-agenda__time">'+esc(s.timeSlot)+'</div><div>'
        +(s.type?'<span class="tbbq-agenda__tag'+(dim?' tbbq-agenda__tag'+dim:'')+'">'+esc(s.type)+'</span>':'')
        +'<div class="tbbq-agenda__title'+(dim?' tbbq-agenda__title'+dim:'')+big+'">'+icon(s.type)+esc(s.name)+'</div>'
        +(s.description?'<p class="tbbq-agenda__desc">'+esc(s.description)+'</p>':'')
        +'</div></div>';
    }
    root.innerHTML=html;
  }).catch(function(){root.innerHTML='<p class="tbbq-agenda__loading">Could not load right now.</p>';});
})();
</script>`;
}
