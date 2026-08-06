// Self-contained Elementor snippet for the Life Science startup logo wall.
//
// Same contract as the other builders in this folder: one HTML block with #id-scoped styles
// and a small script, no build step, no framework, everything !important because WordPress
// themes restyle every generic tag. __ORIGIN__ is swapped for the live origin by the copy
// button, so copying from localhost bakes in localhost.
//
// Mirrors app/ls-startups/page.tsx: three coloured rows, logos only (no names, no pitch, no
// country), each logo linking to the startup's website, and a "More soon" tile ending every
// row. The confirmed-only gate is NOT here and never should be — it lives server-side in
// lib/lsstartups.ts, so an unconfirmed applicant cannot reach a pasted snippet at all.

export type LsStartupsEmbedOptions = {
  uid?: string;
  // Drop the panel's own background + padding, for a page that already provides them.
  transparent?: boolean;
};

// Kept in sync by hand with ROWS in app/ls-startups/page.tsx. Order and colour are Auri's:
// Planetary fully green, Human Health between green and blue, Deep Tech blue.
const ROWS = [
  { name: "Planetary Health", color: "#00c11a" },
  { name: "Human Health", color: "#10c8a7" },
  { name: "Deep Tech", color: "#2BB4E1" },
];

export function buildLsStartupsEmbedSnippet({
  uid,
  // Transparent by DEFAULT: see the note in partnersEmbedSnippet.ts. The panel's own
  // near-black box read as a dark slab on top of the page's background.
  transparent = true,
}: LsStartupsEmbedOptions = {}): string {
  const id = uid || "tbbq-ls-startups";
  const path = "/api/ls-startups";

  return `<!-- TechBBQ Life Science startups exhibiting — paste into an Elementor HTML widget -->
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<div id="${id}" class="tbbq-lsw">
  <p class="tbbq-lsw__status">Loading…</p>
  <div class="tbbq-lsw__rows"></div>
</div>

<style>
  #${id}{--bg:#0d0d0d;--fg:#f2f2f2;--muted:#9a9a9c;--border:#2a2a2a;--card:#131313;
    --head:'Onest',ui-sans-serif,system-ui,sans-serif;--sans:'Inter',ui-sans-serif,system-ui,sans-serif;
    display:block!important;${transparent ? "" : "background:var(--bg)!important;padding:32px 24px!important;border-radius:20px!important;"}
    font-family:var(--sans)!important;color:var(--fg)!important;box-sizing:border-box}
  #${id} *{box-sizing:border-box}
  #${id} .tbbq-lsw__status{margin:0!important;padding:0!important;color:var(--muted)!important;font-size:14px!important}

  #${id} .tbbq-lsw__row{margin:0 0 34px!important;padding:0!important}
  #${id} .tbbq-lsw__row:last-child{margin-bottom:0!important}
  /* Coloured dot + coloured label, not a filled band: the logos below are white and a solid
     colour bar would compete with them. */
  #${id} .tbbq-lsw__label{display:flex!important;align-items:center!important;gap:9px!important;margin:0 0 20px!important;padding:0 0 12px!important;border-bottom:1px solid var(--row-line,rgba(255,255,255,.08))!important;font-family:var(--head)!important;font-size:13px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--row)!important}
  #${id} .tbbq-lsw__label::before{content:"";width:7px;height:7px;border-radius:9999px;background:var(--row)}

  /* Five across, fixed. auto-fill was packing seven into a wide container, which reads as a
     crowd rather than a wall. The three categories are heading for roughly 15/15/16, so this
     becomes a tidy three rows each; widen to six once a category is full. */
  #${id} .tbbq-lsw__grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:12px!important;margin:0!important;padding:0!important;list-style:none!important}

  /* A real block, NOT display:contents. A theme that rewrites the anchor's display used to
     leave the tile with no height, so max-height:100% resolved against nothing and every logo
     drew at its natural size. The fixed height below is the load-bearing rule. */
  #${id} .tbbq-lsw__link{display:block!important;width:100%!important;height:auto!important;margin:0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;text-decoration:none!important;color:inherit!important;line-height:0!important}
  #${id} .tbbq-lsw__tile{display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:100%!important;height:150px!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;padding:18px!important;margin:0!important;border:0!important;border-radius:12px!important;background:transparent!important;line-height:0!important;overflow:hidden!important;transition:background .2s ease,transform .2s ease!important}
  #${id} .tbbq-lsw__tile img{transform-origin:center center!important;transition:transform .2s ease!important;display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center center!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:none!important;aspect-ratio:auto!important}
  #${id} .tbbq-lsw__link:hover .tbbq-lsw__tile{background:var(--row-hover,var(--card))!important;transform:translateY(-2px)!important}
  /* The ring is drawn on the tile rather than the anchor, so it hugs the logo box. */
  #${id} .tbbq-lsw__link:focus-visible .tbbq-lsw__tile{outline:2px solid var(--row)!important;outline-offset:2px!important;background:var(--row-hover,var(--card))!important}
  /* Stand-in for a startup whose upload is not a browser-renderable image. */
  #${id} .tbbq-lsw__tile--text{font-family:var(--head)!important;font-size:14px!important;font-weight:600!important;line-height:1.3!important;text-align:center!important;color:var(--muted)!important;border:1px dashed var(--border)!important;background:transparent!important}
  /* The last tile of every row: a slot waiting to be filled, not a company. */
  #${id} .tbbq-lsw__soon{display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:100%!important;height:150px!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;padding:18px!important;margin:0!important;border:1px dashed var(--row)!important;border-radius:12px!important;opacity:.55!important;color:var(--row)!important;font-family:var(--head)!important;font-size:12px!important;font-weight:600!important;line-height:1.2!important;letter-spacing:.08em!important;text-transform:uppercase!important;text-align:center!important}

  /* Narrow containers step down from five, so an Elementor column never crushes the logos. */
  @media(max-width:1000px){#${id} .tbbq-lsw__grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
  @media(max-width:780px){#${id} .tbbq-lsw__grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  @media(max-width:560px){
    #${id}{${transparent ? "" : "padding:20px 16px!important;border-radius:16px!important;"}}
    #${id} .tbbq-lsw__grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
    #${id} .tbbq-lsw__tile,#${id} .tbbq-lsw__soon{padding:12px!important}
    #${id} .tbbq-lsw__soon{font-size:10px!important}
    #${id} .tbbq-lsw__label{font-size:11px!important}
  }
</style>

<script>
(function(){
  var root=document.getElementById("${id}");
  if(!root)return;
  var ORIGIN="__ORIGIN__";
  var ENDPOINT=ORIGIN+"${path}";
  var ROWS=${JSON.stringify(ROWS)};
  var rowsEl=root.querySelector(".tbbq-lsw__rows");
  var statusEl=root.querySelector(".tbbq-lsw__status");

  /* Two derived shades per row: a visible divider and a hover wash that reads as the row
     colour without drowning the white logo on top of it. */
  function rowVars(hex){
    var n=parseInt(String(hex).replace("#",""),16);
    var r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    return "--row:"+hex+";--row-line:rgba("+r+","+g+","+b+",.38);--row-hover:rgba("+r+","+g+","+b+",.14)";
  }
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  /* Only an absolute http(s) URL becomes a live href or src — never a javascript: or data:
     URL out of an Airtable free-text cell. The feed already filters, this is defence in
     depth for a snippet that will outlive this deploy on someone else's page. */
  /* A site-relative path is resolved against the CONNECTOR, not against the page. The feed
     hands back "/api/photo/...", which on the dashboard is same origin and just works. Pasted
     into techbbq.dk it silently resolves to https://techbbq.dk/api/photo/... and every logo
     404s, leaving a wall of empty tiles. */
  function safeUrl(u){
    var s=String(u==null?"":u).trim();
    if(/^https?:\\/\\//i.test(s))return s;
    if(/^\\/[^\\/]/.test(s))return ORIGIN+s;
    return "";
  }

  function tile(s){
    var logo=safeUrl(s.logo);
    var inner=logo
      ? '<span class="tbbq-lsw__tile"><img src="'+esc(logo)+'" alt="'+esc(s.company)+'" loading="lazy"></span>'
      : '<span class="tbbq-lsw__tile tbbq-lsw__tile--text">'+esc(s.company)+'</span>';
    var site=safeUrl(s.website);
    /* No link when the startup never filled in a Website: it still belongs on the wall,
       just not pointed somewhere invented. */
    return site
      ? '<a class="tbbq-lsw__link" href="'+esc(site)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(s.company)+' website">'+inner+'</a>'
      : inner;
  }

  /* Even out how BIG each logo looks. object-fit:contain matches BOUNDING BOXES, and these
     range from square to 5:1, so a square mark ends up height-limited to a fraction of the
     tile while a wide wordmark fills it edge to edge. Both are correctly contained and they
     look nothing alike. Scaling to a constant AREA is much closer to how the eye judges
     "same size". Applied as a transform so no layout box moves and the grid never reflows.
     Capped at 1, because going past contain would crop the logo. */
  function fitOne(img){
    var w=img.naturalWidth,h=img.naturalHeight;
    if(!w||!h)return;
    /* The IMG fills the tile's content box and object-fit:contain does the letterboxing, the
       same arrangement the dashboard uses. So the box to measure is the img itself, and it has
       no padding of its own (the tile carries it). */
    var boxW=img.clientWidth,boxH=img.clientHeight;
    if(boxW<=0||boxH<=0)return;
    var f=Math.min(boxW/w,boxH/h), area=(w*f)*(h*f);
    if(!area)return;
    var k=Math.max(.35,Math.min(1,Math.sqrt(boxW*boxH*.55/area)));
    img.style.transform = k<.999 ? "scale("+k.toFixed(3)+")" : "";
  }
  /* Give every tile the dashboard's 5:3 box: height = width x 0.6, measured not guessed.
     Set inline with PRIORITY, because the stylesheet declares the fallback height with
     !important and an ordinary inline style would lose to it. A fixed pixel height cannot
     match the dashboard, whose columns are much narrower than a full-width WordPress section.
     The "More soon" tile is sized too, or it would sit proud of the row. */
  function sizeTiles(){
    var tiles=root.querySelectorAll(".tbbq-lsw__tile,.tbbq-lsw__soon");
    for(var i=0;i<tiles.length;i++){
      var w=tiles[i].clientWidth;
      if(!w)continue;
      tiles[i].style.setProperty("height",Math.round(w*0.6)+"px","important");
    }
  }
  function fitLogos(){
    var imgs=root.querySelectorAll(".tbbq-lsw__tile img");
    for(var i=0;i<imgs.length;i++){
      var im=imgs[i];
      if(im.complete)fitOne(im);
      else im.addEventListener("load",(function(x){return function(){fitOne(x);};})(im),{once:true});
    }
  }
  /* Column count changes at the breakpoints, so the tile changes shape and every scale has to
     be recomputed. Debounced: resize fires continuously while dragging. */
  function layout(){sizeTiles();fitLogos();}
  var fitTimer;
  window.addEventListener("resize",function(){clearTimeout(fitTimer);fitTimer=setTimeout(layout,120);});

  fetch(ENDPOINT).then(function(r){
    /* r.ok matters: a 429 or 502 still returns JSON with no list in it, which without this
       check reads as "no startups" rather than "could not load". */
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(data){
    var all=(data&&data.startups)||[];
    if(!all.length){statusEl.textContent="No startups to show yet.";return;}
    statusEl.remove();
    rowsEl.innerHTML=ROWS.map(function(row){
      /* LS Type is a multi-select, so a startup in two categories appears in BOTH rows.
         That is intentional (confirmed with Auri): it is exhibiting under both. */
      var items=all.filter(function(s){return (s.categories||[]).indexOf(row.name)>=0;});
      return '<section class="tbbq-lsw__row" style="'+rowVars(row.color)+'">'
        +'<h3 class="tbbq-lsw__label">'+esc(row.name)+'</h3>'
        +'<div class="tbbq-lsw__grid">'
        +items.map(tile).join("")
        +'<span class="tbbq-lsw__soon">More soon</span>'
        +'</div></section>';
    }).join("");
    layout();
  }).catch(function(err){
    statusEl.textContent="Could not load the startups.";
    if(window.console)console.error("[tbbq ls-startups embed]",err);
  });
})();
</script>`;
}
