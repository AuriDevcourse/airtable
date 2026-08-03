// Self-contained Elementor snippet for one section of the Brella program.
//
// Same contract as lib/eventEmbedSnippet.ts: one HTML block with its own #id-scoped styles
// and a small script, no build step, no framework, everything !important because WordPress
// themes restyle every generic tag. __ORIGIN__ is swapped for the live origin by the copy
// button, so copying from localhost bakes in localhost.
//
// The SECTION IS BAKED INTO THE URL (?section=…), not filtered here. That keeps the rules
// for what belongs in a section in exactly one place (lib/brellaSections.ts, applied by the
// API route) rather than shipping a second copy into every pasted snippet, where it could
// never be corrected once it is live on techbbq.dk.

import { EVENT_DAYS, type BrellaSection } from "@/lib/brellaSections";

export type BrellaEmbedOptions = {
  section: BrellaSection;
  uid?: string;
  // Drop the panel's own background + padding, for a page that already provides them.
  transparent?: boolean;
};

// Kept in sync with the TRACK_COLORS list on app/brella-program/page.tsx by hand. The Grill
// tracks are named after their colour, so the mapping cannot be a rotation.
const TRACK_COLORS = `[
    [/green grill/i,"#5CBC8B"],[/blue grill/i,"#1B6CA8"],[/orange grill/i,"#FA7000"],
    [/founders stage/i,"#CE0F2E"],[/india/i,"#2BB4E1"],
    [/^event room|^rooms?\\b/i,"#1B6CA8"],[/^side event/i,"#CE0F2E"]
  ]`;

export function buildBrellaEmbedSnippet({
  section,
  uid,
  transparent = false,
}: BrellaEmbedOptions): string {
  const id = uid || "tbbq-brella";
  const path = `/api/program?event=brella&section=${section}`;

  return `<!-- TechBBQ program (Brella) — paste into an Elementor HTML widget -->
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<div id="${id}" class="tbbq-bp">
  <div class="tbbq-bp__tracks" role="tablist" aria-label="Filter by track"></div>
  <div class="tbbq-bp__days"><p class="tbbq-bp__empty">Loading…</p></div>
  <div class="tbbq-bp__overlay" hidden>
    <div class="tbbq-bp__modal" role="dialog" aria-modal="true" aria-label="Session details"></div>
  </div>
</div>

<style>
  #${id}{--bg:#0d0d0d;--card:#131313;--card2:#191919;--fg:#f2f2f2;--muted:#9a9a9c;--border:#2a2a2a;
    --head:'Onest',ui-sans-serif,system-ui,sans-serif;--sans:'Inter',ui-sans-serif,system-ui,sans-serif;
    display:block!important;${transparent ? "" : "background:var(--bg)!important;padding:32px 24px!important;border-radius:20px!important;"}
    font-family:var(--sans)!important;color:var(--fg)!important;box-sizing:border-box}
  #${id} *{box-sizing:border-box}

  /* Pills. Forced + scoped: WordPress themes give every <button> their own look. */
  #${id} .tbbq-bp__tracks{display:flex!important;flex-wrap:wrap!important;justify-content:center!important;gap:6px!important;padding:5px!important;margin:0 auto 22px!important;border:1px solid var(--border)!important;border-radius:9999px!important;background:var(--card)!important;width:fit-content!important;max-width:100%!important}
  #${id} .tbbq-bp__tracks button{appearance:none!important;border:0!important;margin:0!important;padding:8px 16px!important;border-radius:9999px!important;background:transparent!important;color:var(--muted)!important;font-family:var(--head)!important;font-size:13px!important;font-weight:600!important;line-height:1!important;text-transform:none!important;letter-spacing:normal!important;cursor:pointer!important;box-shadow:none!important;transition:background .18s,color .18s}
  #${id} .tbbq-bp__tracks button:hover{color:var(--fg)!important}
  #${id} .tbbq-bp__tracks button[aria-selected="true"]{background:var(--fg)!important;color:#0d0d0d!important}
  #${id} .tbbq-bp__tracks button:focus-visible{outline:2px solid #ce0f2e!important;outline-offset:2px!important}

  #${id} .tbbq-bp__daylabel{margin:26px 0 12px!important;padding:0!important;font-family:var(--head)!important;font-size:12px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--muted)!important}
  #${id} .tbbq-bp__grid{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:14px!important}

  #${id} .tbbq-bp__card{position:relative!important;display:block!important;width:100%!important;text-align:left!important;appearance:none!important;background:var(--card)!important;border:1px solid var(--border)!important;border-radius:12px!important;padding:14px 14px 14px 16px!important;margin:0!important;overflow:hidden!important;font-family:var(--sans)!important;color:var(--fg)!important;box-shadow:none!important;transition:border-color .2s,background .2s}
  #${id} button.tbbq-bp__card{cursor:pointer!important}
  /* Pseudo element rather than border-left, so the radius stays even on all four corners. */
  #${id} .tbbq-bp__card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:var(--track)}
  #${id} button.tbbq-bp__card:hover{border-color:var(--track)!important;background:var(--card2)!important}
  #${id} .tbbq-bp__time{margin:0!important;padding:0!important;font-family:var(--head)!important;font-size:11px!important;font-weight:600!important;letter-spacing:.06em!important;color:var(--fg)!important}
  #${id} .tbbq-bp__title{margin:10px 0 0!important;padding:0!important;font-family:var(--head)!important;font-size:15px!important;font-weight:600!important;line-height:1.3!important;color:#fff!important;text-transform:none!important;letter-spacing:normal!important}
  #${id} .tbbq-bp__room{display:flex!important;align-items:center!important;gap:5px!important;margin:10px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12px!important;line-height:1.4!important}
  #${id} .tbbq-bp__desc{margin:8px 0 0!important;padding:0!important;color:rgba(255,255,255,.72)!important;font-size:12px!important;line-height:1.5!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  #${id} .tbbq-bp__count{margin:10px 0 0!important;padding:0!important;color:var(--track)!important;font-family:var(--head)!important;font-size:11px!important;font-weight:600!important}
  #${id} .tbbq-bp__empty{margin:0!important;color:var(--muted)!important;font-size:14px!important}

  /* Dialog. position:fixed so it escapes whatever Elementor column it was pasted into. */
  #${id} .tbbq-bp__overlay{position:fixed!important;inset:0!important;z-index:99999!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;padding:5vh 16px!important;background:rgba(0,0,0,.72)!important;overflow-y:auto!important}
  #${id} .tbbq-bp__overlay[hidden]{display:none!important}
  #${id} .tbbq-bp__modal{position:relative!important;width:100%!important;max-width:640px!important;background:var(--card)!important;border:1px solid var(--border)!important;border-top:3px solid var(--track)!important;border-radius:16px!important;padding:28px!important}
  #${id} .tbbq-bp__close{position:absolute!important;top:14px!important;right:14px!important;display:grid!important;place-items:center!important;width:32px!important;height:32px!important;padding:0!important;border:1px solid var(--border)!important;border-radius:9999px!important;background:var(--card2)!important;color:var(--muted)!important;cursor:pointer!important}
  #${id} .tbbq-bp__close:hover{color:var(--fg)!important}
  #${id} .tbbq-bp__modal h2{margin:8px 0 0!important;padding:0!important;font-family:var(--head)!important;font-size:22px!important;font-weight:600!important;line-height:1.25!important;color:#fff!important;text-transform:none!important}
  #${id} .tbbq-bp__meta{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:8px!important;margin:10px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:13px!important}
  #${id} .tbbq-bp__topic{padding:3px 9px!important;border-radius:9999px!important;background:var(--card2)!important;border:1px solid var(--border)!important;font-family:var(--head)!important;font-size:10px!important;font-weight:600!important;text-transform:uppercase!important;letter-spacing:.05em!important}
  #${id} .tbbq-bp__body p{margin:12px 0 0!important;padding:0!important;color:rgba(255,255,255,.8)!important;font-size:14px!important;line-height:1.6!important}
  #${id} .tbbq-bp__modal h3{margin:24px 0 0!important;padding:0!important;font-family:var(--head)!important;font-size:12px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--muted)!important}
  #${id} .tbbq-bp__people{list-style:none!important;margin:12px 0 0!important;padding:0!important;display:grid!important;gap:14px!important}
  #${id} .tbbq-bp__person{display:flex!important;gap:12px!important;margin:0!important;padding:0!important}
  #${id} .tbbq-bp__photo{flex:0 0 auto!important;width:52px!important;height:52px!important;border-radius:9999px!important;object-fit:cover!important;object-position:50% 30%!important;background:var(--card2)!important;display:grid!important;place-items:center!important;font-family:var(--head)!important;font-weight:700!important;color:var(--track)!important;margin:0!important}
  #${id} .tbbq-bp__pname{margin:0!important;padding:0!important;font-family:var(--head)!important;font-size:14px!important;font-weight:600!important;color:#fff!important}
  #${id} .tbbq-bp__prole{margin:3px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12px!important;line-height:1.4!important}
  #${id} .tbbq-bp__pbio{margin:6px 0 0!important;padding:0!important;color:rgba(255,255,255,.7)!important;font-size:12px!important;line-height:1.5!important}

  @media(max-width:1100px){#${id} .tbbq-bp__grid{grid-template-columns:repeat(3,1fr)!important}}
  @media(max-width:820px){#${id} .tbbq-bp__grid{grid-template-columns:repeat(2,1fr)!important}}
  @media(max-width:560px){
    #${id}{${transparent ? "" : "padding:20px 16px!important;border-radius:16px!important;"}}
    #${id} .tbbq-bp__grid{grid-template-columns:1fr!important}
    #${id} .tbbq-bp__modal{padding:22px!important}
  }
</style>

<script>
(function(){
  var root=document.getElementById("${id}");
  if(!root)return;
  var ENDPOINT="__ORIGIN__${path}";
  var daysEl=root.querySelector(".tbbq-bp__days");
  var pillsEl=root.querySelector(".tbbq-bp__tracks");
  var overlay=root.querySelector(".tbbq-bp__overlay");
  var modal=root.querySelector(".tbbq-bp__modal");
  var COLORS=${TRACK_COLORS};
  var ALL=[],track="",lastFocus=null;

  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  /* Only an absolute http(s) URL becomes a live src — never a javascript: or data: URL from
     upstream data. Brella photo URLs are plain public https links. */
  function safeUrl(u){var s=String(u==null?"":u).trim();return /^https?:\\/\\//i.test(s)?s:"";}
  function color(room){for(var i=0;i<COLORS.length;i++){if(COLORS[i][0].test(room||""))return COLORS[i][1];}return "#FA7000";}
  /* TechBBQ's day numbering, serialized from EVENT_DAYS so the snippet cannot drift from the
     dashboard. Brella's own "Day N" counts whichever dates exist in the feed and shifts when
     one is deleted, so it is never shown. A date that is not an event day (the 25th) gets the
     date with no day number rather than an invented "Day 0". */
  var EVENT_DAYS=${JSON.stringify(EVENT_DAYS)};
  function dayLabel(d){
    d=String(d||"");
    var known=null;
    for(var i=0;i<EVENT_DAYS.length;i++){if(d.indexOf(EVENT_DAYS[i].date)>=0){known=EVENT_DAYS[i];break;}}
    var m=/(\\d+)\\s+(\\w{3})/.exec(d);
    var date=m?(m[1]+" "+m[2].toUpperCase()):d.toUpperCase();
    return known?(known.label+", "+date):date;
  }
  function dayNum(d){var m=/^Day\\s+(\\d+)/i.exec(d||"");return m?+m[1]:99;}
  /* "All day" and anything unparseable sort last within their day rather than to 00:00. */
  function mins(t){var m=/(\\d{1,2}):(\\d{2})/.exec(t||"");return m?(+m[1])*60+(+m[2]):1441;}
  function hasDetail(s){return (s.speakers&&s.speakers.length)||String(s.description||"").length>150;}
  var PIN='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';

  function card(s,i){
    var n=(s.speakers||[]).length;
    var inner='<p class="tbbq-bp__time">'+esc(s.timeSlot||"Time TBC")+'</p>'
      +'<p class="tbbq-bp__title">'+esc(s.name)+'</p>'
      +(s.room?'<p class="tbbq-bp__room">'+PIN+esc(s.room)+'</p>':'')
      +(s.description?'<p class="tbbq-bp__desc">'+esc(s.description)+'</p>':'')
      +(n?'<p class="tbbq-bp__count">'+n+' speaker'+(n===1?'':'s')+'</p>':'');
    var style=' style="--track:'+color(s.room)+'"';
    /* A real <button> only when there is something to open, so a card never advertises
       detail it does not have. */
    return hasDetail(s)
      ? '<button type="button" class="tbbq-bp__card" data-i="'+i+'"'+style+'>'+inner+'</button>'
      : '<div class="tbbq-bp__card"'+style+'>'+inner+'</div>';
  }

  function render(){
    var list=track?ALL.filter(function(s){return s.room===track;}):ALL;
    if(!list.length){daysEl.innerHTML='<p class="tbbq-bp__empty">Nothing scheduled here yet.</p>';return;}
    var byDay={},order=[];
    list.forEach(function(s){if(!byDay[s.day]){byDay[s.day]=[];order.push(s.day);}byDay[s.day].push(s);});
    order.sort(function(a,b){return dayNum(a)-dayNum(b);});
    daysEl.innerHTML=order.map(function(d){
      var rows=byDay[d].slice().sort(function(a,b){return mins(a.timeSlot)-mins(b.timeSlot)||String(a.name).localeCompare(b.name);});
      return '<h3 class="tbbq-bp__daylabel">'+esc(dayLabel(d))+'</h3><div class="tbbq-bp__grid">'
        +rows.map(function(s){return card(s,ALL.indexOf(s));}).join("")+'</div>';
    }).join("");
  }

  function openModal(s){
    lastFocus=document.activeElement;
    modal.style.setProperty("--track",color(s.room));
    /* Brella's location often repeats the track name verbatim, so it is only appended when
       it says something new. */
    var meta=[s.room,s.location!==s.room?s.location:""].filter(Boolean).join(" \\u00b7 ");
    var people=(s.speakers||[]).map(function(p){
      var ph=safeUrl(p.photo);
      var img=ph?'<img class="tbbq-bp__photo" src="'+esc(ph)+'" alt="" loading="lazy">'
        :'<span class="tbbq-bp__photo" aria-hidden="true">'+esc(String(p.name||"?").trim().charAt(0).toUpperCase())+'</span>';
      return '<li class="tbbq-bp__person">'+img+'<div><p class="tbbq-bp__pname">'+esc(p.name)+'</p>'
        +((p.title||p.company)?'<p class="tbbq-bp__prole">'+esc([p.title,p.company].filter(Boolean).join(" \\u00b7 "))+'</p>':'')
        +(p.bio?'<p class="tbbq-bp__pbio">'+esc(p.bio)+'</p>':'')+'</div></li>';
    }).join("");
    modal.innerHTML='<button type="button" class="tbbq-bp__close" aria-label="Close">'
      +'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
      +'<p class="tbbq-bp__time">'+esc(s.timeSlot||"Time TBC")+'</p>'
      +'<h2>'+esc(s.name)+'</h2>'
      +'<p class="tbbq-bp__meta">'+PIN+esc(meta)+(s.type?'<span class="tbbq-bp__topic">'+esc(s.type)+'</span>':'')+'</p>'
      +(s.description?'<div class="tbbq-bp__body">'+String(s.description).split("\\n").filter(Boolean).map(function(p){return '<p>'+esc(p)+'</p>';}).join("")+'</div>':'')
      +(people?'<h3>Speakers</h3><ul class="tbbq-bp__people">'+people+'</ul>':'');
    overlay.hidden=false;
    modal.querySelector(".tbbq-bp__close").focus();
  }
  function closeModal(){
    overlay.hidden=true;
    /* Send focus back where it came from, or a keyboard user is dumped at the top of the
       document every time they close a session. */
    if(lastFocus&&lastFocus.focus)lastFocus.focus();
  }

  daysEl.addEventListener("click",function(e){
    var b=e.target.closest?e.target.closest(".tbbq-bp__card[data-i]"):null;
    if(b)openModal(ALL[+b.getAttribute("data-i")]);
  });
  overlay.addEventListener("click",function(e){if(e.target===overlay)closeModal();});
  modal.addEventListener("click",function(e){if(e.target.closest(".tbbq-bp__close"))closeModal();});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!overlay.hidden)closeModal();});

  /* r.ok matters: a 429 or 502 still returns JSON with no list in it, which without this
     check reads as "no sessions" rather than "could not load". */
  fetch(ENDPOINT).then(function(r){
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }).then(function(data){
    ALL=(data&&data.sessions)||[];
    if(!ALL.length){daysEl.innerHTML='<p class="tbbq-bp__empty">No sessions to show yet.</p>';return;}
    var seen=[];
    ALL.forEach(function(s){if(s.room&&seen.indexOf(s.room)<0)seen.push(s.room);});
    seen.sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
    /* One track means nothing to filter, so the row is dropped rather than shown with a
       single inert pill. */
    if(seen.length>1){
      pillsEl.innerHTML='<button type="button" role="tab" aria-selected="true" data-t="">All</button>'
        +seen.map(function(t){return '<button type="button" role="tab" aria-selected="false" data-t="'+esc(t)+'">'+esc(t)+'</button>';}).join("");
      pillsEl.addEventListener("click",function(e){
        var b=e.target.closest?e.target.closest("button[data-t]"):null;
        if(!b)return;
        track=b.getAttribute("data-t");
        Array.prototype.forEach.call(pillsEl.children,function(x){x.setAttribute("aria-selected",String(x===b));});
        render();
      });
    } else { pillsEl.remove(); }
    render();
  }).catch(function(err){
    daysEl.innerHTML='<p class="tbbq-bp__empty">Could not load the program.</p>';
    if(window.console)console.error("[tbbq brella embed]",err);
  });
})();
</script>`;
}
