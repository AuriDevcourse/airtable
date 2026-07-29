// Elementor snippet for the program/agenda — the schedule equivalent of
// lib/embedSnippet.ts. Fetches /api/program, groups sessions by Day, renders each as
// a row: time slot · session name · type/room tags · description. Same dark TechBBQ
// look, all styles scoped under the unique id so nothing leaks into WordPress.
// __ORIGIN__ is swapped for the live URL at copy time (see components/CopyEmbed.tsx).

export type AgendaOptions = {
  // Unique element id so several embeds can share one WordPress page.
  uid?: string;
  // Which program feed to render, e.g. "/api/program?event=niss". Default = TechBBQ.
  path?: string;
};

export function buildAgendaSnippet({ uid, path = "/api/program" }: AgendaOptions = {}): string {
  const id = uid || "tbbq-program";

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-program"><p class="tbbq-program__loading">Loading…</p></section>

<style>
  .tbbq-program{--bg:#0d0d0d;--card:#131313;--fg:#f2f2f2;--muted:#9a9a9c;--accent:#fa7000;--sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--head:"Onest",var(--sans);background:var(--bg);color:var(--fg);font-family:var(--sans)!important;padding:clamp(24px,4vw,48px);border-radius:20px}
  .tbbq-program__loading{color:var(--muted);margin:0}
  .tbbq-program__day{font-family:var(--head)!important;font-weight:600;letter-spacing:-.02em;font-size:22px;margin:32px 0 16px;color:#fff}
  .tbbq-program__day:first-child{margin-top:0}
  .tbbq-session{display:flex;gap:20px;background:var(--card);border-radius:16px;padding:18px 20px;margin:0 0 12px}
  .tbbq-session__time{flex:0 0 110px;font-family:var(--head)!important;font-weight:600;font-size:15px;color:var(--accent);white-space:nowrap}
  .tbbq-session__body{flex:1 1 auto;min-width:0}
  .tbbq-session__name{font-family:var(--head)!important;font-weight:500;letter-spacing:-.02em;font-size:17px;line-height:1.25;margin:0;color:#fff}
  .tbbq-session__tags{margin:6px 0 0;display:flex;gap:8px;flex-wrap:wrap}
  .tbbq-session__tag{display:inline-block;padding:3px 10px;border-radius:9999px;background:#1d1d1d;color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.02em}
  .tbbq-session__desc{font-family:var(--sans)!important;margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.5;white-space:pre-line}
  @media(max-width:600px){
    .tbbq-program{padding:16px}
    .tbbq-session{flex-direction:column;gap:6px;padding:14px 16px}
    .tbbq-session__time{flex:none}
  }
</style>

<script>
(function(){
  var ENDPOINT = "__ORIGIN__${path}";
  var root = document.getElementById("${id}");
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  fetch(ENDPOINT).then(function(r){return r.json();}).then(function(data){
    var list=(data&&data.sessions)||[];
    if(!list.length){root.innerHTML='<p class="tbbq-program__loading">Program coming soon.</p>';return;}
    var html="";
    var day="";
    for(var i=0;i<list.length;i++){
      var s=list[i];
      if(s.day!==day){day=s.day;if(day)html+='<h3 class="tbbq-program__day">'+esc(day)+'</h3>';}
      var tags="";
      if(s.type)tags+='<span class="tbbq-session__tag">'+esc(s.type)+'</span>';
      if(s.room)tags+='<span class="tbbq-session__tag">'+esc(s.room)+'</span>';
      html+='<div class="tbbq-session"><div class="tbbq-session__time">'+esc(s.timeSlot)+'</div><div class="tbbq-session__body"><h4 class="tbbq-session__name">'+esc(s.name)+'</h4>'+(tags?'<div class="tbbq-session__tags">'+tags+'</div>':'')+(s.description?'<p class="tbbq-session__desc">'+esc(s.description)+'</p>':'')+'</div></div>';
    }
    root.innerHTML=html;
  }).catch(function(){root.innerHTML='<p class="tbbq-program__loading">Could not load right now.</p>';});
})();
</script>`;
}
