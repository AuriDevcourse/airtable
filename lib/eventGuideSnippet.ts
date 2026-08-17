import { endpointDecl } from "@/lib/embedOriginGuard";

// Elementor snippet for the Event Guide. Fetches /api/event-guide and renders the tabbed sections.
// Same class names and the same markup as components/EventGuide.tsx, so the two stay comparable —
// a change to one has an obvious counterpart in the other.
//
// SELF-CONTAINED. One HTML widget: markup, its own #id-scoped CSS, its font <link> and its script.
// It shares nothing with the WordPress theme and needs no plugin, which is the whole requirement —
// paste it in and it works.
//
// TYPEFACE: ONEST, the TechBBQ heading font, requested exactly the way every other embed in this
// repo requests it. This was first built in expanded Archivo to match the staging design and Auri
// corrected it (2026-08-11). Worth knowing if you ever go looking: the live guide's own markup asks
// for "Archivo+Expanded", which is not a Google family — that URL answers 400 and the page silently
// falls back to a system sans.
//
// NO F.A.Q. The design has one; it was built here and removed at Auri's request (2026-08-11).
//
// NO HERO. The staging design opens with a full-bleed gradient title block; that is the WordPress
// page's own header, and shipping a second one inside the widget would give the page two titles.
//
// __ORIGIN__ is swapped for the live URL at copy time (see components/CopyEventGuideEmbed.tsx).

export type EventGuideOptions = {
  /** Unique element id, so two guides can share one WordPress page without colliding. */
  uid?: string;
  /** Feed path. Only overridden by a future variant of the guide. */
  path?: string;
};

export function buildEventGuideSnippet({
  uid,
  path = "/api/event-guide",
}: EventGuideOptions = {}): string {
  const id = uid || "tbbq-event-guide";

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<section id="${id}" class="tbbq-eg"><p class="tbbq-eg__loading">Loading the event guide…</p></section>

<style>
  /* ═══ ELEMENTOR HARDENING ═══════════════════════════════════════════════════════════════
     Everything in this block exists because of what happened on techbbq.dk the first time this
     was pasted (2026-08-11). The widget does not get to assume anything about the page around it.

     1. IT PAINTS ITS OWN GROUND. The guide was dropped into an Elementor section with a WHITE
        background. Every colour here is built for a dark page, so the section headings (#f2f2f2)
        and the un-selected pills went invisible — white text on white. The widget now carries
        --ground itself and stops depending on the section's background entirely.
     2. IT SIZES TO ITS CONTAINER, NOT THE VIEWPORT. The Elementor column was about 370px wide on
        a 1440px screen, so the @media (max-width:720px) collapse never fired and the two-column
        panel stayed two columns inside 370px — a 170px text column beside a 150px photo. The
        collapse is now a CONTAINER query, which asks how wide THIS widget is. The old media query
        is kept underneath for browsers without container query support.
     3. IT RESETS WHAT THE THEME STYLES. A WordPress theme has opinions about h2, h3, p, ul, li,
        button, figure and img — margins, uppercase headings, list bullets, button chrome. Each of
        those is neutralised below before the real rules, so the guide looks the same whatever
        theme it lands in.
     4. IT IS FULL WIDTH AND CENTRES ITSELF. The dark ground spans the whole column; the content
        inside is what stops at 760px.
     ═══════════════════════════════════════════════════════════════════════════════════════ */
  #${id}.tbbq-eg{
    --fg:#f2f2f2;--muted:#9a9a9c;--card:#131313;--card2:#191919;--border:#2a2a2a;--acc:#ff2600;--ground:#0d0d0d;
    font-family:"Inter",ui-sans-serif,system-ui,sans-serif!important;
    /* Absolute, not inherited: a theme that scales its root font would otherwise resize the
       whole guide. Every size below is in px, clamp() or cqi for the same reason.
       !important throughout this block is not defensiveness for its own sake: the techbbq.dk
       theme sets h2,h3 font-family with !important, and !important is the only thing that
       outranks !important. Every one of these is scoped to this widget's own id. */
    font-size:16px!important;line-height:1.5!important;font-weight:400!important;font-style:normal!important;text-align:left!important;
    color:var(--fg)!important;background:var(--ground)!important;
    width:100%;max-width:none;margin:0;
    padding:clamp(28px,5vw,56px) clamp(16px,4vw,24px);
    /* Makes this element the thing @container measures. */
    container-type:inline-size;
  }
  #${id}.tbbq-eg,#${id} *,#${id} *:before,#${id} *:after{box-sizing:border-box}
  /* Theme reset. Deliberately element selectors so every rule with a class below outranks it. */
  #${id} h2,#${id} h3,#${id} p,#${id} ul,#${id} li,#${id} figure{
    margin:0!important;padding:0!important;border:0;background:none;color:inherit;
    font-family:inherit!important;text-transform:none!important;letter-spacing:normal!important;
    text-align:left!important;font-style:inherit!important;
    /* Inherited, not fixed: every real size comes from a class below.
       !important AS OF 2026-08-17 (Auri: "I think we do need to use sometimes important"). Plain
       inherit, with no !important, lost to a theme's p{font-size:19px!important} — measured — and the
       whole panel scaled up with it. Only !important outranks !important.
       THIS RAISED THE STAKES ON EVERY CLASS RULE BELOW. .eg-h is the h2, .eg-panel__title the h3,
       .eg-eyebrow/.eg-lead/.eg-day are p and .eg-tags li is an li — all of them in the selector list
       above. So each of their font declarations now carries !important too. With !important on both
       sides, specificity decides and a class beats an element, which is the order we want; with it on
       only this side, this rule would flatten every heading, pill and lead line in the guide to 16px
       regular. If you add a class rule that sets font-size, font-weight or line-height on one of
       these six elements, it needs !important or it will not apply. */
    font-size:inherit!important;line-height:inherit!important;font-weight:inherit!important;
  }
  /* 2. NOTHING PAINTS A BACKGROUND UNLESS IT ASKS TO. The first paste landed under a theme with
     section,div{background:#fff}, which put a white block behind the copy inside an otherwise
     dark panel — the computed styles on the root and the panel were all correct and it still
     looked broken. The three elements that DO want a colour re-assert it with !important. */
  #${id} div,#${id} section,#${id} span{background:none!important}
  /* THE CONTAINERS HAD TO BE CLAIMED TOO, and this was the leak that made the rest look fixed while
     it was not. Every reset above is on the elements that HOLD TEXT, and each of them says
     font-*:inherit — which faithfully inherits whatever the DIV above it computed. A theme with
     div{font-family:Georgia!important;font-size:19px!important} therefore poisoned the guide through
     its own wrappers: the eyebrow came out Georgia, and the venue-details list came out 19px because
     its ul sits inside an unclassed div. Measured 2026-08-17 under a test theme.
     FONT PROPERTIES ONLY. Nothing about the box model, because .eg-section carries margin:0 auto 88px
     without !important and .eg-panel its own padding — a margin:0!important here would flatten the
     whole layout. That is why this is a separate rule and not three more selectors on the reset above.
     text-align is inherited on purpose so a theme's text-align:center cannot re-centre body copy,
     while .eg-h keeps its own centring with !important. */
  #${id} div,#${id} section,#${id} span{
    font-family:inherit!important;font-size:inherit!important;font-weight:inherit!important;
    font-style:inherit!important;line-height:inherit!important;letter-spacing:inherit!important;
    text-transform:none!important;text-align:inherit!important;
  }
  #${id} ul{list-style:none!important}
  #${id} li:before{content:none}
  #${id} img{max-width:100%!important;border:0!important;border-radius:0!important;box-shadow:none!important;display:block}
  /* A LINK IS BODY TEXT THAT HAPPENS TO BE CLICKABLE.
     NO BACKTICKS IN THIS COMMENT. It lives inside a template literal, and one terminates the
     string — tsc caught it, the browser would have got a syntax error.
     The theme reset above lists h2, h3, p, ul, li and figure, and NOT the anchor, which is how the
     KeyPass link in the Wardrobe panel ended up a size larger and in a different typeface than
     the sentence it sits in (Auri, 2026-08-17: "we just switch the styling"). A theme rule like
     a{font-family:…;font-size:19px;font-weight:700} lands ON the anchor, and an element-level
     declaration beats the 13px Inter the anchor should be inheriting from .eg-body. Nothing was
     wrong with our CSS; it simply never claimed these properties, so the theme kept them.
     Every font property is therefore pinned to inherit, not to a value: the link has to track
     whatever its container is, which is 13px muted body copy here and could be a list item or a
     lead line elsewhere. The only things a link is allowed to differ by are the brighter colour
     and the underline, both set on .eg-body a below. */
  #${id} a{
    background:none;box-shadow:none;border:0;
    font-family:inherit!important;font-size:inherit!important;font-weight:inherit!important;
    font-style:inherit!important;line-height:inherit!important;letter-spacing:inherit!important;
    text-transform:none!important;
  }
  #${id} button{
    -webkit-appearance:none;appearance:none;
    margin:0;font-family:inherit;text-transform:none;letter-spacing:normal;
    box-shadow:none;min-height:0;min-width:0;width:auto;height:auto;text-align:center;
  }
  #${id} .tbbq-eg__loading{color:var(--muted);margin:0;text-align:center;padding:40px 0}
  #${id} .eg-h,#${id} .eg-panel__title{font-family:"Onest",ui-sans-serif,system-ui,sans-serif!important;font-weight:600!important;letter-spacing:-.02em!important;color:var(--fg)!important;text-transform:none!important}
  /* The dark ground is full width; the CONTENT is what stops at 760px. */
  #${id} .eg-section{max-width:760px;margin:0 auto 88px}
  #${id} .eg-section:last-of-type{margin-bottom:0}
  /* TWO font-size declarations on purpose. The first is the fallback for browsers with no
     container query support; the second uses cqi (1% of THIS widget's width) and overrides it
     where supported. A viewport-based clamp printed a 38px heading inside a 370px Elementor
     column, which is how this was found. */
  #${id} .eg-h{font-size:clamp(26px,4vw,38px)!important;font-size:clamp(23px,5.4cqi,38px)!important;line-height:1.1!important;text-align:center!important;margin:0 0 22px!important}
  #${id} .eg-tabs{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:0 0 22px;padding:0;list-style:none}
  #${id} .eg-tab{font:500 13px/1 "Inter",ui-sans-serif,system-ui,sans-serif!important;color:var(--fg)!important;background:transparent!important;border:1px solid var(--border)!important;border-radius:999px!important;padding:9px 15px!important;width:auto!important;height:auto!important;cursor:pointer;text-transform:none!important;letter-spacing:normal!important;transition:background-color .18s ease,color .18s ease,border-color .18s ease}
  #${id} .eg-tab:hover{background:var(--card2)!important}
  #${id} .eg-tab[aria-selected="true"]{background:#f2f2f2!important;border-color:#f2f2f2!important;color:#0d0d0d!important}
  #${id} .eg-tab:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
  /* THE STACK. Every panel is here, but only the ACTIVE one is in normal flow, so the slot is
     exactly as tall as the panel being read — no reserved space under a short one. The height is
     ANIMATED between panels (see select()) so a longer tab grows rather than snapping; the heading
     and the tabs sit above it and never move. inert keeps hidden links off the keyboard. */
  #${id} .eg-slot{background:none!important;position:relative;transition:height 260ms ease}
  #${id} .eg-slot>.eg-panel{position:absolute;top:0;left:0;width:100%;visibility:hidden}
  #${id} .eg-slot>.eg-panel[data-active="true"]{position:relative;visibility:visible}
  #${id} .eg-panel{background:var(--card)!important;border-radius:16px;padding:clamp(18px,3vw,26px);display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:clamp(18px,3vw,28px);align-items:start}
  /* aspect-ratio, not a height: it reserves the photo's space before the <img> exists, which is
     what lets an unvisited panel measure the same as a visited one. */
  #${id} .eg-panel__media{margin:0!important;border-radius:12px;overflow:hidden;background:var(--card2)!important;aspect-ratio:5/4}
  #${id} .eg-panel__media img{width:100%!important;height:100%!important;max-width:none!important;display:block;object-fit:cover;object-position:50% 30%}
  #${id} .eg-eyebrow{display:flex;align-items:center;gap:8px;font-size:10px!important;font-weight:600!important;letter-spacing:.14em!important;text-transform:uppercase!important;color:var(--fg);margin:0 0 18px!important}
  #${id} .eg-eyebrow:before{content:"";width:5px;height:5px;border-radius:50%;background:var(--acc);flex:0 0 auto}
  #${id} .eg-panel__title{font-size:clamp(19px,2.4vw,24px)!important;font-size:clamp(18px,3.4cqi,24px)!important;line-height:1.2!important;margin:0 0 12px!important}
  #${id} .eg-body{font-size:13px!important;line-height:1.6!important;color:var(--muted)}
  #${id} .eg-body>*+*{margin-top:10px!important}
  #${id} .eg-body p{margin:0}
  #${id} .eg-lead{color:var(--fg);font-weight:600!important}
  /* The underline carries !important for the mirror-image reason: a theme with a{text-decoration:none}
     would strip the one signal that survives for a reader who cannot see the colour difference.
     Colour alone is never the affordance (SECURITY.md r9). */
  #${id} .eg-body a{color:var(--fg)!important;background:none!important;box-shadow:none!important;text-decoration:underline!important;text-underline-offset:2px!important;text-decoration-thickness:1px!important}
  #${id} .eg-body a:hover{opacity:.75}
  #${id} .eg-list{margin:0;padding:0;list-style:none}
  #${id} .eg-list li{position:relative;padding-left:13px!important}
  #${id} .eg-list li+li{margin-top:4px!important}
  #${id} .eg-list li:before{content:"";position:absolute;left:2px;top:.62em;width:3px;height:3px;border-radius:50%;background:var(--muted)}
  #${id} .eg-day{color:var(--fg);font-weight:600!important;margin:0 0 4px!important}
  #${id} .eg-schedule+.eg-schedule{margin-top:14px!important}
  #${id} .eg-tags{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0!important;padding:0;list-style:none!important}
  #${id} .eg-tags li{font-size:9px!important;font-weight:600!important;letter-spacing:.09em!important;text-transform:uppercase!important;color:#d0d0d0;border:1px solid var(--border)!important;border-radius:4px;padding:4px 7px!important;line-height:1!important}
  #${id} .eg-tags li:before{content:none}
  /* THE COLLAPSE, asked of the WIDGET's width rather than the screen's. This is the rule that a
     narrow Elementor column needs and a viewport media query cannot give. */
  @container (max-width:720px){
    #${id} .eg-panel{grid-template-columns:1fr}
    #${id} .eg-panel__media{grid-row:1;aspect-ratio:16/10}
    #${id} .eg-tabs{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;padding-bottom:4px;scrollbar-width:none}
    #${id} .eg-tabs::-webkit-scrollbar{display:none}
    #${id} .eg-tab{flex:0 0 auto}
  }
  /* Fallback for browsers with no container query support. Same values, asked of the viewport. */
  @media (max-width:720px){
    #${id} .eg-panel{grid-template-columns:1fr}
    #${id} .eg-panel__media{grid-row:1;aspect-ratio:16/10}
    #${id} .eg-tabs{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;padding-bottom:4px;scrollbar-width:none}
    #${id} .eg-tabs::-webkit-scrollbar{display:none}
    #${id} .eg-tab{flex:0 0 auto}
  }
  @media (prefers-reduced-motion:reduce){
    #${id} .eg-tab{transition:none}
    #${id} .eg-slot{transition:none}
  }
</style>

<script>
(function(){
  var root=document.getElementById(${JSON.stringify(id)});
  if(!root)return;
${endpointDecl(path, "  ")}

  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}

  /* [label](url) only. Everything is escaped FIRST and the link built from the escaped pieces, so
     no authored copy can introduce an attribute or a tag. The scheme is allow-listed for the same
     reason it is in the React renderer: a javascript: href in the data must not become a link. */
  function linkify(s){
    return esc(s).replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g,function(_,label,href){
      if(!/^(https?:\\/\\/|mailto:|#|\\/)/i.test(href))return label;
      var ext=/^https?:/i.test(href)?' target="_blank" rel="noopener noreferrer"':"";
      return '<a href="'+href+'"'+ext+'>'+label+'</a>';
    });
  }

  function block(b){
    if(!b)return"";
    if(b.kind==="list"){
      var lead=b.lead?'<p class="eg-lead">'+esc(b.lead)+'</p>':"";
      var items="";
      for(var i=0;i<(b.items||[]).length;i++)items+='<li>'+linkify(b.items[i])+'</li>';
      return '<div>'+lead+'<ul class="eg-list">'+items+'</ul></div>';
    }
    if(b.kind==="schedule"){
      var rows="";
      for(var j=0;j<(b.rows||[]).length;j++)rows+='<li>'+esc(b.rows[j])+'</li>';
      return '<div class="eg-schedule"><p class="eg-day">'+esc(b.day)+'</p><ul class="eg-list">'+rows+'</ul></div>';
    }
    return '<p>'+(b.lead?'<span class="eg-lead">'+esc(b.lead)+' </span>':"")+linkify(b.text)+'</p>';
  }

  /* EVERY panel is built up front — that is what fixes the section height. The photo is NOT: it is
     carried on data-src and promoted to src the first time the panel is shown, so a section of
     eight does not fetch eight images for the one being read. The figure holds its space either
     way through aspect-ratio, so promoting it later shifts nothing. */
  function panel(item,sid,idx,active){
    var blocks="";
    for(var i=0;i<(item.blocks||[]).length;i++)blocks+=block(item.blocks[i]);
    var tags="";
    if(item.tags&&item.tags.length){
      for(var t=0;t<item.tags.length;t++)tags+='<li>'+esc(item.tags[t])+'</li>';
      tags='<ul class="eg-tags">'+tags+'</ul>';
    }
    var img=active
      ? '<img src="'+esc(item.image)+'" alt="'+esc(item.alt)+'" loading="lazy" decoding="async">'
      : '<img data-src="'+esc(item.image)+'" alt="'+esc(item.alt)+'" loading="lazy" decoding="async">';
    return '<div class="eg-panel" role="tabpanel" id="'+sid+'-p'+idx+'" aria-labelledby="'+sid+'-t'+idx+'"'
      +' data-active="'+(active?"true":"false")+'" tabindex="'+(active?"0":"-1")+'"'
      +(active?"":' aria-hidden="true" inert')+'>'
      +'<div>'
      +'<p class="eg-eyebrow">'+esc(item.eyebrow||item.tab)+'</p>'
      +'<h3 class="eg-panel__title">'+esc(item.title)+'</h3>'
      +'<div class="eg-body">'+blocks+'</div>'
      +tags
      +'</div>'
      +'<figure class="eg-panel__media">'+img+'</figure>'
      +'</div>';
  }

  function section(sec,n){
    var sid=${JSON.stringify(id)}+"-s"+n;
    var tabs="",panels="";
    for(var i=0;i<sec.items.length;i++){
      var it=sec.items[i];
      tabs+='<button type="button" class="eg-tab" role="tab" id="'+sid+'-t'+i+'"'
        +' aria-controls="'+sid+'-p'+i+'" aria-selected="'+(i===0?"true":"false")+'"'
        +' tabindex="'+(i===0?"0":"-1")+'" data-i="'+i+'">'+esc(it.tab)+'</button>';
      panels+=panel(it,sid,i,i===0);
    }
    return '<section class="eg-section" data-sec="'+n+'" aria-labelledby="'+sid+'-h">'
      +'<h2 class="eg-h" id="'+sid+'-h">'+esc(sec.title)+'</h2>'
      +'<div class="eg-tabs" role="tablist" aria-label="'+esc(sec.title)+'">'+tabs+'</div>'
      +'<div class="eg-slot">'+panels+'</div>'
      +'</section>';
  }

  fetch(ENDPOINT,{headers:{Accept:"application/json"}}).then(function(r){
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(data){
    var secs=(data&&data.sections)||[];
    if(!secs.length){root.innerHTML='<p class="tbbq-eg__loading">Event guide coming soon.</p>';return;}
    var html="";
    for(var i=0;i<secs.length;i++)html+=section(secs[i],i);
    root.innerHTML=html;

    /* Delegated from the root: ONE listener for all five sections, and because the panels are
       already in the DOM a switch only flips attributes — nothing is rebuilt and focus is never
       lost. */
    root.addEventListener("click",function(e){
      var btn=e.target&&e.target.closest?e.target.closest(".eg-tab"):null;
      if(btn&&root.contains(btn))select(btn);
    });
    root.addEventListener("keydown",function(e){
      var btn=e.target&&e.target.closest?e.target.closest(".eg-tab"):null;
      if(!btn)return;
      var list=[].slice.call(btn.parentNode.querySelectorAll(".eg-tab"));
      var cur=list.indexOf(btn),next=null,last=list.length-1;
      if(e.key==="ArrowRight")next=cur===last?0:cur+1;
      else if(e.key==="ArrowLeft")next=cur===0?last:cur-1;
      else if(e.key==="Home")next=0;
      else if(e.key==="End")next=last;
      if(next===null)return;
      e.preventDefault();
      select(list[next]);
      list[next].focus();
    });

    function select(btn){
      var secEl=btn.closest(".eg-section");
      var idx=Number(btn.getAttribute("data-i"));
      var slot=secEl.querySelector(".eg-slot");
      /* Measured BEFORE anything swaps: this is the height the animation starts from. */
      var fromH=slot.offsetHeight;

      var pills=secEl.querySelectorAll(".eg-tab");
      for(var i=0;i<pills.length;i++){
        var on=pills[i]===btn;
        pills[i].setAttribute("aria-selected",on?"true":"false");
        pills[i].setAttribute("tabindex",on?"0":"-1");
      }
      var panels=secEl.querySelectorAll(".eg-slot>.eg-panel");
      for(var j=0;j<panels.length;j++){
        var active=j===idx;
        panels[j].setAttribute("data-active",active?"true":"false");
        panels[j].setAttribute("tabindex",active?"0":"-1");
        if(active){
          panels[j].removeAttribute("aria-hidden");
          panels[j].removeAttribute("inert");
          var im=panels[j].querySelector("img[data-src]");
          if(im){im.setAttribute("src",im.getAttribute("data-src"));im.removeAttribute("data-src");}
        }else{
          panels[j].setAttribute("aria-hidden","true");
          panels[j].setAttribute("inert","");
        }
      }

      /* Height cannot transition to "auto", so measure the new panel with the height cleared,
         then move between two pixel values and give the height back to auto on landing. Pinning
         it would break reflow on a window resize. */
      slot.style.height="";
      var toH=slot.offsetHeight;
      var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if(fromH===toH||reduce)return;
      slot.style.height=fromH+"px";
      /* Read forces the start value to take, or both writes collapse into one recalculation and
         nothing animates. */
      void slot.offsetHeight;
      slot.style.height=toH+"px";
      /* ONE listener per slot, replaced each time. Clicking faster than the transition interrupts
         it, and a fresh listener per click would pile up on an element that can be clicked all
         day. */
      if(slot._egDone)slot.removeEventListener("transitionend",slot._egDone);
      slot._egDone=function(e){
        if(e.propertyName!=="height")return;
        slot.style.height="";
        slot.removeEventListener("transitionend",slot._egDone);
        slot._egDone=null;
        /* The document really did change height, so the iframe wrapper needs telling. */
        sendHeight();
      };
      slot.addEventListener("transitionend",slot._egDone);
    }
  }).catch(function(err){
    root.innerHTML='<p class="tbbq-eg__loading">Could not load the event guide right now.</p>';
    /* Logged for the same reason as the other embeds: a stale paste and a server fault look
       identical from the outside without the endpoint in the message. */
    if(window.console&&console.error)console.error("[tbbq-event-guide] failed to load",ENDPOINT,err);
  });

  /* Height for the iframe wrapper the current guide is pasted into. A no-op when this snippet is
     dropped straight into an Elementor HTML widget on the page itself — there is no parent to
     listen — so it is safe either way. */
  var lastH=0;
  function sendHeight(){
    if(window.parent===window)return;
    var h=Math.min(document.body.scrollHeight,8000);
    if(Math.abs(h-lastH)>5){lastH=h;window.parent.postMessage({iframeHeight:h},"*");}
  }
  window.addEventListener("load",function(){setTimeout(sendHeight,300);});
  if(window.ResizeObserver)new ResizeObserver(sendHeight).observe(document.body);
})();
</script>`;
}
