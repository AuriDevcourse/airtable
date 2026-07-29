// Single source of truth for the WordPress/Elementor embed snippet. Every feed uses the
// same card grid (frame, hover glow, per-image shimmer); only two things vary per table:
//   - path:    which API route to fetch (that's how you target a specific table/role)
//   - listKey: the array key in the JSON ("speakers" for the main feed, "people" for NISS)
// __ORIGIN__ is left in place and swapped for the live URL at copy time (client-side).

export type EmbedOptions = {
  path: string; // e.g. "/api/niss-2025?role=Speaker"
  listKey: "speakers" | "people" | "team";
  // Unique element id so several embeds can live on ONE WordPress page (e.g. a
  // "Previous Presenters" block and a "Previous Moderators" block). Without this they'd
  // share id="tbbq-speakers" and getElementById would only ever find the first one, so the
  // second block stays stuck on "Loading…". Generate a fresh id per copy.
  uid?: string;
  // Show the "Load more" button (reveal 20 at a time). Default true. Set false for small
  // sets (e.g. NISS 2025) where paginating a few extra cards adds no value.
  loadMore?: boolean;
  // Mobile layout. "rows" = photo-left, name+title-right list rows (default — the standard
  // mobile look for every feed). "grid" = 2 cards per row. Desktop is a grid either way.
  mobileLayout?: "grid" | "rows";
  // Hover-glow palette. "fire" = the red/orange TechBBQ gradient (default). "ls" = the
  // cyan->teal Life Science & Deep Tech gradient (#27C7E7 -> #00EAC0).
  gradient?: "fire" | "ls";
  // Click behaviour. false (default) = the card is a link straight to LinkedIn. true = the
  // card opens a detail pop-up (photo, name, title · company, bio, LinkedIn button) — matches
  // the React /speakers-2026 page. Needs a feed with a `bio` field to be useful.
  modal?: boolean;
  // Shuffle the list on every page load (Fisher-Yates, client-side). Order is re-randomized
  // each refresh — the 1-hour server/CDN cache can't freeze it because the shuffle runs in
  // the browser after the fetch. Default false (feed's own order is kept).
  //
  // Anyone the feed gives a numeric `hierarchy` is exempt: they hold that order at the top
  // and only the rest is shuffled. On a feed with no `hierarchy` field this shuffles
  // everything, which is the original behaviour.
  shuffle?: boolean;
  // How many cards each "Load more" press reveals. Ignored when loadMore is false.
  pageSize?: number;
  // Fixed number of cards per row on desktop. Default (undefined) keeps the responsive
  // auto-fill grid (~5-6 wide). Set e.g. 4 to pin the desktop grid to 4 columns. Tablet
  // (≤900px → auto-fill) and mobile (≤600px → 2-up or rows) are unaffected.
  columns?: number;
  // Multi-group tab mode (the /all-speakers-2026 embed). When set, ENDPOINT must return
  // { groups: { [key]: Person[] } } and the snippet renders a centered pill switcher
  // above the grid; clicking a pill swaps the rendered group without refetching. The
  // first entry is selected by default. listKey and the top-level modal/shuffle are
  // ignored in this mode — set them per tab instead: `shuffle` Fisher-Yates shuffles
  // that group once per page load; `modal` makes that group's cards open the detail
  // pop-up (needs bio data) while other groups link straight to LinkedIn. Cards with a
  // `tag` (which event/room a person belongs to) show it above the name.
  tabs?: { key: string; label: string; shuffle?: boolean; modal?: boolean }[];
};

// The diagonal hover glow, per palette. Same shape (black -> colour -> colour -> fade),
// only the two mid-stops change so each feed keeps a consistent card style.
const GRADIENTS: Record<"fire" | "ls", string> = {
  fire: "linear-gradient(115deg,rgba(0,0,0,.95) 0%,rgba(206,15,46,.92) 26%,rgba(250,112,0,.6) 48%,transparent 72%)",
  ls: "linear-gradient(115deg,rgba(0,0,0,.95) 0%,rgba(39,199,231,.92) 26%,rgba(0,234,192,.6) 48%,transparent 72%)",
};

export function buildEmbedSnippet({
  path,
  listKey,
  uid,
  loadMore = true,
  mobileLayout = "rows",
  gradient = "fire",
  modal = false,
  shuffle = false,
  pageSize = 20,
  columns,
  tabs,
}: EmbedOptions): string {
  const id = uid || "tbbq-speakers";
  const rowsClass = mobileLayout === "rows" ? " tbbq-rows" : "";
  const hoverGradient = GRADIENTS[gradient];
  // Tab mode renders its own multi-group script; the single-list extras don't apply
  // (modal/shuffle are per-tab there). tabModal keeps the pop-up styles + setup in.
  const tabModal = Boolean(tabs?.length && tabs.some((t) => t.modal));
  if (tabs?.length) {
    modal = false;
    shuffle = false;
  }
  // Pin the desktop grid to a fixed column count when asked. Scoped to ≥901px so the
  // tablet (auto-fill) and mobile (2-up / rows) rules below are untouched. The #id makes
  // it win over the base .tbbq-grid; minmax(0,1fr) stops long names overflowing the track.
  const columnsCss =
    columns && columns > 0
      ? `
  @media(min-width:901px){#${id}.tbbq-speakers .tbbq-grid{grid-template-columns:repeat(${columns},minmax(0,1fr))}}`
      : "";

  // Extra CSS for the detail pop-up. Scoped so it can't leak into the host WordPress page.
  const modalStyles = modal || tabModal
    ? `
  .tbbq-speakers .tbbq-card--btn{cursor:pointer}
  .tbbq-speakers .tbbq-card--btn:focus-visible{outline:2px solid #ce0f2e;outline-offset:2px}
  .tbbq-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);font-family:var(--sans)!important}
  .tbbq-modal__panel{position:relative;width:100%;max-width:420px;max-height:calc(100vh - 40px);overflow-y:auto;background:#191919;border-radius:20px}
  .tbbq-modal__close{position:absolute;top:12px;right:12px;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:0;border-radius:9999px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer}
  .tbbq-modal__close:hover{background:rgba(0,0,0,.78)}
  .tbbq-modal__media{aspect-ratio:4/3;overflow:hidden;border-radius:20px 20px 0 0;background:#1d1d1d}
  .tbbq-modal__media img{width:100%;height:100%;object-fit:cover;object-position:50% 25%;display:block}
  .tbbq-modal__body{padding:20px 22px 24px}
  .tbbq-modal__name{font-family:var(--head)!important;font-weight:500;letter-spacing:-.02em;font-size:22px;line-height:1.15;margin:0;color:#fff}
  .tbbq-modal__meta{font-family:var(--sans)!important;margin:8px 0 0;color:#fa7000;font-size:14px;line-height:1.4}
  .tbbq-modal__bio{font-family:var(--sans)!important;margin:16px 0 0;color:#9a9a9c;font-size:15px;line-height:1.6;white-space:pre-line}
  .tbbq-modal__bio--empty{font-style:italic}
  .tbbq-modal__li{display:inline-flex;align-items:center;gap:8px;margin-top:20px;padding:10px 18px;border-radius:9999px;background:#f2f2f2;color:#0d0d0d;font-family:var(--head)!important;font-weight:600;font-size:14px;text-decoration:none}
  .tbbq-modal__li:hover{background:#fff}`
    : "";

  // Extra JS that builds the pop-up and wires clicks (event-delegated by card index).
  // Injected inside the fetch callback, right after the grid is cleared, so `list` exists.
  const modalSetup = modal || tabModal
    ? `
    var docOverflow="";
    var lastFocus=null;
    var modalEl=document.createElement("div");
    modalEl.className="tbbq-modal";modalEl.setAttribute("role","presentation");modalEl.style.display="none";
    modalEl.innerHTML='<div class="tbbq-modal__panel" role="dialog" aria-modal="true" aria-label="Speaker details"><button type="button" class="tbbq-modal__close" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button><div class="tbbq-modal__media"></div><div class="tbbq-modal__body"><h3 class="tbbq-modal__name"></h3><p class="tbbq-modal__meta"></p><p class="tbbq-modal__bio"></p><a class="tbbq-modal__li" target="_blank" rel="noopener"></a></div></div>';
    root.appendChild(modalEl);
    var mClose=modalEl.querySelector(".tbbq-modal__close");
    var mMedia=modalEl.querySelector(".tbbq-modal__media");
    var mName=modalEl.querySelector(".tbbq-modal__name");
    var mMeta=modalEl.querySelector(".tbbq-modal__meta");
    var mBio=modalEl.querySelector(".tbbq-modal__bio");
    var mLi=modalEl.querySelector(".tbbq-modal__li");
    function openModal(s){
      if(!s)return;
      lastFocus=document.activeElement;
      mMedia.innerHTML=s.photo?'<img src="'+esc(s.photo)+'" alt="'+esc(s.name)+'">':'';
      mName.textContent=s.name||"";
      var meta=(s.title||"")+(s.company?" \\u00b7 "+s.company:"");
      mMeta.textContent=meta;mMeta.style.display=meta?"":"none";
      if(s.bio){mBio.textContent=s.bio;mBio.className="tbbq-modal__bio";}
      else{mBio.textContent="No description available yet.";mBio.className="tbbq-modal__bio tbbq-modal__bio--empty";}
      if(s.linkedin){mLi.href=s.linkedin;mLi.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.34 18.34V9.9H5.67v8.44h2.67zM7 8.5a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1zm11.34 9.84v-4.63c0-2.48-1.32-3.63-3.09-3.63-1.42 0-2.06.78-2.42 1.33V9.9h-2.67v8.44h2.67v-4.47c0-.24.02-.47.09-.64.19-.47.62-.96 1.34-.96.95 0 1.32.72 1.32 1.77v4.3h2.67z"></path></svg> View LinkedIn profile';mLi.style.display="";}
      else{mLi.style.display="none";}
      modalEl.style.display="flex";
      docOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
      mClose.focus();
    }
    function closeModal(){modalEl.style.display="none";document.body.style.overflow=docOverflow;if(lastFocus&&lastFocus.focus)lastFocus.focus();}
    mClose.addEventListener("click",closeModal);
    modalEl.addEventListener("mousedown",function(e){if(e.target===modalEl)closeModal();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&modalEl.style.display!=="none")closeModal();});
    grid.addEventListener("click",function(e){var c=e.target.closest(".tbbq-card");if(c&&c.getAttribute("data-i")!=null)openModal(list[+c.getAttribute("data-i")]);});
    grid.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){var c=e.target.closest(".tbbq-card");if(c&&c.getAttribute("data-i")!=null){e.preventDefault();openModal(list[+c.getAttribute("data-i")]);}}});`
    : "";

  // Centered pill switcher markup + styles, only in tab mode.
  const tabsHtml = tabs?.length
    ? `<div class="tbbq-tabs" role="tablist" aria-label="Speaker group"><div class="tbbq-tabs__pills">${tabs
        .map(
          (t, i) =>
            `<button type="button" role="tab" data-k="${t.key}" aria-selected="${i === 0 ? "true" : "false"}">${t.label}</button>`
        )
        .join("")}</div></div>`
    : "";
  const tabsStyles = tabs?.length
    ? `
  .tbbq-tabs{display:flex;justify-content:center;margin:0 0 24px}
  .tbbq-tabs__pills{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:center;border-radius:9999px;background:#131313;padding:4px}
  .tbbq-tabs button{height:36px;padding:0 16px;border:0;border-radius:9999px;background:transparent;color:#9a9a9c;font-family:var(--head)!important;font-size:14px;font-weight:500;cursor:pointer;transition:color .15s,background .15s}
  .tbbq-tabs button:hover{color:#f2f2f2}
  .tbbq-tabs button[aria-selected="true"]{background:#f2f2f2;color:#0d0d0d}
  .tbbq-tabs button:focus-visible{outline:2px solid #ce0f2e;outline-offset:2px}
  @media(max-width:600px){.tbbq-tabs{margin:0 0 16px}}`
    : "";

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-speakers${rowsClass}">${tabsHtml}<div class="tbbq-grid"><p class="tbbq-speakers__loading">Loading…</p></div></section>

<style>
  .tbbq-speakers{--bg:#0d0d0d;--card:#131313;--fg:#f2f2f2;--muted:#9a9a9c;--sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--head:"Onest",var(--sans);background:var(--bg);color:var(--fg);font-family:var(--sans)!important;padding:clamp(24px,4vw,48px);border-radius:20px}
  .tbbq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px}
  .tbbq-speakers__loading{grid-column:1/-1;color:var(--muted);margin:0}
  .tbbq-more{display:block;margin:24px auto 0;padding:12px 28px;border:1px solid #2a2a2a;border-radius:9999px;background:#131313;color:#f2f2f2;font-family:"Onest",sans-serif;font-weight:500;font-size:14px;cursor:pointer;transition:background .18s}
  .tbbq-more:hover{background:#1b1b1b}
  @media(max-width:600px){.tbbq-grid{grid-template-columns:repeat(2,1fr);gap:12px}.tbbq-speakers{padding:16px}}
  @media(max-width:600px){
    .tbbq-rows .tbbq-grid{grid-template-columns:1fr;gap:10px}
    .tbbq-rows .tbbq-card,.tbbq-rows .tbbq-card>a{display:flex;align-items:center;gap:14px;text-align:left}
    .tbbq-rows .tbbq-card__media{width:84px;height:84px;flex:0 0 auto}
    .tbbq-rows .tbbq-card__body{padding:0;flex:1 1 auto;min-width:0}
    .tbbq-rows .tbbq-card__body h3{font-size:19px}
    .tbbq-rows .tbbq-card__body p{white-space:normal;overflow-wrap:break-word}
  }
  .tbbq-card{position:relative;background:var(--card);border-radius:20px;padding:8px;overflow:hidden}
  .tbbq-card a{text-decoration:none;color:inherit;display:block}
  .tbbq-card__media{position:relative;z-index:1;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:#1d1d1d}
  .tbbq-card__media img{width:100%;height:100%;object-fit:cover;object-position:50% 30%;display:block}
  .tbbq-card__body{position:relative;padding:12px 8px 4px}
  .tbbq-card__body h3{position:relative;z-index:1;font-family:var(--head)!important;font-weight:500;letter-spacing:-.02em;font-size:17px;line-height:1.2;margin:0;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.5)}
  .tbbq-card__body p{position:relative;z-index:1;font-family:var(--sans)!important;margin:6px 0 0;color:rgba(255,255,255,.82);font-size:14px;line-height:1.4;text-shadow:0 1px 6px rgba(0,0,0,.5)}
  .tbbq-card::after{content:"";position:absolute;inset:-8px;background:${hoverGradient};opacity:0;transition:opacity .25s ease;pointer-events:none}
  .tbbq-card:hover::after{opacity:1}
  .tbbq-card__media.shimmer::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);animation:tbbq-shimmer 1.4s ease-in-out infinite}
  @keyframes tbbq-shimmer{100%{transform:translateX(100%)}}
  .tbbq-card__tag{position:relative;z-index:1;font-family:var(--sans)!important;margin:0 0 4px;color:#fa7000;font-size:12px;font-weight:600;letter-spacing:.02em}${tabsStyles}${modalStyles}${columnsCss}
</style>

<script>
(function(){
  var ENDPOINT = "__ORIGIN__${path}";
  var STEP = ${loadMore ? String(pageSize) : "1000000"};
  var LOADMORE = ${loadMore ? "true" : "false"};
  var root = document.getElementById("${id}");
  var grid = root.querySelector(".tbbq-grid");${
    tabs?.length
      ? `
  // Whether the currently shown group opens the detail pop-up (card() reads this,
  // show() sets it — both live at this scope).
  var modalOn=false;`
      : ""
  }
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function card(s,i){
    var media='<div class="tbbq-card__media'+(s.photo?' shimmer':'')+'">'+(s.photo?'<img src="'+esc(s.photo)+'" alt="'+esc(s.name)+'" loading="lazy" onload="this.parentNode.classList.remove(\\'shimmer\\')" onerror="this.parentNode.classList.remove(\\'shimmer\\')">':'')+'</div>';
    var meta=esc(s.title)+(s.company?" · "+esc(s.company):"");
    var tag=s.tag?'<p class="tbbq-card__tag">'+esc(s.tag)+'</p>':'';
    var inner=media+'<div class="tbbq-card__body">'+tag+'<h3>'+esc(s.name)+'</h3><p>'+meta+'</p></div>';
    ${
      tabs?.length
        ? `if(modalOn){return '<article class="tbbq-card tbbq-card--btn" data-i="'+i+'" role="button" tabindex="0" aria-haspopup="dialog">'+inner+'</article>';}
    var body=s.linkedin?'<a href="'+esc(s.linkedin)+'" target="_blank" rel="noopener">'+inner+'</a>':inner;
    return '<article class="tbbq-card">'+body+'</article>';`
        : modal
          ? `return '<article class="tbbq-card tbbq-card--btn" data-i="'+i+'" role="button" tabindex="0" aria-haspopup="dialog">'+inner+'</article>';`
          : `var body=s.linkedin?'<a href="'+esc(s.linkedin)+'" target="_blank" rel="noopener">'+inner+'</a>':inner;
    return '<article class="tbbq-card">'+body+'</article>';`
    }
  }
  fetch(ENDPOINT).then(function(r){return r.json();}).then(function(data){${
    tabs?.length
      ? `
    var groups=(data&&data.groups)||{};
    // Shuffle the flagged groups once per page load (re-rolls on refresh; switching
    // tabs back keeps this load's order).
    var SHUFFLE=${JSON.stringify(tabs!.filter((t) => t.shuffle).map((t) => t.key))};
    for(var sk=0;sk<SHUFFLE.length;sk++){
      var sg=groups[SHUFFLE[sk]];
      if(sg)for(var si=sg.length-1;si>0;si--){var sj=Math.floor(Math.random()*(si+1));var st=sg[si];sg[si]=sg[sj];sg[sj]=st;}
    }
    // Groups whose cards open the detail pop-up instead of linking to LinkedIn.
    var MODAL=${JSON.stringify(Object.fromEntries((tabs ?? []).filter((t) => t.modal).map((t) => [t.key, true])))};
    var list=[];
    var shown=0;
    var more=document.createElement("button");
    more.type="button";more.className="tbbq-more";more.textContent="Load more";
    function fill(){
      var next=Math.min(shown+STEP,list.length);
      var html="";for(var i=shown;i<next;i++){html+=card(list[i],i);}
      grid.insertAdjacentHTML("beforeend",html);
      shown=next;
      more.style.display=shown>=list.length?"none":"";
    }
    more.onclick=fill;
    if(LOADMORE)root.appendChild(more);${tabModal ? modalSetup : ""}
    function show(key){
      modalOn=!!MODAL[key];
      list=groups[key]||[];
      shown=0;
      more.style.display="none";
      if(!list.length){grid.innerHTML='<p class="tbbq-speakers__loading">Nobody to show yet.</p>';return;}
      grid.innerHTML="";
      fill();
    }
    var tabBtns=root.querySelectorAll(".tbbq-tabs button");
    for(var t=0;t<tabBtns.length;t++){
      tabBtns[t].addEventListener("click",function(){
        for(var u=0;u<tabBtns.length;u++)tabBtns[u].setAttribute("aria-selected",tabBtns[u]===this?"true":"false");
        show(this.getAttribute("data-k"));
      });
    }
    show(${JSON.stringify(tabs[0].key)});`
      : `
    var list=(data&&data.${listKey})||[];
    if(!list.length){grid.innerHTML='<p class="tbbq-speakers__loading">Nobody to show yet.</p>';return;}${
      shuffle
        ? `
    function tbbqShuffle(a){for(var si=a.length-1;si>0;si--){var sj=Math.floor(Math.random()*(si+1));var st=a[si];a[si]=a[sj];a[sj]=st;}return a;}
    var tbbqRanked=[],tbbqRest=[];
    for(var hi=0;hi<list.length;hi++){(typeof list[hi].hierarchy==="number"?tbbqRanked:tbbqRest).push(list[hi]);}
    // Shuffle then sort — Array.sort is stable, so equal hierarchy values keep the shuffled
    // order instead of one person always outranking their tie.
    tbbqShuffle(tbbqRanked).sort(function(a,b){return a.hierarchy-b.hierarchy;});
    list=tbbqRanked.concat(tbbqShuffle(tbbqRest));`
        : ""
    }
    grid.innerHTML="";${modalSetup}
    var shown=0;
    var more=document.createElement("button");
    more.type="button";more.className="tbbq-more";more.textContent="Load more";
    function fill(){
      var next=Math.min(shown+STEP,list.length);
      var html="";for(var i=shown;i<next;i++){html+=card(list[i],i);}
      grid.insertAdjacentHTML("beforeend",html);
      shown=next;
      if(shown>=list.length)more.style.display="none";
    }
    more.onclick=fill;
    if(LOADMORE)root.appendChild(more);
    fill();`
  }
  }).catch(function(){grid.innerHTML='<p class="tbbq-speakers__loading">Could not load right now.</p>';});
})();
</script>`;
}
