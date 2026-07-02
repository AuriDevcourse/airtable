// Single source of truth for the WordPress/Elementor embed snippet. Every feed uses the
// same card grid (frame, hover glow, per-image shimmer); only two things vary per table:
//   - path:    which API route to fetch (that's how you target a specific table/role)
//   - listKey: the array key in the JSON ("speakers" for the main feed, "people" for NISS)
// __ORIGIN__ is left in place and swapped for the live URL at copy time (client-side).

export type EmbedOptions = {
  path: string; // e.g. "/api/niss-2025?role=Speaker"
  listKey: "speakers" | "people";
  // Unique element id so several embeds can live on ONE WordPress page (e.g. a
  // "Previous Presenters" block and a "Previous Moderators" block). Without this they'd
  // share id="tbbq-speakers" and getElementById would only ever find the first one, so the
  // second block stays stuck on "Loading…". Generate a fresh id per copy.
  uid?: string;
};

export function buildEmbedSnippet({ path, listKey, uid }: EmbedOptions): string {
  const id = uid || "tbbq-speakers";
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-speakers"><div class="tbbq-grid"><p class="tbbq-speakers__loading">Loading…</p></div></section>

<style>
  .tbbq-speakers{--bg:#0d0d0d;--card:#131313;--fg:#f2f2f2;--muted:#9a9a9c;background:var(--bg);color:var(--fg);font-family:"Inter",ui-sans-serif,system-ui,sans-serif;padding:clamp(24px,4vw,48px);border-radius:20px}
  .tbbq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px}
  .tbbq-speakers__loading{grid-column:1/-1;color:var(--muted);margin:0}
  .tbbq-more{display:block;margin:24px auto 0;padding:12px 28px;border:1px solid #2a2a2a;border-radius:9999px;background:#131313;color:#f2f2f2;font-family:"Onest",sans-serif;font-weight:500;font-size:14px;cursor:pointer;transition:background .18s}
  .tbbq-more:hover{background:#1b1b1b}
  @media(max-width:600px){.tbbq-grid{grid-template-columns:repeat(2,1fr);gap:12px}.tbbq-speakers{padding:16px}}
  .tbbq-card{position:relative;background:var(--card);border-radius:20px;padding:8px;overflow:hidden}
  .tbbq-card a{text-decoration:none;color:inherit;display:block}
  .tbbq-card__media{position:relative;z-index:1;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:#1d1d1d}
  .tbbq-card__media img{width:100%;height:100%;object-fit:cover;object-position:50% 30%;display:block}
  .tbbq-card__body{position:relative;padding:12px 8px 4px}
  .tbbq-card__body h3{position:relative;z-index:1;font-family:"Onest",sans-serif;font-weight:500;letter-spacing:-.02em;font-size:17px;line-height:1.2;margin:0;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.5)}
  .tbbq-card__body p{position:relative;z-index:1;margin:6px 0 0;color:rgba(255,255,255,.82);font-size:14px;line-height:1.4;text-shadow:0 1px 6px rgba(0,0,0,.5)}
  .tbbq-card::after{content:"";position:absolute;inset:-8px;background:linear-gradient(115deg,rgba(0,0,0,.95) 0%,rgba(206,15,46,.92) 26%,rgba(250,112,0,.6) 48%,transparent 72%);opacity:0;transition:opacity .25s ease;pointer-events:none}
  .tbbq-card:hover::after{opacity:1}
  .tbbq-card__media.shimmer::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);animation:tbbq-shimmer 1.4s ease-in-out infinite}
  @keyframes tbbq-shimmer{100%{transform:translateX(100%)}}
</style>

<script>
(function(){
  var ENDPOINT = "__ORIGIN__${path}";
  var STEP = 20;
  var root = document.getElementById("${id}");
  var grid = root.querySelector(".tbbq-grid");
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function card(s){
    var media='<div class="tbbq-card__media'+(s.photo?' shimmer':'')+'">'+(s.photo?'<img src="'+esc(s.photo)+'" alt="'+esc(s.name)+'" loading="lazy" onload="this.parentNode.classList.remove(\\'shimmer\\')" onerror="this.parentNode.classList.remove(\\'shimmer\\')">':'')+'</div>';
    var meta=esc(s.title)+(s.company?" · "+esc(s.company):"");
    var inner=media+'<div class="tbbq-card__body"><h3>'+esc(s.name)+'</h3><p>'+meta+'</p></div>';
    var body=s.linkedin?'<a href="'+esc(s.linkedin)+'" target="_blank" rel="noopener">'+inner+'</a>':inner;
    return '<article class="tbbq-card">'+body+'</article>';
  }
  fetch(ENDPOINT).then(function(r){return r.json();}).then(function(data){
    var list=(data&&data.${listKey})||[];
    if(!list.length){grid.innerHTML='<p class="tbbq-speakers__loading">Nobody to show yet.</p>';return;}
    grid.innerHTML="";
    var shown=0;
    var more=document.createElement("button");
    more.type="button";more.className="tbbq-more";more.textContent="Load more";
    function fill(){
      var next=Math.min(shown+STEP,list.length);
      var html="";for(var i=shown;i<next;i++){html+=card(list[i]);}
      grid.insertAdjacentHTML("beforeend",html);
      shown=next;
      if(shown>=list.length)more.style.display="none";
    }
    more.onclick=fill;
    root.appendChild(more);
    fill();
  }).catch(function(){grid.innerHTML='<p class="tbbq-speakers__loading">Could not load right now.</p>';});
})();
</script>`;
}
