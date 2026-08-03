// Self-contained Elementor snippet for the TechBBQ partner logo wall.
//
// Same contract as the other builders in this folder: one HTML block with #id-scoped styles
// and a small script, no build step, no framework, everything !important because WordPress
// themes restyle every generic tag. __ORIGIN__ is swapped for the live origin by the copy
// button, so copying from localhost bakes in localhost.
//
// Mirrors app/partners/page.tsx: one coloured row per tier, logos only, each linking to the
// partner's site. Fewer columns in the higher tiers, so a Prime logo renders larger than a
// Community one. Partners with no logo are dropped entirely — the dashboard keeps them as name
// tiles so the gap stays visible, but on techbbq.dk they would just look like a mistake.

export type PartnersEmbedOptions = {
  uid?: string;
  // Drop the panel's own background + padding, for a page that already provides them.
  transparent?: boolean;
};

// Kept in sync by hand with PARTNER_TIERS in lib/partners.ts. Hot at the top of the ladder,
// cooling down it, so the ranking reads without the labels. `cols` is the ranking device:
// fewer columns means a bigger logo, so Prime reads larger than Community.
const ROWS = [
  { name: "Prime", color: "#CE0F2E", cols: 4 },
  { name: "Main", color: "#FF2600", cols: 4 },
  { name: "Conqueror", color: "#FA7000", cols: 4 },
  { name: "Pioneer", color: "#fd9d04", cols: 5 },
  { name: "Core", color: "#10c8a7", cols: 5 },
  { name: "Challenger", color: "#2BB4E1", cols: 5 },
  { name: "International", color: "#7C9CFF", cols: 5 },
  { name: "Community", color: "#9a9a9c", cols: 6 },
];

export function buildPartnersEmbedSnippet({
  uid,
  // Transparent by DEFAULT. The panel used to paint its own near-black box, which on
  // techbbq.dk sat as a visible dark slab on top of the section's own background. The wall is
  // white logos on whatever the page provides; it does not need a background of its own.
  transparent = true,
}: PartnersEmbedOptions = {}): string {
  const id = uid || "tbbq-partners";
  const path = "/api/partners";

  return `<!-- TechBBQ partners — paste into an Elementor HTML widget -->
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<div id="${id}" class="tbbq-pw">
  <p class="tbbq-pw__status">Loading…</p>
  <div class="tbbq-pw__rows"></div>
</div>

<style>
  #${id}{--bg:#0d0d0d;--fg:#f2f2f2;--muted:#9a9a9c;--border:#2a2a2a;--card:#131313;
    --head:'Onest',ui-sans-serif,system-ui,sans-serif;--sans:'Inter',ui-sans-serif,system-ui,sans-serif;
    display:block!important;${transparent ? "" : "background:var(--bg)!important;padding:32px 24px!important;border-radius:20px!important;"}
    font-family:var(--sans)!important;color:var(--fg)!important;box-sizing:border-box}
  #${id} *{box-sizing:border-box}
  #${id} .tbbq-pw__status{margin:0!important;padding:0!important;color:var(--muted)!important;font-size:14px!important}

  #${id} .tbbq-pw__row{margin:0 0 34px!important;padding:0!important}
  #${id} .tbbq-pw__row:last-child{margin-bottom:0!important}
  /* Coloured dot + coloured label, not a filled band: the logos below are white and a solid
     colour bar would compete with them. */
  #${id} .tbbq-pw__label{display:flex!important;align-items:center!important;gap:9px!important;margin:0 0 20px!important;padding:0 0 12px!important;border-bottom:1px solid var(--row-line,rgba(255,255,255,.08))!important;font-family:var(--head)!important;font-size:16px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--row)!important}
  #${id} .tbbq-pw__label::before{content:"";width:7px;height:7px;border-radius:9999px;background:var(--row)}

  /* Column count per tier comes from --cols on the row: four for Prime through Conqueror,
     five in the middle, six for Community. Fewer columns means a bigger logo, which is how
     the ranking reads without anyone having to check the labels. */
  #${id} .tbbq-pw__grid{display:grid!important;grid-template-columns:repeat(var(--cols,6),minmax(0,1fr))!important;gap:16px!important;margin:0!important;padding:0!important;list-style:none!important}

  /* A real block, NOT display:contents. A theme that rewrites the anchor's display used to
     leave the tile with no height, so max-height:100% resolved against nothing and every logo
     drew at its natural size. The fixed height below is the load-bearing rule. */
  #${id} .tbbq-pw__link{display:block!important;width:100%!important;height:auto!important;margin:0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;text-decoration:none!important;color:inherit!important;line-height:0!important}
  /* Height is a FALLBACK only. sizeTiles() overwrites it with width x 0.6, so the tile is the
     same 5:3 box the dashboard uses (.lw-logo in globals.css). A fixed pixel height cannot
     match, because the column width on techbbq.dk is far wider than on the dashboard: at ~290px
     columns the correct height is 174px, and 150px squeezed every logo. That mismatch is why
     the wall looked smaller on the site than in the local preview. */
  #${id} .tbbq-pw__tile{display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:100%!important;height:150px!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;padding:18px!important;margin:0!important;border:0!important;border-radius:12px!important;background:transparent!important;line-height:0!important;overflow:hidden!important;transition:background .2s ease,transform .2s ease!important}
  #${id} .tbbq-pw__tile img{transform-origin:center center!important;transition:transform .2s ease!important;display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center center!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:none!important;aspect-ratio:auto!important}
  #${id} .tbbq-pw__link:hover .tbbq-pw__tile{background:var(--row-hover,var(--card))!important;transform:translateY(-2px)!important}
  /* The ring is drawn on the tile rather than the anchor, so it hugs the logo box.
     Without this the link is keyboard-reachable but invisible when focused, which a wall of
     logos with no text cannot afford. */
  #${id} .tbbq-pw__link:focus-visible .tbbq-pw__tile{outline:2px solid var(--row)!important;outline-offset:2px!important;background:var(--row-hover,var(--card))!important}
  /* A frieze of several marks in one file (EU co-funding strip, 13:1): it takes the whole row
     and sits at the top of its tier. The span goes on the GRID ITEM, which is the anchor when
     the partner has a website and the tile itself when it does not, so both carry the class.
     Height is left to sizeTiles(), which gives this one a much flatter box. */
  #${id} .tbbq-pw__link--wide,#${id} .tbbq-pw__tile--wide{grid-column:1 / -1!important}
  /* Stand-in for a startup whose upload is not a browser-renderable image. */
  #${id} .tbbq-pw__tile--text{font-family:var(--head)!important;font-size:14px!important;font-weight:600!important;line-height:1.3!important;text-align:center!important;color:var(--muted)!important;border:1px dashed var(--border)!important;background:transparent!important}

  /* Narrow containers ignore --cols and step down, so an Elementor column never squeezes
     six logos into 300px. */
  @media(max-width:1100px){#${id} .tbbq-pw__grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
  @media(max-width:820px){#${id} .tbbq-pw__grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  @media(max-width:560px){
    #${id}{${transparent ? "" : "padding:20px 16px!important;border-radius:16px!important;"}}
    #${id} .tbbq-pw__grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
    /* 12px to match .lw-logo's phone padding on the dashboard. Height still comes from
       sizeTiles(), so the 5:3 box holds on a phone too. */
    #${id} .tbbq-pw__tile{padding:12px!important}
    #${id} .tbbq-pw__label{font-size:13px!important}
  }
</style>

<script>
(function(){
  var root=document.getElementById("${id}");
  if(!root)return;
  var ORIGIN="__ORIGIN__";
  var ENDPOINT=ORIGIN+"${path}";
  var ROWS=${JSON.stringify(ROWS)};
  var rowsEl=root.querySelector(".tbbq-pw__rows");
  var statusEl=root.querySelector(".tbbq-pw__status");

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
     hands back "/partner-logos/<file>" and "/api/photo/...", which on the dashboard are same
     origin and just work. Pasted into techbbq.dk they silently resolve to
     https://techbbq.dk/partner-logos/... and every logo 404s, leaving a wall of empty tiles.
     That is exactly what happened on the 2026 partners page. */
  function safeUrl(u){
    var s=String(u==null?"":u).trim();
    if(/^https?:\\/\\//i.test(s))return s;
    if(/^\\/[^\\/]/.test(s))return ORIGIN+s;
    return "";
  }

  /* A logo-less partner is DROPPED from the embed, not rendered as a name tile. The name
     tiles exist so the dashboard can show which logos are still missing; on techbbq.dk they
     would just look like a mistake. Auri: "not take the ones that do not have the logo". */
  function tile(s){
    var logo=safeUrl(s.logo);
    if(!logo)return "";
    /* data-scale is the per-logo nudge from the feed and data-nofit opts a frieze out of the
       equal-area rule. Both are read by fitOne(), and both are plain attributes so the
       dashboard component and this string builder can carry them identically. */
    var attrs='';
    if(s.scale>0)attrs+=' data-scale="'+Number(s.scale)+'"';
    if(s.wide)attrs+=' data-nofit="1"';
    var inner='<span class="tbbq-pw__tile'+(s.wide?' tbbq-pw__tile--wide':'')+'"><img src="'+esc(logo)+'" alt="'+esc(s.company)+'" loading="lazy"'+attrs+'></span>';
    var site=safeUrl(s.website);
    /* No link when the partner never filled in a website: still shown, just not pointed
       somewhere invented. */
    return site
      ? '<a class="tbbq-pw__link'+(s.wide?' tbbq-pw__link--wide':'')+'" href="'+esc(site)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(s.company)+' website">'+inner+'</a>'
      : inner;
  }

  /* Even out how BIG each logo looks. object-fit:contain matches BOUNDING BOXES, and these
     range from square to 5:1, so a square mark ends up height-limited to a fraction of the
     tile while a wide wordmark fills it edge to edge. Both are correctly contained and they
     look nothing alike. Scaling to a constant AREA is much closer to how the eye judges
     "same size". Applied as a transform so no layout box moves and the grid never reflows.
     Capped at 1, because going past contain would crop the logo. */
  function fitOne(img){
    /* A multi-mark strip owns its whole row on purpose; normalising it to the same area as a
       single logo would undo that. */
    if(img.getAttribute("data-nofit"))return;
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
    /* Deliberate per-logo nudge from the feed, for the handful the area rule cannot judge:
       it measures the bounding box and cannot see that a file is mostly internal padding.
       Allowed above 1, unlike the automatic factor, but capped at 1.6 because overflow is
       hidden and an over-large scale would crop the mark. */
    var n=parseFloat(img.getAttribute("data-scale"));
    if(n>0)k=Math.min(1.6,k*n);
    img.style.transform = Math.abs(k-1)>.001 ? "scale("+k.toFixed(3)+")" : "";
  }
  /* Give every tile the dashboard's 5:3 box: height = width x 0.6, measured not guessed.
     Set as an inline style with PRIORITY, because the stylesheet above declares the fallback
     height with !important and an ordinary inline style would lose to it. This is what keeps
     the embed the same shape as the local preview at any column width. */
  function sizeTiles(){
    var tiles=root.querySelectorAll(".tbbq-pw__tile");
    for(var i=0;i<tiles.length;i++){
      var w=tiles[i].clientWidth;
      if(!w)continue;
      /* A frieze spans the row, so the 5:3 box would be a third of the page tall. 9:1 on
         desktop, 7:1 once the grid drops to three columns and the strip has less width. */
      var r=tiles[i].className.indexOf("tbbq-pw__tile--wide")>=0
        ? (window.innerWidth<=820?1/7:1/9)
        : 0.6;
      tiles[i].style.setProperty("height",Math.round(w*r)+"px","important");
    }
  }
  function fitLogos(){
    var imgs=root.querySelectorAll(".tbbq-pw__tile img");
    for(var i=0;i<imgs.length;i++){
      var im=imgs[i];
      if(im.complete)fitOne(im);
      else im.addEventListener("load",(function(x){return function(){fitOne(x);};})(im),{once:true});
    }
  }
  function layout(){sizeTiles();fitLogos();}
  /* Column count changes at the breakpoints, so the tile changes shape and every scale has to
     be recomputed. Debounced: resize fires continuously while dragging. */
  var fitTimer;
  window.addEventListener("resize",function(){clearTimeout(fitTimer);fitTimer=setTimeout(layout,120);});

  fetch(ENDPOINT).then(function(r){
    /* r.ok matters: a 429 or 502 still returns JSON with no list in it, which without this
       check reads as "no startups" rather than "could not load". */
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(data){
    var all=(data&&data.partners)||[];
    if(!all.length){statusEl.textContent="No partners to show yet.";return;}
    statusEl.remove();
    rowsEl.innerHTML=ROWS.map(function(row){
      /* One tier per partner, unlike the Life Science wall where LS Type is a multi-select. */
      var items=all.filter(function(s){return s.tier===row.name&&safeUrl(s.logo);});
      /* A row-spanning frieze goes FIRST, matching the dashboard and techbbq.dk. Anywhere
         else it would cut the grid in half and strand the tiles after it. */
      items.sort(function(a,b){return (b.wide?1:0)-(a.wide?1:0);});
      /* SKIP an empty tier. The dashboard drops rows with no partners, and without this the
         embed printed a bare "INTERNATIONAL" heading with nothing under it: there are
         currently zero International partners. Rows must be filtered here, not in the feed,
         because a tier can be non-empty in Airtable and still have no logo to show. */
      if(!items.length)return "";
      return '<section class="tbbq-pw__row" style="'+rowVars(row.color)+';--cols:'+row.cols+'">'
        +'<h3 class="tbbq-pw__label">'+esc(row.name)+'</h3>'
        +'<div class="tbbq-pw__grid">'
        +items.map(tile).join("")
        +'</div></section>';
    }).join("");
    layout();
  }).catch(function(err){
    statusEl.textContent="Could not load the partners.";
    if(window.console)console.error("[tbbq partners embed]",err);
  });
})();
</script>`;
}
