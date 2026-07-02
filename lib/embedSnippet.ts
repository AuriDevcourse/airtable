// Single source of truth for the WordPress/Elementor embed snippet. Every feed uses the
// same card grid (frame, hover glow, per-image shimmer); only two things vary per table:
//   - path:    which API route to fetch (that's how you target a specific table/role)
//   - listKey: the array key in the JSON ("speakers" for the main feed, "people" for NISS)
// __ORIGIN__ is left in place and swapped for the live URL at copy time (client-side).

export type EmbedOptions = {
  path: string; // e.g. "/api/niss-2025?role=Speaker"
  listKey: "speakers" | "people";
};

export function buildEmbedSnippet({ path, listKey }: EmbedOptions): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="tbbq-speakers" class="tbbq-speakers"><p class="tbbq-speakers__loading">Loading speakers…</p></section>

<style>
  .tbbq-speakers{--bg:#0d0d0d;--card:#131313;--fg:#f2f2f2;--muted:#9a9a9c;background:var(--bg);color:var(--fg);font-family:"Inter",ui-sans-serif,system-ui,sans-serif;padding:clamp(24px,4vw,48px);border-radius:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px}
  .tbbq-speakers__loading{grid-column:1/-1;color:var(--muted);margin:0}
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
  var root = document.getElementById("tbbq-speakers");
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  fetch(ENDPOINT).then(function(r){return r.json();}).then(function(data){
    var list=(data&&data.${listKey})||[];
    if(!list.length){root.innerHTML='<p class="tbbq-speakers__loading">No speakers yet.</p>';return;}
    root.innerHTML=list.map(function(s){
      var media='<div class="tbbq-card__media'+(s.photo?' shimmer':'')+'">'+(s.photo?'<img src="'+esc(s.photo)+'" alt="'+esc(s.name)+'" loading="lazy" onload="this.parentNode.classList.remove(\\'shimmer\\')" onerror="this.parentNode.classList.remove(\\'shimmer\\')">':'')+'</div>';
      var meta=esc(s.title)+(s.company?" · "+esc(s.company):"");
      var inner=media+'<div class="tbbq-card__body"><h3>'+esc(s.name)+'</h3><p>'+meta+'</p></div>';
      var body=s.linkedin?'<a href="'+esc(s.linkedin)+'" target="_blank" rel="noopener">'+inner+'</a>':inner;
      return '<article class="tbbq-card">'+body+'</article>';
    }).join("");
  }).catch(function(){root.innerHTML='<p class="tbbq-speakers__loading">Could not load speakers right now.</p>';});
})();
</script>`;
}
