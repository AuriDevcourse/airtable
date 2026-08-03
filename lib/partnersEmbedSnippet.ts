// Self-contained Elementor snippet for the TechBBQ partner logo wall.
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
  transparent = false,
}: PartnersEmbedOptions = {}): string {
  const id = uid || "tbbq-partners";
  const path = "/api/partners";

  return `<!-- TechBBQ Life Science startups exhibiting — paste into an Elementor HTML widget -->
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
  #${id} .tbbq-pw__label{display:flex!important;align-items:center!important;gap:9px!important;margin:0 0 20px!important;padding:0 0 12px!important;border-bottom:1px solid rgba(255,255,255,.08)!important;font-family:var(--head)!important;font-size:13px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--row)!important}
  #${id} .tbbq-pw__label::before{content:"";width:7px;height:7px;border-radius:9999px;background:var(--row)}

  /* auto-fill, not a fixed column count: rows hold anywhere from 3 to 8 logos and a fixed
     grid would strand a half-empty last line on the short ones. This is also what makes the
     block responsive without a single media query for the desktop-to-tablet range. */
  #${id} .tbbq-pw__grid{display:grid!important;grid-template-columns:repeat(var(--cols,6),minmax(0,1fr))!important;gap:12px!important;margin:0!important;padding:0!important;list-style:none!important}

  /* display:contents so the anchor adds no box of its own — the grid keeps sizing the tile. */
  #${id} .tbbq-pw__link{display:contents!important;text-decoration:none!important}
  #${id} .tbbq-pw__tile{display:grid!important;place-items:center!important;width:100%!important;aspect-ratio:3/2;padding:18px!important;margin:0!important;border-radius:12px!important;transition:background .2s,transform .2s}
  #${id} .tbbq-pw__tile img{max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important;object-fit:contain!important;display:block!important;margin:0!important;border-radius:0!important;box-shadow:none!important}
  #${id} .tbbq-pw__link:hover .tbbq-pw__tile{background:var(--card)!important;transform:translateY(-2px)}
  /* display:contents removes the anchor's own focus box, so the ring is drawn on the tile.
     Without this the link is keyboard-reachable but invisible when focused, which a wall of
     logos with no text cannot afford. */
  #${id} .tbbq-pw__link:focus-visible .tbbq-pw__tile{outline:2px solid var(--row)!important;outline-offset:2px!important;background:var(--card)!important}
  /* Stand-in for a startup whose upload is not a browser-renderable image. */
  #${id} .tbbq-pw__tile--text{font-family:var(--head)!important;font-size:14px!important;font-weight:600!important;line-height:1.3!important;text-align:center!important;color:var(--muted)!important;border:1px dashed var(--border)!important}

  /* Narrow containers ignore --cols and step down, so an Elementor column never squeezes
     six logos into 300px. */
  @media(max-width:1100px){#${id} .tbbq-pw__grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
  @media(max-width:820px){#${id} .tbbq-pw__grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  @media(max-width:560px){
    #${id}{${transparent ? "" : "padding:20px 16px!important;border-radius:16px!important;"}}
    #${id} .tbbq-pw__grid{display:grid!important;grid-template-columns:repeat(var(--cols,6),minmax(0,1fr))!important;gap:12px!important;margin:0!important;padding:0!important;list-style:none!important}
    #${id} .tbbq-pw__tile{padding:12px!important}
    #${id} .tbbq-pw__label{font-size:11px!important}
  }
</style>

<script>
(function(){
  var root=document.getElementById("${id}");
  if(!root)return;
  var ENDPOINT="__ORIGIN__${path}";
  var ROWS=${JSON.stringify(ROWS)};
  var rowsEl=root.querySelector(".tbbq-pw__rows");
  var statusEl=root.querySelector(".tbbq-pw__status");

  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  /* Only an absolute http(s) URL becomes a live href or src — never a javascript: or data:
     URL out of an Airtable free-text cell. The feed already filters, this is defence in
     depth for a snippet that will outlive this deploy on someone else's page. */
  function safeUrl(u){var s=String(u==null?"":u).trim();return (/^https?:\\/\\//i.test(s)||/^\\/[^\\/]/.test(s))?s:"";}

  /* A logo-less partner is DROPPED from the embed, not rendered as a name tile. The name
     tiles exist so the dashboard can show which logos are still missing; on techbbq.dk they
     would just look like a mistake. Auri: "not take the ones that do not have the logo". */
  function tile(s){
    var logo=safeUrl(s.logo);
    if(!logo)return "";
    var inner='<span class="tbbq-pw__tile"><img src="'+esc(logo)+'" alt="'+esc(s.company)+'" loading="lazy"></span>';
    var site=safeUrl(s.website);
    /* No link when the partner never filled in a website: still shown, just not pointed
       somewhere invented. */
    return site
      ? '<a class="tbbq-pw__link" href="'+esc(site)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(s.company)+' website">'+inner+'</a>'
      : inner;
  }

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
      return '<section class="tbbq-pw__row" style="--row:'+row.color+';--cols:'+row.cols+'">'
        +'<h3 class="tbbq-pw__label">'+esc(row.name)+'</h3>'
        +'<div class="tbbq-pw__grid">'
        +items.map(tile).join("")
        +'</div></section>';
    }).join("");
  }).catch(function(err){
    statusEl.textContent="Could not load the partners.";
    if(window.console)console.error("[tbbq partners embed]",err);
  });
})();
</script>`;
}
