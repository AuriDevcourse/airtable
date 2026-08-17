import { originDecl } from "@/lib/embedOriginGuard";
// Self-contained Elementor snippet for the Intern Pool.
//
// Same contract as the other builders in this folder: one HTML block with #id-scoped styles and a
// small script, no build step, no framework, everything !important because WordPress themes
// restyle every generic tag. __ORIGIN__ is swapped for the live origin by the copy button, so
// copying from localhost bakes in localhost.
//
// ─── WHAT THIS PAGE IS FOR, BECAUSE IT CHANGES THE MARKUP ───────────────────────────────
// It is a TALENT POOL: the interns are being promoted so a recruiter reading techbbq.dk in August
// or September can hire them (Auri, 2026-08-08). That is why the card leads with the PITCH rather
// than the job title, why "Looking for" gets its own line instead of being buried in the pitch, and
// why the LinkedIn button is a button rather than a small icon in a corner.
//
// It also means the cards must not become a contact directory. No email is rendered here, and none
// is sent — /api/interns never carries the address at all (see lib/interns.ts). A recruiter goes
// through LinkedIn, which is a channel the intern controls and can close.
//
// NO GATE LIVES HERE. Consent, the photo requirement, the publish tick and the "Show until" expiry
// are all enforced server-side in lib/interns.ts, so a pasted snippet cannot show somebody who did
// not agree to be shown — including a snippet pasted a month ago and forgotten, which is the case
// that matters, since these cards are meant to come down on their own.

export type InternsEmbedOptions = {
  uid?: string;
  // Drop the panel's own background + padding, for a page that already provides them.
  transparent?: boolean;
  // The department filter row. Omit for a single-department embed, where it would be one pill.
  departments?: string[];
  // Narrow the feed to one department, for a page that is about one team.
  department?: string;
};

export function buildInternsEmbedSnippet({
  uid,
  // Transparent by DEFAULT, matching the partner wall: the panel's own near-black box read as a
  // dark slab sitting on top of the page's background.
  transparent = true,
  departments,
  department,
}: InternsEmbedOptions = {}): string {
  const id = uid || "tbbq-interns";
  const path = department
    ? `/api/interns?department=${encodeURIComponent(department)}`
    : "/api/interns";
  const depts = department ? [] : departments ?? [];

  return `<!-- TechBBQ Intern Pool — paste into an Elementor HTML widget -->
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<div id="${id}" class="tbbq-ip">
  <div class="tbbq-ip__filters" hidden></div>
  <p class="tbbq-ip__status">Loading…</p>
  <div class="tbbq-ip__grid"></div>
</div>

<style>
  #${id}{--bg:#0d0d0d;--fg:#f2f2f2;--muted:#9a9a9c;--border:#2a2a2a;--card:#131313;--card2:#1a1a1a;
    --accent:#FF2600;
    --head:'Onest',ui-sans-serif,system-ui,sans-serif;--sans:'Inter',ui-sans-serif,system-ui,sans-serif;
    display:block!important;${transparent ? "" : "background:var(--bg)!important;padding:32px 24px!important;border-radius:20px!important;"}
    font-family:var(--sans)!important;color:var(--fg)!important;box-sizing:border-box}
  #${id} *{box-sizing:border-box}
  #${id} .tbbq-ip__status{margin:0 0 18px!important;padding:0!important;color:var(--muted)!important;font-size:14px!important}

  /* DEPARTMENT PILLS. Same shape as the other embeds' filter rows. */
  #${id} .tbbq-ip__filters{display:flex!important;flex-wrap:wrap!important;gap:8px!important;margin:0 0 22px!important;padding:0!important}
  #${id} .tbbq-ip__pill{appearance:none!important;cursor:pointer!important;margin:0!important;padding:8px 15px!important;border:1px solid var(--border)!important;border-radius:9999px!important;background:transparent!important;color:var(--muted)!important;font-family:var(--head)!important;font-size:12px!important;font-weight:600!important;letter-spacing:.04em!important;line-height:1!important;box-shadow:none!important;transition:color .2s,border-color .2s,background .2s}
  #${id} .tbbq-ip__pill:hover{color:var(--fg)!important;border-color:#4a4a4a!important}
  #${id} .tbbq-ip__pill[aria-pressed="true"]{background:var(--fg)!important;border-color:var(--fg)!important;color:#0d0d0d!important}

  /* THREE ACROSS. A pitch card is a block of text, not a logo tile: at four across the pitch
     wraps to six lines and the wall stops being scannable. */
  #${id} .tbbq-ip__grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:16px!important;margin:0!important;padding:0!important;list-style:none!important}

  /* Column flex so the LinkedIn button can be pinned to the bottom with margin-top:auto and line
     up across a row of cards whose pitches are different lengths. */
  #${id} .tbbq-ip__card{position:relative!important;display:flex!important;flex-direction:column!important;margin:0!important;padding:20px!important;border:1px solid var(--border)!important;border-radius:14px!important;background:var(--card)!important;transition:border-color .2s ease,background .2s ease!important}
  #${id} .tbbq-ip__card:hover{border-color:#3d3d3d!important;background:var(--card2)!important}

  /* Photo and name sit on one row. A full-bleed headshot would make this a "meet the team" card;
     the pitch is the point, so the face is an avatar and the text gets the space.
     96px, up from 64 (Auri, 2026-08-08: "have the pictures bigger"). Keep in step with
     .ip-card__photo in app/globals.css. 96 is the ceiling for this layout: at 3 across the card's
     content box is ~330px, so anything larger squeezes a two-line name into three.
     Rounded square, not a circle (Auri, 2026-08-17): soft-radius squares frame content, pills are
     what you press. Takes effect on techbbq.dk only once the embed is copied out again. */
  #${id} .tbbq-ip__head{display:flex!important;align-items:center!important;gap:16px!important;margin:0 0 16px!important;padding:0!important}
  #${id} .tbbq-ip__photo{flex:0 0 auto!important;width:96px!important;height:96px!important;border-radius:14px!important;object-fit:cover!important;object-position:50% 30%!important;background:var(--card2)!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;display:block!important}
  #${id} .tbbq-ip__who{min-width:0!important}
  #${id} .tbbq-ip__name{margin:0!important;padding:0!important;font-family:var(--head)!important;font-size:17px!important;font-weight:600!important;line-height:1.25!important;color:#fff!important}
  #${id} .tbbq-ip__role{margin:4px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12.5px!important;line-height:1.4!important}

  /* THE PITCH, and it is the largest text in the card on purpose. */
  #${id} .tbbq-ip__pitch{margin:0!important;padding:0!important;color:rgba(255,255,255,.88)!important;font-family:var(--sans)!important;font-size:14px!important;font-weight:400!important;line-height:1.55!important}

  /* The ask. Boxed and labelled so a recruiter skimming twenty cards can read only these. */
  #${id} .tbbq-ip__ask{margin:14px 0 0!important;padding:11px 13px!important;border:0!important;border-left:3px solid var(--accent)!important;border-radius:0 8px 8px 0!important;background:rgba(255,38,0,.07)!important}
  #${id} .tbbq-ip__askLabel{display:block!important;margin:0 0 3px!important;padding:0!important;font-family:var(--head)!important;font-size:10px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--accent)!important}
  #${id} .tbbq-ip__askText{display:block!important;margin:0!important;padding:0!important;color:var(--fg)!important;font-size:13px!important;line-height:1.45!important}

  #${id} .tbbq-ip__does{margin:14px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12.5px!important;line-height:1.5!important}
  #${id} .tbbq-ip__doesLabel{color:#c9c9c9!important;font-weight:500!important}

  /* margin-top:auto is what pins this to the bottom of an uneven row. */
  #${id} .tbbq-ip__foot{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;flex-wrap:wrap!important;margin:18px 0 0!important;padding:0!important}
  #${id} .tbbq-ip__card .tbbq-ip__foot{margin-top:auto!important;padding-top:18px!important}
  #${id} .tbbq-ip__from{margin:0!important;padding:0!important;color:var(--muted)!important;font-size:11.5px!important;line-height:1.3!important}
  #${id} .tbbq-ip__li{display:inline-flex!important;align-items:center!important;gap:7px!important;margin:0!important;padding:9px 14px!important;border:1px solid var(--border)!important;border-radius:9999px!important;background:transparent!important;color:var(--fg)!important;font-family:var(--head)!important;font-size:12px!important;font-weight:600!important;line-height:1!important;text-decoration:none!important;box-shadow:none!important;transition:background .2s,border-color .2s,color .2s}
  #${id} .tbbq-ip__li:hover{background:var(--fg)!important;border-color:var(--fg)!important;color:#0d0d0d!important}
  #${id} .tbbq-ip__li svg{width:14px!important;height:14px!important;display:block!important;fill:currentColor!important}

  @media(max-width:1024px){#${id} .tbbq-ip__grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
  @media(max-width:640px){#${id} .tbbq-ip__grid{grid-template-columns:1fr!important}}
</style>

<script>
(function(){
  var root=document.getElementById(${JSON.stringify(id)});
  if(!root||root.dataset.tbbqInit)return;
  root.dataset.tbbqInit="1";

${originDecl("  ")}
  var PATH=${JSON.stringify(path)};
  var DEPTS=${JSON.stringify(depts)};
  var status=root.querySelector(".tbbq-ip__status");
  var grid=root.querySelector(".tbbq-ip__grid");
  var filters=root.querySelector(".tbbq-ip__filters");
  var all=[];
  var active="all";

  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}

  // "2026-10-01" -> "1 October". Built from the parts rather than toLocaleDateString on a parsed
  // Date: "2026-10-01" parses as UTC midnight, which is the 30th of September in a negative
  // offset, and this line is the one thing on the card a recruiter might act on a date with.
  var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  function niceDate(iso){
    if(!iso)return "";
    var p=String(iso).slice(0,10).split("-");
    if(p.length!==3)return "";
    var m=parseInt(p[1],10);
    if(!(m>=1&&m<=12))return "";
    return parseInt(p[2],10)+" "+MONTHS[m-1];
  }

  var LI='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>';

  function card(p){
    var meta=[p.role,p.department].filter(Boolean).join(" · ");
    var h='<article class="tbbq-ip__card">';
    h+='<div class="tbbq-ip__head">';
    if(p.photo){h+='<img class="tbbq-ip__photo" src="'+esc(p.photo)+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async">';}
    h+='<div class="tbbq-ip__who"><h3 class="tbbq-ip__name">'+esc(p.name)+'</h3>';
    if(meta)h+='<p class="tbbq-ip__role">'+esc(meta)+'</p>';
    h+='</div></div>';
    if(p.pitch)h+='<p class="tbbq-ip__pitch">'+esc(p.pitch)+'</p>';
    if(p.lookingFor)h+='<div class="tbbq-ip__ask"><span class="tbbq-ip__askLabel">Looking for</span><span class="tbbq-ip__askText">'+esc(p.lookingFor)+'</span></div>';
    if(p.responsibilities)h+='<p class="tbbq-ip__does"><span class="tbbq-ip__doesLabel">At TechBBQ:</span> '+esc(p.responsibilities)+'</p>';
    h+='<div class="tbbq-ip__foot">';
    var from=niceDate(p.availableFrom);
    h+='<p class="tbbq-ip__from">'+(from?"Available from "+esc(from):"")+'</p>';
    if(p.linkedin)h+='<a class="tbbq-ip__li" href="'+esc(p.linkedin)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(p.name)+' on LinkedIn">'+LI+'LinkedIn</a>';
    h+='</div></article>';
    return h;
  }

  function render(){
    var list=active==="all"?all:all.filter(function(p){return p.department===active;});
    grid.innerHTML=list.map(card).join("");
    status.textContent=list.length?"":"Nobody in the pool right now.";
  }

  function buildFilters(){
    // Only the departments that actually have somebody in them. A pill that filters to nothing
    // is a dead end, and this list is nine long against a pool that will rarely fill all of it.
    var present=DEPTS.filter(function(d){return all.some(function(p){return p.department===d;});});
    if(!DEPTS.length||present.length<2)return;
    filters.hidden=false;
    filters.innerHTML=['all'].concat(present).map(function(d){
      return '<button type="button" class="tbbq-ip__pill" data-d="'+esc(d)+'" aria-pressed="'+(d===active)+'">'+esc(d==="all"?"All":d)+'</button>';
    }).join("");
    filters.addEventListener("click",function(e){
      var b=e.target.closest(".tbbq-ip__pill");
      if(!b)return;
      active=b.getAttribute("data-d");
      filters.querySelectorAll(".tbbq-ip__pill").forEach(function(x){
        x.setAttribute("aria-pressed",String(x.getAttribute("data-d")===active));
      });
      render();
    });
  }

  fetch(ORIGIN+PATH,{headers:{Accept:"application/json"}})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(d){
      all=(d&&d.interns)||[];
      buildFilters();
      render();
    })
    .catch(function(err){
      status.textContent="Could not load the intern pool.";
      if(window.console)console.error("[tbbq-interns]",err);
    });
})();
</script>
<!-- /TechBBQ Intern Pool -->`;
}
