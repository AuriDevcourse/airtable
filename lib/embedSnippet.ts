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
  // Drop the dark panel behind the grid: no background, padding or rounding on the
  // wrapper, so the cards sit directly on the host page's own background. Used by the
  // Fintech speakers embed (their page brings its own backdrop).
  transparent?: boolean;
  // Centered pill tabs that filter ONE list by its `department` field — the team embed. Pass
  // the departments in the order they should appear; an "All" pill is added first and any
  // department with nobody in it is dropped. Different from `tabs` below: that mode needs a
  // multi-group endpoint, this filters a single flat list client-side after the fetch.
  deptTabs?: string[];
  // Render each person's email as a mailto link under the title. Only useful on a feed that
  // returns `email` — today that is /api/team, where staff contact addresses are public by
  // product decision. Default false so no other feed can start printing addresses by accident.
  email?: boolean;
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
  transparent = false,
  email = false,
  deptTabs,
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
  // The department filter renders the same centered pills, so both modes share the styles.
  const wantsPills = Boolean(tabs?.length) || Boolean(deptTabs?.length);
  const tabsStyles = wantsPills
    ? `
  /* Forced + #id-scoped: WordPress themes restyle every <button> globally (their own
     background, border, radius, uppercase, full width), which flattened these pills into
     theme buttons on techbbq.dk. Every property a theme touches is nailed down here. */
  #${id} .tbbq-tabs{display:flex!important;justify-content:center!important;margin:0 0 24px!important;padding:0!important;width:100%!important}
  /* radius 22px, not 9999px: with a 36px button + 4px padding a single row still reads as a
     pill, but once 10 departments wrap onto several lines a 9999px radius turns the container
     into a giant ellipse (which is exactly what it did on mobile). */
  #${id} .tbbq-tabs__pills{display:inline-flex!important;align-items:center!important;gap:4px!important;flex-wrap:wrap!important;justify-content:center!important;border-radius:22px!important;background:#131313!important;padding:4px!important;margin:0 auto!important;max-width:100%!important;box-shadow:none!important}
  #${id} .tbbq-tabs button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;height:36px!important;line-height:1!important;padding:0 16px!important;margin:0!important;border:0!important;border-radius:9999px!important;background:transparent!important;color:#9a9a9c!important;font-family:var(--head)!important;font-size:14px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:none!important;text-decoration:none!important;box-shadow:none!important;cursor:pointer!important;transition:color .15s,background .15s}
  #${id} .tbbq-tabs button:hover{color:#f2f2f2!important;background:transparent!important}
  #${id} .tbbq-tabs button[aria-selected="true"]{background:#f2f2f2!important;color:#0d0d0d!important}
  #${id} .tbbq-tabs button:focus-visible{outline:2px solid #ce0f2e!important;outline-offset:2px}
  /* Mobile: one swipeable line instead of a 5-line block. The strip scrolls horizontally,
     starts at "All", and hides its own scrollbar; snap keeps a pill from resting half cut off.
     justify-content must go back to flex-start, or an overflowing centered strip clips its
     first pills with no way to reach them. */
  @media(max-width:600px){
    #${id} .tbbq-tabs{margin:0 0 16px!important;justify-content:flex-start!important}
    #${id} .tbbq-tabs__pills{display:flex!important;flex-wrap:nowrap!important;justify-content:flex-start!important;overflow-x:auto!important;overscroll-behavior-x:contain;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-radius:22px!important;width:100%!important}
    #${id} .tbbq-tabs__pills::-webkit-scrollbar{display:none}
    #${id} .tbbq-tabs button{flex:0 0 auto!important;scroll-snap-align:start}
  }`
    : "";

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-speakers${rowsClass}">${tabsHtml}<div class="tbbq-grid"><p class="tbbq-speakers__loading">Loading…</p></div></section>

<style>
  .tbbq-speakers{--bg:${transparent ? "transparent" : "#0d0d0d"};--card:#131313;--fg:#f2f2f2;--muted:#9a9a9c;--sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--head:"Onest",var(--sans);background:var(--bg);color:var(--fg);font-family:var(--sans)!important;padding:${transparent ? "0" : "clamp(24px,4vw,48px)"};border-radius:${transparent ? "0" : "20px"}}
  .tbbq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px}
  .tbbq-speakers__loading{grid-column:1/-1;color:var(--muted);margin:0}
  .tbbq-more{display:block;margin:24px auto 0;padding:12px 28px;border:1px solid #2a2a2a;border-radius:9999px;background:#131313;color:#f2f2f2;font-family:"Onest",sans-serif;font-weight:500;font-size:14px;cursor:pointer;transition:background .18s}
  .tbbq-more:hover{background:#1b1b1b}
  @media(max-width:600px){.tbbq-grid{grid-template-columns:repeat(2,1fr);gap:12px}.tbbq-speakers{padding:${transparent ? "0" : "16px"}}}
  @media(max-width:600px){
    .tbbq-rows .tbbq-grid{grid-template-columns:1fr;gap:10px}
    /* The CARD is a block; the row is its inner wrapper (the link, or .tbbq-card__row when
       there is no LinkedIn). The card itself must NOT be the flex row: the email paragraph is
       a sibling of that wrapper, so it became a third squashed column next to the photo and
       the name. It now sits under the row, indented to line up with the text. */
    .tbbq-rows .tbbq-card{display:block;text-align:left}
    .tbbq-rows .tbbq-card>a,.tbbq-rows .tbbq-card__row{display:flex!important;align-items:center;gap:14px;text-align:left}
    .tbbq-rows .tbbq-card__media{width:84px;height:84px;flex:0 0 auto}
    .tbbq-rows .tbbq-card__body{padding:0;flex:1 1 auto;min-width:0}
    .tbbq-rows .tbbq-card__body h3{font-size:19px}
    .tbbq-rows .tbbq-card__body p{white-space:normal;overflow-wrap:break-word}
    /* 84px photo + 14px gap, so the address starts under the name rather than under the photo. */
    .tbbq-rows .tbbq-card__mail{padding:6px 0 0 98px!important;margin:0!important}
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
  /* Small on purpose — a label on the card, not content. Sized to match .s-card__stage on the
     dashboard so the embed and the preview read the same. */
  .tbbq-card__tag{position:relative;z-index:1;font-family:var(--sans)!important;margin:0 0 3px!important;color:#fa7000;font-size:10px!important;font-weight:700!important;letter-spacing:.05em!important;line-height:1.3!important;text-transform:uppercase!important}
  /* Sits outside the card's link wrapper, so it carries the body's own horizontal padding.
     Every property is !important and the anchor rules are scoped through #id: WordPress
     themes style ALL links globally (their own colour, underline, hover, sometimes a
     background or padding), and an unforced mailto lost that fight on techbbq.dk. */
  .tbbq-card__mail{position:relative;z-index:1;font-family:var(--sans)!important;margin:6px 0 0!important;padding:0 8px 4px!important;font-size:13px!important;line-height:1.4!important;overflow-wrap:anywhere;text-shadow:0 1px 6px rgba(0,0,0,.5)}
  #${id} .tbbq-card__mail a,#${id} .tbbq-card__mail a:link,#${id} .tbbq-card__mail a:visited{display:inline!important;color:rgba(255,255,255,.72)!important;background:none!important;padding:0!important;border:0!important;font-family:var(--sans)!important;font-size:13px!important;font-weight:400!important;text-transform:none!important;text-decoration:underline!important;box-shadow:none!important}
  #${id} .tbbq-card__mail a:hover,#${id} .tbbq-card__mail a:focus{color:#fff!important;text-decoration:underline!important;background:none!important}${tabsStyles}${modalStyles}${columnsCss}
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
  // Photo + text always share ONE wrapper, whether or not the person has a LinkedIn URL. On
  // mobile that wrapper is the flex row; without it, an unlinked person's photo and text
  // became separate flex children of the card and the row layout broke for them alone.
  function wrapRow(s,inner){
    return s.linkedin
      ? '<a href="'+esc(s.linkedin)+'" target="_blank" rel="noopener">'+inner+'</a>'
      : '<div class="tbbq-card__row">'+inner+'</div>';
  }
  function card(s,i){
    // Per-person vertical crop when the feed supplies one (team photos); otherwise the
    // stylesheet's 50% 30% applies.
    var pos=s.focus?' style="object-position:50% '+esc(s.focus)+'"':'';
    var media='<div class="tbbq-card__media'+(s.photo?' shimmer':'')+'">'+(s.photo?'<img src="'+esc(s.photo)+'"'+pos+' alt="'+esc(s.name)+'" loading="lazy" onload="this.parentNode.classList.remove(\\'shimmer\\')" onerror="this.parentNode.classList.remove(\\'shimmer\\')">':'')+'</div>';
    var meta=esc(s.title)+(s.company?" · "+esc(s.company):"");
    // The tag sits directly under the photo. A feed may colour it per person (Life Science
    // uses one colour per stage); without tagColor it stays the brand orange.
    var tag=s.tag?'<p class="tbbq-card__tag"'+(s.tagColor?' style="color:'+esc(s.tagColor)+'"':'')+'>'+esc(s.tag)+'</p>':'';
    ${
      email
        ? `var mail=s.email?'<p class="tbbq-card__mail"><a href="mailto:'+esc(s.email)+'">'+esc(s.email)+'</a></p>':'';`
        : `var mail="";`
    }
    var inner=media+'<div class="tbbq-card__body">'+tag+'<h3>'+esc(s.name)+'</h3><p>'+meta+'</p></div>';
    // The mailto sits AFTER the linked/clickable region, never inside it. An <a> nested in
    // another <a> is invalid: the browser silently splits the card open and the email click
    // can end up following the outer LinkedIn link instead.
    ${
      tabs?.length
        ? `if(modalOn){return '<article class="tbbq-card tbbq-card--btn" data-i="'+i+'" role="button" tabindex="0" aria-haspopup="dialog">'+inner+'</article>';}
    var body=wrapRow(s,inner);
    return '<article class="tbbq-card">'+body+mail+'</article>';`
        : modal
          ? `return '<article class="tbbq-card tbbq-card--btn" data-i="'+i+'" role="button" tabindex="0" aria-haspopup="dialog">'+inner+'</article>';`
          : `var body=wrapRow(s,inner);
    return '<article class="tbbq-card">'+body+mail+'</article>';`
    }
  }
  fetch(ENDPOINT).then(function(r){return r.json();}).then(function(data){${
    tabs?.length
      ? `
    var groups=(data&&data.groups)||{};
    // Shuffle the flagged groups once per page load (re-rolls on refresh; switching
    // tabs back keeps this load's order). Anyone with a numeric \`hierarchy\` is exempt:
    // they keep that curated order at the top and only the unranked tail is shuffled.
    var SHUFFLE=${JSON.stringify(tabs!.filter((t) => t.shuffle).map((t) => t.key))};
    function tbbqShuffle(a){for(var si=a.length-1;si>0;si--){var sj=Math.floor(Math.random()*(si+1));var st=a[si];a[si]=a[sj];a[sj]=st;}return a;}
    for(var sk=0;sk<SHUFFLE.length;sk++){
      var sg=groups[SHUFFLE[sk]];
      if(!sg)continue;
      var sRanked=[],sRest=[];
      for(var hi=0;hi<sg.length;hi++){(typeof sg[hi].hierarchy==="number"?sRanked:sRest).push(sg[hi]);}
      // Shuffle then sort — Array.sort is stable, so hierarchy ties keep the shuffled order.
      tbbqShuffle(sRanked).sort(function(a,b){return a.hierarchy-b.hierarchy;});
      groups[SHUFFLE[sk]]=sRanked.concat(tbbqShuffle(sRest));
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
    if(LOADMORE)root.appendChild(more);${
      deptTabs?.length
        ? `
    // Department filter pills. Built from the data so a department with nobody in it never
    // gets a pill, and ordered by DEPTS (anything unexpected is appended). Filtering keeps
    // the already-computed order, so the leadership block stays on top inside each tab.
    var ALLPEOPLE=list.slice();
    var DEPTS=${JSON.stringify(deptTabs)};
    var present=[];
    for(var di=0;di<DEPTS.length;di++){
      for(var pj=0;pj<ALLPEOPLE.length;pj++){
        if(ALLPEOPLE[pj].department===DEPTS[di]){present.push(DEPTS[di]);break;}
      }
    }
    for(var pk=0;pk<ALLPEOPLE.length;pk++){
      var dd=ALLPEOPLE[pk].department;
      if(dd&&DEPTS.indexOf(dd)===-1&&present.indexOf(dd)===-1)present.push(dd);
    }
    if(present.length>1){
      var tabsWrap=document.createElement("div");
      tabsWrap.className="tbbq-tabs";tabsWrap.setAttribute("role","tablist");
      tabsWrap.setAttribute("aria-label","Filter by department");
      var pills='<div class="tbbq-tabs__pills"><button type="button" role="tab" data-d="" aria-selected="true">All</button>';
      for(var pi=0;pi<present.length;pi++){
        pills+='<button type="button" role="tab" data-d="'+esc(present[pi])+'" aria-selected="false">'+esc(present[pi])+'</button>';
      }
      tabsWrap.innerHTML=pills+'</div>';
      root.insertBefore(tabsWrap,grid);
      var dBtns=tabsWrap.querySelectorAll("button");
      for(var db=0;db<dBtns.length;db++){
        dBtns[db].addEventListener("click",function(){
          for(var u=0;u<dBtns.length;u++)dBtns[u].setAttribute("aria-selected",dBtns[u]===this?"true":"false");
          var want=this.getAttribute("data-d");
          list=want?ALLPEOPLE.filter(function(p){return p.department===want;}):ALLPEOPLE.slice();
          shown=0;grid.innerHTML="";more.style.display="";fill();
        });
      }
    }`
        : ""
    }
    fill();`
  }
  }).catch(function(){grid.innerHTML='<p class="tbbq-speakers__loading">Could not load right now.</p>';});
})();
</script>`;
}
