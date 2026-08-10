import { endpointDecl } from "@/lib/embedOriginGuard";
// WordPress/Elementor embed snippet for the Side Events & Event Rooms grid.
//
// A SEPARATE builder from lib/embedSnippet.ts on purpose. That one renders a person card
// (square photo, name, title · company, LinkedIn) and every option on it is about people —
// modal bios, LinkedIn links, department pills, per-image focus. An event card is a
// different object: a contained logo on a coloured panel, a type badge, an access badge, a
// date, a clamped blurb and a Register button. Bending one builder to do both would mean a
// second set of mutually exclusive branches through code that already carries tab mode.
// The two share only conventions, which are deliberately kept identical:
//   - __ORIGIN__ is swapped for the live URL at copy time (client-side), so copy from the
//     DEPLOYED dashboard or the snippet bakes in localhost.
//   - Everything is #id-scoped and !important on any property a WordPress theme touches.
//     Themes restyle <button> and <a> globally and HARD; that is what flattened the team
//     pills into theme buttons (session 30g) and overrode the mailto colour (30f).
//   - The fetch checks r.ok. A 429/502 still returns valid JSON ({error:…}) with no list,
//     which without the check reads as an empty roster and prints "Nothing to show yet."
//     during an outage (the audit bug, session 31b).

export type EventEmbedOptions = {
  // Feed path. "/api/partner-events" for both kinds, or add ?kind=side-event /
  // ?kind=event-room for a single-kind block.
  path: string;
  // Unique element id so several embeds can live on ONE WordPress page. Without it they
  // share an id and getElementById only ever finds the first, leaving the second stuck on
  // "Loading…". Generate a fresh one per copy.
  uid?: string;
  // Centered pill tabs that filter the ONE fetched list client-side on `kind` (All / Side
  // Events / Event Rooms). Default true. Pointless on a ?kind=… endpoint — pass false.
  kindTabs?: boolean;
  // Drop the dark panel behind the grid so the cards sit on the host page's own
  // background, like the Fintech embed's `transparent`.
  transparent?: boolean;
  // Fixed desktop column count. Default (undefined) is the responsive auto-fill grid.
  columns?: number;
};

export function buildEventEmbedSnippet({
  path,
  uid,
  kindTabs = true,
  transparent = false,
  columns,
}: EventEmbedOptions): string {
  const id = uid || "tbbq-events";

  const columnsCss =
    columns && columns > 0
      ? `
  @media(min-width:1001px){#${id}.tbbq-events .tbbq-ev-grid{grid-template-columns:repeat(${columns},minmax(0,1fr))!important}}`
      : "";

  // Tabs are built from the fetched DATA, not hardcoded: a kind nobody has gets no pill,
  // and the row is skipped entirely when only one kind is present (same rule as the team
  // embed's deptTabs). Counts come from the list so they can never drift from the grid.
  const tabsHtml = kindTabs
    ? `<div class="tbbq-ev-tabs" role="tablist" aria-label="Event type"><div class="tbbq-ev-tabs__pills"></div></div>`
    : "";

  const tabsStyles = kindTabs
    ? `
  #${id} .tbbq-ev-tabs{display:flex!important;justify-content:center!important;margin:0 0 24px!important;padding:0!important;width:100%!important}
  /* radius 22px, not 9999px: one 36px row still reads as a pill, but a wrapped block with a
     9999px radius renders as a giant ellipse (exactly what the team pills did on mobile). */
  #${id} .tbbq-ev-tabs__pills{display:inline-flex!important;align-items:center!important;gap:4px!important;flex-wrap:wrap!important;justify-content:center!important;border-radius:22px!important;background:#131313!important;padding:4px!important;margin:0 auto!important;max-width:100%!important;box-shadow:none!important}
  #${id} .tbbq-ev-tabs button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;height:36px!important;line-height:1!important;padding:0 16px!important;margin:0!important;border:0!important;border-radius:9999px!important;background:transparent!important;color:#9a9a9c!important;font-family:var(--head)!important;font-size:14px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:none!important;text-decoration:none!important;box-shadow:none!important;cursor:pointer!important;transition:color .15s,background .15s}
  #${id} .tbbq-ev-tabs button:hover{color:#f2f2f2!important;background:transparent!important}
  /* The selected pill takes that KIND's colour (red / blue); "All" falls back to white. */
  #${id} .tbbq-ev-tabs button[aria-selected="true"]{background:var(--pill,#f2f2f2)!important;color:#fff!important}
  #${id} .tbbq-ev-tabs button[aria-selected="true"][data-k="all"]{background:#f2f2f2!important;color:#0d0d0d!important}
  #${id} .tbbq-ev-tabs button:focus-visible{outline:2px solid #ce0f2e!important;outline-offset:2px}
  /* Mobile: one swipeable line. justify-content MUST return to flex-start — a centered
     overflowing strip clips its first pills with no way to scroll back to them. */
  @media(max-width:600px){
    #${id} .tbbq-ev-tabs{margin:0 0 16px!important;justify-content:flex-start!important}
    #${id} .tbbq-ev-tabs__pills{display:flex!important;flex-wrap:nowrap!important;justify-content:flex-start!important;overflow-x:auto!important;overscroll-behavior-x:contain;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-radius:22px!important;width:100%!important}
    #${id} .tbbq-ev-tabs__pills::-webkit-scrollbar{display:none}
    #${id} .tbbq-ev-tabs button{flex:0 0 auto!important;scroll-snap-align:start}
  }`
    : "";

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-events">${tabsHtml}<div class="tbbq-ev-grid"><p class="tbbq-ev__loading">Loading…</p></div></section>

<style>
  #${id}.tbbq-events{--bg:${transparent ? "transparent" : "#0d0d0d"};--card:#131313;--fg:#f2f2f2;--muted:#9a9a9c;--border:#2a2a2a;--sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--head:"Onest",var(--sans);background:var(--bg);color:var(--fg);font-family:var(--sans)!important;padding:${transparent ? "0" : "clamp(24px,4vw,48px)"};border-radius:${transparent ? "0" : "20px"}}
  /* auto-fill with a 300px floor: event cards carry a date row, a title, a blurb and a
     button, so they need more width than a speaker card's 230px. */
  #${id} .tbbq-ev-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))!important;gap:20px!important;margin:0!important;padding:0!important;list-style:none!important}
  /* Explicit font-family on every p element: a theme rule targeting bare p beats the
     section's inherited font, which is how the company + description text ended up
     rendering in the host theme's Georgia serif. (No backticks in these comments — this
     whole block is inside a JS template literal, so one would terminate the string.) */
  #${id} .tbbq-ev__loading{font-family:var(--sans)!important;grid-column:1/-1;color:var(--muted);margin:0}
  #${id} .tbbq-ev__empty{font-family:var(--sans)!important;grid-column:1/-1;color:var(--muted);margin:0}

  /* Matches .s-card on the dashboard and every other TechBBQ embed: flat dark frame, a
     uniform 1px border (no coloured spine), and a diagonal glow that fades in on hover
     behind the text band rather than a lift. */
  #${id} .tbbq-ev-card{position:relative!important;display:flex!important;flex-direction:column!important;background:var(--card)!important;border:1px solid var(--border)!important;border-radius:16px!important;padding:8px!important;margin:0!important;overflow:hidden!important;transition:border-color .25s ease}
  /* inset:-8px pushes the glow past the card's own padding so it reaches the real bottom
     edge, exactly as .s-card::after does. */
  #${id} .tbbq-ev-card::after{content:"";position:absolute;inset:-8px;background:linear-gradient(115deg,rgba(0,0,0,.95) 0%,var(--glow-a) 26%,var(--glow-b) 48%,transparent 72%);opacity:0;transition:opacity .25s ease;pointer-events:none}
  #${id} .tbbq-ev-card:hover::after{opacity:1}
  #${id} .tbbq-ev-card:hover{border-color:var(--kind)!important}

  /* Logo CONTAINED on a LIGHT tint of the kind colour. Contained because these are
     wordmarks with their own padding and cover would slice them mid-word; light because
     most partner logos are dark-on-transparent and vanished on a dark panel. The hairline
     drop-shadow traces glyph edges so the minority of WHITE logos stay discernible. */
  /* z-index keeps the logo above the hover glow, so the glow stays in the bottom band. */
  #${id} .tbbq-ev-card__media{position:relative!important;z-index:1!important;aspect-ratio:16/9;border-radius:12px!important;overflow:hidden!important;background:var(--panel)!important;display:grid!important;place-items:center!important;padding:20px!important}
  #${id} .tbbq-ev-card__media img{max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important;object-fit:contain!important;display:block!important;margin:0!important;border-radius:0!important;box-shadow:none!important;filter:drop-shadow(0 0 1px rgba(0,0,0,.45))}
  #${id} .tbbq-ev-card__initial{font-family:var(--head)!important;font-size:34px!important;font-weight:700!important;color:var(--kind)!important;letter-spacing:-.02em}

  #${id} .tbbq-ev-card__body{position:relative!important;z-index:1!important;padding:14px 8px 8px!important;display:flex!important;flex-direction:column!important;flex:1!important}
  #${id} .tbbq-ev-card__tags{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:6px!important}
  #${id} .tbbq-ev-card__kind{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:3px 9px!important;border-radius:9999px!important;background:var(--soft)!important;color:var(--kind)!important;font-family:var(--head)!important;font-size:10px!important;font-weight:700!important;text-transform:uppercase!important;letter-spacing:.06em!important}
  #${id} .tbbq-ev-card__kind::before{content:"";width:5px;height:5px;border-radius:9999px;background:currentColor}
  /* Access is deliberately NOT in the kind colour — it is a different axis (who may
     attend); colouring it red/blue too would read as a second type badge. */
  #${id} .tbbq-ev-card__access{padding:3px 9px!important;border-radius:9999px!important;border:1px solid var(--border)!important;background:#191919!important;color:var(--muted)!important;font-family:var(--head)!important;font-size:10px!important;font-weight:600!important;text-transform:uppercase!important;letter-spacing:.05em!important}
  #${id} .tbbq-ev-card__access--private{color:#fd9d04!important;border-color:rgba(253,157,4,.35)!important}
  /* Day + time are ONE wrapping unit, so a card with a third badge wraps both onto the
     next line rather than stranding the time alone under the badges. */
  #${id} .tbbq-ev-card__when{margin-left:auto!important;display:inline-flex!important;align-items:baseline!important;gap:6px!important}
  #${id} .tbbq-ev-card__date{text-shadow:0 1px 6px rgba(0,0,0,.5)!important;color:var(--fg)!important;font-family:var(--head)!important;font-size:12px!important;font-weight:600!important;white-space:nowrap}
  #${id} .tbbq-ev-card__date--tbc{color:var(--muted)!important;font-weight:500!important;font-style:italic!important}
  /* Follows the date, which keeps the margin-left:auto, so the pair sits at the right edge
     together. Muted against the date: the day is the coarser fact, scanned first. */
  #${id} .tbbq-ev-card__time{color:var(--muted)!important;font-family:var(--head)!important;font-size:12px!important;font-weight:500!important;white-space:nowrap;text-shadow:0 1px 6px rgba(0,0,0,.5)!important}

  #${id} .tbbq-ev-card__title{font-family:var(--head)!important;text-shadow:0 1px 6px rgba(0,0,0,.5)!important;margin:10px 0 0!important;padding:0!important;font-size:16px!important;font-weight:600!important;line-height:1.25!important;color:#fff!important;text-transform:none!important;letter-spacing:normal!important}
  #${id} .tbbq-ev-card__company{margin:5px 0 0!important;font-family:var(--sans)!important;text-shadow:0 1px 6px rgba(0,0,0,.5)!important;padding:0!important;color:var(--muted)!important;font-size:13px!important;line-height:1.4!important}
  /* Clamped to 3 lines rather than truncated in the feed, so the full text stays available
     to other consumers of the JSON. */
  #${id} .tbbq-ev-card__desc{margin:10px 0 0!important;font-family:var(--sans)!important;text-shadow:0 1px 6px rgba(0,0,0,.5)!important;padding:0!important;color:rgba(255,255,255,.78)!important;font-size:13px!important;line-height:1.5!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

  /* margin-top:auto so cards with and without a blurb line their buttons up. */
  #${id} .tbbq-ev-card__cta{margin-top:auto!important;padding-top:14px!important}
  #${id} .tbbq-ev-card__cta a{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;padding:9px 18px!important;border:0!important;border-radius:9999px!important;background:var(--kind)!important;color:#fff!important;font-family:var(--head)!important;font-size:13px!important;font-weight:600!important;text-transform:none!important;text-decoration:none!important;letter-spacing:normal!important;box-shadow:none!important;transition:filter .18s}
  #${id} .tbbq-ev-card__cta a:hover,#${id} .tbbq-ev-card__cta a:visited,#${id} .tbbq-ev-card__cta a:link{color:#fff!important;text-decoration:none!important}
  #${id} .tbbq-ev-card__cta a:hover{filter:brightness(1.12)}
  #${id} .tbbq-ev-card__cta a:focus-visible{outline:2px solid #fff!important;outline-offset:2px}

  /* Tablet/mobile. One column below 640px, and the logo panel gets shallower so a card is
     not mostly logo on a narrow screen. */
  @media(max-width:1000px){#${id} .tbbq-ev-grid{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))!important}}
  @media(max-width:640px){
    #${id}.tbbq-events{padding:${transparent ? "0" : "20px 16px"}!important;border-radius:${transparent ? "0" : "16px"}!important}
    #${id} .tbbq-ev-grid{grid-template-columns:1fr!important;gap:16px!important}
    #${id} .tbbq-ev-card__media{aspect-ratio:21/9;padding:16px!important}
    #${id} .tbbq-ev-card__title{font-size:15px!important}
    /* Day + time drop onto their own line rather than being squeezed against the badges. */
    #${id} .tbbq-ev-card__when{margin-left:0!important;flex-basis:100%!important}
  }${columnsCss}${tabsStyles}
</style>

<script>
(function(){
  var root=document.getElementById("${id}");
  if(!root)return;
  var grid=root.querySelector(".tbbq-ev-grid");
${endpointDecl(path, "  ")}
  var KINDTABS=${kindTabs ? "true" : "false"};
  /* Pill order is fixed even though the pills themselves are built from the data. */
  var ORDER=[{k:"side-event",label:"Side Events",color:"#CE0F2E"},{k:"event-room",label:"Event Rooms",color:"#1B6CA8"}];

  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  /* Only absolute http(s) or a root-relative path reaches an href/src — a javascript: or
     data: URL in an Airtable url cell must never become a live link on techbbq.dk.
     Root-relative is allowed because photoUrl() emits one when PUBLIC_BASE_URL and the
     Vercel env vars are absent (local dev): rejecting it made every logo silently fall
     back to the company initial when previewing the snippet locally. On a real deploy the
     feed emits absolute URLs, which is what a cross-origin embed needs. */
  function safeUrl(u){var s=String(u==null?"":u).trim();return (/^https?:\\/\\//i.test(s)||/^\\/[^\\/]/.test(s))?s:"";}
  function tint(hex,a){var n=parseInt(String(hex).replace("#",""),16);return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+a+")";}
  /* Blend into a solid base and return an OPAQUE rgb(). The kind badge sits ABOVE the hover
     glow, and as a translucent tint its red text vanished into the red glow underneath. */
  function mixOn(hex,amt,base){var c=parseInt(String(hex).replace("#",""),16),b=parseInt(base.replace("#",""),16);
    function ch(sh){return Math.round((((b>>sh)&255)*(1-amt))+(((c>>sh)&255)*amt));}
    return "rgb("+ch(16)+","+ch(8)+","+ch(0)+")";}
  /* Second stop of the hover glow, per kind — a Side Event reuses the site's exact fire
     pairing (#CE0F2E -> #FA7000), an Event Room mirrors it in blue the way the Life
     Science cards use cyan -> teal. Same alphas as .s-card::after: .92 then .6. */
  var GLOW2={"side-event":"#FA7000","event-room":"#2BB4E1"};
  function light(hex,amt){var n=parseInt(String(hex).replace("#",""),16);function m(c){return Math.round(255*(1-amt)+c*amt);}return "rgb("+m((n>>16)&255)+","+m((n>>8)&255)+","+m(n&255)+")";}

  function card(e){
    /* The feed supplies the colour, but fall back per kind so a snippet pasted against an
       older deploy still renders red/blue instead of an unstyled card. */
    var color=e.color||(e.kind==="side-event"?"#CE0F2E":"#1B6CA8");
    var logo=safeUrl(e.logo);
    var media=logo
      ? '<img src="'+esc(logo)+'" alt="'+esc(e.company?e.company+" logo":"")+'" loading="lazy">'
      : '<span class="tbbq-ev-card__initial" aria-hidden="true">'+esc(String(e.company||e.title||"?").trim().charAt(0).toUpperCase())+'</span>';
    var access=e.accessLabel
      ? '<span class="tbbq-ev-card__access'+(e.accessKind==="private-invite"?" tbbq-ev-card__access--private":"")+'">'+esc(e.accessLabel)+'</span>'
      : '';
    var date=e.dateLabel
      ? '<span class="tbbq-ev-card__date">'+esc(e.dateLabel)+'</span>'
      : '<span class="tbbq-ev-card__date tbbq-ev-card__date--tbc">Date TBC</span>';
    /* No "Time TBC" twin — an unscheduled card just shows the day. */
    var time=e.timeSlot?'<span class="tbbq-ev-card__time">'+esc(e.timeSlot)+'</span>':'';
    var reg=safeUrl(e.registerUrl);
    return '<article class="tbbq-ev-card" style="--kind:'+esc(color)+';--soft:'+mixOn(color,.18,"#131313")+';--panel:'+light(color,.1)
      +';--glow-a:'+tint(color,.92)+';--glow-b:'+tint(GLOW2[e.kind]||color,.6)+'">'
      +'<div class="tbbq-ev-card__media">'+media+'</div>'
      +'<div class="tbbq-ev-card__body">'
      +'<div class="tbbq-ev-card__tags"><span class="tbbq-ev-card__kind">'+esc(e.kindLabel||"")+'</span>'+access+'<span class="tbbq-ev-card__when">'+date+time+'</span></div>'
      +'<h3 class="tbbq-ev-card__title">'+esc(e.title)+'</h3>'
      +(e.company?'<p class="tbbq-ev-card__company">'+esc(e.company)+'</p>':'')
      +(e.description?'<p class="tbbq-ev-card__desc">'+esc(e.description)+'</p>':'')
      +(reg?'<div class="tbbq-ev-card__cta"><a href="'+esc(reg)+'" target="_blank" rel="noopener noreferrer">Register</a></div>':'')
      +'</div></article>';
  }

  /* r.ok matters: a 429 or 502 still returns JSON ({error:…}) with no list in it, which
     without this check falls through to the empty branch and tells the visitor there are
     no events rather than that it could not load. */
  fetch(ENDPOINT).then(function(r){
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(data){
    var all=(data&&data.events)||[];
    if(!all.length){grid.innerHTML='<p class="tbbq-ev__empty">No events to show yet.</p>';return;}

    function render(list){
      grid.innerHTML=list.length?list.map(card).join(""):'<p class="tbbq-ev__empty">Nothing in this category yet.</p>';
    }

    var pills=root.querySelector(".tbbq-ev-tabs__pills");
    /* Built from the DATA: a kind nobody has gets no pill, and the whole row is dropped
       when only one kind is present (a single-kind embed has nothing to filter). */
    var present=ORDER.filter(function(o){return all.some(function(e){return e.kind===o.k;});});
    if(KINDTABS&&pills&&present.length>1){
      var defs=[{k:"all",label:"All events",color:null}].concat(present);
      pills.innerHTML=defs.map(function(d,i){
        var n=d.k==="all"?all.length:all.filter(function(e){return e.kind===d.k;}).length;
        return '<button type="button" role="tab" data-k="'+d.k+'" aria-selected="'+(i===0?"true":"false")+'"'
          +(d.color?' style="--pill:'+d.color+'"':'')+'>'+esc(d.label)+' ('+n+')</button>';
      }).join("");
      pills.addEventListener("click",function(ev){
        var b=ev.target.closest("button[data-k]");
        if(!b)return;
        var k=b.getAttribute("data-k");
        Array.prototype.forEach.call(pills.querySelectorAll("button"),function(x){
          x.setAttribute("aria-selected",x===b?"true":"false");
        });
        render(k==="all"?all:all.filter(function(e){return e.kind===k;}));
      });
    } else if(pills){
      /* Hide the empty container so it cannot leave a stray dark bar above the grid. */
      var wrap=root.querySelector(".tbbq-ev-tabs");
      if(wrap)wrap.style.display="none";
    }

    render(all);
  }).catch(function(err){
    grid.innerHTML='<p class="tbbq-ev__empty">Could not load right now.</p>';
    if(window.console&&console.error)console.error("[tbbq-events]",err);
  });
})();
</script>`;
}
