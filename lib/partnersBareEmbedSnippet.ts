import { originDecl } from "@/lib/embedOriginGuard";
// The partner wall with the design taken out — for a THIRD PARTY to style themselves.
//
// buildPartnersEmbedSnippet() is the TechBBQ-branded wall: fonts, tier colours, a 5:3 tile, the
// equal-area logo fit, and roughly 90 !important declarations to survive a WordPress theme. All
// of that is exactly what an external agency does not want. They want the list, the logos and
// the links, in markup they can attach their own CSS to.
//
// So this builder emits the same data as semantic, class-named markup and nothing else:
//   section.tbbq-tier > h2.tbbq-tier__name + ul.tbbq-partners > li.tbbq-partner > a > img
// Every element carries a class and every item carries data-tier / data-company, so a stylesheet
// or a script on their side can target any of it without touching this snippet.
//
// What is kept from the branded builder, because it is correctness rather than taste:
//   - safeUrl(): only absolute http(s) survives as an href or src, and a site-relative feed path
//     is resolved against the CONNECTOR. Pasted on someone else's domain a bare "/api/photo/..."
//     resolves against THEIR site and every logo 404s. That bug already shipped once.
//   - logo-less partners are dropped rather than drawn as name tiles.
//   - a tier with nothing to show prints no heading.
//   - rel="noopener noreferrer" on the outbound links.
//
// __ORIGIN__ is swapped for the live origin by /api/embed, same as the other builders.

export type PartnersBareEmbedOptions = {
  uid?: string;
  // A 5-line starter stylesheet: a logo height and a flex list, no colour and no type.
  //
  // OFF by default. It shipped on, on the reasoning that unsized images render at intrinsic size
  // so a 2000px logo file draws 2000px wide — true, but "no styling" was the actual requirement
  // and the recipient is a designer who will write their own CSS before they look at it. Pass
  // css:true (or ?css=1) to get the starter block back.
  css?: boolean;
  // Drop the tier headings and emit one flat list. For a plain "our partners" logo strip that
  // does not want to publish the sponsorship ladder.
  tiers?: boolean;
};

// Tier order only — no colours, no column counts. Kept in sync by hand with PARTNER_TIERS in
// lib/partners.ts, like the branded builder above it.
const TIER_ORDER = [
  "Prime",
  "Main",
  "Conqueror",
  "Pioneer",
  "Core",
  "Challenger",
  "International",
  "Community",
];

export function buildPartnersBareEmbedSnippet({
  uid,
  css = false,
  tiers = true,
}: PartnersBareEmbedOptions = {}): string {
  const id = uid || "tbbq-partners-bare";
  const path = "/api/partners";

  // Scoped to #id so it cannot leak into the host page, and every rule is a layout minimum.
  const style = css
    ? `
<!-- ─── Starter layout only. Delete this whole <style> block to start from nothing. ─── -->
<style>
  #${id} .tbbq-partners{display:flex;flex-wrap:wrap;gap:24px;align-items:center;margin:0;padding:0;list-style:none}
  #${id} .tbbq-partner{margin:0}
  #${id} .tbbq-logo{display:block;width:auto;height:56px;max-width:200px;object-fit:contain}
  /* The EU co-funding strip is several marks in one file (~13:1). At a shared height it would
     be unreadably small, so it gets its own. */
  #${id} .tbbq-partner--wide .tbbq-logo{height:40px;max-width:520px}
</style>
`
    : "";

  return `<!-- TechBBQ partners — unstyled feed. Logos + links, class-named for your own CSS. -->
<div id="${id}" class="tbbq-partners-root">
  <p class="tbbq-partners-status">Loading partners…</p>
  <div class="tbbq-partners-body"></div>
</div>
${style}
<script>
(function(){
  var root=document.getElementById("${id}");
  if(!root)return;
${originDecl("  ")}
  var ENDPOINT=ORIGIN+"${path}";
  var TIER_ORDER=${JSON.stringify(TIER_ORDER)};
  var GROUP_BY_TIER=${tiers ? "true" : "false"};
  var bodyEl=root.querySelector(".tbbq-partners-body");
  var statusEl=root.querySelector(".tbbq-partners-status");

  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

  /* Absolute http(s) only, so a free-text Airtable cell can never become a javascript: or
     data: href. A site-relative feed path is resolved against the CONNECTOR — resolved
     against the host page instead, every logo 404s. */
  function safeUrl(u){
    var s=String(u==null?"":u).trim();
    if(/^https?:\\/\\//i.test(s))return s;
    if(/^\\/[^\\/]/.test(s))return ORIGIN+s;
    return "";
  }

  function item(p){
    var logo=safeUrl(p.logo);
    /* No logo, no tile: a name-only placeholder is a dashboard affordance, not something to
       publish on someone else's site. */
    if(!logo)return "";
    var name=esc(p.company);
    var img='<img class="tbbq-logo" src="'+esc(logo)+'" alt="'+name+'" loading="lazy" decoding="async">';
    var site=safeUrl(p.website);
    var inner=site
      ? '<a class="tbbq-partner__link" href="'+esc(site)+'" target="_blank" rel="noopener noreferrer">'+img+'</a>'
      : img;
    return '<li class="tbbq-partner'+(p.wide?' tbbq-partner--wide':'')+'"'
      +' data-tier="'+esc(p.tier)+'" data-company="'+name+'">'+inner+'</li>';
  }

  function list(items){
    /* The wide co-funding strip first, so it does not cut a flex row in half. Then groups:
       one partnership drawn as several marks stays side by side instead of being scattered by
       the shuffle above. */
    items.sort(function(a,b){
      return (b.wide?1:0)-(a.wide?1:0)
        || (b.group?1:0)-(a.group?1:0)
        || String(a.group||"").localeCompare(String(b.group||""))
        || (a.groupRank||0)-(b.groupRank||0);
    });
    return '<ul class="tbbq-partners">'+items.map(item).join("")+'</ul>';
  }

  fetch(ENDPOINT).then(function(r){
    /* A 429 or 502 still returns JSON, just without a partners array — without this it would
       read as "no partners" instead of "could not load". */
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(data){
    var all=((data&&data.partners)||[]).filter(function(p){return safeUrl(p.logo);});
    if(!all.length){statusEl.textContent="No partners to show yet.";return;}
    statusEl.remove();

    /* RANDOM ORDER WITHIN A TIER, re-rolled on every page load. The feed is alphabetical, so
       without this the same companies led their tier on every visit. Shuffled ONCE here, before
       either mode runs, because every sort downstream is stable and therefore preserves this as
       the tie-break: the flat mode's tier sort keeps it inside each tier, the grouped mode's
       per-tier filter keeps it as-is, and list()'s wide-first sort only lifts the frieze. It
       runs here rather than in the feed because the feed is CDN-cached — shuffling there would
       give every visitor in a cache window the same "random" order. */
    for(var i=all.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=all[i];all[i]=all[j];all[j]=t;}

    if(!GROUP_BY_TIER){
      /* Flat list, still in tier order: highest tier first is the only ranking left once the
         headings are gone. list() then lifts the wide strip to the front, so it can lead the
         wall from below Prime — that overrides the tier sort on purpose, it is not a slip. */
      all.sort(function(a,b){return TIER_ORDER.indexOf(a.tier)-TIER_ORDER.indexOf(b.tier);});
      bodyEl.innerHTML=list(all);
      return;
    }

    bodyEl.innerHTML=TIER_ORDER.map(function(tier){
      var items=all.filter(function(p){return p.tier===tier;});
      /* An empty tier prints nothing. There are currently no International partners, and a
         bare heading with no logos under it reads as a bug. */
      if(!items.length)return "";
      return '<section class="tbbq-tier" data-tier="'+esc(tier)+'">'
        +'<h2 class="tbbq-tier__name">'+esc(tier)+'</h2>'
        +list(items)
        +'</section>';
    }).join("");
  }).catch(function(err){
    statusEl.textContent="Could not load the partners.";
    if(window.console)console.error("[tbbq partners bare embed]",err);
  });
})();
</script>`;
}
