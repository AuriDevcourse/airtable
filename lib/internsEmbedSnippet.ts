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
    --accent:#FF2600;--orange:#fa7000;
    --head:'Onest',ui-sans-serif,system-ui,sans-serif;--sans:'Inter',ui-sans-serif,system-ui,sans-serif;
    display:block!important;${transparent ? "" : "background:var(--bg)!important;padding:32px 24px!important;border-radius:20px!important;"}
    font-family:var(--sans)!important;color:var(--fg)!important;box-sizing:border-box;
    /* The typographic BASE everything below inherits from. Declared here rather than left to the
       host page, because the next rule makes every child inherit and inheriting a theme's 16px
       serif is how this panel stopped looking like itself. */
    font-size:14px!important;font-weight:400!important;font-style:normal!important;line-height:1.55!important;letter-spacing:normal!important;text-transform:none!important}
  #${id} *{box-sizing:border-box}
  /* ─── THE THEME DOES NOT GET A VOTE ON TYPE ──────────────────────────────────────────────
     WordPress themes style bare tags — a, p, h3, li, span — with their own font-size and family,
     and any element here that did not restate its font was rendering at the theme's size. The
     manager's name came out twice the height of the line it sits on (Auri, 2026-08-19).
     inherit, not fixed values: each element then takes what its own parent sets, which is what the
     rules below already assume. Every rule after this one overrides it, so a card element that DOES
     declare its own size still wins — later rule, same weight. text-decoration is deliberately not
     in here: the underlines on the links are meaningful. */
  #${id} p,#${id} ul,#${id} li,#${id} a,#${id} span,#${id} strong,#${id} h3,#${id} summary,#${id} div,#${id} button{font-family:inherit!important;font-size:inherit!important;font-weight:inherit!important;font-style:inherit!important;line-height:inherit!important;letter-spacing:inherit!important;text-transform:inherit!important}
  /* WordPress themes set display on almost everything, and two of the pieces below are toggled by
     the hidden attribute. Without this the "hidden" half of the pitch is on screen anyway. */
  #${id} [hidden]{display:none!important}
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
  /* Name, role and the LinkedIn pill in one left-aligned column beside the photo. align-items is
     flex-start so the pill is the width of its own label, not of the column. */
  #${id} .tbbq-ip__who{min-width:0!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important}
  #${id} .tbbq-ip__name{margin:0!important;padding:0!important;font-family:var(--head)!important;font-size:17px!important;font-weight:600!important;line-height:1.25!important;color:#fff!important}
  #${id} .tbbq-ip__role{margin:4px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12.5px!important;line-height:1.4!important}

  /* THE PITCH, and it is the largest text in the card on purpose. */
  #${id} .tbbq-ip__pitch{margin:0!important;padding:0!important;color:rgba(255,255,255,.88)!important;font-family:var(--sans)!important;font-size:14px!important;font-weight:400!important;line-height:1.55!important}

  /* ─── THE LONG FIELDS, AS THEY WERE TYPED ──────────────────────────────────────────────
     Interns write these as lists: a title line, then one bullet per thing they do. Rendered as one
     paragraph they read as a run-on sentence with stray glyphs in it, so the script parses the
     lines back into blocks. Keep in step with .ip-rt__* in app/globals.css. Margins sit on the
     blocks, never the container, so the last one leaves no gap above whatever follows. */
  #${id} .tbbq-ip__rtPara{margin:0 0 9px!important;padding:0!important}
  #${id} .tbbq-ip__rtHeading{margin:0 0 7px!important;padding:0!important;color:var(--fg)!important;font-family:var(--head)!important;font-weight:600!important;font-size:12.5px!important;letter-spacing:.01em!important;line-height:1.35!important}
  /* Hanging bullets: the marker sits in the padding so a wrapped line lines up under the first word
     rather than under the dot. */
  #${id} .tbbq-ip__rtList{margin:0 0 9px!important;padding:0 0 0 16px!important;list-style:none!important}
  #${id} .tbbq-ip__rtList>li{position:relative!important;margin:0 0 5px!important;padding:0!important;list-style:none!important}
  #${id} .tbbq-ip__rtList>li:before{content:""!important;position:absolute!important;left:-12px!important;top:.55em!important;width:4px!important;height:4px!important;border-radius:9999px!important;background:var(--accent)!important}
  #${id} .tbbq-ip__rtList>li:last-child{margin-bottom:0!important}
  #${id} .tbbq-ip__rtPara:last-child,#${id} .tbbq-ip__rtHeading:last-child,#${id} .tbbq-ip__rtList:last-child{margin-bottom:0!important}
  #${id} .tbbq-ip__rtList strong,#${id} .tbbq-ip__rtPara strong{color:var(--fg)!important;font-weight:600!important}

  /* "Read full pitch". The capped pitch is what keeps a row of cards the same height, so the full
     text is a press away rather than on the card (Auri, 2026-08-19). A text button, not a pill: the
     LinkedIn pill is the thing you are meant to press on this card. */
  /* align-self, because the card is a column flex container and a stretched button centres its own
     label. text-align belongs with it: a button's text centres by default. */
  #${id} .tbbq-ip__more{appearance:none!important;cursor:pointer!important;display:inline-block!important;align-self:flex-start!important;text-align:left!important;margin:8px 0 0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;color:var(--muted)!important;font-family:var(--head)!important;font-size:11px!important;font-weight:700!important;letter-spacing:.08em!important;text-transform:uppercase!important;line-height:1.2!important;text-decoration:underline!important;text-decoration-color:rgba(255,255,255,.28)!important;text-underline-offset:3px!important;transition:color .18s,text-decoration-color .18s}
  #${id} .tbbq-ip__more:hover{color:var(--fg)!important;text-decoration-color:currentColor!important}
  #${id} .tbbq-ip__more:focus-visible{outline:2px solid var(--orange)!important;outline-offset:3px!important;border-radius:4px!important}

  /* The ask. Boxed and labelled so a recruiter skimming twenty cards can read only these. */
  #${id} .tbbq-ip__ask{margin:14px 0 0!important;padding:11px 13px!important;border:0!important;border-left:3px solid var(--accent)!important;border-radius:0 8px 8px 0!important;background:rgba(255,38,0,.07)!important}
  #${id} .tbbq-ip__askLabel{display:block!important;margin:0 0 3px!important;padding:0!important;font-family:var(--head)!important;font-size:10px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--accent)!important}
  #${id} .tbbq-ip__askText{display:block!important;margin:0!important;padding:0!important;color:var(--fg)!important;font-size:13px!important;line-height:1.45!important}

  /* RESPONSIBILITIES, FOLDED AWAY. The longest field on the card and the one nobody reads twenty
     times over, so the closed state says only that it is there. A native <details>: keyboard
     operable, announces its own expanded state, and needs no script. Keep in step with .ip-does in
     app/globals.css. */
  #${id} .tbbq-ip__does{display:block!important;margin:14px 0 0!important;padding:12px 0 0!important;border-top:1px solid var(--border)!important}
  #${id} .tbbq-ip__doesSummary{display:flex!important;align-items:center!important;gap:8px!important;margin:0!important;padding:0!important;cursor:pointer!important;list-style:none!important;color:var(--muted)!important;font-family:var(--head)!important;font-size:10px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important;transition:color .2s}
  #${id} .tbbq-ip__doesSummary::-webkit-details-marker{display:none!important}
  #${id} .tbbq-ip__doesSummary::marker{content:""!important}
  #${id} .tbbq-ip__doesSummary:hover{color:var(--fg)!important}
  #${id} .tbbq-ip__doesSummary:focus-visible{outline:2px solid var(--orange)!important;outline-offset:3px!important;border-radius:6px!important}
  /* Pushed to the far edge so every card's chevron sits on the same vertical line down the grid. */
  #${id} .tbbq-ip__chev{flex:none!important;width:14px!important;height:14px!important;margin-left:auto!important;fill:none!important;stroke:currentColor!important;transition:transform .18s}
  #${id} .tbbq-ip__does[open] .tbbq-ip__chev{transform:rotate(90deg)}
  #${id} .tbbq-ip__doesBody{margin:9px 0 0!important;padding:0!important;color:var(--muted)!important;font-size:12.5px!important;line-height:1.5!important}

  /* margin-top:auto is what pins this to the bottom of an uneven row. */
  #${id} .tbbq-ip__foot{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;flex-wrap:wrap!important;margin:18px 0 0!important;padding:0!important}
  #${id} .tbbq-ip__card .tbbq-ip__foot{margin-top:auto!important;padding-top:18px!important}
  #${id} .tbbq-ip__from{margin:0!important;padding:0!important;color:var(--muted)!important;font-size:11.5px!important;line-height:1.3!important}

  /* WHO AT TECHBBQ THIS INTERN REPORTS TO (Auri, 2026-08-19). To the right of the date, muted, so it
     reads as an annotation on the card rather than part of the pitch. The label recedes and the NAME
     is the part you read, which is why the name is brighter than the date beside it. Keep in step
     with .ip-card__mgr in app/globals.css. */
  #${id} .tbbq-ip__mgr{display:inline-flex!important;align-items:center!important;gap:6px!important;margin:0 0 0 auto!important;padding:0!important;color:rgba(255,255,255,.78)!important;font-size:11.5px!important;line-height:1.3!important}
  #${id} .tbbq-ip__mgrIcon{flex:none!important;width:12px!important;height:12px!important;color:var(--muted)!important;fill:none!important;stroke:currentColor!important}
  #${id} .tbbq-ip__mgrLabel{color:var(--muted)!important;font-family:var(--head)!important;font-size:9.5px!important;font-weight:700!important;letter-spacing:.12em!important;text-transform:uppercase!important}
  /* Underlined on an offset rather than coloured: at 11.5px in a card footer that is the only
     affordance that reads as pressable without pulling the eye off the LinkedIn pill above.
     THE FONT IS PINNED TO inherit, and that is not decoration. WordPress themes style bare <a> with
     their own font-size and family, so a link that only declares colour and underline renders at the
     theme's link size — the manager's name came out twice the height of the line it sits on
     (Auri, 2026-08-19). Every text link inside a card has to restate what it inherits. */
  #${id} .tbbq-ip__mgrLink{color:inherit!important;background:none!important;font:inherit!important;letter-spacing:inherit!important;text-transform:none!important;text-decoration:underline!important;text-decoration-color:rgba(255,255,255,.3)!important;text-underline-offset:3px!important;transition:color .18s,text-decoration-color .18s}
  #${id} .tbbq-ip__mgrLink:hover{color:var(--orange)!important;text-decoration-color:currentColor!important}
  #${id} .tbbq-ip__mgrLink:focus-visible{outline:2px solid var(--orange)!important;outline-offset:3px!important;border-radius:4px!important;text-decoration-color:transparent!important}
  #${id} .tbbq-ip__mgrSep{color:var(--muted)!important}

  #${id} .tbbq-ip__li{display:inline-flex!important;align-items:center!important;gap:7px!important;margin:0!important;padding:9px 14px!important;border:1px solid var(--border)!important;border-radius:9999px!important;background:transparent!important;color:var(--fg)!important;font-family:var(--head)!important;font-size:12px!important;font-weight:600!important;line-height:1!important;text-decoration:none!important;box-shadow:none!important;transition:background .2s,border-color .2s,color .2s}
  #${id} .tbbq-ip__li:hover{background:var(--fg)!important;border-color:var(--fg)!important;color:#0d0d0d!important}
  #${id} .tbbq-ip__li svg{width:14px!important;height:14px!important;display:block!important;fill:currentColor!important}
  /* The same pill, sized down to sit under a name without competing with it (Auri, 2026-08-17:
     LinkedIn belongs with the name, where you read WHO somebody is). */
  #${id} .tbbq-ip__li--head{margin:8px 0 0!important;padding:6px 11px!important;gap:6px!important;font-size:11px!important}
  #${id} .tbbq-ip__li--head svg{width:12px!important;height:12px!important}

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
  // Lucide chevron-right and user-round, drawn with the same weight and joins as the dashboard's.
  var CHEV='<svg class="tbbq-ip__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  var USER='<svg class="tbbq-ip__mgrIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';

  // ─── FORMATTED THE WAY IT WAS TYPED ────────────────────────────────────────────────────
  // A port of parseBlocks/RichText in app/interns/page.tsx, and it has to stay a port: the two
  // cards are meant to be the same card. Interns write the long fields as a list — a title line,
  // then one bullet per thing they do, with whatever glyph their keyboard offered. As one
  // paragraph that reads as a run-on sentence with punctuation scattered through it.
  //
  // A deliberately small subset of Markdown: bullet lines, a **bold** heading, paragraphs. Every
  // piece of the intern's text goes through esc() before it is concatenated, and only the tags
  // this function writes itself are HTML. Nothing here ever puts raw field text into markup.
  var BULLET=/^(?:[-–—*•●○▪‣·]|\\d+[.)])\\s+/;
  var BOLD_LINE=/^\\*\\*(.+)\\*\\*$/;

  // **bold** inside a line. Anything else Markdown can do is left as the characters they typed:
  // half-rendered Markdown is worse than none.
  function inlineHtml(text){
    var parts=String(text).split("**");
    if(parts.length<3)return esc(text);
    return parts.map(function(part,i){return i%2?"<strong>"+esc(part)+"</strong>":esc(part);}).join("");
  }

  function richText(raw){
    var blocks=[];
    String(raw==null?"":raw).split("\\n").forEach(function(line){
      var text=line.trim();
      if(!text)return;
      // Consecutive bullets join the list already open, so a run of them is one <ul>, not six.
      if(BULLET.test(text)){
        var item=text.replace(BULLET,"").trim();
        if(!item)return;
        var last=blocks[blocks.length-1];
        if(last&&last.kind==="list")last.items.push(item);
        else blocks.push({kind:"list",items:[item]});
        return;
      }
      var bold=text.match(BOLD_LINE);
      blocks.push(bold?{kind:"heading",text:bold[1].trim()}:{kind:"para",text:text});
    });
    // A short first line with no closing punctuation is a job title, not a sentence. Promoted only
    // when something follows it, so a one-line entry stays plain text instead of a lone heading.
    var first=blocks[0];
    if(blocks.length>1&&first&&first.kind==="para"&&first.text.length<=60&&!/[.!?:,]$/.test(first.text)){
      blocks[0]={kind:"heading",text:first.text};
    }
    return blocks.map(function(b){
      if(b.kind==="list"){
        return '<ul class="tbbq-ip__rtList">'+b.items.map(function(i){return "<li>"+inlineHtml(i)+"</li>";}).join("")+"</ul>";
      }
      return '<p class="'+(b.kind==="heading"?"tbbq-ip__rtHeading":"tbbq-ip__rtPara")+'">'+inlineHtml(b.text)+"</p>";
    }).join("");
  }

  function collapse(s){return String(s==null?"":s).replace(/\\s+/g," ").trim();}

  function card(p){
    var meta=[p.role,p.department].filter(Boolean).join(" · ");
    var mgrs=p.managers||[];
    var h='<article class="tbbq-ip__card">';
    h+='<div class="tbbq-ip__head">';
    if(p.photo){h+='<img class="tbbq-ip__photo" src="'+esc(p.photo)+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async">';}
    // LinkedIn sits with the NAME, not in the footer: it identifies the person, so it belongs where
    // you read who they are. The footer keeps what is about availability rather than identity.
    h+='<div class="tbbq-ip__who"><h3 class="tbbq-ip__name">'+esc(p.name)+'</h3>';
    if(meta)h+='<p class="tbbq-ip__role">'+esc(meta)+'</p>';
    if(p.linkedin)h+='<a class="tbbq-ip__li tbbq-ip__li--head" href="'+esc(p.linkedin)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(p.name)+' on LinkedIn">'+LI+'LinkedIn</a>';
    h+='</div></div>';
    // THE CAPPED PITCH LEADS, always. The full one is rendered beside it and revealed on a press,
    // and only when there is more to read — a pitch already under the cap gets no button, because a
    // "Read full pitch" that expands to the same sentence is a broken promise.
    if(p.pitch){
      var full=collapse(p.pitchFull).length>collapse(p.pitch).length?p.pitchFull:"";
      h+='<div class="tbbq-ip__pitch tbbq-ip__pitchShort">'+esc(p.pitch)+'</div>';
      if(full){
        h+='<div class="tbbq-ip__pitch tbbq-ip__pitchFull" hidden>'+richText(full)+'</div>';
        h+='<button type="button" class="tbbq-ip__more" aria-expanded="false">Read full pitch</button>';
      }
    }
    if(p.lookingFor)h+='<div class="tbbq-ip__ask"><span class="tbbq-ip__askLabel">Looking for</span><span class="tbbq-ip__askText">'+esc(p.lookingFor)+'</span></div>';
    if(p.responsibilities){
      h+='<details class="tbbq-ip__does"><summary class="tbbq-ip__doesSummary"><span>Responsibilities</span>'+CHEV+'</summary>';
      h+='<div class="tbbq-ip__doesBody">'+richText(p.responsibilities)+'</div></details>';
    }
    // Drawn only when there is something to put in it. With LinkedIn moved up to the name, a card
    // with neither a date nor a manager would otherwise show an empty padded strip along its edge.
    var from=niceDate(p.availableFrom);
    if(from||mgrs.length){
      h+='<div class="tbbq-ip__foot">';
      h+=from?'<p class="tbbq-ip__from">Available from '+esc(from)+'</p>':'<span></span>';
      if(mgrs.length){
        h+='<p class="tbbq-ip__mgr">'+USER+'<span class="tbbq-ip__mgrLabel">Manager</span><span>';
        h+=mgrs.map(function(m){
          // Pressable only when we HAVE a profile: a styled span that looks like a link and does
          // nothing is the worse failure. The label names whose profile it is, because "Manager"
          // repeated down a screen tells a screen reader nothing.
          return m.linkedin
            ?'<a class="tbbq-ip__mgrLink" href="'+esc(m.linkedin)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(m.name)+' on LinkedIn">'+esc(m.name)+'</a>'
            :esc(m.name);
        }).join('<span class="tbbq-ip__mgrSep"> · </span>');
        h+='</span></p>';
      }
      h+='</div>';
    }
    h+='</article>';
    return h;
  }

  // "Read full pitch". Bound ONCE to the grid rather than per card, so it survives every re-render
  // the department pills cause.
  grid.addEventListener("click",function(e){
    var btn=e.target&&e.target.closest?e.target.closest(".tbbq-ip__more"):null;
    if(!btn)return;
    var art=btn.closest(".tbbq-ip__card");
    var shortEl=art&&art.querySelector(".tbbq-ip__pitchShort");
    var fullEl=art&&art.querySelector(".tbbq-ip__pitchFull");
    if(!shortEl||!fullEl)return;
    var opening=fullEl.hasAttribute("hidden");
    if(opening){fullEl.removeAttribute("hidden");shortEl.setAttribute("hidden","");}
    else{shortEl.removeAttribute("hidden");fullEl.setAttribute("hidden","");}
    btn.setAttribute("aria-expanded",String(opening));
    btn.textContent=opening?"Show less":"Read full pitch";
  });

  // A DIFFERENT ORDER FOR EVERY VISITOR (Auri, 2026-08-17). The first card on the wall is the one
  // that gets read, and the feed's own sort would hand that to the same intern on every view. Done
  // here rather than server-side because /api/interns is cached and CDN-cached: a shuffle up there
  // would freeze one order for everybody until the cache rolled over.
  //
  // Shuffles the ARRAY once on load, not per render, so pressing a department pill re-filters
  // without re-jumping the cards that stay on screen.
  function shuffle(a){
    for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
    return a;
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
      all=shuffle((d&&d.interns)||[]);
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
