# Progress · TechBBQ Airtable Connector

Server-side proxy that exposes a **safe slice** of the TechBBQ Airtable as JSON, so
techbbq.dk (WordPress + Elementor) can show speakers without the token or PII ever
reaching the browser.

---

# HANDOFF · read this first (2026-08-03)

**State: pushed and deployed.** Clean tree, `tsc --noEmit` clean. (No commit hash recorded here
on purpose: this line ships inside the commit it would describe, so any hash written into it is
stale the moment it is written.) main auto-deploys, so what is on GitHub is what is on the site.

**The one thing left is manual and nothing works without it: re-copy BOTH embeds** from the
deployed dashboard into their Elementor HTML widgets. Sessions 03k and 03l fixed the partner
logo 404s, the black panel, the tile geometry and the empty International row, and a pasted
snippet NEVER self-updates. Paste into an HTML widget, not a Text Editor widget: the latter runs
wpautop, which injects `<p>` and `<br>` into the script and breaks it outright.

## What exists now

| Page | Feed | Source of truth |
|---|---|---|
| `/ls-startups` | `/api/ls-startups` | Airtable, live. Logos included. |
| `/partners` | `/api/partners` | Airtable for WHO + tier. **Logos are local files.** |
| `/brella-program` | `/api/program?event=brella` | Brella, read-only |
| `/partner-events` | `/api/partner-events` | Airtable |

## The things most likely to trip up the next person

**1. Partner logos are a COPY, not live.** Adding a partner in Airtable puts them on the page
immediately but with NO logo. Someone must run:
```
node scripts/sync-partner-logos.mjs --write      # match + copy into public/partner-logos
node scripts/upload-white-logos.mjs --write      # optional: push the white set back to Airtable
```
`/ls-startups` does NOT have this problem — it reads logos straight from Airtable.

**2. Never trust an image measurement.** Three separate hours went to this. An image can look
broken when it is fine, or fine when it is broken:
- `loading="lazy"` means an off-screen image is never requested, so `naturalWidth === 0` and
  every logo reads as "broken". Force `loading="eager"` and await onload first.
- The photo proxy answers `max-age=86400` on a STABLE url, so after replacing a logo the
  browser serves yesterday's file for a day. Add a cache-buster before measuring. (The feed now
  appends `?v=<attachmentId>` so real visitors are fine; this is about measuring.)
- A measurement taken during a dev-server rebuild reports failures that do not exist.

**3. Nine partner tiers are hard-coded**, in `TIER_OVERRIDES` in `lib/partners.ts`, because
Airtable and the live site disagree and the live site won. There is no auto-sync: techbbq.dk
answers a plain request with a 455, so it can only be read through a real browser. Re-check that
map if the live page is ever re-tiered.

**3b. Tuning a logo's size is a FEED edit, not a CSS one.** `LOGO_SCALE` in `lib/partners.ts`
holds the per-logo nudges and `LOGO_FILE_OVERRIDES` swaps in a different file (or a row-spanning
frieze). Both flow to the dashboard and the embed together. The values are LINEAR, so the
visible area changes with the square: 0.85 is a 28% area cut, not a 15% one.

**4. Every URL a feed emits must be ABSOLUTE.** Always build it with `baseUrl()` from
`lib/photo.ts`. A relative path works on the dashboard and silently 404s in the embed, because
the browser resolves it against techbbq.dk. This is invisible in local preview: same origin, so
it looks perfect right up until it is pasted. It cost the whole partners wall once (03k).

## Open items, none blocking

1. **Push 03k, THEN re-copy both embeds** from the DEPLOYED dashboard into WordPress. Order
   matters: re-copying before the deploy just bakes the broken relative logo URLs back in. The
   snippets currently pasted there predate the Elementor hardening, the 5-per-row change, the
   row colours, the logo fit and the absolute-URL fix.
2. **Widen Life Science to 6 per row** once a category fills up. It is `--cols` on the row in
   `app/ls-startups/page.tsx` and the `repeat(5,…)` in `lib/lsStartupsEmbedSnippet.ts`.
3. **Two very wide logos still read small**, Immunordic (aspect 5.66) and H+H (4.35). They
   already touch both side edges; only a tighter SVG export fixes it.
4. **Yoke Bio has no website** ("no website yet" in Airtable), so its logo is unlinked. 23
   partners are likewise unlinked.
5. **Walther Therapeutics is linked to a site its own Airtable note calls under construction.**
   Auri was told; left linked since the event is weeks out.
6. **Do NOT use the LS `Linkedin` column as a website fallback** — those are personal profiles,
   not company pages. A company-LinkedIn column would be the clean fix.
7. Still open from earlier sessions: `parseTimeSlot` has no equivalent in `lib/program.ts`, and
   the Brella schedule still contains four test rows on Founders Stage.

## Conventions worth keeping

- Read multi-selects with `tags()`, never `===`. `status` being a multi-select silently sent the
  first version of the LS gate to the wrong field.
- Publish gates live SERVER-side, never in an embed snippet. A pasted snippet outlives the
  deploy and cannot be corrected.
- Attachment writes use `uploadAttachment` (appends). A PATCH on an attachment field replaces
  the whole array and would erase every existing file.
- Write JS and Markdown with the editor tools, not shell heredocs. Escaping has silently
  corrupted a regex (a literal 0x08 byte) and eaten backticks out of this file.

---

## Session 2026-08-04f (the phone picker now follows the section)

State: done, live and verified at 375px.

The phone picker was filled only for the TIMELINE sections. Switching to Event Rooms therefore
left an empty box still labelled "Stage" — and because the pill row is hidden below 760px, there
was then no way to filter rooms on a phone at all. A real gap, not just a wrong label.

`fillPicker(label, allLabel, items)` now builds it from whatever the current section's pill row
holds, and each section declares its own wording:

| Section | Label | Options |
|---|---|---|
| Stages | Stage | All stages + the five |
| Event Rooms | Room | All rooms + Event Room 1-4, Rooms 5,6,7 |
| Grill Sessions | Grill | All grills + Green/Blue/Orange |
| Side Events | — | hidden; filtered by DAY chips instead |

Hiding it needed `#id .tbbq-bp__pickWrap.tbbq-bp__pickWrap--off` — two classes, so it outranks
the media-query rule that shows the picker on a phone regardless of source order.

Verified live: labels correct per section, the room picker actually filters (24 cards -> 9 for
Event Room 1), Side Events shows TUE/WED/THU day chips and no picker.

Files: `lib/brellaEmbedSnippet.ts`.

## Session 2026-08-04e (the dialog was COLUMN-FRAGMENTED; how to find that again)

State: done, live and verified at 375px.

**The moderator appeared off to the right and the dialog scrolled sideways.** Both were one
cause: the speaker list was being FRAGMENTED across CSS columns.

**The evidence, and it is the tell to remember.** The list reported a CSS `width` of 298px while
`getBoundingClientRect()` said 612, and `ul.getClientRects().length` was **2** — at
`31,634 298x133` and `345,47 298x242`. A normal block box has exactly one client rect. Two rects
of equal width, side by side, with the earlier content in the LOWER one, is column fragmentation
and nothing else. That is why the first speaker sat at the bottom of the left column while the
rest appeared top-right.

**getComputedStyle could not find the culprit.** Every ancestor from the list up to `main`
reported `column-count: 1` / `auto`. Whatever applies the columns on techbbq.dk does not surface
there, and this is the third time on this page that computed styles have lied (see also the
transform and grid readings in 03m and 03x). Do not trust them here; trust geometry.

**Found by binary search on the live page instead**, applying one candidate property at a time
and re-counting the fragments: `columns:1` on the modal did nothing, `column-span:all` on the
modal did nothing, `display:flow-root` on the list did nothing, and `column-span:all` on the LIST
fixed it instantly — one rect, 283px, no sideways scroll.

So `column-span:all` is now on every direct child of the modal, since any of them can fragment.
It is ignored outside a multi-column context, so it costs nothing anywhere else.

**Also Auri's ask:** on a phone the dialog is 95% wide, capped at 92vh, and scrolls only
downwards; the overlay's side padding was removed so the width is actually honoured.

Verified live at 375px: modal 342px (91% of the screen, the rest being its own margins), list ONE
fragment at 285px, all 4 speakers in a single column stacked downwards, no sideways scroll on the
modal or the page, vertical scrolling works, dialog fits the viewport.

Files: `lib/brellaEmbedSnippet.ts`.

## Session 2026-08-04d (dialog scrolled sideways on a phone; roomier phone timeline)

State: done, live and verified at 360px and 1600px.

**The dialog scrolled HORIZONTALLY on a phone.** Measured rather than guessed: the modal's
`scrollWidth` was 622 against a `clientWidth` of 323, and walking its descendants found the
culprit immediately — `ul.tbbq-bp__people` rendering 582px wide inside a 283px content box,
overflowing by 278.

It was a CSS grid. This theme has now been caught mishandling grid containers twice (the
timeline in 03x, this list here), so the speaker list is plain BLOCK flow with margins, which
cannot outgrow its parent. `overflow-x:hidden` on the modal is the backstop. Live after:
`scrollWidth === clientWidth`, list 283px, no sideways scroll on either the modal or the overlay.

Note the overlay scrolls horizontally by DEFAULT once it scrolls vertically: setting
`overflow-y:auto` while `overflow-x` is `visible` computes overflow-x to `auto` per spec. So an
overflowing child anywhere in the dialog becomes a horizontal scrollbar unless something stops
it.

**Phone timeline: 3.4 -> 4.2px per minute**, and with rows that tall there is room to label every
HALF hour instead of every hour. Half-hour labels are 10px and dimmed against the hours' 11px
semibold, so the gutter still reads as hours with marks between them. Desktop is unchanged at
hourly labels.

Verified live at 360px: 17 labels including :30s, 16 cards, 0 clipping, dialog fits and does not
scroll sideways. At 1600px: 5 columns in the right order, hourly labels only, 43 cards, 1
clipping by 16px, no full-width cards, dialog fine.

Files: `lib/brellaEmbedSnippet.ts`.

## Session 2026-08-04c (phone select was squashed; and a guard that let a stale save through)

State: done, live and verified.

**The phone's stage select clipped its own text.** techbbq.dk puts a fixed height on every
`select`; our rule declared padding but NO height, so the theme won: a 32px box holding 22px of
padding plus a 17px line. Fixed with an explicit `height:auto; min-height:46px`. Live: 46px box
for 39px of content.

**A false alarm worth recording.** The single mobile column looked like it was showing the wrong
sessions — "Welcome to TechBBQ 2026!" under BBQ Stage, where it used to be on Founder. Checked
the feed: Brella genuinely moved it, and 16 cards is the correct BBQ count for 26 August. The
filter was right. Check the DATA before rewriting the filter.

**A save silently did nothing, and the guard is why.** The publish step verifies the fetched
snippet before writing, and the marker used was `min-height:46px` — which ALREADY existed on the
column headers. A stale fetch passed the check, and the old snippet was re-saved: the giveaway
was the stored length being byte-identical to the previous save (53272). Re-run with a marker
unique to the change (`min-height:46px!important;max-height:none`) plus a `?cb=` on the fetch.

Rule for next time: **the marker must be a string that did not exist in the previous version**,
and an unchanged byte length after a save means nothing was written.

Live at 360px: select 46px with its text fitting, one column, correct stage, 16 cards, 0
clipping, label inside the box, no horizontal overflow.

Files: `lib/brellaEmbedSnippet.ts`.

## Session 2026-08-04b (published the embed to techbbq.dk from the browser)

State: done. The live page carries the current snippet. `tsc --noEmit` clean, everything pushed.

**The embed is now installed by fetching, not pasting.** New route `/api/embed?kind=…` returns
the snippet as text/plain with `__ORIGIN__` already resolved to the deployment. The copy buttons
build their string in the BROWSER, which is fine for a human and useless for automation; a 53KB
snippet is not something to move by hand. It refuses with 409 when `baseUrl()` is empty rather
than emitting relative endpoints, which is the bug that emptied the partner wall.

It is on the middleware's PUBLIC_PATHS list. That is deliberate: it returns markup, the same
bytes are already in the source of any page carrying the snippet, it reads no protected feed and
calls no paid API, so gating it would protect nothing and make it unfetchable from the WordPress
editor that needs it.

**How the page was updated** (repeatable, and much faster than copy-paste):
1. `https://techbbq.dk/wp-admin/post.php?post=58341&action=elementor`
2. Wait for `elementor.documents.getCurrent().container.children.length > 0` — the editor boots
   long before its element tree exists, and reading too early finds ONE container and no widgets.
3. Walk the container tree for the widget whose `settings.get("html")` matches `/tbbq-bp/`.
   On this page that is widget `af642bb`, and it is the only match.
4. `$e.run("document/elements/settings", {container, settings:{html:NEW}, options:{external:true}})`
5. `$e.run("document/save/default")`

**The front end is CACHED.** After saving, `techbbq.dk/program2026/` still served the old snippet;
`?cachebust=…` showed the new one immediately. Always verify with a cache-buster or the
measurement is of the previous version.

**What the live page then revealed, which no local harness had:** 18 of 41 cards were clipping
their own text. A real column there is ~270px, narrower than any preview, so titles wrap to two
lines far more often while a card's height still comes from its DURATION. Two changes: the minute
scale 2.4 -> 3px (30 min = 90px), and a middle "tight" tier that keeps title + time but drops the
faces below 78px — measured as 2 lines of title (32) + time (14) + faces (16) + padding (12).

Verified on the live page, 1600px: 41 cards, **1** clipping by 16px (was 18), no full-width cards,
correct stage order, dialog fits the viewport with the close on the right, clear of the time,
which carries the stage colour as a 3px bar, bios closed, names 13px, Campfire "Program coming
soon". At 390px: one column, select shown, pills hidden, label and select inside the box, 10px
side padding, **0 of 16** cards clipping, no horizontal overflow.

Files: `app/api/embed/route.ts` (new), `middleware.ts`, `lib/brellaEmbedSnippet.ts`,
`app/brella-program/page.tsx`, `app/globals.css`.

## Session 2026-08-04a (dialog time bar, Campfire wording, mobile density)

State: done, pushed. `tsc --noEmit` clean. Diagnosed against the LIVE page again.

**The close button was on the LEFT, sitting on the time.** Not a theme problem: the harsh dialog
reset from 03w sets `float:none!important` on everything inside the modal, which killed the close
button's own `float:right!important`. Equal specificity, and the reset is declared later, so it
won. Re-declared AFTER the reset. Worth remembering: a blanket `#id .modal *` reset outranks
nothing and ties with every class rule in the same block, so anything it stamps out has to be
restored below it, not above.

**The dialog's time now carries the stage colour** as a 3px left bar, with 52px of right padding
so the sticky close button never reaches the text. Measured gap: 307px, no collision.

**Campfire says "Program coming soon"** instead of "Nothing scheduled", on both surfaces.

**Speaker names 14px -> 13px.**

**The 05:00 PM label read as cut off** because the last gutter label is centred on the final
gridline and hangs half below the body. 22px of bottom padding on the timeline.

**Mobile, measured on techbbq.dk itself at 390px:** the embed sat flush against both screen
edges, the STAGE label was clipped off the left, and cards were cutting their own speaker rows.
The last one is the interesting one: a phone keeps the same type size in a column a third as
wide, so titles wrap onto more lines while the card's height still comes from its DURATION.
The minute scale now stretches to 3.4px/min below 760px (2.4 on desktop), which gives that text
somewhere to go. Result: 0 of 15 cards clipping, against several before. Plus 10px of side
padding and a smaller section masthead.

Files: `lib/brellaEmbedSnippet.ts`, `app/brella-program/page.tsx`, `app/globals.css`.

### Next steps

1. Re-copy the embed into /program2026/.

## Session 2026-08-03z (the dialog was taller than the screen; diagnosed on the LIVE page)

State: done, pushed. `tsc --noEmit` clean.

**The embed is live at https://techbbq.dk/program2026/** (found via the WordPress pages REST
list). Worth recording: the Chrome extension runs in Auri's own session, so the real page can be
inspected directly instead of guessing from a screenshot. That is how this one was diagnosed and
it beat the simulation.

**Measured on the live page, dialog open:**
```
modal height    1191px      max-height: none
modal overflow  visible     body overflow while open: visible
```
The modal had NO height cap and could not scroll itself; only the overlay could. On any screen
shorter than the content the last speaker was simply unreachable, and because the page behind
was never locked, a scroll gesture moved the article instead of the dialog. That is the cut-off
Auri saw, and it got worse on a phone purely because the viewport is shorter.

Not an Elementor problem, incidentally: the overlay's `position: fixed` was working correctly
and no ancestor was clipping it. Checked the whole chain for transform/filter/will-change/contain
and found none. The bug was ours.

**Fix, on BOTH the embed and the dashboard:**
- modal `max-height: 90vh` (94vh on a phone) + `overflow-y: auto` + `overscroll-behavior:
  contain`, so it scrolls itself and never runs past the screen;
- the close button moves from `position: absolute` to `position: sticky; float: right`, because
  the modal is now the scroll container and an absolute button scrolls out of reach. sticky +
  float works in plain block flow, so a theme that blockifies flex or grid cannot strand it;
- the embed now locks `body` overflow while open and restores it on close. The dashboard already
  did this.

Verified at 525px and 900px viewports, with every bio expanded, on both surfaces: the modal
always fits the viewport, the close button stays pinned while scrolling, and the bottom of the
content is reachable.

Files: `lib/brellaEmbedSnippet.ts`, `app/globals.css`.

### Next steps

1. Re-copy the embed into `/program2026/`. The pasted copy still has the uncapped dialog, the
   grid layout and the CAPS.

## Session 2026-08-03y (bios closed, bigger headings, stage order, short sessions inline)

State: done, pushed. `tsc --noEmit` clean.

**Bios opened on load, and it was my own CSS.** The 03w dialog reset included
`.tbbq-bp__pbio{display:block!important}`, and `display:block!important` beats the UA style
behind the `hidden` attribute, so every bio was expanded. Fixed with a following rule of equal
specificity: `#id .tbbq-bp__modal [hidden]{display:none!important}`. Lesson worth keeping: once
you force `display` on an element, you have silently disabled `hidden` on it.

**Stage order is now BBQ, Founder, Tech, Campfire, Life Science** (`BRELLA_STAGES`). One list,
so the dashboard, the embed and the mobile dropdown all reorder together.

**Column headings 15px -> 17px** on both surfaces (15px on a phone).

**A 3-minute Breathwork Break was being exiled to a half-width side lane.** Session 03n had the
lane packer compare DRAWN extents rather than scheduled ones, so a card floored to 26px could
not cover the next one. The side effect: a 15:14-15:17 break "overlaps" the 15:19 talk on
screen while not overlapping on the clock, so it counted as a clash and lost half its width.
Reverted to comparing scheduled ends. Short sessions now sit in sequence at full width and may
overlap the next card by a few pixels BELOW their text, which is the better trade.

Verified: 5 of the 6 Breathwork Breaks now render at full column width; the 6th stays at 50%
because it genuinely clashes with another session, which is what lanes are for.

**Backticks in a comment broke the build for the third time this session.** The snippet is one
big template literal. There is now a note in the file; the tell is `TS1005: ';' expected`.

Files: `lib/brellaSections.ts`, `lib/brellaEmbedSnippet.ts`, `app/brella-program/page.tsx`,
`app/globals.css`.

## Session 2026-08-03x (embed collapsed on techbbq.dk: CSS Grid removed, casing forced)

State: done, pushed. `tsc --noEmit` clean.

Auri's screenshot of the live embed: every card full width and stacked on top of the next, the
time gutter running the whole width with its times pinned right, and every session title and
speaker name in CAPS.

**Cause 1: the theme blockified the grid.** `.tbbq-bp__body` was `display:grid` and the columns
were grid items; the schedule only works because each column is a positioning context for its
absolutely positioned cards. Once the container is `display:block` the columns stack, the cards
resolve their `left`/`width` percentages against the BODY, and everything draws full width on
top of everything else.

`!important` did NOT save it, and neither did an inline `display:grid` — reproduced in a harness
applying `.sec div,.sec span{display:block}`, where the body still computed to `block` with both
in place. Rather than keep escalating a specificity fight that was already lost twice:

**THE TIMELINE NO LONGER USES CSS GRID.** Columns and the gutter are ABSOLUTELY POSITIONED, with
their geometry written inline by the script:
```
width: calc((100% - GUTTERpx) / N)
left:  calc(GUTTERpx + i * ((100% - GUTTERpx) / N))
```
An absolutely positioned box ignores its parent's `display` entirely, so there is nothing left
for a theme to override. It stays fluid because the widths are `calc()` percentages, and the 4px
side padding on each column replaces the old grid gap. The same treatment went to the header
(so it still lines up with the columns), the gridlines and the "Nothing scheduled" label.

**Cause 2: the theme uppercases content.** The 03w reset covered the DIALOG only; the schedule
itself was untouched. `#id, #id *` now force `text-transform:none`, `font-variant:normal` and
`letter-spacing:normal`, and the handful of places that SHOULD be uppercase (day labels, role
tags, topic chips, the all-day label) re-declare it at class specificity, which beats the
universal selector.

**Verified in a harness carrying all four theme habits at once** — `*{text-transform:uppercase}`,
`p{columns:2 8em}`, `div,span{display:block}`, `div{position:static}`:
- desktop 1717px: 5 columns at 329px each, headers aligned to their columns to the pixel,
  gutter 74px, 0 of 39 cards full width (29 before);
- phone 390px: one column, select shown, pills hidden, no horizontal overflow;
- dialog: 640px wide, description 582px at `column-count:1`, names and titles in normal case.

Files: `lib/brellaEmbedSnippet.ts`.

### Next steps

1. Re-copy the embed. The pasted one has the broken grid layout baked in.

## Session 2026-08-03w (ONE embed for the whole program, stable controls, hardened dialog)

State: done, pushed. `tsc --noEmit` clean.

**One snippet now carries the entire program.** There were four "Copy embed" buttons, one per
section; the dashboard is down to a single "Copy embed (whole program)". The snippet draws its
own Stages / Event Rooms / Grill Sessions / Side Events masthead and switches between them
client-side.

**The grouping is done SERVER-side**, via a new `?section=all` on `/api/program`, which answers
`{counts, groups:{stages, rooms, grills, side}}`. This is the whole reason it is not four
parallel fetches or a client-side filter: the rules for what belongs in which section live in
`lib/brellaSections.ts`, and shipping those regexes into the snippet would put a second copy on
techbbq.dk that can never be corrected once pasted. Same reasoning as `/api/all-speakers`.

**Pressing a filter no longer moves the page**, which needed two things, as on the dashboard:
1. `setSection()` measures the masthead's viewport offset and scrolls by the delta afterwards.
2. That is not enough on its own — Side Events is a fraction of the timeline's height, so the
   browser clamped `scrollTop` and the view still jumped ~200px. `applyFloor()` keeps a
   `min-height` equal to the tallest section seen. It is measured from the CHILDREN, because
   reading the container after the floor is applied would just return the floor.
Measured: rooms 143px and side 199px of movement before, **0px on all four** after, in both
directions.

**The dialog got a much harsher reset.** On techbbq.dk the description rendered ONE WORD PER
LINE and every name was uppercased. Two theme habits do that: a CSS multi-column rule on a
content wrapper, which turns a paragraph into a narrow strip, and `text-transform` on headings.
The modal now forces `columns:auto; column-count:1; column-width:auto`, `text-transform:none`,
`word-break:normal`, and `min-width:0` on flex children, which a flex item needs before it is
allowed to be as wide as its text. Verified against a harness that deliberately applies
`p{columns:2 8em}` and `h2,h3,strong{text-transform:uppercase}`: description 582px wide at
`column-count:1`, names no longer uppercased.

**Backticks bit again.** A CSS comment mentioning `columns` in backticks terminated the template
literal. Second time this session. There is now a line in the file saying so.

Files: `app/api/program/route.ts`, `lib/brellaEmbedSnippet.ts`, `components/CopyBrellaEmbed.tsx`,
`app/brella-program/page.tsx`.

### Next steps

1. Copy the ONE embed from the deployed dashboard into a single Elementor HTML widget and
   delete the four old per-section widgets.

## Session 2026-08-03v ("Copy API code" for the external designer)

State: done, pushed. `tsc --noEmit` clean.

Auri handed an external designer a fetch snippet for `/api/main-speakers` and wanted the same
for the other speaker feeds. `lib/apiSnippet.ts` + `components/CopyApiSnippet.tsx` generate it.
This is NOT an embed: the embed builders ship finished markup for an Elementor widget, this
ships a few lines of JavaScript for someone working in their own framework.

**Why it is generated rather than typed into a message: the array key is not the same on every
feed.** `/api/main-speakers` and `/api/speakers-2026` answer `{speakers:[...]}`, the event-room
and investor feeds answer `{people:[...]}`, and `/api/all-speakers` answers
`{counts, groups:{speakers, eventRoom, investors}}`. Copying one snippet and changing the URL
gives `undefined.map is not a function`, which is a poor thing to hand a contractor. Each
snippet spells out its own shape.

Buttons: `/all-speakers-2026` (combined + event room + investors), `/speakers-2026`,
`/investors`, `/main-speakers`. Styled as a secondary button so they do not compete with the
gradient "Copy embed code" beside them.

`/api/all-speakers` is the one to hand over for a single speakers page: one request, all three
groups, and the lists stay consistent because they are read in one server pass.

**Every snippet was EXECUTED, not just eyeballed**: 189 speakers / 91 event room / 38 investors
from the combined feed, and 12 / 189 / 43 / 38 from the four single feeds, every record with a
name.

### CORS IS THE THING THAT WILL BITE

`ALLOWED_ORIGIN` is a SINGLE origin (`lib/apiRoute.ts`), set to `https://techbbq.dk` in
production. Verified: the deployment returns that same value whatever Origin is sent, so a
browser on ANY other domain — the new site's staging URL, the designer's localhost — is blocked
from reading these feeds. Photos are unaffected (an `<img>` needs no CORS) and are absolute in
production; only the JSON is gated.

Two ways out, and the second needs code:
1. Point `ALLOWED_ORIGIN` at the new site instead. One env var, but techbbq.dk then loses access.
2. Make it a comma-separated allowlist and echo whichever origin matches. That means threading
   the request into `withCors()`, which has 37 call sites. NOT done: widening CORS is a security
   change and is Auri's call, not a side effect of a snippet task.

The snippets say this in a comment, so the designer knows what they are looking at when the
browser blocks them rather than guessing at the connector being down.

Files: `lib/apiSnippet.ts` (new), `components/CopyApiSnippet.tsx` (new),
`app/all-speakers-2026/page.tsx`, `app/investors/page.tsx`, `app/speakers-2026/page.tsx`,
`app/main-speakers/page.tsx`, `app/globals.css`.

## Session 2026-08-03u (THE EMBED IS PORTED: timeline, mobile dropdown, shared theme)

State: done, pushed. `tsc --noEmit` clean. The embed is finally level with the dashboard.

**`lib/brellaTheme.ts` is new and exists to stop drift.** The page renders React and the embed
builder emits an HTML string, so neither can import the other's markup, but they must AGREE on
track colours and stage icons. Both were duplicated by hand and had already diverged (the embed
still had Founders Stage red after the dashboard moved it to green). Regexes are stored as
SOURCE STRINGS so the table can be `JSON.stringify`'d straight into the snippet; the page
compiles them once at module load.

**The embed now has two layouts, chosen by section:**
- `stages`, `grills` -> the timeline, mirroring the dashboard: 09:00 origin, one column per
  stage, 30-minute gridlines, cluster-based lanes on drawn extents, five-word titles, avatars,
  moderator-aware counts, the gradient card for Life Science.
- `rooms`, `side` -> the card list. Side Events is filtered by DAY, since it has one track.

**The phone layout shows ONE column and a native `<select>` to switch.** Five columns in 360px
is unreadable. A native select rather than a custom dropdown on purpose: inside an unknown
WordPress theme a hand-rolled menu is a z-index and portal fight with no upside. Below 760px the
pill row is hidden and the select appears; `syncNarrow()` picks the first column when none is
chosen and re-renders on the breakpoint so rotating the phone stays consistent. Day pills stay
visible at every width, since there are only two and they are what people switch most.

**Verified at 390px and 1440px** inside deliberately hostile host CSS (`a{display:contents}`,
`img{aspect-ratio:3/2}`, `span{display:inline}`, a serif `button` font). Desktop: 5 columns, 34
events, 5 icons, 51 avatars, the LS gradient resolving to two stops, grills 10. Mobile: pills
hidden, select shown, one column, correct counts per stage (BBQ 8, Tech 9, LS 11, Campfire 0
with "Nothing scheduled"), day switch working, no horizontal overflow at either width, dialog
showing role tags and collapsed bios.

**Trap #2 caught me again**, and it is worth repeating because it looked exactly like a real
bug: the first mobile measurement reported 0 events for every stage. Nothing was wrong. The
measurement ran while the dev server was still compiling the freshly written test page. A clean
reload gave 8. Never diagnose from the first measurement after touching a file.

Files: `lib/brellaTheme.ts` (new), `lib/brellaEmbedSnippet.ts` (rewritten),
`app/brella-program/page.tsx` (now imports the shared theme).

### Next steps

1. Copy all four Brella embeds from the DEPLOYED dashboard into their Elementor HTML widgets.
   HTML widget, not Text Editor: wpautop injects <p> and <br> into the script and breaks it.

## Session 2026-08-03t (Grills get the timeline, Side Events get days, card avatars)

State: done, pushed. `tsc --noEmit` clean. Dashboard only.

**The timeline is no longer stages-only.** `TIMELINE_COLUMNS` in `lib/brellaSections.ts` maps a
section to its column set, `stages` -> `BRELLA_STAGES` and `grills` -> `BRELLA_GRILLS`, and
`stageOf()` is now a thin wrapper over a generic `columnOf(room, set)`. Grill Sessions renders
the same three-part control (column picker, day picker, timeline) with Green/Blue/Orange as its
columns. Adding another timeline section is one entry in that map.

**Side Events is filtered by DAY, not by track.** It has exactly one track, so "All / Side Event
Promotion" filtered nothing, while the events genuinely span 25-27 August. Chips are now
TUE 25 AUG / WED 26 AUG / THU 27 AUG via `weekdayLabel()`.

That needs a year, which Brella's day string ("25 August") does not carry, so `EVENT_YEAR` is a
constant in `lib/brellaSections.ts`. That is a fixed fact about this deployment and is fine as a
constant, unlike "today", which must always be computed.

**Card avatars.** Up to two faces before the names, overlapped with a ring in the card colour,
falling back to an initial when Brella has no photo. `orderedSpeakers()` is shared with
`shortNames()` so the faces and the names are always the same two people in the same order.

**Two smaller things:** the dialog's room line now shows the STAGE's icon when the room is one of
the five and the generic pin otherwise, so it matches the column you clicked from; and "Read bio"
has a chevron that rotates on open.

**Column headings centre on both axes** (`min-height: 46px`), since a one-line stage name was
floating at the top of a box sized for the two-line Life Science heading.

Files: `lib/brellaSections.ts`, `app/brella-program/page.tsx`, `app/globals.css`.

### Next steps

1. The embed is now four sections behind. Porting it is a real piece of work.

## Session 2026-08-03s (timeline cards: 5-word title, time range, two speaker names)

State: done, pushed. `tsc --noEmit` clean. Dashboard only.

Timeline cards now carry three lines: the headline cut to its first five words with an ellipsis,
the start-to-end time, and up to two speaker names with "+N" for the rest.

`shortNames()` puts SPEAKERS BEFORE MODERATORS before slicing. A card with room for two names
should spend them on who is talking rather than who is chairing; the full list with roles is in
the dialog, which is one click away.

The full headline is on the element's `title` attribute, so hovering still gives it.

Title clamp drops 3 lines -> 2. With the text cut to five words, the third line only ever
produced dead space above the time. The name line is `nowrap` + `text-overflow: ellipsis`, so a
long pair of names truncates instead of wrapping and shoving the layout around.

Cards under 46px keep `data-compact` and show the title alone; there is no room for three lines
in a ten-minute slot.

Only the TIMELINE cards changed. The card lists under Event Rooms, Grill Sessions and Side
Events still show the full title and description, since they are not height-constrained.

Files: `app/brella-program/page.tsx`, `app/globals.css`.

## Session 2026-08-03r (stage icons, bigger column headings, roomier day pills)

State: done, pushed. `tsc --noEmit` clean. Dashboard only.

**Icons are inlined SVG, not a package.** Auri asked whether to pull in a Next.js icon library or
Radix. The answer is no, and the reason is structural rather than about bundle size: the embed
builders emit raw HTML STRINGS and cannot render a React component, so the same glyphs would
have to exist as hand-written SVG in the snippet anyway. A package would cover the dashboard and
leave the embed maintaining a second copy, which is how two sets of icons drift apart. `PinIcon`
already worked this way. Everything follows Lucide's conventions: 24x24, currentColor stroke,
2px, round caps and joins, no fill.

Mapping: BBQ flame, Tech zap, Founder rocket (all three are Lucide's own paths), Campfire two
crossed logs, Life Science a double helix. The last two are drawn here because Lucide has no
firewood or helix glyph that fits.

**Both hand-drawn icons needed a second pass after looking at them at real size.** The campfire
started as crossed logs UNDER a small flame and rendered as a stray dot above an X; the flame is
gone and the logs now span the box. The helix was drawn across the middle third of the viewBox
and collapsed into an illegible vertical squiggle; it now spans 6-to-18. Both are legible at
16px, though the helix is the weakest of the five and is the one to revisit if any is replaced.

The icon takes the stage's own accent colour, so the heading colour-codes the column too.

**Column headings 13px -> 15px** and laid out as flex so the icon sits beside a wrapping title.
**Day pills** get `height:auto` and 9px/22px padding: `.seg`'s flat 36px row was sized for one
line of text and was squeezing the date against the day number.

Files: `app/brella-program/page.tsx`, `app/globals.css`.

## Session 2026-08-03q (Brella: no scroll jump, pill bars hug content, LS gradient)

State: done, pushed. `tsc --noEmit` clean. Dashboard only.

**Switching section no longer moves the view.** Two mechanisms, and the first alone was not
enough:
1. `changeSection()` records the masthead's viewport offset, and a `useLayoutEffect` scrolls by
   the delta after the new section lays out. `useLayoutEffect`, not `useEffect`: on `useEffect`
   the jump paints for a frame and is then corrected, which is worse than leaving it.
2. Restoring the scroll only works if the page is still tall enough to scroll there. Side Events
   is a third the height of the timeline, so from deep in the page the browser clamped
   `scrollTop` and the view still lurched ~390px. The results area now keeps a `minHeight` floor
   equal to the tallest section seen this visit. It only ever grows, so it cannot oscillate.
Measured before: Side Events moved 388px. After: 0px on all four tabs.

**Pill bars end with their content.** `.seg` is `inline-flex` and hugs its buttons, but
`.bp-controls` was `align-items: stretch`, and a stretched flex child fills the cross axis, so
the background ran the full page width with the buttons floating in the middle. `align-items:
center` fixes it. `display:flex` is still what stops the child margins collapsing (03o), so that
part must stay.

**Life Science x Deep Tech cards are a blue-to-green gradient.** A second optional accent,
`TRACK_COLORS_2` -> `--track2`, used by a two-stop `linear-gradient`. Every other track leaves
`--track2` unset and the CSS falls back to `--track`, so the gradient resolves to the flat tint
it always was. Life Science moved off the violet from 03o and is now #2BB4E1 -> #37C978.

The top rule stays a SOLID `--track`. A gradient bar would need a pseudo-element sitting over
the border area, and the card sets `overflow: hidden`, which clips to the PADDING box and would
have hidden it entirely. Tried, reverted, noted here so nobody tries it again.

Files: `app/brella-program/page.tsx`, `app/globals.css`.

## Session 2026-08-03p (Brella polish: room aliases, two-line day pills, squarer cards)

State: done, pushed. `tsc --noEmit` clean. Dashboard only; embed still untouched.

**Named programmes fold into their room.** Brella gives a programme its own track even when it
occupies a numbered room, so the Event Rooms tab listed "Event Room 1" and "Future of FinTech"
as if they were different places. `ROOM_ALIASES` in `lib/brellaSections.ts` now maps
Future of FinTech -> Event Room 1 and Nordic India Startup Summit -> Event Room 4. Applied in
`lib/brellaprogram.ts` as the session is built, NOT in the page, so the route and any future
embed cannot disagree about a room name. Event Room 1 went 2 -> 9 sessions, Event Room 4 1 -> 8,
and the tab now lists rooms only.

Reversing this means deleting the alias, not renaming anything in Brella.

**Day pills are two lines**: DAY 1 above 26 August, the date at 11px and dimmed. It was
"DAY 1 · 26 Aug" on one line.

**Cards are squarer**: timeline card 8px -> 5px, all-day chip 6px -> 4px.

**No rule under the stage names.** `.bp-tl__colHead` had a `border-bottom`, and with a border on
each of five columns it read as five separately underlined words instead of one header row. The
vertical separators added in 03o already delimit the columns, so the underline was doing nothing
but adding noise. Removed from the gutter head too, or a stub line would have been left hanging
under the time column alone.

Files: `lib/brellaSections.ts`, `lib/brellaprogram.ts`, `app/brella-program/page.tsx`,
`app/globals.css`.

## Session 2026-08-03o (Brella: moderator roles, stage colours, no layout jump)

State: done, pushed. `tsc --noEmit` clean. Still DASHBOARD ONLY; the Brella embed is untouched.

**Brella DOES expose speaker roles.** The comment in `lib/brellaprogram.ts` claiming the
assignment's `role` is always null was out of date. The 2026 event has Panelist 42, Moderator 27,
Speaker 26, blank 16, Facilitator 4, Keynote speaker 3. `role` now rides on `ProgramSpeaker`,
verbatim rather than folded into a boolean, and drives:
- the count line: "2 speakers · 1 moderator", never calling a chair a speaker;
- a role tag beside each name in the dialog.
Only "Moderator" counts as not-speaking. Panelist, Facilitator and Keynote speaker are all
speaking, so they stay in the speaker count.

**Speaker bios are behind a press.** The dialog lists name, role, job title and company; the bio
opens on click. Several Brella bios run a full screen each and six stacked buried the session's
own description.

**Stage colours** (Auri): BBQ #FA7000 orange, Tech #2BB4E1 blue, Campfire #F2C744 yellow,
Founder #37C978 green. Life Science was NOT specified and takes violet #8E7CFF, because the
other four now own orange/blue/yellow/green and the old default orange collided with BBQ.
The former founders-stage red rule was deleted rather than left to shadow the new one.

**The layout no longer jumps between sections**, which had two causes and neither was the
scrollbar (`scrollbar-gutter: stable` was already set):
1. The track pill row was rendered only when a section had MORE than one track. Side Events has
   one, so the entire row vanished and everything below shifted up. It now always renders.
2. Stages has two picker rows (stage + day), the others have one. Both now sit in a
   `.bp-controls` block with a reserved 92px min-height.
That block is `display:flex` specifically to stop child margin collapsing, which was leaving a
10px difference in the pill row's position depending on the open section. Verified by measuring:
the masthead, the pill row and the count line now sit at identical viewport offsets in all four
sections.

**Two smaller fixes:** the 09:00 gutter label is centred on the first gridline, so half of it sat
above the timeline and was clipped — the body now carries a 10px top margin to make room. And
each stage column has a vertical separator, drawn on the column rather than the cards so it runs
the full height including the empty Campfire one.

Files: `lib/program.ts`, `lib/brellaprogram.ts`, `app/brella-program/page.tsx`,
`app/globals.css`.

### Next steps

1. Port all of this plus the timeline to `lib/brellaEmbedSnippet.ts`. Nothing since 03n has
   reached techbbq.dk.
2. If Life Science's violet is wrong, it is one line in `TRACK_COLORS`.

## Session 2026-08-03n (Brella Stages rebuilt as a one-day timeline)

State: done, pushed. `tsc --noEmit` clean. DASHBOARD ONLY — the Brella EMBED still renders the
old day-grouped card list and has NOT been ported.

**Stages is now a clock, not a list.** One column per stage, one day at a time, origin fixed at
09:00. Controls in order: centred section masthead, stage picker, day picker. Event Rooms, Grill
Sessions and Side Events keep the card list, because only the stages run in parallel.

**The five stages are an EXPLICIT list** (`BRELLA_STAGES` in `lib/brellaSections.ts`), not
whatever the data happens to contain. Campfire Stage is a real Brella track (id 43281) with
nothing on it yet; derived from the data it would not exist at all, then appear unannounced the
day someone schedules something. It gets a visibly empty column instead. `match` regexes map the
Brella name to the public one ("Founders Stage" -> "Founder Stage").

**Two tracks moved section**, both Auri's call:
- Grill Sessions (Green/Blue/Orange, 17 sessions) are their own tab now. Three grill tracks under
  Stages drowned the five real stages.
- Future of FinTech (7) runs in Event Room 1, so it files under Event Rooms. Its own name is
  kept: "Event Room 1" is a separate track with its own sessions and merging them hides which is
  which.

**Default day follows the calendar**: Day 2 once it is actually 27 August, Day 1 otherwise.
`defaultEventDay(now)` takes the date as an ARGUMENT and is called from an effect, never at
module scope. Module scope would freeze it at build time, which is exactly the bug that hit the
AI Workshop dashboard, and computing it during render would trip a hydration mismatch.

**Three layout bugs worth remembering, all found by looking rather than reasoning:**
1. Cards showed a time and no title. The card is a flex column and the title, being shrinkable,
   lost to its siblings and collapsed to zero height. `flex: none` on all three children plus
   `overflow: hidden` makes the title win and the timestamp the thing that clips.
2. Short sessions overlapped the next card. A 5-minute slot is 12px at 2.4px/min and is floored
   to a 26px minimum, so it ends earlier on the clock than it does on screen. The lane packer now
   compares DRAWN extents (`MIN_CARD_MIN`), not scheduled ones.
3. One brief clash halved every card in the column for the whole day, because lanes were counted
   per column. They are now counted per CLUSTER of mutually overlapping sessions.

Cards shorter than 46px get `data-compact`: title only, one line. Half a clipped title above half
a clipped timestamp reads as broken.

Files: `lib/brellaSections.ts`, `app/brella-program/page.tsx`, `app/globals.css`.

### Next steps

1. **Port the timeline to `lib/brellaEmbedSnippet.ts`.** Nothing here reaches techbbq.dk. The
   embed also predates the new Grill Sessions section, so its section list is short by one.
2. Campfire Stage fills itself in as soon as Brella has sessions on track 43281. No code change.
3. `PX_PER_MIN` (2.4) is the one knob for vertical density.

## Session 2026-08-03m (per-logo size nudges, the EU frieze, bigger tier labels, more air)

State: done, pushed. `tsc --noEmit` clean.

**Per-logo overrides now exist**, in `lib/partners.ts`. The area fitter measures a BOUNDING BOX
and cannot see that a file is mostly internal padding, or that a mark is dense and reads heavy
for its area. Two new feed fields carry the human judgement instead:

- `scale` — linear multiplier, emitted as `data-scale`, read by `fitLogo()` and the embed's
  `fitOne()`. Allowed above 1 (the automatic factor never is), capped at 1.6 because overflow is
  hidden and more would crop. Current list: Flatpay, Skytek Nordics, Nordea at 1.3; Repodo 0.85.
- `wide` — a frieze of several marks in one file. Spans the row, sorted to the top of its tier,
  and opts OUT of the area rule via `data-nofit`.

**Scale is LINEAR, area is the square.** Repodo was first set to 0.78, which sounds gentle and
removes 39% of the visible area; Auri asked for "slightly". 0.85 (-28%) is the shipped value.
Anyone tuning this should reason in area, not in the number they type.

**Erhvervshus Sjælland's tile now carries the EU co-funding frieze** (Closing Loops + Co-funded
by the European Union + Danish Board of Business Development), exactly as techbbq.dk shows it.
At 2560x192 it is 13.3:1, so a normal 5:3 cell would render it at a fraction of the height:
`sizeTiles()` gives it 9:1 on desktop and 7:1 below 820px, and it takes the full row width.
Downloaded to `public/partner-logos/Erhvervshus-frieze.png` rather than hotlinked, so it follows
the same convention as every other logo. NOTE `techbbq.dk` answers plain curl with a 454; it
needs a full browser header set (UA + Accept + Referer + Sec-Fetch-*) to fetch.

**Tier labels 13px -> 16px** on both surfaces. The embed grid gap is now ASYMMETRIC:
`row-gap:12px; column-gap:16px`. The first attempt used the single-value shorthand, which widened
the lines as well; the extra air is only wanted between logos sitting side by side. The column
value differs from the dashboard's 12px on purpose (12px is ~4.9% of a 245px dashboard tile, and
techbbq.dk's tiles are 310-390px wide, so the same value reads tighter), while the row value
stays at 12px to match.

Watch out when editing that file: the whole snippet is a JS TEMPLATE LITERAL, so a backtick in a
CSS comment ends the string. One in the word `gap` broke the build for a moment.

**Two measurement traps hit again, both already in the handoff, both cost time anyway:**
- The embed's `fetch` was served a CACHED `/api/partners` body (`s-maxage=3600`), so `wide` and
  `scale` were missing from the data while being present in the code. Reloading the HTML does
  not refresh it; the API response needs its own cache bypass.
- `getComputedStyle(img).transform` intermittently returned `none` while `img.style.transform`
  was `scale(1.3)`. The inline style is the reliable read. Two separate "the nudge is broken"
  diagnoses came from believing the computed value.
Also: a double-`requestAnimationFrame` await inside the page froze the renderer and needed a
reload. Prefer `setTimeout` when probing a heavy page.

Files: `lib/partners.ts`, `lib/logoFit.ts`, `app/partners/page.tsx`, `app/globals.css`,
`lib/partnersEmbedSnippet.ts`, `public/partner-logos/Erhvervshus-frieze.png`.

### Next steps

1. Re-copy the partners embed from the deployed dashboard. Again: nothing reaches techbbq.dk
   until this is done.
2. Tune any logo by editing `LOGO_SCALE` in `lib/partners.ts`. No CSS involved, and it applies
   to the dashboard and the embed at once.
3. If another multi-mark strip turns up, add it to `LOGO_FILE_OVERRIDES` with `wide: true`.

## Session 2026-08-03l (embed made to match the dashboard: no black box, 5:3 tiles, no empty tier)

State: fixed and verified against a hostile-CSS harness. `tsc --noEmit` clean.

Four things Auri reported after pasting the fixed snippet. All four were real, and three of them
were the embed and the dashboard quietly disagreeing about geometry.

**1. The black box.** The panel painted its own `#0d0d0d` background plus 32px padding, which on
techbbq.dk sat as a dark slab on the section's own background. `transparent` now defaults to
TRUE in both builders. The wall is white logos on whatever the page provides.

**2 and 3. Logos smaller on the site than locally.** Two independent causes, and the second is
the one that mattered.

*Cause A, tile shape.* The dashboard's `.lw-logo` is `aspect-ratio:5/3`, so its height tracks
its width. The embed hardcoded `height:150px`. On the dashboard a 5-column tile is ~245x147, so
150px is about right; on techbbq.dk the same tile is ~310 wide and should be 186 tall. Every
logo was working in a box 20% too short. Fixed with `sizeTiles()`, which sets
`height = round(width * 0.6)` inline with `setProperty(..., "important")` — an ordinary inline
style loses to the stylesheet's own `!important` fallback.

*Cause B, and this is the real one: the image could never scale UP.* The embed styled the img
`width:auto; height:auto; max-width:100%; max-height:100%`. That renders an image at its
INTRINSIC size and only ever shrinks it. Any logo whose natural size is smaller than the tile
just sat there small, and `object-fit:contain` did nothing because the element box was already
the intrinsic box. The dashboard never had this bug: there the img IS the tile, `width:100%`,
so contain scales up as well as down. Fixed by making the embed img fill the tile the same way
(`width:100%; height:100%; object-fit:contain`) and measuring the img's own box in `fitOne()`.

Measured, all 104 partners, logo area as a fraction of tile area:

| | before | after | dashboard |
|---|---|---|---|
| Impact Fund Denmark | 0.081 | 0.403 | 0.375 |
| Flatpay | 0.390 | 0.390 | 0.342 |
| Skytek Nordics | — | 0.390 | 0.342 |
| median | 0.371 | 0.374 | 0.342 |
| spread (max/min) | 9.93x | 5.92x | 6.13x |

Impact Fund Denmark was five times too small and is now slightly above the dashboard. Spread now
matches the dashboard's, which is the real test: the embed is no longer a different renderer.

**4. An empty INTERNATIONAL heading on the site but not locally.** There are currently ZERO
International partners. The dashboard drops rows with no items; the embed mapped over all eight
tiers unconditionally and printed a bare heading. It now skips empty rows. Filtered in the
snippet, not the feed, because a tier can be non-empty in Airtable and still have nothing to
show once logo-less partners are dropped.

**How this was verified**, since the handoff's trap #2 says never trust an image measurement:
generated the real snippet into a throwaway `public/_embedtest.html` wrapped in deliberately
hostile host CSS (`a{display:contents}`, `img{aspect-ratio:3/2}`, `span{display:inline}` — the
same shapes Elementor was imposing), forced every image `eager`, awaited every `onload`, then
computed the VISIBLE logo size from `naturalWidth/Height` and the contain ratio rather than
trusting the element box. Same measurement run against `/partners` for the comparison column.
The harness was deleted afterwards; regenerate it from the builder if this needs revisiting.

Both walls now: transparent, tile ratio 0.600, "More soon" flush with its row, LS 3 rows,
partners 7 rows.

Files: `lib/partnersEmbedSnippet.ts`, `lib/lsStartupsEmbedSnippet.ts`.

### Next steps

1. Re-copy BOTH embeds from the deployed dashboard. Nothing here reaches techbbq.dk until then.
2. If the wall ever needs its own dark panel back, pass `transparent: false` in the copy button.

## Session 2026-08-03k (partner logos 404'd on techbbq.dk: the feed emitted relative URLs)

State: fixed and verified, **NOT committed**. `tsc --noEmit` clean.

Auri reported the partners wall on techbbq.dk "doesn't load anything" and pasted a wall of
console output.

**The console output was almost entirely noise, and following it would have wasted the session.**
The `iframe-app` / OIDC / `angie.umd.cjs` errors are the Elementor editor failing to
authenticate. The one plausible-looking entry, `Uncaught SyntaxError: Unexpected token '<'` at
line 3507, belongs to a DIFFERENT plugin: Essential Addons emits
`<script id="eael-inline-js"><script>`, a nested opening tag. Pre-existing, unrelated, not ours.
Worth reporting upstream. Lesson: on a WordPress page the console is mostly other people's
plugins, so locate OUR block by id before reading any of it.

**Finding the real fault took inspecting the live page, not the source.** Loaded the preview URL
in the user's own Chrome (it needs their session) and queried the DOM. The embed was working:
8 tier rows, 104 tiles, correct structure, API fetch fine. Every logo was pointed at

```
https://techbbq.dk/partner-logos/Beyond%20Beta.svg      ← 404
```

`lib/partners.ts` built `logo` as a hardcoded site-relative literal,
`` `/partner-logos/${encodeURIComponent(hit.file)}` ``. Same origin on the dashboard, so it works
there and in every local preview. Resolved against techbbq.dk it is a 404, giving 104 correctly
built and completely empty tiles: rows, labels and layout all present, no images. That is what
"doesn't load anything" looked like.

Partners was the ONLY feed doing this. Every other one goes through `photoUrl()`, which already
absolutises via `baseUrl()`. Partners bypassed the helper because its logos are local files
rather than an Airtable proxy, and the absolute-URL requirement went with the helper.

**Fix, at the source rather than in the embed.** Exported `baseUrl()` from `lib/photo.ts` and
used it in `lib/partners.ts`. Verified in all three environments:

| Env | `logo` |
|---|---|
| local dev | `/partner-logos/Beyond%20Beta.svg` |
| Vercel | `https://airtable-woad.vercel.app/partner-logos/Beyond%20Beta.svg` |
| `PUBLIC_BASE_URL` | `https://connector.techbbq.dk/partner-logos/…` |

Then confirmed from techbbq.dk's own page context that three production URLs decode as real
images (200×200, 292×150, 1080×1054) — not merely well-formed, actually rendering cross-origin.
`<img>` needs no CORS, so no header work was required.

**Also hardened both embed snippets** as defence in depth: `safeUrl()` now resolves a leftover
relative path against `ORIGIN` (the `__ORIGIN__` the copy button substitutes) instead of
returning it bare. Still rejects `javascript:`, `data:` and protocol-relative `//evil.com`,
verified by executing the generated function. In production this is a no-op now that the feed is
correct; it matters for a snippet copied from a local dashboard.

**Second finding: the pasted snippet is stale.** Its tiles measured 253px tall, exactly
`379 ÷ 1.5`, which is the old `aspect-ratio` rule. The hardened version uses a fixed 150px. So
that page predates all of session 03j as well.

Files: `lib/partners.ts`, `lib/photo.ts` (export), `lib/partnersEmbedSnippet.ts`,
`lib/lsStartupsEmbedSnippet.ts`.

### Next steps

1. Commit and push the four files. main auto-deploys.
2. After the deploy finishes, re-copy the **partners** embed from the deployed dashboard into
   Elementor. Not before: the copy button bakes in whatever the feed currently returns.
3. Re-copy the **Life Science** embed too while there, for 03j's fixes.
4. Re-check the wall on techbbq.dk: logos visible, tiles 150px, hover wash tinted per tier.

## Session 2026-08-03j (both walls hardened for Elementor, and logos evened out)

State: DONE, pushed as `8dcd85f`, `25f8933`, `2f1424c`.

Everything here came from Auri testing the embeds on the real WordPress page, which surfaced
three faults the local preview never would have.

**Logos rendered at natural size, overflowing rows and sitting off-centre.** The tile's height
came from `aspect-ratio` with NO `!important`, and the anchor used `display:contents`. Elementor
overrides both, and once the tile has no definite height, `max-height:100%` on the image
resolves against nothing and the cap silently stops applying. Now the height is a real pixel
value, `aspect-ratio` is decoration rather than load-bearing, and the anchor is an ordinary
block. Every layout property is forced, `box-sizing` included, since themes reset it globally
and it quietly changes what a height means.

Verified by rendering the copied snippet under CSS that mimics the overrides (`img{width:100%}`,
`a{display:inline}`, `aspect-ratio:auto`, `box-sizing:content-box`): every tile holds its height,
nothing overflows or sits off-centre.

**Row colour never reached the embeds.** The divider was hard-coded white and the hover was a
flat near-black, invisible on a dark page. Each row now derives a 38% divider and a 14% hover
wash from its own colour in the snippet's own script — `rgba()` rather than `color-mix()`,
because a pasted snippet has to work in whatever browser the visitor brings.

**Life Science is five per row**, fixed, replacing an auto-fill that packed seven into a wide
container. Categories are heading for roughly 15/15/16, so five gives three tidy rows each.

**Logos are now sized by AREA, not bounding box** (`lib/logoFit.ts`). Rilemo, SmartSens and
Blue2 looked half-size and nothing was wrong with the files: `object-fit:contain` matches
bounding boxes, and these range from 0.99 (square) to 5.66 (a thin wordmark). In a 2:1 tile a
wide mark fills it edge to edge while a square one cannot leave the middle third. Scaling to a
constant area is much closer to how the eye judges "same size". Applied as a transform so no
layout box moves; capped at 1 because going past contain would crop. Tiles went 3:2 → 5:3,
which is not cosmetic — a square logo is height-starved in a 2:1 tile at any scale.

Measured across the fifteen: before 6.7k–13.2k (1.96x spread, squares at the bottom), after
7.7k–12.8k (1.65x), with eleven of fifteen inside 12.0–12.8k.

**Also fixed in the partners builder**, which was generated from the Life Science one and kept
its descriptions: the HTML comment announced Life Science startups, the header described three
category rows instead of tiers, and the phone breakpoint had been overwritten with the desktop
grid rule, so narrow screens tried to hold six columns instead of two.

## Session 2026-08-03i (LS startups refreshed: 15 confirmed, an invisible logo fixed)

State: DONE, pushed.

Confirmed set grew 12 → 15 (H+H LABS/Hydratico, Vetbac, Blue2). **No code change was needed for
the new logos** — that page reads live from Airtable and `?v=<attachmentId>` busts the cache the
moment a file is replaced. Only the 5-minute server cache had to expire, which briefly made H+H
look logo-less and sent me looking for a bug that was not there.

**A logo that renders NOTHING is worse than a missing one.** Hydratico's SVG was exported with
`fill: none` on every path, so the tile was present and completely invisible: the startup
vanished from the wall with no broken-image icon and no name fallback to signal it. Recoloured
to white and uploaded as `white-Hydratico Water Doctors.svg` alongside the original.
`fill:none` is the one case the automatic whitener deliberately skips, because removing it would
flood-fill a genuinely outlined shape, so an all-none file has to be handled by hand.

**Website parsing rewritten, 11 → 14 linked.** These cells are founder-typed free text and the
old parser only accepted `http(s)://` or a `www.` prefix, silently dropping three real sites:
- `immunordic.com` — bare domain, no scheme
- `linkedin.com/company/smartsensdk/…` — a company LinkedIn page, no scheme
- `walthertx.com (currently under construction — live in a few weeks)` — domain plus a note

Now: take the first whitespace token, accept anything matching a hostname, upgrade to https.
Prose still fails closed — "no website yet" has no dot, so Yoke Bio stays correctly unlinked.

**Do NOT use the `Linkedin` column as a website fallback.** All 15 have one, but they are
PERSONAL profiles (`/in/hanseibe/`, `/in/marie-ihlemann/`), not company pages. Linking a company
logo to a named individual is the wrong destination and publishes a person on a page about
companies. A company-LinkedIn column would be the clean fix.

Judgement call flagged to Auri: Walther's own note says the site is under construction, and it
is linked anyway since the event is three weeks out.

## Session 2026-08-03h (partners: tiers corrected from the live site, links, logos uploaded)

State: DONE, pushed. Follow-on to 03g, same page.

**Tier source settled.** Airtable's `Partnership Type 2026` and the CRM's deal-size formula
disagree on 16 rows. Auri's call: **the live techbbq.dk/partners page is correct** ("Nordea is
not a prime partner, it has a 48,000 crown deal"). Only the 9 DIFFERENCES are stored, in
`TIER_OVERRIDES` in lib/partners.ts, so a normal Airtable change still flows through and the map
stays auditable. There is no auto-sync: techbbq.dk 455s a plain request, so it can only be read
through a real browser.

**Finding the live list took a wrong turn worth recording.** `/partners/` looked like a sales
page with 15 images and no partner wall. It is not: the 241 partner logos are **inline `<svg>`
elements**, not `<img>`, so an image inventory finds nothing. Walk `<h2>` tier headings and the
`<a>` elements that follow them instead.

**Community is grey** (`#9a9a9c`) — it is 61 of 104 rows and a saturated colour there pulled the
eye off the paid tiers. Columns per tier double as the ranking: 4 for Prime/Main/Conqueror,
5 for Pioneer/Core/Challenger, 6 for Community, so a higher tier renders a bigger logo. No
"More soon" tile on this wall (that is the Life Science one only). `Tailored` dropped;
`International` kept but now empty, so the row disappears.

**Logos link to the partner site.** Source is `Link to your website`. Four cells held SEVERAL
urls in one field — Copenhagen had four joined with `&` and `@` — which produced an href with
spaces that no browser can navigate, so those logos silently did nothing when clicked. The first
url now wins. Four sites are hand-corrected in `WEBSITE_OVERRIDES`.

**The embed drops logo-less partners**; the dashboard keeps them as dashed name tiles, which is
what makes the gap visible to whoever maintains the wall.

**110/110 logos matched**, all white. Auri supplied ~20 by hand for the ones no automatic match
could reach, plus corrected exports for seven that had resolved to an off-brand version. Five
dark SVGs are recoloured on the way in.

**The white set was uploaded back into Airtable** by `scripts/upload-white-logos.mjs`: 110 files
appended to the `Logo` field, each prefixed `white-`, taking it from 203 to 313 attachments with
the colour originals untouched. It uses the `uploadAttachment` endpoint, which APPENDS — a PATCH
on an attachment field replaces the whole array and would have wiped all 203. Re-running skips
cells that already have a `white-` file.

**Duplicate-logo bugs fixed:** my alias mapped "European Commission" to the EIC (different
bodies, so one mark appeared in two tiers), and the data holds one organisation under two names
in the same tier, so `fetchPartners` now also dedupes on tier + logo file.

## Session 2026-08-03g (new /partners page: the 2026 partner logo wall, one row per tier)

State: **DONE and verified in the browser, NOT committed, NOT deployed.** `tsc --noEmit` clean;
`npm run build` not re-run. Stacks on the uncommitted 03c-03f work.

Same construction as `/ls-startups` and it reuses the `.lw-*` styles, just nine tier rows.
New: `lib/partners.ts`, `app/api/partners/route.ts`, `app/partners/page.tsx`,
`lib/partnersEmbedSnippet.ts`, `components/CopyPartnersEmbed.tsx`,
`scripts/sync-partner-logos.mjs`, `lib/partnerLogoManifest.json`, `public/partner-logos/`.

**Which "tier"? There are two and they disagree.** `Partners 2026` (the CRM) has a formula
`Partnership Tier (Based on Deal Size)` giving 6 buckets over 155 confirmed rows, with no
Community at all. `Marketing Project Overview` view **`Partner Deliverables 2026`** has a
single-select `Partnership Type 2026` — the one `scripts/community-tier-audit.mjs` already
maintains. **The marketing one is used**, because it is the list marketing curates for the
website and it carries Community.

Auri's call: **drop `Investor`, `Academic` and `Tailored`** ("Academic usually is community,
Investor can be different"; Tailored cut in the follow-up pass, International kept). 122 rows in
the view, 106 published after the exclusions and after de-duplicating companies that appear
twice.

**Columns per row are Auri's spec and act as the RANKING**, not as layout convenience — fewer
columns means a bigger logo, so a Prime partner reads larger than a Community one on the same
page. There is no "More soon" tile on this wall (that is the Life Science wall only).

| tier | partners | cols |
|---|---|---|
| Prime | 3 | 4 |
| Main | 2 | 4 |
| Conqueror | 6 | 4 |
| Pioneer | 4 | 5 |
| Core | 10 | 5 |
| Challenger | 14 | 5 |
| International | 5 | 5 |
| Community | 62 | 6 |

Narrow screens ignore `--cols` and step down to 4 / 3 / 2, so an Elementor column never squeezes
six logos into 300px.

Note `Put on web` is read but NOT used as a gate. It tracks what is already live on techbbq.dk,
not what belongs there, and 8 of the view's rows are unchecked simply because nobody ticked them
yet. Gating on it would hide real partners.

### Logos do NOT come from Airtable, and that is deliberate
The attachments on that view are colour originals — 69 PNG, 8 JPEG, 16 SVG, plus a zip, a PDF
and an .ai — and would render as white boxes on a near-black wall, exactly the problem the Life
Science wall had before the white SVG exports.

`scripts/sync-partner-logos.mjs` resolves each partner to a white logo file and copies it into
`public/partner-logos/`. **Airtable stays the source of truth for WHO and WHICH TIER; the image
comes from the logo libraries.** Two sources, in priority order:
1. `tbbqvisualgen/public/logos` (~830 files) via its `logoLibrary.json`, which already carries a
   per-file brightness measurement, so the picker can prefer the light variant.
2. `C:/Users/User/Desktop/SVG` — Auri's newer white exports, not in that library, read off disk.

Matching is normalise-both-sides (case, accents, punctuation, legal suffixes, the library's own
"White"/"Colour" variant words) plus a hand-written `ALIASES` map for trading-name, acronym and
Danish-spelling mismatches. **97 of 110 matched, 92 of them light.**

**The bug worth remembering:** the library contains a file called `Inc.svg`, and `norm()` strips
"inc" as a legal suffix, so its key normalised to the EMPTY STRING — which prefix-matches every
name on earth. It silently claimed **15 partners**, all rendering the same "Inc." mark, and it
looked plausible enough on screen to nearly ship. Empty keys are now skipped and the prefix
fallback requires ≥6 chars on BOTH sides.

**Unmatched (12), showing their name in a dashed tile:** Beta Health, Copenhagen, Copenhagen
School of Entrepreneurship, Creative Business Network, EIT Urban Mobility, Ignite Sweden,
Innovation District Copenhagen, MADE, Mesh, START Paris, Third Law ApS, Young AI Leaders Linz.
Four of those are ambiguous on purpose rather than guessed: "Copenhagen" matches three different
brands, "Mesh" matches two, and MADE / EIT Urban Mobility have no file anywhere. Fix the name in
Airtable or drop the file in the library, then re-run the script with `--write`.

**The cost of this approach, stated plainly:** the logos are a COPY. A partner added in Airtable
appears on the page immediately but with no logo until someone re-runs the sync. The page names
the gap in an internal panel rather than hiding it.

### Embed excludes logo-less partners; logos link to the partner site
Auri: the name tiles are "only for this local view... shouldn't show specifically on our
website". So the EMBED drops any partner without a logo, while the DASHBOARD keeps them as
dashed name tiles — that is exactly what makes the gap visible to whoever maintains the wall.
The filter runs before the row is built, so a tier whose every partner lacks a logo disappears
rather than leaving an empty heading.

Websites come from `Link to your website` on the marketing view, filled on 93 of 107 rows. That
column is free text and holds both `https://x.com/` and a bare `www.x.com`, so `safeUrl()`
upgrades the bare hosts and rejects anything that is not http(s) — a `javascript:` URL sitting
in an Airtable cell must never become a live link on techbbq.dk. Every link is
`target="_blank"` with `rel="noopener noreferrer"` and carries an `aria-label`, because the
anchor's only content is an image and it would otherwise have no accessible name.

Verified: dashboard 105 tiles / 9 name tiles / 82 links. Embed 96 tiles / 0 name tiles /
75 links, zero bad rel, zero non-http.

### Two duplicate-logo bugs, one mine and one in the data
**Mine:** the alias map had `"European Commission" -> "EIC"`. The European Commission and the
European Innovation Council are different bodies, and the EIC is separately a partner in its own
right, so the SAME mark appeared in both Core and International and read as a duplicate on the
wall. Alias removed. **Neither logo library has a European Commission logo**, so it now shows
its name until someone adds one. Beware of aliasing an acronym to a similar-sounding body.

**In the data:** some partners exist twice under different names that resolve to one mark, e.g.
"AISTART Incubator - Business Helsinki" and "Business Helsinki", both in Community. The same
image twice in one row is always wrong on a logo wall whatever the CRM says, so `fetchPartners`
now deduplicates on tier + logo file as well as tier + company, and logs what it dropped.

Deliberately NOT deduplicated across tiers: `advores` (Community + International, the two rows
differ by a typo, "Rechtanwälte" vs "Rechtsanwälte") and `TÜV SÜD` (Challenger + Community, two
legal entities). A brand in two tiers is a partnerships-team question, not something to hide.
Total is now 105.

### FIXED: dark SVGs are recoloured to white on the way in
Auri: "if we have a logo that is in SVG format, just make it in white". `whitenSvg()` in the
sync script rewrites every `fill` and `stroke` (presentation attribute AND inside a `<style>`
block) to `#ffffff`, and adds a white fill on the root for anything relying on the default
black. `fill="none"`, `url(#gradient)` and embedded images are left alone: removing a `none`
would flood-fill an outlined shape.

It runs ONLY on files already measured as dark, and that limit is the point: a multi-colour mark
flattens to a white silhouette, which is right for a two-colour wordmark and wrong for a colour
wheel. A dark PNG cannot be fixed this way at all and still needs a real export.

All five now render white: AstraZeneca, Danish Life Science Cluster, e-conomic, Impact Fund
Denmark, Venture Cafe Warsaw. Verified by canvas measurement with a cache-buster: **zero dark
logos left on the wall.**

**The bug that ate the most time here was INVISIBLE.** This script was edited through a Python
heredoc, and Python turned the intended `\b` word-boundary escape into a literal **0x08
BACKSPACE byte** inside three regex literals. Every pattern then matched nothing, while looking
perfectly correct in an editor, in `sed` output and in the terminal. The same regex typed fresh
into `node -e` worked, which is what finally gave it away.

Rules learned:
- If a regex reads correctly but matches nothing, dump the file with `JSON.stringify` and look
  for control characters.
- **Write JS and Markdown with the Write/Edit tools, not shell heredocs.** The same class of
  mangling ate the backticks out of this very section on the first attempt.

### Companies Auri identified by hand
`CBS CSE.svg` for Copenhagen School of Entrepreneurship, `City.svg` for the row literally named
"Copenhagen" (the city, not a company), and `IDC_white_transparent.png` on the desktop for
Innovation District Copenhagen, which exists as PNG only.

**One correction to Auri's list:** he pointed at `Desktop/SVG/DanishLifeScienec Cluster.svg` for
Creative Business Network, but that file renders as the DANISH LIFE SCIENCE CLUSTER mark and put
that partner on the wall twice, in Prime and Core. CBN now uses
`Desktop/CBN-Logo-white_CBN-logo-black-1.png` instead, which is the file from his screenshot.

### Historic: the five logos that were not white
`AstraZeneca Colour.svg`, `Danish Life Science Cluster.svg`, `E Conomic Primary Pos.svg`,
`Impact Fund Denmark.svg`, `Venture Cafe Warsaw Horiz.svg`. **Checked both libraries: no white
variant of any of them exists**, so this is not a picker bug. They need a white export, the same
way the Life Science startups did.

`https://techbbq.dk/partners/` was checked as a possible source and is a dead end: it is the
"Become a partner" sales page, 15 images, none of them partner logos. A plain curl also gets a
455 from the WAF, so it has to be loaded in a real browser to inspect at all.

### Gotcha that cost time twice now
`loading="lazy"` means an off-screen image is never requested, so `naturalWidth === 0`. A
"broken images: 61" reading from a canvas/DOM check is measuring *not yet requested*, not
*failed*. Set `loading = "eager"` and await onload before judging. Combined with the 24h
`max-age` trap from 03f, the rule is: **never trust an image measurement without first forcing
the load and busting the cache.**

## Session 2026-08-03f (new /ls-startups page: confirmed Life Science startups exhibiting)

State: **DONE and verified in the browser, NOT committed, NOT deployed.** `tsc --noEmit` clean;
`npm run build` not yet re-run.

New `lib/lsstartups.ts` + `app/api/ls-startups/route.ts` + `app/ls-startups/page.tsx`, a
`.st-*` block in globals.css, one `PHOTO_SOURCES` key, one middleware public path, one TopNav
line ("Life Science Startups" under Projects).

Source: the same Life Science Project table as the speaker roster (`tblvukXfmR7KTFymG`) but
view `viwC65YEXxl8iDPzN`, the 2026 startup applications, 93 rows. **Different grain — this lib
returns COMPANIES, lib/lifescience.ts returns PEOPLE.** Kept separate on purpose; merging them
would force one shape to carry the other's nulls.

**The gate is `status` contains "Confirmed startup" → 12 published.**

**This was wrong in the first version and Auri caught it** ("I can see plenty of others that are
in progress"). Worth understanding, because the bug is invisible and will recur:

`status` is a **multi-select**, so Airtable returns it as an ARRAY (`["Confirmed startup"]`).
The first check compared that cell to the string `"Confirmed startup"`. An array is never equal
to a string, so it matched nothing, the column looked empty across the whole view, and the gate
was pointed at `Confirmation` instead. The verification "proving" the column was empty was
running the same broken comparison, so it agreed. **Read multi-selects with `tags()`, never
`str()`, and never trust an emptiness result that came from `===` on a select field.**

The two columns are genuinely different sets, which is why it mattered:
- `Confirmation = Selected` → 24. Selected for the programme.
- `status = Confirmed startup` → 12. Has actually confirmed they are coming.

Every Confirmed startup is also Selected, but 8 Selected rows are only "Contacted", 2 are "In
progress" and 1 has "Declined". Those are pipeline, not exhibitors. Cross-tab from the live view
2026-08-03:

```
33  To be rejected || (blank)      12  Selected       || Confirmed startup
21  Plan B         || (blank)       8  Selected       || Contacted
 7  (blank)        || Not contacted  2  Selected       || In progress
 6  (blank)        || (blank)        2  To be rejected || Contacted
                                     1  Selected       || Declined
```

Gate fails CLOSED: a blank or unrecognised status is excluded, because the cost of showing a
rejected applicant on techbbq.dk far exceeds the cost of a confirmed one appearing a day late.
`Confirmation` is no longer requested at all.

Rows after the fix: Planetary Health 3, Human Health 8, Deep Tech 7 (sums past 12 because
LS Type is multi-select).

**This is the most sensitive table the connector touches** and the allow-list matters more here
than anywhere else. Not published, deliberately: Email, Phone, internal Comments, Source, the
lead owner, third-party-sharing answers, the GDPR column, `Stakeholder`/`Title` (the contact
PERSON — this page lists companies), and **`Confirmation` itself**. That last one is the
non-obvious trap: emitting it would tell every rejected applicant they were "To be rejected",
straight out of a public JSON feed. Audited the live response: no "@", no "Confirmation", no
"Plan B", no "rejected", and a cross-check against the raw view found zero non-Selected
companies leaked and zero Selected ones missing.

**Logos: presence is not enough.** Two of the 23 uploaded an Illustrator `.ai` and a CorelDRAW
`.cdr`. Airtable stores both happily and generates **no thumbnail**, so the proxy served a valid
file no browser can draw — a broken-image icon mid-card. `hasRenderableLogo()` now requires the
FIRST attachment (the one lib/photo.ts serves) to be png/jpeg/gif/webp/svg; anything else falls
back to the company initial. Live mix: 12 png, 5 jpeg, 4 svg, 1 ai, 1 cdr.

Also: several logos are WHITE-on-transparent (Blue2, Cytely, Immunordic) and vanished on the
light panel — the mirror of the dark-logo problem the partner-event cards have. No single panel
colour suits both, so the panel stays light for the majority and two stacked drop-shadows trace
the glyph edges for the minority. One 1px shadow (what the partner embed uses) was
proportionally invisible on wordmarks this large.

Categories are the `LS Type` multi-select, **Human Health / Planetary Health / Deep Tech**.
**Auri's call, asked and confirmed 2026-08-03:** a startup tagged with two categories appears in
BOTH rows, because it is exhibiting under both. It looks like a duplicate and is not one — 6 of
the 12 are double-tagged (Previto, SmartSens, Immunordic, Rilemo, Sorbus, Paindrainer), so 12
companies fill 18 tiles. Do not "fix" this without asking again.

Row counts are therefore 3 + 8 + 7 against 12 companies. `?category=` narrows the
feed server-side for a per-category embed; unknown values serve everything, matching `?kind=`,
`?stage()` and `?section=`.

### Elementor embed + responsive check
`lib/lsStartupsEmbedSnippet.ts` + `components/CopyLsStartupsEmbed.tsx`. Its own builder rather
than a prop on `<CopyEmbed>`: a three-row logo wall is not a speaker grid with different
options — no names, no cards, no load-more, and a coloured heading per row.

**One button, the whole wall.** `?category=` exists on the feed if a single-category embed is
ever wanted, but the point of this block is the three rows together.

**The confirmed-only gate is NOT in the snippet and must never be.** It stays server-side in
`lib/lsstartups.ts`, so an unconfirmed applicant cannot reach a pasted snippet even if that
snippet outlives this deploy on someone else's page.

Verified by copying the snippet and re-executing it in a live page: 3 rows, correct colours
(green / teal / blue), 3 + 8 + 7 logos, 12 links, a More soon tile per row, zero broken images,
`__ORIGIN__` resolved.

**Responsive, and tested against the CONTAINER rather than the viewport** — the real constraint
on techbbq.dk is the Elementor column, which is narrower than the window. `auto-fill` +
`minmax()` does the work, so there is no media query at all for the desktop-to-tablet range:

```
container 320px → 2 columns     480px → 3 columns     768px → 5 columns
```
no overflow at any of them. The dashboard page itself: at a 450px viewport it drops to 2
columns with `scrollWidth` 437 against 450, so no sideways scroll on a phone.

### "More soon" placeholder
Every row ends with a hollow dashed tile reading MORE SOON, in that row's colour at 55%
opacity. It sits INSIDE the grid as the last tile rather than as a line under the wall,
because the message is that these rows are still filling up: an empty slot in the run of logos
says that, a sentence underneath reads as a footnote. Real text, not `aria-hidden` decoration,
so a screen reader announces it with the row it belongs to.

It shares the dashed-border language with the `.lw-logo--text` fallback (a startup whose upload
cannot be drawn), but they differ in colour: the placeholder is row-coloured, the fallback is
grey. No fallback is firing today, so the two are not on screen together.

### Row colours (Auri's spec)
Planetary Health **fully green** `#00c11a`, Human Health **between green and blue** `#10c8a7`,
Deep Tech **blue** `#2BB4E1`. One green-to-blue axis, nature through to technology, rather than
three unrelated hues. All three are existing house tokens (`--color-success`, `--color-teal`,
and the Deep Tech blue already used on `/life-science`), so nothing new entered the palette.

Rendered as a coloured dot plus a coloured label with a 30%-tinted divider, NOT a filled band:
the logos below are white, and a strong colour bar would fight them for attention. Measured
against `#0d0d0d`: 8.0 / 9.1 / 8.1 contrast, all well past the 4.5 AA floor.

The colour rides on a `--row` custom property set per section, so the hover tint and the
keyboard focus ring pick it up too — which is how the wall still tells you which section you
are in after the labels scroll off.

### The page is a LOGO WALL, not cards (Auri's revision)
Second pass, after the first build came back as cards: **logos only, in three rows.** No company
names, no pitch, no website link, no country, no filter pills. The feed still carries those
fields for other consumers; the page simply ignores them. Logos sit directly on the near-black
background with no panel, because the uploads are supposed to be the white-on-transparent
versions.

A startup whose upload cannot be drawn (the .ai / .cdr pair) would silently VANISH from a wall
with no names on it, so it falls back to its name set as a plain dashed wordmark. That is
deliberately ugly: it should read as "fix this upload", not as a design choice.

### Logo variants: pick by WHAT THE FILE IS, never by position (lib/logoPick.ts)
Auri uploaded white SVG variants alongside the originals, appended LAST in the same
`High quality company logo` cell. The proxy served attachment `[0]`, so the page kept showing
the old colour logos and it looked like nothing had changed.

"Take the last one" would also be wrong: **Rilemo holds `logotipo_bianco.svg` AND
`logotipo_nero.svg`**, and nero (black) sorts last. So `pickLogo()` scores each attachment:
white/bianco/blanco/weiss/hvid/negative in the filename `+4`, black/nero/noir/dark `-4`, SVG
`+2`, ties keep upload order. Non-renderable types (.ai, .cdr) are filtered out first.

**One function, two callers**, and that is the point: `lib/lsstartups.ts` uses it to decide
whether to publish a logo URL at all, and `lib/photo.ts` uses it to choose which bytes to
serve. If those two disagreed the page would render a file the feed never approved, or show a
broken image. `PhotoSource` grew an opt-in `pickLogo?: true` so only this feed pays for it;
every other feed has one headshot per cell where first-wins is correct.
`logoUrl()` also keeps SVGs on their original URL rather than Airtable's rasterised thumbnail.

Result: all 12 confirmed startups now resolve to a white or vector variant, GreenCow included
(its .ai is now accompanied by an SVG), so the dashed-wordmark fallback no longer fires at all.

### All 12 logos are white. The measurement that said otherwise was reading a stale cache.
A canvas measurement after the SVG upload reported 6 logos still wrong (Ownwell, MagCath,
Sorbus as light boxes; Yoke, SmartSens, Walther as dark ink). **That was a false alarm, and the
method was at fault.**

`/api/photo/...` is a STABLE URL whose bytes change when the Airtable attachment changes, and it
answers `Cache-Control: public, max-age=86400`. So the browser kept serving the pre-upload
files under the same URL, and the canvas dutifully measured them. Clearing localStorage does
nothing here — that only holds the feed JSON, not the images.

**Measuring an image behind this proxy requires a cache-buster** (`?cb=<random>`), or the result
describes yesterday's file. With one, all 12 measure white on transparent, which matches the
files themselves: every SVG Auri exported is `fill:#fff` (`SmartSense.svg` is `#fefdfd`,
`Walther Therepeutics.svg` `#fcfbfb`).

### FIXED: the proxy URL is now versioned, so a replaced logo appears immediately
The stale-cache trap was not just a measurement error, it hit Auri too ("I still cannot see any
updates"). Root cause: `/api/photo/<feed>/<rec>` is a STABLE url whose BYTES change when the
Airtable attachment is replaced, and it answers `max-age=86400`. Those two facts are in direct
conflict, and the cache wins for a day.

`photoUrl()` now takes an optional `version`, and `lib/lsstartups.ts` passes **Airtable's
per-attachment id** (`?v=attR42uRsaqnJOpYL`). Swap a logo and the id changes, so the URL changes,
so every browser and CDN fetches it at once — while an unchanged logo still caches hard for the
full day. The route ignores `?v=` entirely; only the cache key reads it.

Other feeds are untouched and still emit unversioned URLs. They can adopt the same argument if a
headshot ever needs replacing mid-event.

**SVG now outranks a raster named "white"**, which fixed the last real defect: Walther has both
`Logo in white.png` (450 kB) and a white SVG (11 kB), and the filename hint alone was picking
the PNG. Scores are now SVG `+5`, white-ish filename `+4`, dark-ish filename `-4`, so Rilemo's
`logotipo_bianco.svg` still beats `logotipo_nero.svg`. All 12 resolve to an SVG, 2-19 kB each.

### Historic note: the first measurement, before the white SVGs (21 logos)
Measured, not eyeballed — each logo was drawn to a canvas and its opaque pixels sampled for mean
luminance and transparency:

- **Solid background, renders as a white box on the dark page (8):** Ownwell, EasyPCR, Epidetect
  Labs, MagCath, SÉRÉNITÉ-Forceville, Sorbus Biomedical, IROC, and Insellar (a solid DARK navy
  block, the opposite problem).
- **Dark ink on transparent, nearly invisible on dark (5):** Vetbac (mean luminance 46), Navari
  (38), Yoke Bio (81), SmartSens (81), Walther Therapeutics (96).
- **Genuinely white/light on transparent (8):** Blue2, Cytely, Immunordic, Previto, Rilemo,
  Magnolia, Paindrainer, Re Fresh.

This is an ASSET problem in Airtable, not a code one, and no CSS fixes it honestly: `invert()`
would wreck the multi-colour marks, and a light panel behind every logo is the card design that
was just removed. The 13 need a white version requested from the startup.

Verified: feed 23, rows 7 / 15 / 11, `/api/ls-startups` public (200 with no auth), the two
non-renderable uploads fall back to a wordmark.

### Next steps
1. `npm run build`, then commit + push (main auto-deploys).
2. **No Elementor embed snippet for this page yet** — every other page has one. Ask whether
   techbbq.dk needs the exhibitor grid embedded.
3. **Chase white logos from the 13 named above**, plus a png/svg from GreenCow (.ai) and
   H+H LABS (.cdr). Until then the wall has white boxes and near-invisible marks in it.
4. Not published but available if wanted: Funding stage, Product development stage, Founded
   date, Product name, elevator pitch. Left out rather than guessed.

## Session 2026-08-03e (Brella page: 26-27 only, session dialog with speakers, embed snippets)

State: **DONE and verified in the browser, NOT committed, NOT deployed.** `tsc --noEmit` clean;
`npm run build` still not run. Stacks on 03c + 03d, all uncommitted.

Three things Auri asked for on `/brella-program`.

**1. Stages is 26-27 August only, and the day numbering is TechBBQ's, not Brella's.**
26 Aug = **Day 1**, 27 Aug = **Day 2** (`EVENT_DAYS` in `lib/brellaSections.ts`), which is what
the signage says.

**Brella's own "Day N" is never displayed.** It numbers whichever dates exist in the feed, so it
is not stable: someone deleted the 24 August test row while this was being built and every
remaining day shifted by one (26 Aug went from "Day 3" to "Day 2"). Both the section filter and
the label match on the DATE for that reason. Brella's number survives in one place only, as the
sort key for ordering the day groups, where it is chronological by construction.

A date that is not an event day (the 25th, which carries Day 0 side events) renders as plain
"25 AUG" with no day number: inventing a "Day 0" puts a label on screen that nobody uses, and
reusing Brella's number would contradict the two real days right below it. Only Stages gets the
date restriction — Side Events genuinely run on the 25th.

**Nordic India Startup Summit is an Event Room, not a Stage** (Auri's call). Brella gives these
named summits their own track instead of filing them under "Event Room N", so on the name alone
they defaulted to Stages. `ROOM_SUMMITS` catches them. **Nordic Africa has no Brella track yet**
and is matched pre-emptively, so it lands in the right section the day it appears rather than
quietly showing up under Stages.

**2. Click a session for the speakers.** `lib/brellaprogram.ts` now follows
timeslot → speaker-assignment → speaker in the `included` payload and maps name, job title,
company, photo and bio onto a new optional `speakers[]` on `ProgramSession`, plus `location`.
Both are OPTIONAL because the three Airtable program sources have no speaker link and the older
agenda embed ignores them. 5 of 46 sessions have speakers today.
- Brella `photo-url` is a plain public brella-assets URL, **not signed like Airtable's**, so it
  is passed straight through rather than proxied via `/api/photo`. If Brella starts signing
  them, they need the same treatment.
- A card is only clickable when the dialog would show something the card does not (speakers, or
  a description past the 3-line clamp). It becomes a real `<button>` in that case and stays an
  `<article>` otherwise, so nothing advertises detail it does not have.
- Dialog closes on Escape and on backdrop click, locks body scroll, restores focus.
- Brella's `location` frequently repeats the track name ("Founders Stage · Founders Stage"), so
  it is only appended when it differs.

**3. Copy embed code**, one button per section. New `lib/brellaEmbedSnippet.ts` +
`components/CopyBrellaEmbed.tsx`, same contract as the other snippet builders (id-scoped,
`!important` everywhere, `__ORIGIN__` swapped at copy time, fresh uid per copy). The snippet
carries the day groups, track pills, cards and the full speaker dialog.

**The section rules now live in ONE place: `lib/brellaSections.ts`.** The page filters
client-side (it needs per-section counts for the headings), the route filters server-side via
the new `?section=stages|rooms|side` so the snippet can request one section, and the snippet
itself carries NO section logic — it just fetches a URL. That was the point: a rule baked into a
pasted snippet can never be corrected once it is live on techbbq.dk. `?section=` is Brella-only
and an unknown value serves everything, matching `?kind=` and `?stage=`.

Verified after both corrections: **stages 23** (DAY 1 26 AUG + DAY 2 27 AUG, 5 track pills),
**rooms 17** (6 pills, Nordic India among them), **side 6** (25 AUG + both event days, no pill
row since it is one track). The copied snippet was injected into a live page and re-executed
end to end: same cards, same day headings, dialog opens with 3 speakers and 3 photos, Escape
closes it.

### Next steps
1. `npm run build`, then commit + push 03c, 03d and 03e (main auto-deploys).
2. Still not built: the timeline view from mock 1.
3. Speaker coverage is thin (5 of 46). Worth asking Brella admins to fill the rest.
4. Test the copied snippet in a real Elementor widget on techbbq.dk, cross-origin, once deployed.

## Session 2026-08-03d (new /brella-program page, the live Brella schedule in house styling)

State: **DONE and verified in the browser, NOT committed, NOT deployed.** `tsc --noEmit` clean;
`npm run build` NOT run yet. Stacks on top of the uncommitted 03c work.

New page `app/brella-program/page.tsx` + a `.bp-*` block at the end of `app/globals.css` +
one line in `components/TopNav.tsx` ("Program 2026 (Brella)" under Program & internal). Built
from Auri's three mock screenshots: oversized section headings, a pill per track, day-grouped
cards with a coloured spine, time / title / location-with-pin.

Read-only over the existing `/api/program?event=brella`. **No new API, no new Airtable field, no
writes** — `lib/brellaprogram.ts` stays GET-only because that key can delete sessions in the live
attendee app.

- **The three sections are derived, not given.** Brella's `room` is one flat list of track names
  with no grouping of its own, so `sectionOf()` reads them: `/^side event/` → Side Events,
  `/^(event room|rooms?\b)/` → Event Rooms, **everything else → Stages**. That default is
  deliberate: a track added in Brella tomorrow appears under Stages instead of vanishing.
- Track colours are matched by NAME, not assigned from a rotation, because the Grill tracks are
  literally named after their colour and an "Orange Grill Session" card with a green spine would
  contradict the venue signage.
- `startMinutes()` sorts "All day" and anything unparseable LAST within its day rather than to
  00:00, where it would otherwise lead the list.
- A section with zero sessions renders disabled rather than hidden, so the set of three headings
  does not reshuffle as the schedule fills.
- The track pill row is suppressed when a section has only one track (Side Events today).

Verified by driving the page: Stages 28 sessions / 5 tracks, Event Rooms 10 / 5, Side Events 6 /
1 track. Chose the day-grouped card grid from mocks 2 and 3; **the timeline view in mock 1 (time
gutter, day columns, blocks positioned by time) is NOT built.**

### Brella independently confirms the Event Room times written in 03b
Every value written into Airtable that day matches Brella exactly: Nordic IPO 12:30-17:30,
Beyond Unicorns 13:30-17:30, Creative Business Cup 15:00-17:30 (26th) and 09:30-13:00 (27th),
Future of Fintech 09:30-13:00, AI That Sells 14:30-16:30. Board Summit is "All day" in Brella
against the 09:30-17:30 Auri chose, which is the same call. Two independent sources agreeing is
the strongest evidence those cells are right.

**Brella has test rows in it.** Founders Stage carries "Test Session", "Meeting with Auri"
(00:00-01:00), "Why did the chicken cross the road." and "Crazy story about Titanic". They are
live in the attendee app and this page shows them. Deleting them is a Brella admin job, not a
code change — this repo must not write there.

### Next steps
1. `npm run build`, then commit + push 03c and 03d together (main auto-deploys).
2. Ask whether the timeline view from mock 1 is wanted for Stages.
3. No Elementor embed snippet for this page yet — every other page has one, so decide whether
   techbbq.dk needs the Brella program embedded too.
4. Get the four test rows removed in Brella.

## Session 2026-08-03c (per-stage Life Science embed + a Brella source for Side Event times)

State: **code DONE and verified in the browser, NOT committed, NOT deployed.** `tsc --noEmit`
clean; `npm run build` NOT re-run since the route change, so run it before pushing.

Auri: "if I'm specifically taking a deep tech event, I want to copy the embed for those
particular people." So the copy button on `/life-science` now follows the stage pill.

- **`/api/life-science?stage=<exact Airtable option>`** narrows the feed to one stage, the same
  shape as `/api/partner-events?kind=`. Filtered AFTER `cached()`, so every variant shares one
  Airtable fetch instead of each warming its own entry. `PUBLISHED_STAGES` is now exported from
  `lib/lifescience.ts` and the route validates against it, so there is no second copy to drift.
- An unknown `?stage=` is **ignored and serves everyone**, matching `?kind=`. Returning an empty
  list would turn one typo in a WordPress snippet into a grid that silently shows nobody, and a
  page that quietly went blank is worse than one showing more than intended.
- `app/life-science/page.tsx` passes the stage into `CopyEmbed` and drops `tagTabs` for a single
  stage — a lone pill above a list that is already one stage reads as broken. `key={stage}`
  remounts the button so its "Copied" state cannot carry over and claim the previous snippet.

Verified by driving the real page: All → `/api/life-science`, 37 people, pills present. Deep Tech
Event Day → `?stage=Deep%20Tech%20Event%20Day`, 5 people, no pills. Feed counts check out
(37 / 5 / 32, unknown value → 37).

### Brella already has the Side Event times this repo was missing

Answering "do we have a Brella connection here": yes, live and read-only. `lib/brellaprogram.ts`,
org 109 / event 10356, `BRELLA_API_KEY`, surfacing as the Brella tab on `/program`, 44 sessions
today. GET only on purpose — the same key can create and delete sessions in the live attendee app.

Its **"Side Event Promotion" track carries times for 5 of the 6 Side Events** that 2026-08-03b had
to leave blank (the planning sheet only said "Day 0 Evening"):
Amplify Europe Jam Session 09:00-11:00 (25th) · Gateway to DACH 18:00-20:30 (25th) · GTM Secret
Dinner 18:30-23:59 (26th) · CFO Round Table Dinner 19:30-22:30 (26th) · Nordic Industrial AI
Hackathon 19:00-23:30 (27th) · Bridge to Germany = "All day".

**Nothing written anywhere.** Two problems first: **GTM Secret Dinner is 25 Aug in Airtable and
26 Aug in Brella**, so one is wrong; and several end times look like placeholders (`23:59`).

### Next steps
1. `npm run build`, then commit + push the `?stage=` work (main auto-deploys).
2. Resolve the GTM Secret Dinner date, then decide whether Brella's times get copied into the
   Airtable `Time slot` cells for the Side Events.
3. Still open from 03b: the same `parseTimeSlot` for `lib/program.ts`.
4. Still open from 03b: get a stage set for the 8 hidden Life Science people.

**Gotcha that cost real time this session:** two `next dev` servers ran against the same `.next`
and clobbered each other's output — `/partner-events` 404'd with a missing `page.js` while its
sibling manifest existed. Something outside the session keeps starting a second one (it also
edited `app/life-science/page.tsx` mid-edit). If a route 404s or 500s with ENOENT on `page.js`,
count the `next dev` processes BEFORE debugging the code: `Get-CimInstance Win32_Process -Filter
"Name='node.exe'" | Where-Object { $_.CommandLine -like "*airtable*" }`. Kill all, `rm -rf .next`,
start one.

## Session 2026-08-03b (Event Room times shipped + the Time slot format check, finally)

State: DONE and **pushed to `main`** as `5006251` (with the Life Science stage gate as `4347231`).
`tsc --noEmit` + `npm run build` clean, feed verified, page screenshotted.

Auri sent a planning sheet
(`1eNpGsMegPNeGR1r0hYR-N6057qHgPfD95WA69ucX7dc`) and asked to put times on the
`/partner-events` cards, which had shown none since the page was built.

**The sheet has seven tabs and the first one is the wrong one.** Its default tab is the
pop-up schedule (booth pop-ups, Hall E, Founders Lounge) and that dataset barely intersects
these cards, so the first pass matched only 2 events and one of those was a false positive
(the Google row there is a booth pop-up at E-001, not the Scaling Europe event room). Auri
pointed to the **Event Rooms** tab (`gid=132451139`) and that one maps cleanly. Read that
tab, not `gid=0`, next time. `gid=1506604086` ("Side Events 2026 Updated") is the other
useful one: it carries Time // Day, Location, Description and Registration Link.

**8 events now carry a time, 9 rows written** (Nordic IPO has a duplicate row and both were
filled so whichever wins the dedup shows the same value):
Beyond Unicorns 13:30-17:30 · Nordic IPO 12:30-17:30 (×2 rows) · Scaling Europe 12:00-14:45 ·
Creative Business Cup 15:00-17:30 (26th) and 09:30-13:00 (27th) · Board Summit 09:30-17:30 ·
Future of Fintech 09:30-13:00 · AI That Sells 14:30-16:30.
Every target cell was empty first; the fill script skips any non-empty cell rather than
overwriting. Cross-checked Flatpay against `/api/program?event=fintech` (runs 09:30-12:50,
so 09:30-13:00 holds).

**Board Summit's two tabs disagreed** — Event Rooms grid says 9.30-17.30, Side Events tab
says Day 2 (09:30-11:30). Auri chose the full day. If a partner queries it, that is why.

**Deliberately NOT written:** Sweden@TechBBQ VIP Reception (only in the pop-up tab, and that
cell says "NO Announcement!!!"), Nebius hackathon and CTO Connect (no clock time anywhere),
and the four Day 0 side events (the sheet only says "Day 0 Evening").

**`parseTimeSlot` in lib/partnerevents.ts is the format check that was overdue three times**
(`13:30-14-30` on NISS, `'10:00–10:10\n'` on Fintech). Forgiving input, one strict output:
accepts `.` or `:`, hyphen/en dash/em dash/`to`, stray newlines, and a wrapping label
(`Day 1 - 12:30-17:30`, `Day 2 (09:30-13:00)` — the sheet's own shape, which someone will
paste in whole). It insists on finding EXACTLY ONE range, so a cell holding two sessions is
refused rather than half-published. Unreadable → `null` + `console.warn`, never rendered.
Output is always `HH:MM-HH:MM` with a plain hyphen (no en dash, per the UI rule).
**lib/program.ts still has no equivalent** and is where two of the three defects came from.

Also: same-day cards now sort by start time (untimed last), a row carrying a time wins the
duplicate-submission tiebreak, and date + time render as ONE `.ev-card__when` unit — as
loose siblings the time broke onto its own line, left-aligned, on any card with three
badges. Ported into `lib/eventEmbedSnippet.ts` too, so the Elementor embed matches.

### Next steps
1. Commit + push, then redeploy so techbbq.dk gets it.
2. Side Event times: only the Side Events tab has them, and mostly as "Day 0 Evening". Ask
   Marketing for clock times before filling those.
3. Give `lib/program.ts` the same parser (fintech + niss + techbbq all read a free-text
   `Time Slot`).
4. Still open from 2026-08-02c: the 8 empty Fintech `Session Description` cells and the
   missing `description` key on the `fintech` + `niss` program sources.

## Session 2026-08-03a (Life Science x Deep Tech page update request scoped)

State: **ITEMS 1 + 2 ARE LIVE ON techbbq.dk. Items 3-4 blocked, see below.**

### LIVE on https://techbbq.dk/life-science/ (WordPress page id 39356)

Published 2026-08-03 via Elementor. Two changes, verified on the public page after publishing:
1. **Speakers 2026** HTML widget `c50239a` now carries the stage-filter snippet (embed id
   `tbbq-co7rmd`, replacing `tbbq-9eidxb`). Live pill counts: All 37 · Life Science x Deep Tech
   Stage 32 · Deep Tech Event Day 5.
2. **New Nebius Grill Session block** — top-level container `b0652e5` ("Nebius Grill Session")
   at index 1, directly after the hero, holding HTML widget `ff06e0e`. Static block: title,
   subtitle, 26 Aug 2026 · 11:50–12:30 · Grill Session Green · Hall E, the three description
   paragraphs, and both presenters (Dr. Ilya Burkov / Nebius, Pia Hardy / NVIDIA).
   **Headshots landed later the same day** and replaced the initials avatars:
   `/wp-content/uploads/2026/08/ilya.jpg` and `/wp-content/uploads/2026/08/Pia-Hardy.png`, both
   768x760, rendered as 52px circles with `object-fit:cover`.
   **Layout revised on Auri's request:** the card is now a two-column grid (`.tbbq-ns__cols`,
   `minmax(0,1.55fr) minmax(0,1fr)`) with the description on the left and the presenters in the
   right column, which was previously empty space. `align-items:start` lines the "Presenters"
   label up with the first paragraph, and the two presenter cards stack one per row because the
   side column is too narrow for a pair. Stacks to one column under 900px.
   Verified live: 799px + 515px columns, presenters to the right of the text, both photos loading.
   The `@media(max-width:900px)` stack rule is confirmed present and parsed in the live
   stylesheet via CSSOM, but NOT visually confirmed at a narrow viewport — `resize_window`
   reported an inconsistent `innerWidth` (3181 regardless of window size) on this display.
   **Pre-existing, not ours:** a `video.elementor-video` widget on this page overflows the
   viewport horizontally at ~1000px wide. Worth fixing separately.
   **Third revision (partner logos, bigger photos, LinkedIn):**
   - Headshots 52px → **72px** (64px under 600px).
   - **Pia Hardy's row is now a link** to `linkedin.com/in/pia-hardy-483254138`, with a LinkedIn
     glyph on the right and a hover/focus state. That URL came from Airtable, NOT a guess: she is
     in the Life Science table as "Pia Wilhelmina Hardy" / Nvidia but sits **outside** the
     published `Speakers Library 2026` view, which is why the earlier in-view search missed her.
   - **Dr. Ilya Burkov's row is now also a link** to `linkedin.com/in/ilyaburkov/`. Auri supplied
     that URL directly; it exists nowhere in Airtable (every table with a LinkedIn-ish field was
     scanned). Both rows are `<a>` now, identical at 100px tall with the LinkedIn glyph. The base
     `.tbbq-ns__person` rule is kept so a future presenter without a URL can be a plain `<div>`
     and still look the same.
   - **Partner logo footer**, hairline-separated: Nebius then NVIDIA, both 24px tall (20px mobile).
     `NvidiaLog.svg` is white + green (`.cls-1 #fff`, `.cls-2 #77ba44`) so it sits straight on the
     dark card. `nebius-logo.svg` carries a dark navy `#052B42` wordmark that is invisible on
     `#131313`, so it gets a **white chip** behind it. Neither logo is recoloured — recolouring a
     partner mark is their brand call, not ours. If a reversed Nebius or dark-bg NVIDIA variant
     arrives, drop the chip and give both one treatment.
   - Gotcha: **`curl` gets HTTP 455 on these SVGs** (bot protection); fetch them from the browser.
     The PNG/JPG headshots were fine over curl.
   Reference copy of the markup at
   `scratchpad/nebius-grill-session.html` (the published version drops a few CSS comments).
   Static on purpose: it is ONE session with fixed copy, and `/api/partner-events` covers only
   Side Event / Event Room / Bridge Event, not Grill Sessions.
   Checked at 360px: no horizontal overflow, presenters collapse to one column.

**HOW TO EDIT EITHER AGAIN:** the Elementor widgets were created/updated through Elementor's own
command API from the browser console (`$e.run('document/elements/create')` and
`document/elements/settings`), because dragging widgets and Ctrl+V into the ACE code editor both
failed — the OS clipboard is unreachable from the page (`readText` throws "Document is not
focused") and a synthetic Ctrl+V never reached ACE. Save with `$e.run('document/save/default')`.

### Deep Tech Event Day teaser on the Life Science page (the ONLY route to /deeptechday/)

Auri's decision: the Event Day gets **no entry in Projects and Tracks**. The single way in is a
teaser section on the Life Science page with a Read more button. So container `e9842d9`
("Deep Tech Event Day teaser", HTML widget `34be7d7`) at top-level **index 3**, between
"What to Expect" and "Why Life Science x Deep Tech?" — placed there because the What to Expect
list already name-drops "Deep Tech Day". **If that block is ever deleted, /deeptechday/ becomes
unreachable except by direct URL.** There is a comment saying so at the top of the widget.

**REBUILT with native Elementor widgets** after Auri's feedback: no left-only accent line, no pill
buttons anywhere, and stop hand-coding what Elementor widgets already do. The HTML widget was
deleted. Current structure, all native:
- `b7d3581` card container: **1px solid `#2A2A2A` border on all four sides**, radius 20, bg
  `#131313`, flex row going column on tablet/mobile.
- `17935e8` copy column: heading widget (eyebrow) + heading widget (H2 title) + text-editor.
- `9270757` action column: **Elementor button widget**, styles copied off the page's own
  "Read about the Deep Tech Pitch Competition" button (`29000c8`): 8px radius (not a pill),
  archivo-expanded 14px/400, `#F2F2F2` text, 20px padding, `sm` size.

Two traps hit here, both worth remembering:

1. **`$e.run` calls that time out may still have executed.** The button-create call timed out at
   45s, so a guarded retry created a SECOND identical button. Always re-read the model before
   retrying a create — do not trust the timeout to mean "nothing happened".

2. **Elementor's lazy-background rule blanks gradients on the 4th container onward.** The generated
   CSS carried the correct `background-image: linear-gradient(...)`, but an inline rule
   `.e-con.e-parent:nth-of-type(n+4):not(.e-lazyloaded):not(.e-no-lazyload), … *
   { background-image: none !important }` overrode it, so the button rendered transparent. The
   `e-lazyloaded` class is only added to containers that themselves have a background, so a
   background-less wrapper never gets it and the override is permanent. Adding `e-no-lazyload` to
   the wrapper's `_css_classes` saved into the document but the front end kept serving cached HTML
   without it. **Fix used: a solid `background_color: #2BB4E1` instead of the gradient**, because
   the rule only kills `background-image`, never `background-color`. The site's gradient runs
   `#3CB4CC → #2BB4E1`, two near-identical blues, so it looks the same. `e-no-lazyload` is still on
   the wrapper; if the cache clears the gradient could be restored, but solid is the safer default.

Verified live: button background `rgb(43,180,225)`, 8px radius, archivo-expanded 14px, `#F2F2F2`
text, 20px padding, href `/deeptechday/`, four native widgets, zero HTML widgets, border 1px on all
four sides. **Not visually screenshotted** — this page's scroll-triggered animations move content
between measuring and capturing, so several attempts framed the wrong section. Worth Auri eyeballing.

**Also spotted on the Life Science page, NOT fixed:** the "Two Pitch Competitions" bullet in
What to Expect ends with a stray editorial note, `[Icon: Calendar/Stage] Deep Tech Day`, left in
the published copy. Someone's production instruction that never got removed.

### LIVE on https://techbbq.dk/deeptechday/ (WordPress page id 72609)

The page had been created by **duplicating the LP Universe / Pension Summit page** and was published
with that event's content still in it: "Our Partners for TechBBQ's LP Universe", 17 pension-fund
speakers off `/api/investor-speakers?event=pension-summit`, Hotel D'Angleterre as the venue, and
Rares Bagyo (Investor Relations) as the contact. Auri wanted the LAYOUT kept and the content
replaced from `Downloads/TechBBQ Deep Tech Event Day _ One-Pager _ Aug 26.pdf`. Done and published:

- **Speakers embed** (widget `492769d`, uid `tbbq-jh2pxa`) repointed to
  `/api/life-science?stage=Deep%20Tech%20Event%20Day` → the 5 correct speakers. Edited the existing
  snippet surgically instead of regenerating: endpoint, `LOADMORE`/`STEP` off (5 people need no
  pagination), fire→ls hover glow, plus one added line blanking `p.tag` so all five cards don't
  print "DEEP TECH EVENT DAY" on a page that already is that.
- **Partners** cut from 11 LP logos to 3, in one-pager order, each linked: Novo Nordisk Foundation
  (`NNFoundation-White.svg` 71236), Microsoft (`microsoft.svg` 31992), Heartcore (`Heartcore.svg`
  33622). All three verified `#FFFFFF` before use — `NovoNordiskFonden.svg` (19870) is `#222760`
  navy and `Microsoft_logo_Colour.svg` (71285) has `#737373` text, both unusable on this dark page.
  Heading → "Our Partners for the Deep Tech Event Day", subtitle → the three programme strands.
- **Mission** now carries the one-pager's invitation copy. **Location** now says 26 Aug 2026,
  09:00–17:00, Event Room 6, Bella Center, plus the 10,000+/1,700+/1,000+/60-countries line.
- **New "What to Expect" section** at top-level index 4, made by duplicating the Mission container
  so it inherits the styling, with the five programme bullets. Its image column was dropped so the
  list gets full width.
- **Contact** → Alixe Averty, Project Manager, alixe@techbbq.org, photo swapped to `Alixe 2026`
  (71067, the same 2026 series as Rares' headshot). Michael Baczyk (Heartcore) is the one-pager's
  second contact and is NOT on the page; the layout has one contact card. He does appear as a speaker.

**Second pass (full PDF coverage + spacing).** Auri asked for everything from the one-pager and for
the sections to sit closer together.
- **Location section became "At a Glance"** (heading `0a01cf4`, text `6f48361`) carrying the PDF's
  four bullets verbatim: Date & Venue, Part of, **Audience** (the one fact that was missing entirely,
  including "universities"), Programme. Converted rather than added, so the venue isn't stated twice.
- **Michael Baczyk added as a second contact card**, by duplicating `b557543` → `761ec2c`. Investor,
  Heartcore Capital, michael@heartcore.com. His photo has no WP media entry, so it points at the
  connector proxy `/api/photo/lifescience/recbl9baiJ5vHRk4d` (verified: serves 512x518). Note that
  external URL means **no width/height attributes**, so a little layout shift is possible; uploading
  the headshot to the media library would fix that if it matters.
- **Spacing: page height 6580px → 4590px in the editor (30% shorter).** Three separate culprits, all
  inherited from the LP template: (1) `min_height: 40–90vh` on every section below the hero, so short
  content sat centred in a 900px box — now content-driven; (2) inner card padding `50/20/50/20` →
  `28/20/28/20`; (3) a `min_height: 300px` on each row, dropped for the text-only What to Expect and
  reduced to 240px where an image needs a floor. Section padding 36 → 24, margins 40 → 8.
- **The hero is still `80vh` (1211px)** and untouched, which is now the tallest thing on the page by
  far. If it still reads as too spread out, that's the next thing to cut.

**Third pass (horizontal contact cards, blue headlines, grouped logos).**
- Contact cards are now **horizontal**: `flex_direction: row`, photo 132x164 pinned left, details
  right. 430x192 each, equal, side by side. Pinning the photo needed `_element_width: 'initial'` +
  `_element_custom_width` + `_flex_size: 'none'` — inside a flex row the image widget's default
  `flex-shrink: 1` was squashing it to 100px regardless of the width setting.
- **The three partner logos were spread across the full 1278px row.** Cause: that container is a
  **grid** container (`display: grid`), so every `flex_*` setting was silently ignored. Fixed by
  setting `container_type: 'flex'` first, then the flex settings. Now centred with a 56px gap.
- **Headlines blue — and the trap here is the important part.** Six section headings, ids
  `a17967f, 17766e0, 138daa4, d636018, 0a01cf4, 5615d33`. Setting `title_color` looked like it
  worked (`getComputedStyle().color` came back blue) but the first heading still rendered ORANGE,
  because the **Piotnet addon's gradient-text** feature (`pafe_gradient_text: 'yes'`, colours
  `#FD7100 → #F40101`, 300deg) paints via `background-clip: text` +
  `-webkit-text-fill-color: transparent`. `color` is meaningless under that. **Always check
  `webkitTextFillColor` and `backgroundImage`, not `color`, when verifying text colour on this site.**
  I then briefly made it worse by enabling `pafe_gradient_text` on the five headings that never had
  it, which gave them a default `#FFA155` orange. Final state: `pafe_gradient_text: ''` on all six
  plus `title_color: #2BB4E1`, so all six are flat blue with `backgroundImage: none`.

**Fourth pass (hero rebuilt as a card + logo balance).**
- Hero content is now exactly Auri's spec: eyebrow `Part of TechBBQ 2026`, H1 `Deep Tech<br>Event Day`
  in blue at 52px, one "when" line (`26 August 2026 · 09:00 – 17:00 · Event Room 6, Bella Center,
  Copenhagen`), and the logo. **The PDF tagline was deleted** at his instruction ("and that's it") and
  now appears nowhere on the site. The ticket note was kept deliberately — practical access info.
- Hero restyled to match the Life Science teaser card: new inner container `2665226` with
  `#131313` bg, 1px `#2A2A2A` border, radius 20, flex row, logo left / copy right. Both old inner
  boxes (`1e6efbe` bordered logo box, `302f132` radius-60 dark panel) were stripped to transparent so
  there is ONE card rather than three nested ones. Hero height **1211px → 483px**.
- **How NOT to build a full-width-section card:** styling the section itself (`22c4df3`) made the card
  run edge-to-edge, because on this page every rounded panel is an INNER container while the section
  stays full-bleed. Constraining the section instead was a dead end: `width: 1440px` applied but left-
  aligned, `_flex_align_self: 'center'` did nothing (parent is not a flex row), and Elementor silently
  dropped `auto` side margins. The fix was structural — create an inner wrapper and
  `$e.run('document/elements/move', {container, target, options:{at}})` the two children into it.
  `document/elements/move` works reliably; use it rather than fighting width settings.
- Partner logos rebalanced: Heartcore (square, fills its box) moved to the middle at 200; Novo and
  Microsoft to 280, because Novo's mark is 249x48 (~5:1) and filled only a fifth of an equal box.
  Partners headline reduced to 30px.

**Fifth pass (hero matched to the LS card, bg photo, bigger logos, What-to-Expect boxes).**
Measured the Life Science teaser card first instead of guessing. Its exact spec, now mirrored on the
hero card `2665226`: bg `#131313`, 1px `#2A2A2A`, radius 20, `space-between`, `padding 32px 36px`,
gap 36; eyebrow 11px / line-height 11px / weight 700 / **`#00EAC0` teal** (this was the "missing
colour" — hero eyebrow had been grey `#9A9A9C`); title 30px / lh 30px / weight 600. Layout mirrored
to **copy left (62%), deeptech logo right (34%)**.
- Title colour kept blue `#2BB4E1` (the standing "headlines blue" rule) whereas the LS card's is
  `#F2F2F2`. Flagged to Auri.
- **Elementor's sanitiser strips `<br>` from heading titles on save**, so `Deep Tech<br>Event Day`
  became one line. That happens to match the LS card, so left as is.
- Hero background photo: `Life-Science-Stage-1-scaled.jpg` (67882, 2560x1440). Sampled its average
  brightness at **82/255** before committing, then a `#0D0D0D` overlay at **0.72** so the copy still
  reads. Container overlays are a **`::before` pseudo-element**, not a child div — checking for
  `.elementor-background-overlay` gives a false negative.
- Partner logos scaled to 380 / 260 / 380 (Heartcore stays smallest, it fills its box).
- **What to Expect: the 5 bullets are now 5 individual boxes**, wrapper `f7016d9`, boxes
  `6557220 b1ca73e 327d4af 7756f85 b9b2f7e`. Each is a container (bg `#191919`, 1px `#2A2A2A`,
  radius 14, padding 20, width 31.5%) holding a heading + text-editor. The old `<ul>` was stripped
  from `e3763d4`, leaving only the intro paragraph.

**Sixth pass (contact section mobile fix + responsive overflow audit).** Auri reported the
"Have any further questions" area not fitting on mobile, and wanted photo-left / text-right on both
cards. Six separate causes, only the first three of which were mobile-specific:
1. Alixe's text column `d8b1f15` had **`width_mobile: 500px`** — wider than any phone viewport.
2. Both text columns had **`flex-shrink: 0`**, because `_flex_size: 'grow'` emits `1 0 auto`. Even
   with `min-width: 0` and `overflow-wrap: break-word` they could not shrink. Fix is
   `_flex_size: 'custom'` + `_flex_grow: 1` + `_flex_shrink: 1` → `1 1 auto`.
3. Alixe's card had a leftover **`padding_mobile` of all zeros** while Michael's was empty, so her
   photo sat flush to the card edge and the two cards were asymmetric.
4. **Four section wrappers had a hard `width: 1300px`** (`dd024ed 5f0060d d8cf0fe c7227fb`) with a
   fixed `738px` tablet value and nothing in between, so ANY window between the tablet breakpoint
   and 1300px overflowed. Fixed with `width: {size:'min(1300px, 100%)', unit:'custom'}` —
   **Elementor's `custom` unit accepts arbitrary CSS and is the way to get a responsive cap.**
5. **The hero deeptech SVG renders ~3.1x its font-size**, so `size: 185px` produced a 575px-wide
   logo that burst out of its 34% column. Now `clamp(70px, 9vw, 220px)`. First attempt at `22vw`
   made it worse (691px) — measure the aspect ratio before picking a vw value.
6. Partner logos at 380 did not fit a narrow desktop. **`flex_wrap: 'wrap'` cannot help here**: the
   model and `--flex-wrap` both say `wrap` but something forces `flex-wrap: nowrap` in computed
   style, so the row can never wrap. Sized to 260 / 190 / 260 instead, which fits the narrowest
   desktop and is close to the 229px speaker photos Auri compared them against.

Verified live: page overflow 0, both cards 430px in a row, photos 132px left of the text on both.

**Two more gotchas from this pass:**
1. **`border_border` silently reset to `''`** on the hero card at some point, while `border_width`,
   `border_color` and `border_radius` all survived. The generated CSS then emitted no `--border-*`
   vars and the card rendered borderless. If a border vanishes, re-check `border_border` specifically.
2. **The Chrome extension dropped mid-run** and the failed call had partially executed, creating a
   duplicate text-editor. Same lesson as the timeout case: after any failed structural call, re-read
   the model before retrying. Waits under ~1.5s between create calls also let the model read stale.

**A bug I introduced and fixed in the same pass, worth remembering:** mapping duplicated widgets by
text is unsafe. `"alixe@techbbq.org"` matched a `/Alixe/i` name test, so the email heading was
overwritten with "Michael Baczyk" while the name heading kept "Alixe Averty". Map by explicit
element id or by position, never by a substring that can appear in more than one field.

**FIXED BY AURI, no longer an issue:** the hero logo no longer says "Pitch Competition".

**Previously known wrong (now resolved above):** the hero logo was
`Deeptech_Landscape_white_color_pitch-competition.svg` (72619), so the page announces itself as the
Deep Tech **Pitch Competition**. The one-pager uses a "deeptech Event Day" lockup. No Event Day
variant exists in the media library (searched deeptech / deep-tech / event-day / eventday), and the
wording is baked into the SVG so CSS cannot fix it. Upload the Event Day logo and swap widget `0.0.0`.

Section order is inherited from the LP page: Partners, Speakers, Mission, What to Expect, Location,
Contact. The one-pager's order is Invitation, What to Expect, At a Glance, Partners, Contact — so
partners currently appear before the page explains the event. Left as-is because Auri asked to keep
the layout; worth offering a reorder.

### Repo state

Uncommitted on `main`: `lib/lifescience.ts` (exports `PUBLISHED_STAGES`),
`app/api/life-science/route.ts` (`?stage=` support), `app/life-science/page.tsx` (per-stage copy
button). Typecheck clean. **`?stage=` is NOT deployed** — prod ignores it and returns all 37 for
any value, so a single-stage embed pasted today would silently show everyone. Deploy before using
it on the Deep Tech Event Day page.

### What was just done (item 1)

Generalised the single-list pill filter in `lib/embedSnippet.ts` so it can filter on any field,
then pointed the Life Science embed at `tag`:
- New `tagTabs?: string[]` option. A `pillFilter` object (`{field, values, label}`) now drives the
  one pill implementation; `deptTabs` → `department`, `tagTabs` → `tag`. No code was duplicated,
  and the team embed's behaviour is unchanged.
- `components/CopyEmbed.tsx` threads `tagTabs` through.
- `app/life-science/page.tsx` gained the matching pill filter on the dashboard preview itself, and
  passes `tagTabs={LS_STAGES}` to `CopyEmbed`. The count line now reads "N speaker(s) on <stage>",
  and under All it appends "· 8 with no stage set in Airtable" as a nudge to fix that data.

### Then: blank-stage speakers excluded outright (marketing's call, same day)

Auri relayed the decision: someone assigned to neither event should not be on the website at all.
So `lib/lifescience.ts` gained a **second publish gate** on top of view membership — a record also
needs a recognised value in `Which LS DT stage? `. Deliberately a GATE, not a UI filter: with the
stage pills live, a blank person would be reachable only under "All", which reads as a bug.
- `PUBLISHED_STAGES` is derived from `STAGE_COLORS`, so the colour map stays the single source of
  truth for which stages exist.
- `publishedStage()` scans the whole multi-select for a RECOGNISED option instead of taking `[0]`,
  so a person isn't dropped just because some new select option sorts ahead of their real stage.
- Unrecognised values **fail closed** (hidden), so a typo'd or renamed Airtable option cannot
  publish someone under a stage the site has no pill or colour for.
- The dropped names are `console.info`'d once per uncached fetch, so the data gap shows up in
  Vercel logs without the feed publishing a "who is missing" list.
- The dashboard's old "N with no stage set" count line note was removed (blanks no longer reach
  the client) and the hero copy now states both gates.

Verified live: `/api/life-science` went **45 → 37** (32 + 5), zero blank tags. The 8 now hidden,
for marketing to assign a stage to: Piotr Byrski, Andrea Dimitracopoulos, Michele Dallari,
Mads Lacoppidan, Louise Rørbæk Heiberg, Christian Brix Tillegreen, Piotr Surma, Magnus Björsne.

`LS_STAGES` is duplicated in the page rather than imported from `lib/lifescience.ts` **on purpose**:
that module reads `AIRTABLE_TOKEN` at module scope, so importing it into a client component would
pull a server-only module into the browser bundle. Keep the two lists in sync by hand.

Verified: `npx tsc --noEmit` clean. Snippet asserted to emit `p.tag===want` with no leftover
`.department`, and both regressions checked (team embed still filters on `department`, a feed with
neither option emits no pill markup). Then driven in a real browser, both on `/life-science` and on
the generated embed rendered as a standalone page: All 45 · Life Science x Deep Tech Stage 32 ·
Deep Tech Event Day 5, matching Airtable exactly, and each pill shows only that stage's cards.

### Still open

Marketing sent a Slack request plus a Google Doc
("LS DT Project | Website Update July 2026") asking for four things on the Life Science x
Deep Tech page. Scoped all four against the live sources. Auri has not yet green-lit any build.

**1. Speakers filter — DONE, see above.** Source data was already flowing: `lib/lifescience.ts:34`
reads `Which LS DT stage? ` and maps both requested options onto `tag`. Live tally in view
`viw8tGwoWltVeBwpl` (45 records): `Life Science x Deep Tech Stage` 32 · `Deep Tech Event Day` 5 ·
**blank 8**. The 8 blank rows are now **excluded from the feed entirely** (see the gate above), so
the published roster is 37. Marketing must assign a stage to get any of those 8 back on the site.

**2. Nebius Grill Session — already live in Brella, do NOT hardcode it.**
Timeslot `973336`, track `🟢 Green Grill Session`, `location: "Hall E"`, duration 40,
`start-time 2026-08-26T09:50:00Z → 10:30Z` (= 11:50–12:30 CEST), subtitle
`Grill Session by Nebius B.V.`. Title and description match the doc verbatim, so
`/api/program` already serves this session. Two catches:
- `speaker-assignments` is **empty**. Both presenters (Dr. Ilya Burkov / Nebius, Pia Hardy /
  NVIDIA) exist only as free text in the last two description blocks. No structured speaker
  objects, no photos. Marketing said photos are "to be shared soon".
- Neither presenter exists anywhere in the LS Airtable table (searched the view for
  burkov/hardy/nebius/nvidia → 0 hits). They are on Grill Session Green, which is **neither**
  of the two filter categories, so adding them to the LS table would land them in the blank
  bucket with no pill. Either keep them inside the session card, or the stage column needs a
  third option.
- `lib/brellaprogram.ts:228` maps `room` to the track, so this renders "Green Grill Session"
  and **drops `location` ("Hall E")**. One line to add if marketing wants the hall shown.

**3. Program display for the two tracks — BLOCKED, and not on us.**
Pulled every Brella track for org 109 / event 10356. The full set is: `1:1 meetings` (50),
`Nordic India Startup Summit` (7), `Orange Grill Session` (7), `Side Event Promotion` (6),
`Blue Grill Session` (5), `Green Grill Session` (5), `Founders Stage` (4), `Rooms 5,6,7` (3),
`Event Room 3` (2), `Event Room 1` (2), `Event Room 2` (2), `Event Room 4` (1).
**There is no "Life Science x Deep Tech Stage" and no "Deep Tech Stage" track.** The program
team must create them in Brella and assign sessions before anything can be extracted. Raise
this in the meeting; it is not a website task.
Also **the doc contradicts itself on naming**: the speakers filter asks for
`Life Science x Deep Tech Stage` + `Deep Tech Event Day`, the program section asks for
`Life Science x Deep Tech Stage` + `Deep Tech Stage`. Pin down which is real.

**4. Deep Tech Event Day — Auri created a WordPress page for it (not in this repo).**
Content comes from `Downloads/TechBBQ Deep Tech Event Day _ One-Pager _ Aug 26.pdf`. Facts from it
that were previously unknown: **26 Aug 2026, 09:00–17:00, Bella Center, Event Room 6**; partners
**Novo Nordisk Foundation, Microsoft, Heartcore Capital**; contacts Alixe Averty
(alixe@techbbq.org) and Michael Baczyk, Heartcore (michael@heartcore.com); tagline "Where AI,
Quantum and Life Science leaders come together to shape the future of innovation."
**Assessment: the one-pager needs no code.** It is all static copy (invitation, 5 What To Expect
bullets, At A Glance, 3 logos, 2 contacts) which Elementor does natively. Only the parts the
one-pager does NOT contain would need a feed, and those are exactly the blocked ones below.
**Flag raised to Auri:** publishing those two email addresses on a public page invites scraping —
use a form or obfuscate (SECURITY.md r6/r18).
Awaiting Auri's answer on whether he wants a Deep-Tech-Event-Day-only speaker grid on that page
(a one-line variant: same embed, `tagTabs` dropped, feed filtered to that stage).

**Old item 4 notes — the startup list still needs a source.**
Executive Breakfast (Heartcore Capital), Deep Tech Stage programme, and the pitch competition
(Microsoft-supported, 50,000 DKK + credits) are all just copy, fine as a static block.
"Participating startups listed in Airtable" is the vague part. Candidates found, **none of
which is a pitch-competition shortlist**:
- `Life Science Project` view `Startup Library 2026` = `viwC65YEXxl8iDPzN`
- standalone table `Startup Library 2026` = `tblVljqHIiozyovxB` (Startup Name, Location,
  Solution Categories, TechBBQ Categorization, Disease Categories, Maturity, Website, One Liner)
- `Smarterra Pitch Competition` = `tblsepp3UxW1QtbfH` (but the doc names Microsoft as sponsor)

### Next steps

1. Deploy, then copy the embed from the DEPLOYED `/life-science` (not localhost, or `__ORIGIN__`
   bakes in localhost) and paste it into the Elementor HTML widget on the LS x DT page.
2. Ask marketing which Airtable view holds the actual pitch-competition startups.
3. Ask who creates the two missing Brella tracks, and by when. Item 3 stays blocked until then.
4. Get the blank `Which LS DT stage? ` column filled for the 8 LS speakers.
5. Confirm whether the Nebius card should show "Hall E" alongside the track.
6. Chase the two Nebius headshots; decide static-in-card vs added to Airtable.

### Gotchas found this session

- Brella auth is the header `Brella-API-Access-Token` plus `Accept: application/vnd.brella.v4+json`.
  A bearer token or `X-Api-Key` returns **403 `user_not_found`**, which reads like a permissions
  problem but is just the wrong header.
- Brella track names carry leading emoji (`🟢 Green Grill Session`); `lib/brellaprogram.ts:59`
  already strips them. Don't match track names on the raw string.
- The Google Doc export redirects cross-host to `doc-*.googleusercontent.com`, so fetching it
  takes two hops.

## Session 2026-08-02c (Future of Fintech program audited against Auri's Google Sheet)

State: **FINDINGS ONLY, NOTHING FIXED.** Auri asked whether the Airtable program matches the
sheet. It nearly does. Four discrepancies, all still open, all waiting on his call.

Source: `Future Of Fintech` (`tbleh7Lqv1zMQaUKx`), program view `viw0mk6kOUKxNqgzU`, 8 rows.
**All 8 sessions and all 8 time ranges match the sheet exactly, in the same order.**

**1. Every `Session Description` is EMPTY in Airtable** (verified field-by-field against the
view). The 8 description paragraphs in the sheet exist nowhere in the base.

**And filling them in would not be enough**, which is the part worth remembering: the `fintech`
entry in `PROGRAM_SOURCES` maps only `name` / `timeSlot` / `type`. There is no `description`
key, so `lib/program.ts` never requests the field and the feed could not expose it even once
the cells are populated. **`niss` has the same gap.** Only the `techbbq` source maps
`description`. The agenda embed already renders descriptions, so nothing downstream needs
changing — this is two lines of config plus the data.

**2. Session 2 lost the company name.** Sheet: "Opening Session with **Flatpay** · Unicorn to
Decacorn - Building for the Scale Leap". Airtable: "Unicorn to Decacorn: Building for the Scale
Leap". Dropping "Opening Session" is right, `Type of Session` already says `Opening`, but
Flatpay is gone. Auri has not yet said which wording he wants.

**3. Session 2's `Time Slot` holds a trailing newline** — the raw value is `'10:00–10:10\n'`,
which renders as a line break inside the time column. Same class of invisible data defect as
the NISS `13:30-14-30`, and it ships for the same reason: the publish rule only checks that a
Time Slot is non-empty, never that it is well-formed. **Third instance now. Write the format
check.**

**4. Dash inconsistency**, same as NISS was: rows 1-4 en dash, rows 5-8 hyphen.

Nothing to exclude at the end — the "Final Networking and panel" row Auri flagged is not in the
program view, so it never reaches the feed.

### Next steps
1. Data fixes, cleared for nothing yet: strip the trailing newline, normalise the four hyphens.
2. Confirm the Flatpay wording, then write it.
3. Add `description: "Session Description"` to the `fintech` source (and the equivalent to
   `niss`), then load the 8 texts from the sheet into Airtable.
4. **The `Time Slot` format check, now overdue.** Three malformed values have reached
   techbbq.dk across two tables.

## Session 2026-08-02b (Refresh button works in PRODUCTION, via an authenticated bypass)

State: DONE. `tsc --noEmit` + `npm run build` clean. Auth gate verified with curl on a real
production server. Committed + pushed to `main`.

**Reverses the dev-only decision from 2026-08-02a.** Auri screenshotted the deployed dashboard
asking "is there no sync button?" — and no, by design, which was the wrong design. He uses the
deployed dashboard, not localhost, so the button was missing exactly where it is needed.

**The old mechanism could not work in production and has been deleted.** `/api/admin/refresh`
cleared a serverless instance's in-memory `Map`; up there the CDN answers the visitor, so that
press would have changed nothing while looking successful. Gone, along with `invalidateAll()`.

**New mechanism: `?fresh=<n>` on `/api/program`.** One path that works identically in dev and
prod. A URL the CDN has never seen is the ONLY kind that reaches the function at all, which is
why the button increments `n` on every press rather than sending a constant.
- The route `invalidate()`s its key then `cached()`s, so the live read also repopulates that
  instance for ordinary readers.
- Responds `Cache-Control: no-store` and **no CORS headers** — authenticated, same-origin,
  not a feed. The CDN must never store it or answer the next press from it.
- **Gated by the dashboard password**, because `/api/program` itself has to stay public for the
  Elementor embeds and an open bypass is an unauthenticated route hitting a third-party API on
  every call (SECURITY r5, Auri's most common vulnerability). The browser already attaches
  Basic auth to same-origin fetches, so no secret goes into the page bundle.
- Own rate-limit bucket, **10/min** against 60 for cached reads. `rateLimit()` grew an optional
  `{bucket, max}` so the expensive path cannot eat the cheap path's allowance.
- Returns **401 rather than silently serving the cached copy**: a bypass that quietly does
  nothing is worse than one that says no.

**`lib/dashboardAuth.ts` (new)** holds the password check that middleware and the route now
share. Two copies of an auth check drift, and a drifting auth check fails open. Constant-time
compare, runtime-agnostic (Edge for middleware, Node for the route, so `atob` not `Buffer`),
and **fails closed in production when `DASHBOARD_PASSWORD` is unset** while still allowing
`npm run dev` with no secrets.

**`useCachedList` gained `revalidateError`.** A background refetch that fails while cached data
is on screen used to be swallowed — correct for the list (stale beats blank) but it left the
button waiting on a change report that would never arrive. The 401 case made that reachable.

### Gotchas
- **`CopyAgendaEmbed` must be passed `base`, never `path`.** `path` can carry `?fresh=`, which
  is an authenticated URL — baking it into an Elementor snippet would 401 every public visitor.
  Caught before committing; worth re-checking if that page is refactored.
- The button does NOT purge the public CDN copy, and the report says so in as many words.
  techbbq.dk still picks a change up within the hour. Don't let the UI overstate it.
- Verified gate (curl, real prod server): public feed 200 unauthenticated · bypass 401 with no
  password · 401 with the wrong password · 200 with the right one · pages still 401 · and with
  `DASHBOARD_PASSWORD` unset on a production build the bypass 401s while the public feed
  stays 200.
- `npx tsc --noEmit | tail` reports "clean" even when it isn't, because `tail` succeeds. Test
  for empty output instead. Also `rm -rf .next` first, or deleted routes leave stale generated
  types behind and tsc fails on phantom files.
- The orphaned-dev-server trap bit twice more: `TaskStop` leaves the node child on port 3000,
  the replacement silently takes 3001, and every curl then measures the wrong server (a run of
  incoherent 404/500/200s is the tell). Kill by port first, every time.

### Next steps
1. Add the `Time Slot` format check so a malformed time is flagged instead of published.
2. Put `RefreshButton` on the other feed pages. Each needs its own `?fresh=` handling in its
   route, so it is not purely a component drop.

## Session 2026-08-02a (NISS program corrected in Airtable + local-only refresh button)

State: DONE. `tsc --noEmit` + `npm run build` clean, verified in the browser on `/program`.
Committed + pushed to `main` 2026-08-02 at Auri's explicit instruction.

**1. Patched the NISS 2026 program to match Auri's canonical schedule.** 13 of 15 rows, 14
cells, written straight to Airtable (`tblfIPjV4t1c1628h`, view `viwMqDT1GMW7AwOtQ`) with a
throwaway script; re-read all 15 records afterwards to confirm zero remaining diffs.
- `Nordic Founder Panel: What Would Make India Relevant?` → `Building Toward India`
- `13:30-14-30` → `13:30–14:30` and `16:30-16-50` → `16:30–16:50` (hyphen typed where a
  colon belonged, in the minutes)
- `15:30-16:00` → `15:40–16:00` (the 15:30 start overlapped the 14:35–15:35 pitch)
- 11 further rows normalised hyphen → en dash, so all 15 time slots read consistently
- Deliberately did NOT copy the `17:20-1740` from Auri's paste; Airtable's `17:20–17:40` was
  already right.

**Both malformed times had shipped to techbbq.dk.** The publish rule only requires that a
Time Slot be non-empty, never that it parses, so `14-30` rendered verbatim. Still open — a
format check on `Time Slot` is the obvious follow-up and Auri has been offered it twice.

**2. Local-only "Refresh from Airtable" button** (`/program`). Feeds stay at the 1h
`TTL_MS` — Auri explicitly wants that for the live site — and this is the escape hatch for
editing sessions.
- `app/api/admin/refresh/route.ts` — POST, drops server cache entries. `{key}` clears one
  feed, no body clears all. **404s when `NODE_ENV === "production"`**, and is outside
  middleware's `PUBLIC_PATHS` so it also sits behind the dashboard password. Reason it
  refuses in prod: there the CDN's `s-maxage` is what serves visitors and clearing one
  instance's Map does nothing, so the press would lie.
- `lib/rate-limit.ts` — added `invalidateAll()` alongside the existing `invalidate()`.
- `components/DevRefreshButton.tsx` — returns null unless dev. Verified the label and the
  route path are both **absent from `.next/static`** in a production build (0 matches), so
  it is stripped, not merely hidden.
- `lib/useCachedList.ts` — new optional 4th arg `nonce`, folded into the effect deps. This
  is what lets the button refetch IN PLACE. First attempt used `window.location.reload()`
  and it threw you back to the Brella tab every press. Do not fold a counter into
  `cacheKey` instead — that writes a new localStorage entry per press and orphans the old.

**3. The refresh reports WHAT changed**, or says nothing did.
- `lib/diffList.ts` (new) — matches rows by `id` (so a reordered row is not a delete plus an
  add), classifies added/removed/changed, and for changed rows lists each field as
  `Time Slot: 12:30–13:30 (was 12:00-13:00)`. Caps at 15 rows and 70 chars per value, and
  reports the remainder as "and N more not listed" rather than truncating silently.
  `FIELD_LABELS` maps camelCase JSON keys to Airtable-ish column names; unmapped keys get
  de-camelCased automatically, so a new feed field still reads sensibly.
- `useCachedList` returns `changes: ChangeSummary | null`. **null vs total===0 is load-bearing**:
  null means no comparison was possible (cold load, where every row would read as "added" —
  noise), total===0 means it compared and they were genuinely identical. That second case is
  the "No changes. This page already matched Airtable." line, and it matters: silence would
  read as "the button didn't work".
- The report only renders after a press (`pressed` state). `changes` also fills on ordinary
  background revalidation, and printing a diff nobody asked for on page load is noise.

**The button no longer clears localStorage on the `onCleared` path**, and this is deliberate:
that copy IS the baseline the diff compares against. Clearing it made every refresh report
"nothing changed". The reload fallback still clears it, since a reload repaints from
localStorage before fetching and would flash the stale list.

### Gotchas
- **`TaskStop` on `npm run dev` leaves the child node process holding port 3000.** The next
  `next dev` silently moves to 3001 while the orphan serves 500s from the `.next` you just
  deleted. Kill by port (`Get-NetTCPConnection -LocalPort 3000`) before restarting.
- The `.next` corruption rule still bites: stop dev, `rm -rf .next`, build, `rm -rf .next`,
  restart dev. Don't interleave.
- `/api/program` takes **`?event=`, not `?source=`** despite the lib calling them sources.
  `?source=niss` silently falls back to the `techbbq` table and returns its 3 sample rows.
- Airtable's `Time Slot` and `Session Name` are both `singleLineText`, so writes are safe.
  The token has `data.records:write` plus schema read.
- Browser automation: this page's tab buttons ignore clicks until React hydrates, and
  pixel coords are off because the viewport (1923px) is scaled to the screenshot (1322px).
  `ref` clicks are still flaky here; driving it with `javascript_tool` (`el.click()`) is
  reliable.
- **Testing the change report by tampering with localStorage needs no reload.** Reloading
  (or switching tabs) triggers a background revalidation that immediately rewrites the
  baseline to the real data, so the subsequent press correctly reports nothing. Tamper and
  press in the same tick.
- The report compares against what THIS BROWSER last stored, not against a server-side
  history. A second press right after the first always says "no changes", which is correct.

### Next steps
1. Add the `Time Slot` format check so a malformed time is flagged instead of published.
2. ~~Drop `DevRefreshButton` onto the other feed pages.~~ **Superseded by 2026-08-02b**:
   `DevRefreshButton` and `/api/admin/refresh` no longer exist. Read that session first —
   everything above about the dev-only gate and the `nonce` is history, not current design.
3. Carried over: `TITO_API_TOKEN` + `BRELLA_API_KEY` in Vercel; Life Science and team embed
   re-copies; `/api/team` has no retry.

## Session 2026-07-31f (Event cards restyled to match the house .s-card look)

State: DONE, committed on `partner-events`. `tsc --noEmit` + `npm run build` clean. Verified
over CDP with **real mouse events** on both the page and the executed embed.

Auri's ask: make the event cards look like the other TechBBQ pages — **1px border**, and on
hover the kind's colour as a **glow in the bottom of the card background**.

**What changed, mirroring `.s-card`:**
- Uniform **1px** border (`--color-border`), replacing the 3px coloured left spine. Border
  turns the kind colour on hover.
- **No `translateY` lift** — `.s-card` only fades its glow in, so the lift is gone.
- `.ev-card::after` glow, same construction as `.s-card::after`: `inset:-8px` (pushes past
  the card's own 8px padding so it reaches the real bottom edge), `opacity 0 -> 1` on hover,
  `linear-gradient(115deg, black .95, --glow-a .92, --glow-b .6, transparent 72%)`.
- Glow stops per kind: a Side Event reuses the site's **exact fire pairing**
  `#CE0F2E -> #FA7000`; an Event Room mirrors it in blue `#1B6CA8 -> #2BB4E1`, the way the
  Life Science cards use cyan -> teal. Note `#2BB4E1` (the rejected old blue) earns its keep
  here as the lighter second stop.
- `z-index:1` on `.ev-card__media` and `.ev-card__body`, so the logo and text paint ABOVE the
  glow and the glow stays in the bottom band — the same layering `.s-card__media` /
  `.s-card__name` use.
- `text-shadow: 0 1px 6px rgba(0,0,0,.5)` on title/company/desc/date, copied from
  `.s-card__name`/`__meta`, because that text now sits over the bright part of the glow.
All of it applied to **both** the React page and `lib/eventEmbedSnippet.ts`.

### Two bugs the glow exposed, both caught by rendering + reading computed styles

1. **The kind badge disappeared on hover.** Its background was `rgba(kind, .14)` — a
   TRANSLUCENT tint — so once the red glow lit up behind it, red text on see-through red
   became invisible. The neighbouring "PUBLIC" badge survived only because its background is
   solid. Fix: a `mix()` helper that blends the kind colour into a solid `#131313` and returns
   an **opaque** `rgb()`. Rule of thumb: anything stacked above the glow needs an opaque
   background. (`lightTint` now delegates to the same helper with a white base.)
2. **The embed's company + description rendered in the host theme's Georgia serif.** Those are
   `<p>` elements and never set `font-family`; a theme rule targeting bare `p` **beats the
   section's inherited font**, so `font-family:var(--sans)!important` on `.tbbq-events` did
   nothing for them. Every other element already set a font explicitly, which is why only
   those two were wrong. Fixed on `__company`, `__desc`, `__loading`, `__empty`.
   Confirmed: those now compute to Inter while the host page's own `h1` stays Georgia.

### Gotcha: no backticks in the snippet's CSS comments
A comment reading ``bare `p` element`` inside the builder's **template literal** terminated the
string and broke the build (TS1005 at the next line). The whole CSS/JS block is one template
literal — comments in it must avoid backticks and `${`.

### CDP hover-testing notes (both cost a wrong reading first)
- `Runtime.evaluate` with `awaitPromise` still raced the React render; poll from **Node**
  (`for(...){ if(await ev('document.querySelectorAll(...).length')) break; }`) instead of
  awaiting an in-page wait loop.
- **`scrollIntoView` before dispatching the mouse move.** A card below the fold yields
  coordinates outside the viewport, so `:hover` never fires and the glow reads as broken —
  which it did, showing `opacity:0` on a correctly-built gradient.

## Session 2026-07-31e (All-pill white-on-white fix + missing-data panel)

State: DONE, committed on `partner-events`. `tsc --noEmit` clean.

**1. The "All events" pill was white text on a white background** (Auri spotted it). The rule
`.ev-tabs button[aria-pressed="true"]{background:var(--tab-color,var(--color-foreground));
color:#fff}` gives each selected pill its KIND colour — but the All pill has **no
`--tab-color`**, so the fallback resolved to the light `--color-foreground` (#f2f2f2) while
the text stayed #fff. Fixed with a `[data-k="all"]` carve-out that uses `--color-ink`
instead, plus `data-k` on the button. **The embed snippet already had exactly this
carve-out** — only the React page was missing it, which is the argument for keeping the two
pill styles in step whenever either changes.
Verified over **CDP** (not a screenshot): selected All = `rgb(13,13,13)` on `rgb(242,242,242)`,
Side Events = white on `rgb(206,15,46)`, Event Rooms = white on `rgb(27,108,168)`, cards
6/9/15.

**2. `.ev-gaps` panel at the top of the page** listing what the source still lacks — times,
address (no column at all), category labels, the fused private/invite option, description +
register on Side Events only, and the 1 dateless / 1 logoless row. Each line names the exact
Airtable field so it is actionable, and the footer says which gaps self-heal once filled
versus which need a schema change.
**Deliberately NOT in the embed snippet:** it is an internal note about Airtable, and
techbbq.dk visitors must never see it.

### Verification note worth keeping
Reading computed styles from a page in an **iframe fails cross-origin** — the rig was served
on :8898 while the page was on :3000, so `contentDocument` was blocked and the probe returned
nothing. `--dump-dom` also only dumps the TOP document, so iframe content never appears.
Two ways out, both used here: serve the rig from the app's own origin, or (better, and what
finally worked) drive the real page over **Chrome DevTools Protocol** — Node 25 has a built-in
`WebSocket`, so `--remote-debugging-port=9222` + `Runtime.evaluate` needs no dependencies and
can click and read computed styles on the actual page.

## Session 2026-07-31d (Side Events & Event Rooms: WordPress embed + 3 fixes)

State: DONE, committed on `partner-events`. `tsc --noEmit` + `npm run build` clean. The
snippet was verified by **EXECUTING** it inside a deliberately hostile fake-WordPress page
and reading computed styles — never by string-matching (session 30f's lesson).

**1. `lib/eventEmbedSnippet.ts` + `components/CopyEventEmbed.tsx` — the embed Auri asked
about.** A SEPARATE builder from `lib/embedSnippet.ts` on purpose: that one renders a
*person* (square photo, name, title · company, LinkedIn) and every option on it is about
people — modal bios, LinkedIn, department pills, per-image focus. An event is a different
object (contained logo on a coloured panel, type badge, access badge, date, clamped blurb,
Register button). Bending one builder to do both means a second set of mutually exclusive
branches through code that already carries tab mode. Conventions are kept identical:
`__ORIGIN__` swap at copy time, `#id`-scoped + `!important` on every property a theme
touches, and the `r.ok` check so a 429/502 says "Could not load right now." instead of
announcing an empty roster.
Three buttons on the page: all-with-tabs, Side Events only, Event Rooms only (the
single-kind ones pass `kindTabs={false}` — nothing to filter).

**2. Arrow removed** from the Register button, page and embed.

**3. Darker blue: `#2BB4E1` → `#1B6CA8`.** Chosen by measuring, not by eye — it MATCHES the
red on both contrast axes: **5.59:1 on white** (red is 5.63) so the button's white label is
legible, and **3.32:1 on the #131313 card** (red is 3.30) so the badge reads the same as the
red one. The old `#2BB4E1` was only **2.41:1 against white** — white button text on it failed
outright. One shade serves both roles, so no companion tint was needed.
**Do not "unify" this with `lib/lifescience.ts`, which still uses `#2BB4E1`** — that is the
Deep Tech Event Day stage colour and is unrelated.

**4. Tabs centered on the page too** (`.ev-tabs`), matching the embed, with the count line
centered under them. Mobile gets the same one-swipeable-line treatment as the team embed:
`flex-wrap:nowrap`, `overflow-x:auto`, scroll-snap, hidden scrollbar, and
`justify-content:flex-start` — a CENTERED overflowing strip clips its first pills with no
way to scroll back to them.

### Bug caught by executing the snippet (would have shipped silently)

`safeUrl()` originally required `^https?://`, which is right for blocking a `javascript:` URL
in an Airtable cell — but **`photoUrl()` emits a ROOT-RELATIVE url when `PUBLIC_BASE_URL` and
the Vercel env vars are absent (local dev)**, so every logo failed the test and silently fell
back to the company initial: 0 logos, 15 initials. Now accepts `^https?://` *or* `^/[^/]`
(still blocks `javascript:`, `data:` and protocol-relative `//evil`). Note a relative URL is
genuinely broken for a cross-origin embed, which is why the local rig sets
`PUBLIC_BASE_URL=http://localhost:3000` to reproduce production.

### How the embed was verified (reuse this rig)

- A fake host page with **hostile theme CSS** — global `button{background:#ff00ff;width:100%;
  text-transform:uppercase;border:4px dashed}`, `a{color:#0f0;text-decoration:underline wavy}`,
  `img{border-radius:50%;width:100%}`, `h3{text-transform:uppercase;letter-spacing:6px}` —
  because that is the class of rule that flattened the team pills (30g) and overrode the
  mailto colour (30f). Served from **:8899 while the feed is on :3000**, so CORS is exercised
  too. Computed styles after execution: button `rgb(206,15,46)` / white / `none` /
  `9999px` / auto width, pill white-on-dark with `borderStyle:none` and 36px height, logo
  `border-radius:0` + `object-fit:contain`, title `text-transform:none`. Every theme rule lost.
- Tabs were **clicked**, not just rendered: Side Events → 6 cards (one kind), Event Rooms → 9,
  All → 15 (both). Counts come from the data so they cannot drift from the grid.
- All 6 option variants transpiled standalone and `new vm.Script()`-parsed.

### The mobile-viewport trap (cost a wrong conclusion mid-session)

`--window-size=420` does **NOT** give a 420px viewport on macOS — Chrome enforces a ~500px
minimum window width, so `innerWidth` reported **500** while the screenshot captured only the
left 420px. That looks exactly like horizontal overflow and I briefly called it a bug; it was
not (`overflowing:[]`, `docScroll == innerWidth`). Same family as 30h's `resize_window`
failure. **Fix: render inside a `<iframe width="390">`** — an iframe gets its own real
viewport. Confirmed there: `innerWidth` 390, `docScroll` 390 (no page scroll), one 310px
column, pills strip actually scrollable, logo panel 21/9, date on its own line.

### Next steps
1. **Re-copy the embed from the DEPLOYED dashboard** — from localhost it bakes in
   `http://localhost:3000` and fetches nothing on techbbq.dk.
2. Still local-only otherwise: branch `partner-events` is pushed but not merged to `main`, and
   the preview URL is behind Vercel SSO so it cannot serve the embed. **Production is what
   makes the feed publicly fetchable.**

## Session 2026-07-31c (NEW: Side Events & Event Rooms page + feed)

State: DONE locally, committed, NOT pushed. `tsc --noEmit` + `npm run build` clean, all 15
cards verified in a real rendered browser DOM (headless Chrome `--dump-dom`, not string
matching). Auri's scope call: **build with only what has data** — no time, label or address
support in the code at all until the source has them.

**New files:** `lib/partnerevents.ts`, `app/api/partner-events/route.ts`,
`app/partner-events/page.tsx`. Plus a `partner-events` entry in `PHOTO_SOURCES`
(`Company Logo`), `/api/partner-events` in middleware's `PUBLIC_PATHS`, a TopNav entry
under Program & internal, and an `.ev-*` block at the end of `globals.css`.

One entry per EVENT, red for Side Events (`#CE0F2E`), blue for Event Rooms (`#2BB4E1`).
Same table AND view as `lib/eventrooms.ts` but a different grain — that lib returns one
entry per PRESENTER. Kept separate on purpose; merging would make one shape carry the
other's nulls.

### The trap that dictated this lib's design: THREE fields named `Date of Event `

Partnership Success has three columns literally named `Date of Event ` (identical, trailing
space included) plus a fourth `Date of Event` without the space. Consequences:

- **`fields[]=Date of Event ` fails the WHOLE request** with Airtable's
  `AMBIGUOUS_FIELD_NAMES`. This repo's allow-list pattern is therefore *impossible* by
  name here — it is a hard API error, not a style preference.
- So this lib is the first to address fields **by ID** with `returnFieldsByFieldId=true`.
  Field IDs also survive the trailing-space renames that bite this base constantly
  (`Hierarchy `, `Role `, `Which LS DT stage? `). IDs are in the `FIELDS` map.
- **The date is genuinely SPLIT across two of the three twins**: 13 rows in
  `fld5S7DvQz7C09BNm`, 3 in `fldDUuXRNZ8nIjTo3`, 1 row has both (they agree). Reading
  either alone loses rows, so both are requested and coalesced primary-first.
- A by-NAME read happens to return the right value today only because Airtable omits blank
  fields, so the single populated twin lands under the shared key. Do not rely on it: two
  differing values in two same-named columns would silently pick one.

### 19 rows in the view → 15 events

- 3 rows have no `Session Title` (empty form starts) — dropped.
- 1 true duplicate: Nordic IPO has two rows for 2026-08-26 (partner resubmitted; the newer
  row also carries the fuller company name). Dedupe key is **title + date**, and the date
  belongs in the key: Creative Business Cup runs on BOTH 08-26 and 08-27 and those are two
  real events. Winner = richest row (description/register/logo/access), tie → newest.
- Result: 9 Event Rooms + 6 Side Events. Sorted by date, undated last, then title.

### What the source cannot give (asked for, deliberately absent)

1. **Times.** `Time slot` is populated on 11 rows table-wide but ZERO of these 19 (those are
   Grill sessions). `Start date` (dateTime) is empty on every row in the table.
2. **Address.** No such column exists — all 128 field names checked for
   addr/location/venue/street/city.
3. **Category labels.** `Key Topics/Industries` is a multi-select with the right options and
   57 rows filled table-wide, but zero on these 19.
4. **Private vs invitation-only cannot be separated.** `Event type` offers exactly two
   options: `Public Event` and `Private Event (invite only)` — those two states are fused in
   the source. A third select option is the only fix; only the `ACCESS` map would change.
5. Description + register link exist **only on the 6 Side Events**, never on the 13 Event
   Rooms. A clean split, not random gaps.
6. `Type of Event` has a third option, **`Bridge Event`** (0 rows here). Filtered out rather
   than guessed a colour for — add to `KINDS` if it should show.

### Logo panel: the polarity problem (settled empirically, in that order)

Partners upload BOTH dark-on-transparent and white-on-transparent logos, and nothing in the
data says which. Verified by rendering, not reasoning:
1. Dark tinted panel (first attempt) → Rockstart, advores, OMR Reviews were invisible.
2. **Light** tint of the kind colour (`lightTint(hex, 0.1)`) → those read, but Creative
   Business Network and the Closing Loops/EU row (white logos) washed out.
3. Kept the light panel (it suits the clear majority) + a `drop-shadow(0 0 1px rgba(0,0,0,.45))`
   hairline that traces glyph edges, so a white logo is still discernible and a dark one just
   gains depth. A **mitigation, not a fix** — a white logo still wants an Airtable swap.
Logos are `object-fit: contain` on purpose: they are wordmarks with their own padding, and
`cover` slices them mid-word. `--kind-soft` (dark tint) still backs the pills; only the logo
panel is light.

### Gotchas
- Verified in **headless Chrome** (`--dump-dom` / `--screenshot`), because the page is a
  client component: `useCachedList` fetches in an effect, so the SSR HTML is only the hero +
  "Loading…". A curl of the page can never show a card. The browser extension was not
  connected this session; `"/Applications/Google Chrome.app/.../Google Chrome" --headless
  --virtual-time-budget=15000 --dump-dom <url>` needs no dependencies and worked.
- `source .env.local` breaks under zsh (line 7's unquoted `Website?` glob-expands). Read
  single vars with `grep '^KEY=' .env.local | cut -d= -f2-` instead.
- To view a gated page in a browser without triggering a Basic-auth modal (which wedges the
  Chrome extension), start dev with `DASHBOARD_PASSWORD= ` — middleware falls through when
  no password is set AND `NODE_ENV=development`.
- 2 descriptions run past 400 chars, so the card clamps to 3 lines in CSS rather than
  truncating in the feed — the full text stays available to other JSON consumers.

### Next steps
1. **No WordPress embed yet.** `lib/embedSnippet.ts` builds speaker-shaped cards only; an
   event card (date, access badge, register button) needs its own builder. The page and feed
   are done and `/api/partner-events` is public, so the embed is the remaining piece.
2. Not pushed — decide whether this goes live before/after the missing Airtable fields.
3. Ask partnerships to fill `Time slot` + `Key Topics/Industries` on these rows, add an
   address column, and split `Event type` into three options if private ≠ invite-only.
   Every one of those appears with a small, isolated change here.

## Session 2026-07-31b (Codebase audit: bug fixes + de-duplication)

State: DONE, merged to `main` and pushed (`e158882`), production deploy verified.
`tsc --noEmit` clean, `npm run build` clean, all 17 feed responses verified
**byte-identical** to pre-change output (A/B'd against the original code fetched at the same
moment — see "How this was verified" below).

Landed as two commits, each of which builds on its own so the history stays bisectable:
`df7ccce` de-duplication (the two new modules + every file that only changed mechanically),
then `6addf4e` the ten bug fixes (the files carrying both kinds of change).

**Deploy fingerprint worth reusing:** a green build is not proof the new code is *serving*.
Bug 3 gives a free one-request check — `GET /api/photo/team/<recId>?f=` (bare, no digits)
answers **404 on the new code and 200 on the old**, so it distinguishes "deployed" from
"Vercel still building / CDN still serving the previous edge response" without a redeploy.
Post-merge production check: all 6 spot-checked feeds 200 with sane counts (team 27,
life-science 38, event-room-presenters 38, all-speakers 304, speakers 312).

### Bugs fixed

1. **`lib/eventrooms.ts` — `fetchRoomAssignments()` read only the first page.** It set
   `pageSize=100` and ignored Airtable's `offset`, unlike every other fetch in the repo. The
   moment marketing assigns a 101st person to an event room, that person silently loses their
   room label and falls back to the hosting partner's name. Now paginated.
2. **Embed snippets reported an outage as an empty roster.** `fetch(...).then(r=>r.json())`
   with no `r.ok` check: a 429 (rate limit) or 502 (Airtable down) still returns valid JSON,
   just `{error:...}` with no list — which fell through to the empty-list branch, so
   techbbq.dk announced **"Nobody to show yet."** / **"Program coming soon."** during an
   outage. Both `lib/embedSnippet.ts` and `lib/agendaSnippet.ts` now throw on `!r.ok` and hit
   the existing "Could not load right now." path.
3. **`/api/photo` accepted a bare `?f=`.** `Number("")` is `0`, so `?f=` (and `?f=%20`) passed
   the `Number.isInteger` check and pinned attachment **field 0** — on `/speakers` that means
   "Picture" only, silently skipping the "Headshots For marketing?" fallback. Now digits-only.
4. **`lib/rate-limit.ts` — the per-IP bucket map never evicted.** Unbounded growth keyed by
   client IP on a long-lived instance. Sweeps expired buckets once a minute, on write.
5. **`cached()` had no in-flight de-duplication.** N concurrent misses on a cold key each ran
   the loader; `/api/all-speakers` fans out to five sources at once, which is the easiest way
   to trip Airtable's 5 req/s limit. Now single-flight, plus a 10s negative cache so an
   upstream outage isn't hammered by every request.
6. **`lib/airtable.ts` — dead ternary:** `res.status === 401 || res.status === 403 ? 502 : 502`.
   Both branches identical. Replaced with a plain 502 + a comment on why the real status is
   deliberately not echoed.
7. **`lib/eventrooms.ts` — `roomFromHost()` reverse substring match had no floor.**
   `key.includes(h)` meant a 1–2 char host would match ("fbv".includes("f")). Floor of 4.
8. **`lib/photo.ts` — `resolveSignedUrl()` now re-validates the record id** against
   `^rec[A-Za-z0-9]{14}$` itself. The route already checks it, but the value is interpolated
   into a `filterByFormula` string and the function is exported — it must not rely on its
   caller's diligence.
9. **`lib/team.ts` — a comment on `email` claimed "ONLY populated for the internal, auth-gated
   feed. Never public."** That is simply wrong and contradicted the file's own SAFE_FIELDS
   note: `/api/team` IS in middleware's `PUBLIC_PATHS` and the team embed renders these as
   mailto links on techbbq.dk (deliberate product decision). Corrected, because a future
   reader trusting it could make a bad security call in either direction.
10. **`lib/embedSnippet.ts` — the non-tab `fill()` only ever HID the Load-more button**, never
    re-showed it; re-showing after a department filter relied on the click handler remembering
    to un-hide it first. Now authoritative both ways, matching tab-mode's `fill()`.

### De-duplication (the "bad code" pass)

Two new modules, no behaviour change:

- **`lib/fields.ts`** — `str` / `num` / `numOrNull` / `firstPhoto` / `firstTag` /
  `linkedinUrl` / `escFormula`. These were genuinely identical private copies in each feed
  lib: **15 copies of `str()`, 11 of `firstPhoto()`**. A fix to one (the mobile-LinkedIn
  normalization was the last) had to be remembered 15 times. Per-feed `mapRecord()` functions
  stay put — those really do differ per table.
- **`lib/apiRoute.ts`** — `withCors` / `corsPreflight` / `clientIp` / `tooManyRequests` /
  `errorResponse` / `FEED_CACHE_CONTROL` / `DAILY_CACHE_CONTROL`. **13 route files** repeated
  the same CORS block, OPTIONS handler, `x-forwarded-for` dance and 429 body verbatim.
  Deliberate absentee: **`/api/tito-lookup` uses none of it** — it returns attendee PII, is
  password-gated and must never grow CORS headers.

### How this was verified (repeat this before trusting a refactor here)

Snapshot all 17 responses (13 feeds + `?role=`, `?department=`, `?event=` variants), make the
changes, re-fetch, diff. Four feeds differed — so the changes were `git stash`ed, the server
restarted on the ORIGINAL code, and those four re-fetched: **identical to the new output**.
The deltas were live Airtable edits during the session (a new investor, a new Life Science
speaker, a junk event-room row deleted), not regressions. Both snippet builders were also
transpiled standalone and all 7 option variants `new vm.Script()`-parsed.

### Not changed (deliberate)

- `hierarchy: number` typed as `number` while holding `Infinity` in niss/investors. It's a
  type lie, but `JSON.stringify(Infinity)` is `null` and every client tests
  `typeof x.hierarchy === "number"` — so the behaviour is correct and changing it risks the
  ordering. `numOrNull()` exists in `lib/fields.ts` if this is ever cleaned up.
- `TITO_API_TOKEN` is absent from `.env.local`, so `/lookup` answers 503 locally. Add the
  token to test attendee lookup.

## Session 2026-07-31 (Photo proxy: fix every embed's 410ing images)

State: DONE. Commit `95a213c` pushed, deployed, and verified in production (one photo per
feed streams 200 + real bytes from airtable-woad.vercel.app).

**Why every photo on techbbq.dk broke:** Airtable attachment URLs (airtableusercontent.com)
are SIGNED and die with **410 Gone ~2h after issue**. The feeds' JSON is cached (1h memory +
`s-maxage=3600` + `stale-while-revalidate=86400`), so the raw URLs routinely outlived their
signature — worst case the CDN served day-old JSON pointing at long-dead images.

**Fix:** feeds now emit a stable proxy URL instead of the raw attachment URL:

- `lib/photo.ts` — `PHOTO_SOURCES` registry (feed key → table + attachment fields, priority
  order) + `photoUrl(feed, recId, fieldIndex?)`. Resolves fresh signed URLs on demand via the
  LIST endpoint + `RECORD_ID()` filter so the `fields[]` allow-list applies (single-record GET
  can't restrict fields — would pull PII onto the server). Signed-URL lookups cached 45 min
  (well inside the 2h window).
- `app/api/photo/[feed]/[id]/route.ts` — streams the bytes. On upstream 410/403 it
  invalidates + re-resolves once. `Cache-Control: max-age=86400, s-maxage=604800, swr=30d`.
  Rejects unknown feeds, malformed record ids (`^rec[A-Za-z0-9]{14}$`), bad `?f=` → 404.
- All 11 Airtable-backed libs emit `photoUrl(...)` (presence still checked via `firstPhoto`).
  Event-room slot photos pin their exact field with `?f=<index>` (slots 0–4, overflow = 5).
- `middleware.ts` — `/api/photo/` added as the one PUBLIC **prefix** (dynamic route can't be
  an exact path; trailing slash keeps it from shadowing future siblings).

### Gotchas
- **Base URL**: `photoUrl` builds absolute URLs from `PUBLIC_BASE_URL` →
  `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` → relative (local dev). WordPress consumes the
  JSON cross-origin, so absolute matters; on a future custom domain set `PUBLIC_BASE_URL`.
- **Supabase photos were never the problem**: speakers-2026/all-speakers hub photos are
  `/storage/v1/object/public/` — permanent, left untouched. Only 2 of 181 rows there (the
  summit-extras people) go through the proxy.
- **Photo swaps take up to a day** to show (browser 1d, CDN 7d with background refresh).
  A redeploy clears the CDN instantly if it matters for a launch.
- `lib/sync.ts` is unaffected: it only uploads Supabase-hosted (http) photo URLs, and
  summit-extras people already exist in the marketing table so they're never re-uploaded.
- WordPress needed NO changes — embeds render whatever `photo` URL the JSON carries.

## Session 2026-07-30i (Life Science: stage labels + always-random order)

State: DONE. `tsc --noEmit` + `npm run build` clean, verified on the page AND in the executed
embed snippet. Committed + pushed 2026-07-30.

**Stage under each photo, coloured per stage.** Field `Which LS DT stage? ` — **trailing space
is real**, same trap as `Hierarchy ` / `Role ` in this base. Two options, both present in the
`Speakers Library 2026` view (34 people):
- `Life Science x Deep Tech Stage` → green **#5CBC8B** (31)
- `Deep Tech Event Day` → blue **#2BB4E1** (3)

`lib/lifescience.ts` maps it to **`tag` + `tagColor`** rather than new field names, because the
Elementor snippet already renders `tag` directly under the photo — it only had to learn the
colour (`s.tagColor` → inline `color`, falls back to brand orange when absent, so every other
feed using `tag` is unaffected). Page renders `.s-card__stage` (10px, uppercase, inline colour,
no leading dot so it never reads as the `.s-card__role` badge). Label size settled at **10px /
700** after two passes (8.5px was too small) — kept in step in BOTH places.

**Shared-style consequence:** `.tbbq-card__tag` is used by other embeds too, so the All Speakers
2026 room labels and the Fintech tags are now 10px uppercase as well (were 12px). Only reaches
techbbq.dk when those embeds are re-copied. Split the rule if the speaker tags should stay 12px.

**Random order at all times** (Auri's rule): mount-seeded shuffle on the page + `shuffle` on the
CopyEmbed. Kept client-side ON PURPOSE — the API response is cached 1h, so a server-side shuffle
would freeze one "random" order for every visitor for an hour. The lib's alphabetical sort stays
as a stable base underneath.

### Gotchas
- **`LS Type` is empty for all 34 people**, so the existing `.s-card__role` badge renders
  nothing on this page. Data, not code — fill it in Airtable if that badge is wanted.
- Nobody is on both stages today; if that changes, the FIRST value wins rather than printing a
  joined string into a 10px label.
- This table is wide and slow: a python fetch of the view timed out at 2 minutes while curl
  returned in 1s. Prefer curl with `-m` when poking at it.

### Next steps
1. **Re-copy the Life Science embed** from the deployed dashboard (stage colours + shuffle are
   snippet-side).
3. Still open: `TITO_API_TOKEN` + `BRELLA_API_KEY` in Vercel; team embed re-copy;
   Director/Lead titles as heads of department?; `/api/team` has no retry.

## Session 2026-07-30h (Team embed: mobile fixes)

State: DONE. `tsc --noEmit` + `npm run build` clean, verified inside a 400px iframe.
Committed + pushed 2026-07-30.

**1. Department pills were a giant ellipse on mobile.** 10 pills wrapped onto 5 lines inside a
container with `border-radius:9999px` — on a tall box that renders as a circle. Fixes in
`lib/embedSnippet.ts`: radius `22px` (identical to a pill for one 36px row, a rounded rect when
wrapped) and a mobile block that makes the strip ONE swipeable line — `flex-wrap:nowrap`,
`overflow-x:auto`, scroll-snap, hidden scrollbar, and `justify-content:flex-start` (a CENTERED
overflowing strip clips its first pills with no way to scroll back to them).

**2. Mobile rows were three squashed columns — a regression from 30f.** Moving the mailto
outside the LinkedIn anchor (to fix the nested-`<a>` bug) made it a SIBLING of the photo+text
wrapper, and in rows mode the card itself is the flex row, so the email became a third column.
Now: `.tbbq-rows .tbbq-card{display:block}`, the inner wrapper is the flex row, and
`.tbbq-card__mail` is indented `98px` (84px photo + 14px gap) so the address lines up under the
name, not under the photo.

**3. Also fixed: people with no LinkedIn had no wrapper element at all**, so their photo and
text were separate flex children and their row broke on its own. New `wrapRow()` always wraps
the row — an `<a>` when there is a LinkedIn URL, a `.tbbq-card__row` div when there isn't.

### Gotchas learned while verifying this
- `resize_window` reported success but `innerWidth` stayed 2560, so media queries never fired
  and mobile CSS looked untested. **Inject the snippet into a 400px `<iframe>` instead** — an
  iframe has its own viewport, so media queries resolve correctly.
- The browser tab wedged (CDP `Runtime.evaluate` timeouts, 3 in a row) while the dev server was
  answering in 0.18s. It was the tab, not the code; a fresh tab fixed it. Check server health
  with curl before debugging the app.

### Next steps
1. **Re-copy the team embed** from the deployed dashboard — mobile stays broken on techbbq.dk
   until then.
2. Still open: `TITO_API_TOKEN` + `BRELLA_API_KEY` in Vercel; Director/Lead titles as heads of
   department?; `/api/team` has no retry.

## Session 2026-07-30g (Team embed: forced styles + department pills)

State: DONE. `tsc --noEmit` + `npm run build` clean, verified by EXECUTING the copied snippet
and reading computed styles. Committed + pushed 2026-07-30.

**1. Email styling forced.** On techbbq.dk the theme was overriding the mailto: WordPress
themes style every `<a>` globally. `.tbbq-card__mail a` rules are now `!important` AND scoped
through the embed's own `#uid`, covering `:link/:visited/:hover/:focus`, and resetting `background`,
`padding`, `border`, `box-shadow`, `text-transform`, `font-*` — not just colour and underline.
Verified computed: `underline`, `rgba(255,255,255,0.72)`.

**2. Centered department pills in the EMBED** (they only existed on the dashboard page).
New `deptTabs?: string[]` option in `lib/embedSnippet.ts` — different from `tabs`, which needs a
multi-group endpoint; this filters ONE flat list client-side on `s.department`.
- Pills are built from the DATA: a department with nobody in it gets no pill, unexpected
  Airtable values are appended rather than dropped, and the row is skipped entirely if only
  one department is present.
- Filtering preserves the computed order, so the leadership block stays on top inside a tab.
- Passed only on the All copy (`deptTabs={active === TABS_ALL ? DEPARTMENT_ORDER : undefined}`):
  a single-department embed has nothing to filter.
- Verified in the executed snippet: 10 pills centered, All 27 → Management 6 → Finance 1 → All 27.

**Gotcha worth remembering:** the pill styles are shared with tab mode and are now `#id`-scoped
+ `!important` on every property a theme touches (background, border, radius, width,
letter-spacing, text-transform, box-shadow). Themes restyle `<button>` harder than `<a>` — the
pills were rendering as theme buttons.

### Next steps
1. **Re-copy the team embed** from the deployed dashboard — nothing here reaches techbbq.dk
   until then.
2. Still open: `TITO_API_TOKEN` + `BRELLA_API_KEY` in Vercel; Director/Lead titles as heads of
   department?; `/api/team` has no retry.

## Session 2026-07-30f (Team embed: emails, no Load more, per-person photo crop)

State: DONE. `tsc --noEmit` + `npm run build` clean, verified by EXECUTING the copied snippet
(not by string-matching it). Committed + pushed 2026-07-30.

**1. No Load more on the team embed.** `loadMore={false}` on the team `CopyEmbed` only — all 27
render at once (snippet emits `STEP = 1000000`, `LOADMORE = false`). Every other feed keeps
20-at-a-time; it still matters for 179 speakers.

**2. Emails were missing from the EMBED, not the data.** All 27 addresses were already in
Airtable, in `/api/team` and on the dashboard page. `lib/embedSnippet.ts` simply had no email
support, so techbbq.dk showed name + title only. New `email?: boolean` option (default FALSE so
no speaker feed can start printing addresses by accident), threaded through `CopyEmbed`, enabled
on team. Renders `.tbbq-card__mail` with a mailto.

**3. Per-person photo crop.** `PHOTO_FOCUS_Y` in `lib/team.ts` maps a normalized name to an
`object-position` Y percentage; the feed exposes it as `focus` ("40%"), and both the page
(`TeamPhoto` inline style) and the snippet (`s.focus` → inline style on the img) honour it.
Default stays the stylesheet's `50% 30%`.
- Asked for higher → **40%**: Andrei Ratcu, Marie-Louise Nielsen, Alev Burcin Aydin Jensen.
- Asked for lower → **20%**: Charlotte Esmann, Stephan Evon.
- **Direction, verified empirically** (rendered one photo at 20/30/40 side by side rather than
  reasoning about it): a BIGGER Y moves the subject UP in the frame. Getting this backwards
  would move every face the wrong way.
- Hand-maintained like `PINNED_AFTER_HEADS` — no crop field exists in Airtable. Values are
  tuned to the SPECIFIC image, so re-check one if someone swaps their photo.

### Bug introduced and caught in the same session
The mailto started out INSIDE the card's LinkedIn `<a>`. An anchor inside an anchor is invalid:
the browser silently splits the card, which showed up as **54 mailto links for 27 people**, and
an email click could have followed the outer LinkedIn href. The mail block now sits after the
linked region (`body+mail` inside the `<article>`), with its own horizontal padding to line up
with the body text. Re-verified: 27 cards, 27 mailto links, no nesting.
Lesson: string-matching a generated snippet would have passed this. Execute it.

### Next steps
1. **Re-copy the team embed** from the deployed dashboard — none of this reaches techbbq.dk
   until then (pasted snippets never self-update).
3. Still open: `TITO_API_TOKEN` + `BRELLA_API_KEY` in Vercel; decide whether Director/Lead
   titles count as heads of department; `/api/team` still has no retry.

## Session 2026-07-30e (Team: LTV gate, leadership order, daily refresh)

State: works locally, `tsc --noEmit` + `npm run build` clean. Committed + pushed 2026-07-30.

**1. Long term volunteers off the team list.** `#TechBBCuties` has an `LTV` singleSelect
(YES/NO) = long term volunteer. The gate in `lib/team.ts` is now Active + not Archive +
`{LTV}!='YES'`. 28 → 27 people; the only row it removes is Lennert Jessen (AI & Automation
Intern, the single YES). Every LTV=NO person was already listed, so this ADDS nobody.
Implemented as **exclude YES, not require NO**: today it makes no difference (27 NO, 1 YES,
0 blank), but under require-NO a new hire whose LTV nobody set would silently vanish from
the team page. Blank means "not marked a volunteer", so they stay listed.

**2. "All" is one flat grid, chiefs first, rest random** (Auri's rule). Department sections
and headings only render when a specific department tab is picked.
- `lib/team.ts` derives a `hierarchy` per member from the job TITLE (1 = CEO, 2 = any other
  chief, null = everyone else). Named `hierarchy` on purpose: the page and
  `lib/embedSnippet.ts` already shuffle-while-pinning anyone with a numeric hierarchy, so
  this needed no new ordering code in either place. There is no rank column in Airtable to
  maintain. `CopyEmbed` gets `shuffle` on the All tab → **the team embed needs a RE-COPY**
  from the deployed dashboard, pasted snippets never self-update.
- Page shuffle is the standard mount-seeded LCG, so tab switches and SWR revalidation can't
  reshuffle mid-view; a refresh re-rolls.

**3. Leadership tiers.** `leadershipRank(name, title)` in `lib/team.ts` derives the order from
the job TITLE, since there is no rank column in Airtable:
- `1` CEO — Avnit Singh
- `2` other chiefs (4: Benjamin Notlev, Jutta Ruusunen, Sadia Beg, Thomas Ebdrup)
- `3` **heads of department** (7), directly after the chiefs (Auri's rule)
- `4` `PINNED_AFTER_HEADS` — a hand-maintained NAME list Auri asked for: Alev Burcin Aydin
  Jensen, Andrei Ratcu, Marie-Louise Nielsen. They land at positions 13-15.
- `null` the remaining 12, random.
Ties shuffle among themselves so nobody is permanently above their peers.
**Line deliberately NOT crossed:** only "Head of …" counts as a head. Commercial Director,
Program Lead and the Senior * Managers stay unranked — promoting Director/Lead titles is
Auri's call, not a guess. If the pin list grows past a handful, add a number field to
Airtable and read that instead of maintaining names in code.

**4. Team refreshes ONCE A DAY** (Auri's rule), everything else stays hourly. `cached()` now
takes a per-call `ttlMs` (default still 1h) and `/api/team` passes the new `DAY_MS`; the route's
CDN header went to `s-maxage=86400, stale-while-revalidate=86400`. Consequence: an Airtable
team edit can take up to 24h to show — a deploy (empty commit) resets the in-memory cache
instantly. Note the random ORDER still re-rolls per page load; only the data is daily.

### Two bugs this surfaced (both fixed)
- **"PA to CEO" ranked as a chief.** Sanne Gjedsted Sørensen was joint-top of the team page
  because her title contains "CEO". `chiefRank()` now rejects anything reporting `to` a
  chief, and any assistant/PA/EA, BEFORE the chief match. 6 false chiefs → the correct 5.
- **`Finance` was missing from the known departments** in BOTH `DEPARTMENTS` (lib/team.ts)
  and `DEPARTMENT_ORDER` (app/team/page.tsx). Stephan Evon (Head of Finance) was bucketed
  into a catch-all "Other" tab and `?department=Finance` was silently rejected by the route
  and served as "all". Added to both. Keep the two lists in step with Airtable's Department
  select — a real department missing from them fails this exact way, silently.

### Also worth knowing
- `/api/team` timed out once during this session (ABORT_ERR = the 8s `fetchWithTimeout`
  budget against Airtable's wide-table scan, not a code fault; retries were clean). Unlike
  the hierarchy and summit-extras fetches, `lib/team.ts` has **no retry** — if the team page
  fails intermittently in prod, give it the same 10s + one retry treatment.

### Next steps
1. Re-copy the **team** embed from the deployed dashboard so techbbq.dk gets the
   leadership-first random order.
3. Still outstanding from earlier sessions: set `TITO_API_TOKEN` and `BRELLA_API_KEY` in
   Vercel (both fail closed; /lookup 503s and the default /program tab 503s without them),
   and re-copy the All Speakers 2026 + Fintech/NISS agenda embeds.

## Session 2026-07-30d (Airtable check-in routine + grouped nav + scroll styling)

**1. Airtable check-in routine.** Some Airtable tables are inboxes other people file rows
into, and opening each view by hand is the thing that gets skipped.
- `scripts/checkin.mjs` — READ-ONLY, config-driven. Three modes: plain report, `--json` for
  an agent, `--hook` for the session hook. Adding a table = one entry in `WATCHES`
  (table id, view id, fields to read, a `needsAction` rule, a `missing` rule for the cells
  Auri has to fill). Each watch ranks EITHER by deadline or by age (`waitingSince`).
- `.claude/settings.json` — SessionStart hook `node scripts/checkin.mjs --hook`, 25s timeout,
  so every session in this repo opens with what is waiting. **It can never break a session**:
  no `.env.local`, no token, no network → prints `{"suppressOutput":true}` and exits 0
  (verified by running the script from a directory with no `.env.local`). Silent when nothing
  is outstanding. NOTE: Claude Code only watches `.claude/` for settings that existed at
  session start, so the hook goes live in the NEXT session (or after opening `/hooks`).
- `.claude/commands/checkin.md` — `/checkin` for running it mid-session.
- Watch 1: **Prints 2026** (`tbluSfDoEXnvOquvE` / `viwds5x6kwU2Mg1hP`), rule = Status != Done.
- Watch 2: **Partner Deliverables 2026** (`tblTecOBecLQCNIeD` / `viw7FVbsTb9IRaWF0`), rule =
  `Put on web` unchecked. Two findings: the signal is the **`Put on web` checkbox** (the older
  `Logo website status` select is blank on all 120 rows — a rule built on it reports zero
  forever), and the name lives in **`Company`**, not `Organization name - partner logos`
  (empty on exactly these form-submitted rows). `Contact Name`/`Contact Email` are partner PII
  and deliberately NOT in the field allow-list.
- Bug caught in testing: `Submitted` is a full timestamp, not a date. `daysUntil` returned
  null, unary minus turned it into `-0`, and every row read "waiting 0d". `daysUntil` now
  slices to the date part and `daysSince` guards the null separately.
- Standing at the time: 5 prints open (4 overdue), 7 partners not on web. InvestEU appears
  TWICE (same Partner ID 1438, tiers Prime and Challenger) — one is wrong, resolve before
  publishing.

**2. Grouped TopNav** (Auri's ask). Four labelled groups: Speakers · Projects (Life Science,
NISS 2026, NASS 2026, Fintech Speakers, NISS 2025) · Investors (all + LP Forum + TechBBQ
Investor Day + Pension & Insurance Summit, deep-linked as `/investors?event=…`) · Program &
internal. Sticky group headings, capped height, `overscroll-behavior: contain`.

**Two bugs from the same root cause — Next does NOT remount on a query-only navigation:**
- `/investors` kept tab state in `useState` seeded by a mount-only effect, so clicking an
  investor event from the nav changed the URL while the page still showed the previous event.
  Fixed by making the URL the single source of truth (`useSearchParams` + `router.replace`),
  no local tab state. Back button works now too.
- `TopNav`'s trigger label went stale the same way. Same fix.
- Both need a Suspense boundary (`useSearchParams` on a prerendered page). `TopNav` provides
  its own internally so no page inherits the requirement.
- **The deep link worked on the first try; only navigating BETWEEN events was broken.**
  Testing one link would have shipped both bugs.

**3. Scroll styling.** Thin rounded pill thumb (`#2a2a2a`, transparent track, inset via a
transparent border + `background-clip: padding-box`), lighter on hover, brand orange while
dragging. Both `scrollbar-color` (Firefox) and `::-webkit-scrollbar` declared. `scroll-behavior:
smooth` with a `prefers-reduced-motion` opt-out.

## Session 2026-07-30c (Brella program as a /program source)

State: works end to end locally, `tsc --noEmit` + `npm run build` clean. Committed + pushed
2026-07-30. **`BRELLA_API_KEY` must be set in Vercel** or the default /program tab 503s.

The Airtable "Program 2026" table is still near-empty; the REAL TechBBQ 2026 schedule lives
in Brella. So Brella is now a program source and the DEFAULT tab on /program.

- `lib/brellaprogram.ts` — read-only GET of `organizations/109/events/10356/timeslots?page[size]=500`.
  One call also returns tracks, tags and speaker-assignments via `included`. Maps onto the
  existing `ProgramSession` shape, so the /program page and the agenda embed needed no
  changes beyond a tab.
- `lib/program.ts` — `PROGRAM_SOURCES` is now a discriminated union (`kind: "airtable" | "brella"`);
  `fetchProgram` dispatches, dynamically importing the Brella lib and re-wrapping
  `BrellaError` as `ProgramError`. Existing Airtable sources gained `kind: "airtable"`.
- `app/program/page.tsx` — tabs are now "TechBBQ 2026 (Brella)" (default) · "TechBBQ 2026
  (Airtable)" · NISS · Fintech.
- Env key renamed `BRELLA` → `BRELLA_API_KEY` in `.env.local` (the lib still accepts bare
  `BRELLA` as a fallback) and documented in `.env.example`.

**Mapping decisions (all in the lib, all commented):**
- **80 timeslots → 30 published sessions.** 50 are untitled 15-minute networking rows on the
  "1:1 meetings" track. Filtered by both the no-title rule and the track name.
- **Times are UTC in Brella**, converted to Europe/Copenhagen via `Intl` (08:00Z → 10:00).
  This also means the three "2026-08-25T22:00Z" side-event rows are really 26 Aug local, so
  the program is 2 days: Day 1 · 26 August (17) and Day 2 · 27 August (13).
- **Day labels are derived** — Brella has no Day field. Distinct local dates are numbered
  ("Day 1 · 26 August") so they still sort by `localeCompare` like the Airtable sources.
- **Duration ≥ 360 min → "All day"** rather than printing "00:00 - 12:00" for a side-event promo.
- **track → `room`** (the stage: Founders Stage, Blue/Green/Orange Grill Session, Event Room
  1/2/4, Rooms 5,6,7, Future of FinTech, Side Event Promotion). **first non-room tag → `type`**
  (the topic: AI, DeepTech, Life Science…). Tags also hold hall labels, so `ROOMISH_TAG`
  skips those when picking a topic.
- **Emoji stripped from track/tag names.** Brella's admin names them "⭐ Founders Stage" and
  those strings become labels on techbbq.dk. DESIGN.md r1, enforced in `label()`.
- **`content` is Draft.js block JSON**, flattened to plain text (23 of 30 have one), with
  Brella's `subtitle` leading it. No entity maps exist in the data, so no link URLs are being
  lost — the "LINK TO REGISTER" wording in two side-event descriptions is literal text
  someone typed, with no href anywhere in the API.

**Not carried over:** speaker names. Only 2 of 30 sessions have speaker-assignments in
Brella, so a "Speakers:" line would be blank almost everywhere. Some descriptions list
presenters as free text instead.

### Airtable cleanups this created
- **Delete the "Meeting with Auri" test session in Brella** (Day 1, 00:00-01:00, Founders
  Stage, "Some random talk with this random dude"). It is a real published session as far as
  the feed is concerned and would appear on techbbq.dk. Not filtered in code on purpose:
  hardcoding a person's name to hide a row is the kind of thing nobody remembers later.
- Two side-event descriptions end in "LINK TO REGISTER" with no link. Either add the URL in
  Brella or drop the line.

## Session 2026-07-30b (Tito ticket lookup + Brella API recon)

State: works end to end locally, `tsc --noEmit` + `npm run build` clean. Committed + pushed
2026-07-30. **`TITO_API_TOKEN` must be set in Vercel**, else /lookup returns 503 in prod
(fails closed on purpose).

### Tito ticket lookup — the first non-public feature in this repo

Purpose (Auri): someone emails asking to change the name on their ticket or reassign it,
and we need to see whether that person actually has one. Search by email, name or company;
Tito's own `search[q]` spans all three.

- `lib/tito.ts` — searches 4 events in parallel (`2026`, `lp-forum-2026`, `lp-dinner-2026`,
  `investor-dinner-2026`; `TITO_EVENTS` is the list to extend). Auth `Authorization: Token
  token=<key>`, base `https://api.tito.io/v3/techbbq/<event>/tickets`. Passes all 7
  `search[states][]` so void/archived tickets appear (Tito hides them by default, and a
  silent omission reads as "no ticket"). 25 hits per event, 12s timeout each,
  `Promise.allSettled` so one dead event degrades and is reported; all-dead = 502, never
  an empty "no ticket found".
- `app/api/tito-lookup/route.ts` — **deliberately NOT in middleware's `PUBLIC_PATHS`**, so
  the dashboard password applies. No CORS headers, `Cache-Control: no-store`, nothing
  cached, min 3 / max 120 chars, rate-limited. Nothing about the query or the people found
  is ever logged.
- `app/lookup/page.tsx` + `.lk-*` styles — one card per ticket: name, email, company,
  event, ticket type, reference, **who bought it** (often the answer to "I never got a
  confirmation"), a plain-English state line, and "can they edit it" derived from
  `changes_locked` + void/archived. Links to the ticket's `unique_url`, which is usually
  the whole fix: the holder renames or reassigns it themselves, no admin needed.
  Deliberately does NOT use `useCachedList` — no attendee PII in localStorage (verified).
- Only marketing-safe-ish fields are mapped. `phone_number`, `price`, `discount_code_used`
  and `metadata` are never read, so they cannot leak into a response.

Verified: `q=klak.is` → 10 tickets across TechBBQ 2026, correct states/badges; `q=ab` → 400;
no CORS header; `no-store` present; prod gating mechanism confirmed (`/team` 401 while
`/api/speakers-2026` 200); browser localStorage holds no ticket data.

Live Tito numbers (2026-07-30): TechBBQ 2026 = 1,774 visible tickets (1,850 overall, 76
void/archived hidden by default) · LP Forum 99 · LP Dinner 16 · Investor Dinner 22.

### Brella API recon — the July "no write API" finding is WRONG

Org `109`, event `10356` = TechBBQ 2026 (slug `techbbq2026`). Key in `.env.local` as
`BRELLA` (note: written `BRELLA = value` with spaces; dotenv trims it, bash `source` would
not). Base `https://api.brella.io/api/integration`, headers `Brella-API-Access-Token: <key>`
+ `Accept: application/vnd.brella.v4+json`. Docs: developer.brella.io.

The REST API DOES expose create/update/delete for **speakers, sponsors and timeslots**,
plus speaker↔timeslot assignment and REST-managed webhooks. The 2026-07-08 conclusion
("no Create Sponsor API, CSV import is the only path") was true for Zapier only. So the
annual manual sponsor CSV import and manual speaker entry are both automatable.

Inventory of event 10356: **147 speakers** (140 with bios, 146 with photos, **0 with an
external_id**) · 260 sponsors (looks like last year's carry-over) · 78 timeslots · 1,305
invites (Brella already ingests Tito) · 5 attendees.

**44 people are on techbbq.dk but NOT in Brella** (Aditi Mishra, Aileen Lee, Aino Bergius,
Ben Choi, Carlo Biggio, Christina Grumstrup Sørensen…); 12 are in Brella but not on the
site, several of those being malformed rows with the full name in `first-name` and
`last-name` empty.

Gotchas for whoever builds the sync: nothing has an `external_id`, so run one has to match
on normalized name and then write our id into `external_id`; `external_id` is **not** an
upsert (docs describe find-then-update as two calls), so a blind POST creates duplicates in
the live attendee app; speaker `bio` comes back as DraftJS block JSON on read but is
accepted as a plain rich-text string on write.

Auri's steer this session: **Airtable is the main system, Brella is not** — recon only,
no Brella code written.

### Next steps
1. Add `TITO_API_TOKEN` to Vercel (and confirm `DASHBOARD_PASSWORD` is set there), then
   commit + push. /lookup must never become public.
2. Optional: same lookup over Brella invites, so one search answers "ticket in Tito, and
   are they in the app".
3. Brella speaker sync (44 missing) — only if Auri asks. Dry-run-by-default script like
   `scripts/populate-eventroom2.mjs`.

## Session 2026-07-30 (Airtable Bio override + Speakers tail shuffle — LIVE)

State: DONE. Commit `805b451` on main, deployed and prod-verified (Jacob's bio serves from
the live feed; ranked top 30 hold while the tail re-rolls across loads).

**1. Bio now overridable from Airtable.** Jacob Lauritzen's card said "TBD" because bios
come from the Supabase Speaker Hub (self-service) and the connector can only read it.
The Marketing Project Overview table already had an unused `Bio` multilineText column —
`lib/hierarchy.ts` now reads it in the same call as `Hierarchy` (so no extra Airtable
round-trip) and returns `Map<name, {rank?, bio?}>`; `lib/hub.ts` applies `row.bio` over
the Hub biography when filled. Placeholder bios ("TBD"/"TBA"/"n/a"/"-"/"."/empty →
`isPlaceholderBio`) are treated as no bio, so an un-overridden card shows the
"No description available yet." line instead of publishing the word. Works for the
Airtable-only extras (Ken Villum Klausen, Caspar Hoegh) too — fill their Bio cell and
they get one. Fixed Jacob's cell: it already held the sentence minus its first letter
("acob Lauritzen serves as the CTO at Legora…").
Still bio-less after this: Nour Alnuaimi (had "."), Ken Villum Klausen, Caspar Hoegh.

**2. Speakers group randomizes its tail.** Hierarchy 1..30 stay pinned in Airtable order,
everyone after them re-rolls per page load (was alphabetical). Two places, because the
page and the pasted snippet each order the list: `app/all-speakers-2026/page.tsx`
(ranked/unranked split, shared shuffle helper — Event Room reuses it) and
`lib/embedSnippet.ts` (**tabs-mode shuffle had NO hierarchy exemption** — flagging the
Speakers tab without fixing that would have scrambled the curated 30; it now mirrors the
non-tabs branch). `EMBED_TABS` speakers gets `shuffle: true`.
Verified: two loads → identical first 30, different tail; the real copied snippet run
against 30-ranked + 50-unranked kept the ranked order, shuffled the 50, lost nobody.

### Next steps
1. Commit + push (branch off main first), let Vercel deploy, then **RE-COPY the All
   Speakers 2026 embed** from the deployed dashboard into Elementor — pasted snippets
   never self-update, so the tail shuffle only reaches techbbq.dk after a re-copy.
2. Tell marketing the `Bio` column in Marketing Project Overview is now live on the
   website for "TechBBQ Summit" rows.
3. Feeds cache 1h — an empty commit / redeploy flushes it if an Airtable edit must show
   up immediately. The page's localStorage cache paints the old bio once, then heals.

## Session 2026-07-29 (All Speakers 2026, Programs, Fintech — 20 rounds, ALL LIVE)

State: DONE and prod-verified after every round (last commit `b89f6f0`). Everything
below auto-deployed from main to airtable-woad.vercel.app. Dev server left on :3001
(:3000 held by an older orphaned next process). Round-by-round detail: git log of this
file for 2026-07-29.

### What exists now (the day's net result)

**1. All Speakers 2026** — page `/all-speakers-2026` + ONE tabbed Elementor embed.
- Feed `/api/all-speakers` returns `{counts, groups: {speakers, eventRoom, investors}}`
  in one response (Promise.allSettled over the per-source caches; one dead source
  degrades to [], all-dead = 502).
- Groups: **Speakers** = Speaker Hub + Airtable-only "TechBBQ Summit" rows (176; bio
  pop-up on click, modal like /speakers-2026) · **Event Room Speakers** = NISS + NASS
  (role "Speaker" ONLY) + partner form presenters + Danish Entrepreneurs overflow,
  deduped, shuffled per load, no bios → cards link to LinkedIn · **Investor Speakers**
  = Pension Summit + LP Forum + Investor Day (33).
- Event Room tags = the ROOM: "Event Room 2" for NISS+NASS (per the planning sheet;
  Auri confirmed vs his "room one" wording), partner presenters via person-level
  marketing rows ("Event Room N" Project Name, joined by normName) → HOST_ROOMS map in
  `lib/eventrooms.ts` (1=Erhvervshus+Boardway, 3=Flatpay+FBV, 4=Microsoft, 5=CBN) →
  host company name as fallback (Danish Entrepreneurs' 26, room unknown).
- Embed tab mode (`tabs` option in `lib/embedSnippet.ts`): centered pill switcher,
  per-tab `shuffle` + `modal` flags, `.tbbq-card__tag` labels.

**2. Programs** — page `/program` + per-event agenda embeds (`lib/agendaSnippet.ts`).
- Multi-source `lib/program.ts` (`PROGRAM_SOURCES` map): **techbbq** = new "Program
  2026" table `tblI4IW0b3sLxNWgz` (Day/Time Slot/Type/Description/Event Room; 3 SAMPLE
  rows to delete) · **niss** = NISS table view `viwMqDT1GMW7AwOtQ` (15 sessions,
  opt-out gate `Should be On Website`="NO") · **fintech** = Fintech table view
  `viw0mk6kOUKxNqgzU` (8 sessions). `/api/program?event=…`. Publish rule: Session Name
  + Time Slot (+ Day where the source has one). Sorted day → parsed start time.
- Agenda embed design (Auri's mocks): glow border, big date heading, note pill,
  uppercase outlined tags (ONE color per theme, dim variants removed), per-type Lucide
  icons, `bigOpening` big title on type "Opening". Options: `heading`, `note`,
  `theme: "orange" | "blue"`, `icons`, `bigOpening`; CSS scoped per uid. NISS = orange
  + "August 26th" + tickets note; Fintech = blue on #111827, no icons, no bigOpening.
- Adding another event's program = one PROGRAM_SOURCES entry + one EVENTS entry in
  `app/program/page.tsx`.

**3. Fintech speakers** — page `/fintech-speakers` + `/api/fintech-speakers`
(`lib/fintechspeakers.ts`, view `viwsqDRAVlgJh3STT`). Role "Speaker" only (keynote +
moderator excluded per Auri), curated `Hierarchy ` TEXT 1..9 order, 9 people, no
shuffle. Table holds PII (email/phone) — strict allow-list, response verified clean.
Embed passes `transparent` (new option: wrapper bg/padding/radius removed; cards sit
on the host page's background).

**4. Cross-cutting**
- TopNav is a DROPDOWN now (11 entries; trigger shows current page).
- `lib/linkedin.ts` `normalizeLinkedInUrl()` in ALL feed libs: accepts www./
  scheme-less/lnkd.in/country-subdomain, rewrites i./m./touch. mobile hosts → www.
- NISS speakers: "Brand Ambassadors" role tab (3 people, 3-per-row grid via
  `.grid-cards--3` + embed `columns={3}`; route ALLOWED_ROLES updated — it silently
  falls back to "all" for unknown roles).
- Speakers 2026 merges Airtable-only rows (`lib/summitextras.ts`: "TechBBQ Summit"
  rows not in the Hub, normName dedupe both directions). Ken Villum Klausen (name
  fixed Klause→Klausen in both rows) + Caspar Hoegh live this way.

### Airtable writes made today (data, not code)
- 46 NISS/NASS speakers created as "Event Room 2" rows in Marketing Project Overview
  (photos + LinkedIn re-ingested), Session Name set to Nordic India / Nordic Africa
  Startup Summit. Scripts (idempotent, dry-run default, `--write` to apply):
  `scripts/populate-eventroom2.mjs` + `scripts/set-eventroom2-sessions.mjs`.
- New table "Program 2026" (`tblI4IW0b3sLxNWgz`) created via Meta API + 3 sample rows.

### Next steps
1. **Auri: Danish Entrepreneurs' room number** — 26 Event Room cards still show the
   company name; one HOST_ROOMS line once known.
2. **Elementor RE-COPIES** (all snippet-side changes; always copy from the DEPLOYED
   dashboard): All Speakers 2026 · NISS agenda · Fintech agenda · Fintech speakers ·
   optionally Brand Ambassadors (select the tab first — copy follows the active
   filter).
3. **Airtable cleanups**: delete the 3 Program 2026 sample rows + the "asd" test rows
   in the marketing Event Room view; NISS time typos ("13:30-14-30", "16:30-16-50")
   and the 15:30 overlap; trim the Fintech "Opening" Session Name cell (pasted
   leftovers); retype the NISS opener "Fireside"→"Opening" for the big title; fill
   real TechBBQ program sessions.
4. Minor from auditor: /all-speakers-2026 doesn't show the "· updated" badge after
   revalidation (every other page does).
5. Parked: keynote speaker + moderator on the Fintech speakers feed (relax the Role
   filter when wanted); partner-domain CORS allow-list if an external site ever needs
   browser-side fetch (server-side fetch works for them today).

### Gotchas
- Event Room merge rules live in TWO places (page + /api/all-speakers) — keep in sync.
- 1h server cache + CDN s-maxage on every feed; any deploy resets instantly (empty
  commit works). Airtable edits lag up to an hour otherwise.
- Photo URLs in Airtable-backed feeds are signed and expire (~2h) — consumers must
  re-fetch the feed, never hot-link the URLs.
- The `Hierarchy `/`Role `/`Position at Company ` fields have TRAILING SPACES; Fintech
  `Hierarchy ` is TEXT ("1".."9" or role names). Don't "fix" the field names.
- Dev stale-compile struck repeatedly: after edits the server can serve an old bundle
  with no error — restart `next dev` and kill the node CHILD holding the port.
- Playwright MCP kept dying ("browser already in use") — kill `mcp-chrome-*`
  chrome.exe; contexts reset between evaluate calls, so capture+inject+assert must run
  in ONE evaluate. Embed verification = execute the real copied snippet, not the React
  page (caught the modalOn scope bug the fetch .catch was swallowing).

## Session 2026-07-28c (Investors: random order + Investor Day — merged to main, LIVE)

State: DONE. Commit `fb9c2df` on `investors-shuffle`, merged to main `d0b61f3`, Vercel
deployed + prod-verified (`?event=investor-day` returns 3; old deploy briefly served
the unknown param as "all", correct fail-safe). If a Pension Summit / LP Forum embed
was already pasted in Elementor, RE-COPY it from the deployed /investors so the
snippet gains the shuffle block (pasted snippets never self-update).

- **Random order on /investors** (same pattern as Speakers 2026 / NASS): mount-seeded
  Fisher-Yates on the page, `shuffle` flag on the CopyEmbed. Anyone with a numeric
  `Hierarchy` keeps that order at the top (page + embed both honor this); today everyone
  is unranked so everything shuffles. Verified: two loads, different orders.
- **Third event added: TechBBQ Investor Day** (`?event=investor-day`, tab "Investor
  Day"). 3 people (Trine Hoffensetz Winther, Johan Bøe Bjørkevoll, Tamara Savic), all
  complete. INVESTOR_EVENTS map drives the route allow-list + OR formula, so it was a
  one-line lib change + page tab.
- Data note: the Mads Krogsgaard duplicate got fixed in Airtable mid-session (LP Forum
  19 → 18, one "Mads Krogsgaard" row left). All = 28 (7 + 18 + 3).
- Gotcha hit: `next dev` (webpack, Win11) served a stale compile of the edited page —
  file on disk was new, served bundle old, no compile error. Fix = restart dev server.
  Also: TaskStop on the npm wrapper orphans the node child holding the port (next
  instance silently moves to :3002); taskkill the child PID too.

## Session 2026-07-28b (Investor speakers section — merged to main, LIVE)

State: built + verified locally (feed, tabs, browser), completion-auditor GO.
Committed `1f4f3e1`, merged to main `477df54`, deployed + prod-verified (26/7/19).

- **New feed `/api/investor-speakers`** (`lib/investors.ts` + route). Source: Marketing
  Project Overview (`tblTecOBecLQCNIeD`, same table as main-speakers/hierarchy), rows
  with `Project Name` = "European Growth Pension & Insurance Summit" OR "LP Forum".
  `?event=pension-summit|lp-forum` short keys (allow-listed, mapped to the exact select
  option strings server-side). 10s timeout + retry + `maxDuration=30` (wide-table scan,
  same risk as main-speakers). Fields: Full Name, Job Title, Company, Profile Picture,
  Link to LinkedIn + LinkedIn Handle (http-guard helper), Hierarchy, Project Name.
- **Dedupe in code**: the Speakers view holds real duplicate rows (Thomas Kristensen ×3,
  Kasim Kutay/Torben Andersen/Treichl/Kiander etc. ×2). Collapse per event by normalized
  name; keeper = has LinkedIn, then lower Hierarchy. 42 raw → 26 served
  (7 pension-summit + 19 lp-forum).
- **New page `/investors`**, nav tab "Investors". Tabs All / Pension & Insurance
  Summit / LP Forum; on All each card shows its event tag. Same card grid + CopyEmbed
  as NISS/NASS. Photo gate (name+photo) → 5 pension-summit people currently hidden
  (Jens Munch Holst, Kent Damsgaard, Kjetil Houg, Merete Clausen, Rasmus Bessing —
  no Profile Picture yet; upload = publish, same rule as NISS).
- Order: Hierarchy asc then name (all Hierarchy blank today → alphabetical; set numbers
  in Airtable to curate, no redeploy needed but 1h cache).
- Verified: tsc clean; feed 26/7/19; browser tab-switch test 26→7→19 with event tags.

Next steps:
1. Auri reviews /investors locally → merge to main → copy embed(s) into Elementor.
2. ~~Airtable data fix: Mads Krogsgaard vs Mads Krogsgaard Thomsen dupe~~ FIXED in
   Airtable same day (LP Forum 19 → 18).
3. Photos for the 5 hidden pension-summit people when they should go live.
4. Note: dupes remain in the Airtable view itself (code hides them); clean at leisure.

## Session 2026-07-28 (NASS 2026 section — merged to main, LIVE)

State: DONE. Commit `2f9986c` on `nass-2026`, merged to main `a808b91`, deployed +
prod-verified (26 people). Built + verified locally, completion-auditor GO. Mirrors
NISS 2026 exactly. Random order added same day (see the merged shuffle notes below).

- **New feed `/api/nass-speakers`** (`lib/nass.ts` + `app/api/nass-speakers/route.ts`).
  Source: table `tbl3dTaHrIFrHF6Mo` ("Ticketing Forms"), view `viw9pkLpUOThgHfGB`
  ("Nordic-Africa Summit Presenters", NASS = Nordic-Africa Startup Summit). 26 records,
  all with Headshots. Allow-listed fields only: Presenter's full name / job title /
  bio, Company Name Investor Dinner (that IS the company column here), Headshots,
  LinkedIn profile, Speaker or Moderator. Role filter `?role=Speaker|Moderator`
  (24 + 2). Same rate-limit + 1h cache + CORS as NISS.
- **New page `/nass`** (`app/nass/page.tsx`), nav tab "NASS 2026", middleware
  PUBLIC_PATHS entry. Same card grid/tabs/CopyEmbed as `/niss`.
- Dropped from the NISS copy on purpose: `Hierarchy ` sort (field doesn't exist here,
  order = alphabetical), `Should be On Website` opt-out (no such field; view membership
  + the name+photo gate are the publish switches), Team Member tab, photo crop override.
- Verified: tsc clean, feed 26/2, page 200 on dev :3000.
- **Random order added** (same pattern as Speakers 2026): client-side Fisher-Yates with
  a mount-fixed LCG seed on the page (order stable during revalidation, re-rolls per
  refresh) + `shuffle` flag on the CopyEmbed so the Elementor snippet shuffles too.
  Browser-verified: two loads gave different orders. API stays alphabetical (cached 1h,
  shuffling server-side would freeze one order for everyone).

Next steps:
1. Auri reviews /nass locally → merge `nass-2026` to main (auto-deploys) → copy the
   embed from the DEPLOYED dashboard into Elementor.
2. Airtable data fixes (in the view, not code): Jamie Thurston Wyngaard is in TWICE
   (both with photos, slightly different titles — remove one); the two moderators have
   "(Moderator)" baked into their Full Name cells ("Adama Ibrahim, EMBA (Moderator)",
   "Joseph Yamoah (Moderator)") — strip it, the Role tag already shows it.
3. Confirm the public event name spelling ("Nordic Africa Startup Summit" used in the
   page eyebrow vs the view's "Nordic-Africa Summit").
4. There is also a near-duplicate view "NASS Presenters 2026" (`viwCbSdP7li3GjOwK`,
   27 rows, one with blank role) — feed uses Auri's specified view; consider deleting
   the other to avoid two sources of truth.

## Session 2026-07-22b (NISS photo gate — branch `niss-photo-gate`, NOT yet deployed)

State: filter written + verified locally, waiting on Auri's go-ahead to merge to main
(main auto-deploys to airtable-woad.vercel.app).

- **NISS 2026 feed now hides anyone without a Self Portrait.** `lib/niss.ts`: the record
  loop keeps a person only `if (p.name && p.photo)`. Reason: the table is registration
  data, so most Role-tagged rows have no photo and rendered as grey placeholder cards on
  techbbq.dk/nordic-indiastartupsummit (34 of 53 speakers, 10 of 15 moderators).
  Uploading a Self Portrait in Airtable is now the publish switch.
- Side effect (wanted): duplicate people vanish — dupes were photo-less copies (Zenia W.
  Francker/Zenia Worm Francke, Jose Jacob ×2, Jakob Williams Ørberg ×2, Peter
  Winther-Schmidt ×2, Manish Prabhat ×2, Nikhil Tambe ×2).
- Verified on local dev (port 3921) against live Airtable: Speaker 53→19, Moderator
  15→5, zero photo-less, Hierarchy order intact. `npx tsc --noEmit` clean.
- Same-day Elementor change (not this repo): moved "Meet the Moderators" section directly
  under "Meet the speakers" on the NISS page (structure-panel drag, published, verified).

Next steps:
1. Auri confirms → merge `niss-photo-gate` to main, push, check prod feed
   (`/api/niss-speakers?role=Speaker` should return 19).
2. Content team uploads photos + `Position at Company ` for the ~17 new speakers and 10
   moderators in the NISS table — they reappear automatically.
3. Sheet asks: rename "Dr. Eswarappa Pradeep B." → "Dr. Pradeep B." + clean description
   (fix in Airtable record, not code).
4. Consider clearing Role on the photo-less dupe rows anyway (data hygiene).

Gotchas: only the 2026 NISS feed is gated (niss-2025/team/life-science unchanged);
`Should be On Website`=NO opt-out still applies on top.

## Session 2026-07-22 (Grill session Company values restored + main-page embed fix)

- **Company values wiped → restored.** All 11 rows in Partnership Success view
  "2026 Grill session submissions" (`viwmxcuIN0SFe2tkF`) had the `Company` (primary) cell
  emptied. Revision history: deleted by Auri's own account ~18h earlier (accidental bulk
  clear, no automation involved). The field itself was never deleted. Restored all 11 via
  API by matching each row's `Partner ID` to `Partners 2026` CRM `Company Name` (every ID
  matched exactly one CRM record; email domains cross-checked). Re-fetched before writing,
  only filled still-empty cells. Table-wide sweep: 0 other rows had Company emptied in the
  last 3 days.
- **Root cause (Auri):** the `Company` field was temporarily converted to a Number type;
  Airtable wiped every non-numeric value table-wide, converting back left blanks. Field is
  singleLineText again now.
- **All other 2026 views restored too** (14 more records, same Partner ID → CRM method):
  Badge pickup 4, pop-up 6, Event room form 4 (same records also in Experience view).
  All 2026 views now 0 empty except one TEST row in "2026 Side event and event room info"
  (`recPyYCxemm1SCS7t`, abs@techbbq.org, fake Partner ID 456654123) — left blank on purpose.
- **2025/2024 data restored too: 51 more records** (49 by Partner ID → CRM, 2 by email
  domain: SAP + Zendesk).
- **FULL restore via snapshot (same day, later):** the CRM sweep missed ~173 rows (survey
  rows with no Partner ID). Restored a pre-wipe snapshot (7/21 12:17 PM) as base copy
  **TechBBQ (July 21, 2026)** (`appz3LBz1egRgxEkS`), read original Company values from its
  UI (record IDs preserved; harvested grid DOM via claude-in-chrome JS + per-record URLs;
  token can't see the copy base) and wrote the EXACT originals back: 162 + 8 + 34 writes.
  This also upgraded the earlier CRM-generic values to true submissions (e.g. the three
  um.dk rows are really Innovation Centre Denmark Bangalore / Shanghai / Silicon Valley;
  8 rows had digit-artifacts from the number conversion: "Matrikel1 ApS"→"1",
  "Latitude 59"→"59", "TechBBQ 2025"→"2025" — all fixed). Test rows restored to their
  originals too ("Auri", "Auri again", "JJ (Test Partner)").
  **FINAL: 269 rows, 14 empty Company — 13 were already empty pre-wipe (anonymous 2025/26
  form submissions that never collected a company) + 1 created 2026-07-22 08:28 by
  abs@techbbq.org (post-snapshot, born empty). Incident fully repaired.**
  CLEANUP for Auri: delete the snapshot copy base "TechBBQ (July 21, 2026)" from the
  workspace when comfortable (it also counts toward workspace size).
- **Partnership Success field cleanup DONE (181 → 117 fields).** Via the field manager UI
  (Manage fields, bulk checkbox + Actions · Delete; fields land in trash, recoverable):
  deleted all 60 `6th–35th Presenter Details/Photo` leftovers, the empty orphan
  `1st Presenter Details` dup (no interface refs; the real one is `1st Presenters details`),
  and `Field 37`/`Field 54`/`Field 176` (all verified 0 values across 270 records first).
  Renamed via Meta API: `Field 71` → **Special Offer** (held Zendesk's real offer text),
  `test` → **Survey Intro Text** (constant boilerplate on 142 records, but USED by 2
  interface forms — Partnership Evaluation Survey + 2025 edition — so renamed, not deleted).
  Kept: `Presenter photos`, `1st/5th Presenters details/Photo` sets, `Presenter Details`,
  `Presenters`, and the colleague's new `Presenters Company/Position/Profile Picture` fields.
- **Main Page 12 embed "Could not load right now"**: the snippet in Elementor was copied
  from localhost, so `ENDPOINT` was `http://localhost:3000/api/main-speakers`. Fix = change
  it to `https://airtable-woad.vercel.app/api/main-speakers` (prod API verified live, 12
  speakers). Rule: always copy embeds from the deployed dashboard.
- Schema drift noticed (not acted on): checkbox renamed to "Extra presenters (5+) submitted",
  new fields `Presenters Company` / `Presenters Position in the Company` / `LinkedIn Handle` /
  `Presenters Profile Picture` on Partnership Success, plus a new form view
  "More Event Room Speakers" (`viwaIyG5dUeSCOdTQ`) on Partnership Success itself. The 60
  leftover 6th–35th Presenter fields still exist.

## Session 2026-07-21 (>5 presenters flow BUILT on both forms — main form still unpublished)

Executed the two-form plan from 2026-07-20. All work in the Airtable UI (browser "Work TechBBQ"),
no repo code touched.

### What was just done
- **Main form** (`pagMB9u1RJ4KZCpHJ`, Forms tab · edit at
  https://airtable.com/appgXNjXJqpk9Ebxd/pagMB9u1RJ4KZCpHJ/edit):
  - `Presenters` select now has **"More than 5"** (option existed when session started).
  - All 10 conditional fields (`1st–5th Event Room Speaker Details` + Photos) had "More than 5"
    added to their visibility conditions, so presenters 1–5 still get entered when it's picked.
  - New required checkbox **"Extra presenters (6+) submitted"** on Partnership Success, placed
    right under Presenters, visible ONLY when Presenters = More than 5. Helper text links to the
    speaker form share URL + says one submission per presenter + include Partner ID.
  - Verified in Preview (Event Room → More than 5 → checkbox + all 5 speaker blocks show).
  - **NOT PUBLISHED** — "unpublished changes" banner still up, Auri reviews then hits Publish.
- **Speaker form** "Add Event Room Speakers" (legacy form view on `tblg9iPj4XZK4RQZw` · edit at
  https://airtable.com/appgXNjXJqpk9Ebxd/tblg9iPj4XZK4RQZw/viwbtzN1ShGufUWOt · share link
  https://airtable.com/appgXNjXJqpk9Ebxd/shrgoNWFrLloteBlE):
  - Added required integer **`Partner ID`** field (after Job Title) = the matching key back to the
    partner's main submission. LIVE immediately (legacy forms have no publish step).

### Next steps
1. **Auri flagged the speaker form "has wrong fields"** — review/fix its field list in the
   viwbtzN1ShGufUWOt editor (likely candidates: Session/Stage, Time, the two linked-record
   pickers `Event (Side Event)` / `Partner event (Partnership Success)`). Remember: edits go
   live instantly on the share link.
2. Publish the main form (top-right Publish button) after review.
3. Decide extra-presenter matching: manual by Partner ID vs an Airtable automation that links
   Event Room Speakers rows to the Partnership Success record.
4. Cleanup still pending from 2026-07-20: delete the 60 leftover `6th–35th Presenter` flat fields
   on Partnership Success (UI only) + the duplicated form copy `pagTJwRiyFbxWNYk9` if unused.

### Gotchas
- Public speaker form's linked-record pickers list existing records to outsiders, but all render
  as "Unnamed record" — no real leak. Left in place pending the wrong-fields review.
- Interface form builder right panel shifts rows by field type: on attachment fields the
  **Required toggle sits where Visibility is on text fields**. A misclick silently turned
  1st Photo's Required OFF — caught by comparing against 2nd Photo and re-enabled. Check
  Required states after any panel clicking spree.
- Airtable's form editor still freezes browser automation intermittently (screenshot timeouts);
  actions land, verification screenshots need a retry.
- Memory pointer: `project_tbbq_sideevent_form_2026`.

## Session 2026-07-20 (Event Room: up to 35 presenters submission — PLAN + prep)

**The ask (Charlotte → Auri):** the "Side event & Event Room Info 2026" form must let a partner
submit **up to 35 Event Room presenters** (Danish Entrepreneurs ~35, Creative Business Network ~25).
Current form maxes at 5 (`Presenters` selector + `1st–5th Presenter Details` + photos, flat fields).

**The form:** Airtable Interface form `pagMB9u1RJ4KZCpHJ`, **source table = `Partnership Success`**
(`tbllvkwLhB4Omdphd`), NOT Side Events. (I initially mis-assumed Side Events.)

### What was ruled out (tested live, not guessed)
- **Interface-form linked field = dead end.** Airtable interface forms CANNOT create linked records.
  A linked field only *selects* existing records (typing a new name → "No results", no create). So a
  one-form "add 35 speakers with details" is impossible natively via a linked field.
- **Fillout works but isn't a native Airtable form.** Built a Fillout form with a repeatable "Event
  Room Speakers" block (create records + multiple, max 35, only-new-records for privacy; sub-form
  Name/JobTitle/Company/Photo required). Proved end-to-end: a test "Jane Doe" landed as a real row in
  the `Event Room Speakers` table, then deleted. Data lives in Airtable, but the FORM is Fillout's —
  Auri wants the form itself native, so Fillout is parked (form id `iN9Hz9BUBBus`, can revisit).
- **Flat 6th–35th fields on one form** = 60 columns + ~30 conditional rules; Auri rejected the bloat.

### THE CHOSEN PLAN (native, two-form) — what we're building
1. **Main form** keeps event info + presenters **1–5** as today. Add a **conditional link**
   *"More than 5 presenters? Add the rest here → [link]"* shown when `How many presenters?`/`Presenters`
   = 6+, and/or on the after-submit "thank you" message. (Both are native interface-form options.)
2. **Separate native speaker form** = just speakers, with **"Submit another response"** on → partner
   fills one → submit → "submit another" → repeat, unlimited. Each = one `Event Room Speakers` row.
3. **Link speakers to the partner** via a **Partner ID** field on the speaker form (they already have it
   from the main form); match speakers→event by Partner ID.

**Open decision (asked Auri):** do presenters 1–5 stay on the main form (speaker form only for #6+
overflow), or do ALL speakers go through the speaker form? Auri's wording → 1–5 stay on main, speaker
form is the overflow. (Note: this splits speaker data — 1–5 as flat fields on Partnership Success,
6+ as linked rows in Event Room Speakers. Accepted as pragmatic.)

### Already built / prepped
- **`Event Room Speakers` table** created (`tblg9iPj4XZK4RQZw`): Name, Job Title, Company, Photo, Bio,
  Session/Stage, Time; linked to **Side Events** (`Event (Side Event)`) AND **Partnership Success**
  (`Partner event (Partnership Success)`). Verified inserts link correctly.
- **Classic Form view "Add Event Room Speakers"** on that table, **"Submit another response" ON** —
  this IS the speaker form; needs finishing.
- **60 fields** (`6th–35th Presenter Details` + `6th–35th Presenter Photo`) created on Partnership
  Success (from the flat-field attempt; leftover, table now 174 fields — delete in UI if unused, API
  can't). `Presenters` selector could NOT be extended past 7 via API (blocked, tied to form logic).
- **Main form duplicated** → "Side event and Event room Info 2026 copy" (`pagTJwRiyFbxWNYk9`).

### Next steps
1. Finalize the speaker form: make Name/Position/Company/Photo **required**, add a **Partner ID** field
   to the table + form, get the **share link**.
2. On the main form: add the conditional "more than 5? use this form" link + after-submit message.
3. Confirm the 1–5-stay-on-main decision, then wire it.

### Gotchas
- Airtable's interface editor **freezes browser automation** intermittently — the 35-block conditional
  build stalled on this. A human clicks through it far more reliably than the automation.
- Two front doors (old Airtable form vs any new form) both write to the same tables but don't sync —
  everyone must use ONE form or speaker data splits across places.

## Session 2026-07-20 (New: Main Page 12 feed + embed)

**Current state:** Built + verified locally. New page `/main-speakers` shows the 12 speakers
marked `Main Page = "YES"` in Airtable (Marketing Project Overview, view `viwfIcQFDNQ9ggSqx`),
in curated Hierarchy order, photos + name + title·company only (NO bio), with its own embed button.

### What was just done
- `lib/mainpage.ts` — `fetchMainPageSpeakers()`: reads Airtable `tblTecOBecLQCNIeD`,
  filterByFormula `{Main Page}="YES"`, allow-listed fields (Full Name, Job Title, Company,
  Profile Picture, Link to LinkedIn, Hierarchy). 10s timeout + retry (table is 3339 wide rows,
  same abort risk as hierarchy). Sorted by Hierarchy asc. No bio field at all.
- `app/api/main-speakers/route.ts` — feed, `cached("main-speakers")`, CORS, rate-limit,
  `maxDuration = 30`. Returns `{count, speakers}`.
- `app/main-speakers/page.tsx` — same card/row look as the others, no modal/search/load-more.
  `CopyEmbed path="/api/main-speakers" loadMore={false}` (12 fixed, no bio popup, curated order).
- `middleware.ts` — added `/api/main-speakers` to PUBLIC_PATHS (embeddable, un-gated).
- `components/TopNav.tsx` — nav link "Main Page 12".
- `tsc` clean. API returns 12 with photos (Jacob #1 … Ritika last). Desktop grid + mobile rows
  both render all 12 (global ≤640px breakpoint, no page-specific CSS needed).

**Follow-ups done same session:**
- LinkedIn: `Link to LinkedIn` is empty for all 12, but `LinkedIn Handle` holds the full profile
  URL. Feed now reads `linkedinUrl(Link to LinkedIn, LinkedIn Handle)` (http(s)-only guard) → 12/12
  linked. Cards + embed open the profile in a new tab.
- Grid: main page now 4 per row, not 5. Added `.grid-cards--4` (globals.css, `@media min-width:1001px`)
  and the page uses `className="grid-cards grid-cards--4"`. Tablet (3) and mobile (rows) unchanged.

### Gotchas
- To change who appears: tick/untick `Main Page` in Airtable. No **Sync** button wired for this
  feed — the 1h `cached("main-speakers")` TTL applies, or redeploy to clear.
- Ordering is by `Hierarchy`; Ritika Pai is at 10000 (unranked) so she lands last of the 12.

## Session 2026-07-20 (Speakers 2026 order: hierarchy fetch was timing out)

**Current state:** Fixed + verified locally. `/speakers-2026` again shows the curated top 30
(hierarchy 1..30, Jacob Lauritzen first) in order, then the other 113 shuffled.

### What was wrong
The "first 30 in order, then random" logic was already correct. The bug: the Airtable
hierarchy fetch (`filterByFormula {Project Name}="TechBBQ Summit"` scans the whole, now-bigger
Marketing Project Overview table — last session added 21 partner rows) intermittently aborted at
the 8s fetch timeout. On abort, `fetchHubSpeakers` served everyone unranked and `cached()` froze
that alphabetical roster for 1h. Airtable data itself is fine (exactly 30 rows ranked 1..30, rest
at 10000). Confirmed via dev log: `[hub] hierarchy lookup failed … AbortError`.

### What was just done
- `lib/hierarchy.ts` — split into `fetchHierarchyMapOnce`; 10s timeout + retry once.
- `lib/hub.ts` — hierarchy map now `cached("hierarchy-2026", …)` on its own key, so once loaded
  it persists 1h and serves last-good on a later blip (can't un-rank the whole grid).
- `app/api/speakers-2026/route.ts` — `export const maxDuration = 30` for retry headroom on Vercel.
- `tsc --noEmit` clean. Browser-verified after clearing the stale `tbbq-cache:speakers-2026`
  localStorage entry.

### Next steps
1. Commit (not done — Auri's call) and deploy to Vercel.
2. After deploy, hit **Sync now** on `/speakers-2026` once to drop any prod cache holding the old
   unranked order.

### Gotchas
- The roster still bakes hierarchy into the cached list at fetch time. If the VERY FIRST cold
  load's hierarchy fails both attempts, that load caches unranked for 1h — rare, self-heals on the
  6-hourly sync / **Sync now** / redeploy. A fuller fix (apply hierarchy at read time, not baked in)
  was left out as over-engineering.
- Client caches the list in `localStorage` (`tbbq-cache:speakers-2026`) via `useCachedList`. A
  stale poisoned entry there survives a server fix until the SWR revalidation replaces it.
- Dev only: React StrictMode double-invokes the fetch; with flaky network one of the two can cache
  a degraded response. Not a prod issue.

## Session 2026-07-20 (Community partners → Partner Deliverables 2026: tag + backfill)

### The ask
Auri: make the 44 Community partners on his authoritative list show as `Community` in
`Marketing Project Overview` → view **Partner Deliverables 2026** (`viw7FVbsTb9IRaWF0`).
List saved to `scripts/community-partners-2026.txt`. Tier field used by THIS view is the
table's own `Partnership Type 2026` **singleSelect** (hand-entered per row) — NOT the CRM
formula (see "CRM formula" note below, left untouched).

### Final state (all live in Airtable, verified)
All 44 list partners are `Community` in the table. View row count 79 → **102**.
- **4 rows** already correct at session start → left as-is.
- **4 rows** corrected to Community: Beta Health (`recoDV31XucOrMh8X`), Copenhagen School of
  Entrepreneurship (`recfKPWt7DKW9GfXf`), Nordic Women's Health Hub (`recDF5nW79QKBLtyN`),
  Sri Sathya Sai Institute of Higher Learning = "SSSIHL" (`rec9SZjHsYaJ2boGz`, was Academic).
- **21 rows CREATED** — the list partners that had no row in the view at all. Each: `Company`,
  `Partnership Type 2026 = Community`, `Company Link` → their `Partners 2026` CRM record
  (19/21; TiE Bangalore + RANNIS have no CRM record, so name+tier only).
- **19 created rows backfilled** from the CRM: `Partner ID` (19/19) + `Contact Email` (19/19,
  mostly via the CRM's linked **Contacts** table / `Email (from Contacts) 2` lookup, NOT the
  flat `Contact Email` field which is mostly empty) + `Contact Name`/`Link to your website`
  where present.
- **4 of those 21 were dupes of legacy 2025 rows** (Nordic Music Tech, START Paris, Ignite
  Sweden, DTU Science Park). Copied `Logo` + `Social Media Handles` + `Link to your website`
  from each legacy row onto the new 2026 row → those 4 are now COMPLETE and visible in the view.

### The view filter (this was the whole puzzle — Airtable API can't read view filters)
`Partner Deliverables 2026` shows a row only if ALL of:
`Company is not empty` AND `Created is after 1/1/2026` AND `Logo is not empty`.
Consequences:
- A new row needs a **Logo attachment** to appear. `Company` + `Created` (auto = today) pass free.
- Legacy 2025 rows can NEVER appear here (Created < 2026), even with a logo — that's why the 4
  dupes existed unseen. Their data was copied onto the new 2026 rows; the 2025 rows were LEFT in
  place (redundant but harmless, and the original logo source). Delete only if tidying.
- `Company Link` and `Partner ID` are NOT the filter (both tested empirically with a throwaway
  row, both failed; test row was deleted).

### Still needs Auri
1. **Logos for 17 of the 21 new rows** — until each has a Logo it stays hidden by the filter.
   To edit them: temporarily delete the `Logo is not empty` filter line, add logos, re-add it.
   These 17 have Company + Community + Partner ID + Contact Email already; blank = Logo, Social
   Media Handles (not in CRM for anyone), and most Contact Names.
2. **TiE Bangalore (NISS)** + **RANNIS** — no CRM record; name + Community only.
3. **3 rows tagged Community but NOT on the list** — Clean (`recjiZJvYtGVxECsn`),
   DI (`recqHS4jaSNWj1cQb`), Embassy of India (`rec3kqghE4Nt7pmXF`). Auri said "not on the list =
   not Community" but never supplied replacement values. NOT cleared (blanking a single-select
   drops the row out of grouped views). Their CRM types: Clean=Community Main, DI=Community Core
   Plus, Embassy of India=Community Non-commercial. Awaiting values.

### CRM formula (root cause of the original "no Community anywhere" — LEFT UNTOUCHED)
`Partners 2026`.`Partnership Tier (Based on Deal Size)` (`fldSGGxr4Tcg88ZvP`) is a FORMULA whose
first branch is dead code: it compares the **multipleSelects** `Partnership Type 2026` to a string
with `=`, which Airtable never evaluates true, so "Community" is unreachable (0 of 2615 records,
despite 181 Community-typed). Fix = `FIND(...)` over `ARRAYJOIN(...)`. NOT applied: Meta API can't
rewrite formulas (manual UI edit), it's Partnerships' shared field across 2615 records + other
views, and Auri scoped this to the marketing view only. This view uses its OWN singleSelect, so the
formula bug didn't block the task.

### Gotchas
- CRM contact/website/social fields are mostly EMPTY for these (mostly non-commercial) partners;
  the real emails live in the linked **Contacts** table (`Email (from Contacts) 2` lookup). Social
  handles exist NOWHERE in the CRM — only on legacy form-submitted deliverable rows.
- `Partners 2026` logo fields are broken as a source: the URL lookup returns `"0"`, the linked-logo
  field points every record at one placeholder, and the only real attachments are signed CONTRACTS
  (`Contract 2026` etc.) — never use those as logos.
- Name spellings differ across tables: `SSSIHL`=`Sri Sathya Sai Institute of Higher Learning`,
  `IVC Association`=`Indian Venture & Alternate Capital Association`, `INCUBA x KITCHEN` row =
  CRM `INCUBA` + `The Kitchen`, `Medicon Valleyh Alliance`(typo)=`Medicon Valley Alliance`.
- Heavy CRM duplicates (Health Tech Hub ×5, INCUBA ×5, etc.): authoritative record = the one with
  `Status 2026 = Confirmed` AND a non-blank `Partnership Type 2026`; rest are untyped stubs.
- `scripts/community-tier-audit.mjs` reads the view vs the list (read-only; `--write` adds only the
  safe "should be Community" additions, never clears). Its ALIAS map is incomplete (missed SSSIHL),
  so trust the row work above over a bare audit run.

## Session 2026-07-16d (Speakers 2026 random order every load)

### State
Speakers 2026 renders in random order, re-rolled on every page load. DEPLOYED + verified end
to end (commit b70692c live on `airtable-nksgdgtwi`). React page shuffles; the COPIED embed
now shuffles too (see bugfix below). ONLY remaining user action: Auri re-copies the Speakers
2026 embed from the deployed dashboard (hard-refresh the dashboard first, then Copy) and pastes
it into Elementor. Verify the copied text contains `si=list` before pasting.

Prod aliases → latest deploy: airtable-woad.vercel.app, airtable-tech-bbq.vercel.app,
airtable-git-main-tech-bbq.vercel.app. Vercel project: tech-bbq/airtable. `vercel ls`/`vercel
inspect` work locally for deploy status.

### What was just done
- Shuffle is CLIENT-SIDE on purpose. Server/CDN cache (1h) would freeze a server-side shuffle
  for everyone for an hour; doing it in the browser after fetch means each refresh re-randomizes.
- `lib/embedSnippet.ts`: new `shuffle?: boolean` option. When true, Fisher-Yates on `list`
  right after fetch, before render. Only speakers-2026 passes it; all other feeds unchanged.
- `app/speakers-2026/page.tsx`: `shuffle` on the CopyEmbed + client shuffle of the React grid.
  Uses a mount-fixed seed (LCG) so search/pagination/revalidation don't re-jump the order;
  a real page refresh remounts → new seed → new order.

### Next steps
1. Push + deploy, then RE-COPY the Speakers 2026 embed in Elementor (structural change).

### BUGFIX (same session)
- `components/CopyEmbed.tsx` never forwarded `shuffle` to `buildEmbedSnippet`, so the COPIED
  embed silently dropped it and stayed alphabetical (the React page shuffled via its own code,
  which masked the bug in local checks). Fixed: destructure `shuffle` + pass it through.
  Verified end-to-end by intercepting the Copy button's clipboard write — copied string now
  contains the Fisher-Yates block. Lesson: verify the EMBED output, not just the React page.

## Session 2026-07-16c (NISS "Should be On Website" opt-out filter)

### State
NISS 2026 feed now hides anyone with the new Airtable single-select `Should be On Website` =
`NO`. Verified: Rasmus Abildgaard Kristensen (the only NO) is gone; counts 25→24 all / 19→18
presenters; the 23 blank rows still show. On `main`, needs push + deploy (data-level, so NO
re-copy of the embed).

### What was just done
- `lib/niss.ts`: added `Should be On Website` to SAFE_FIELDS and skip any record whose value
  is exactly `"NO"`. Blank OR `"YES"` both stay visible — deliberately opt-out-only, because
  right now 0 rows are YES and 23 are blank, so a "show only YES" rule would hide everyone.

### Gotchas
- Field is single-select YES/NO; today only NO and blank exist, no YES. Don't flip the logic
  to require YES.
- 2026 table only (tblfIPjV4t1c1628h). Other feeds (speakers-2026, life-science, team,
  niss-2025) don't have this field; they'd each need their own to gain the same gate.

### Next steps
1. Push + deploy; Rasmus drops off the live site within the cache window (or instantly on deploy).

## Session 2026-07-16b (embed mobile default → list rows)

### State
Every feed's embed now defaults to the list-rows mobile layout (was 2-col grid). Verified
the generated snippet carries `tbbq-rows` + the rows media query, desktop grid intact. On
`main`, needs push + deploy, then RE-COPY each block in Elementor to take effect.

### What was just done
- `lib/embedSnippet.ts`: default `mobileLayout` flipped `"grid"` → `"rows"`. Desktop
  unchanged (still the auto-fill grid); only the ≤600px view changes to photo-left rows.
- `app/niss/page.tsx` + `app/niss-2025/page.tsx`: dropped the `role === "Moderator" ? "rows"
  : "grid"` override so all roles use the new rows default.
- speakers-2026, life-science, team, home already passed no `mobileLayout`, so they inherit
  the new default automatically.

### Next steps
1. Push + let Vercel deploy, then Auri RE-COPIES every speaker/presenter/team embed block in
   Elementor (copy from the DEPLOYED site so `__ORIGIN__` resolves correctly).
2. Optional still-open: bake Dr Nikhil Agarwal's photo crop into the embed (currently page-only).

## Session 2026-07-16 (NISS presenters ordered by Airtable Hierarchy)

### State
NISS 2026 presenters now render in a manual sequence set from Airtable instead of
alphabetically. Working + verified locally (dev on :3001). Not committed. On `main`.

### What was just done
- **Hierarchy-based ordering** on the NISS feed (`lib/niss.ts`). The `Hierarchy ` number field
  (note the trailing space, like `Position at Company `) now drives display order. Added it to
  `SAFE_FIELDS`, mapped it onto `NissPerson.hierarchy` (blank/non-numeric → `Infinity`), and
  changed the sort from name-only to `hierarchy asc, then name`. Was `people.sort(localeCompare)`.
- Verified live: `/api/niss-speakers?role=Speaker` returns presenters in Hierarchy order 1→19;
  `?role=all` interleaves all roles by number with alphabetical tiebreak.

### Gotchas
- Real field name is `Hierarchy ` **with a trailing space**. Don't "fix" it.
- Each Role (Presenter/Moderator/Team) has its own 1..n sequence, so the tabs stay clean.
- Airtable currently skips **13** (jumps 12→14) — harmless gap, renumber in Airtable if wanted.
- **Jesper Ludolph** has no Hierarchy value → sorts last (alphabetical fallback). Set his number
  in Airtable to place him.
- Reordering is now pure Airtable: change the Hierarchy cell, refresh, no redeploy.

### Next steps
1. Auri to test in browser, then decide: commit on `main` or branch it.
2. Optional: apply the same Hierarchy ordering to the 2025 NISS feed if that event needs it.

## Session 2026-07-15 (speaker detail modal on /speakers-2026)

### State
Speakers 2026 page now opens a detail pop-up on click instead of jumping straight to
LinkedIn. Working + verified locally (dev on :3001, port 3000 was taken). Not committed.

### What was just done
- **Click-to-open speaker modal** on `/speakers-2026` (`app/speakers-2026/page.tsx`). New local
  `SpeakerModal` component shows photo · name · `title · company` · bio · a "View LinkedIn
  profile" button. Desktop cards and mobile rows are now `<button>`s that set `selected`
  state (were `<a href={linkedin}>`). LinkedIn moved from the whole card into the modal.
- **Modal styles** appended to `app/globals.css` (`.modal*`, `.s-card__button`, `.row__button`),
  matching the dark/fire tokens.
- A11y: `role="dialog"` + `aria-modal` + `aria-labelledby`, focus lands on close button, Escape /
  backdrop / X close, body scroll lock, focus rings, honors `prefers-reduced-motion`.
- Verified: `/speakers-2026` compiled 200, `/api/speakers-2026` returns 140 speakers with bio +
  photo + linkedin. Opened modal (Adrian De Gendt) in browser, all 5 fields render; X closes it
  (DOM check: `modalOpen:false`, 20 `.s-card__button`, no `.s-card a`).
- **Added CopyEmbed** to `/speakers-2026` hero, matching the other feed pages. It was the only
  feed page missing one.
- **Modal in the embed snippet** (`lib/embedSnippet.ts`): new opt-in `modal?: boolean` on
  `EmbedOptions`. When true, the generated vanilla-JS cards open a detail pop-up (photo · name ·
  `title · company` · bio · LinkedIn button) instead of linking to LinkedIn. Event-delegated by
  `data-i` index; Escape / backdrop / X close; body scroll lock; styles scoped under
  `.tbbq-speakers` so they can't leak into WordPress. `CopyEmbed` now forwards `modal`; the 2026
  page passes `modal`. Other embeds (team, niss, life-science) are unchanged (flag defaults off).
  Verified end-to-end: generated the real snippet, ran it in the browser, click opens the pop-up
  with all fields (Adrian De Gendt), X / Escape / backdrop all close, scroll lock restores.

### Next steps
1. Decide whether to clamp bio to a "short" cap (3-line fade). Currently shows full bio.
2. Optional: apply the same modal to `/speakers` (Airtable feed, also has `bio`), `/life-science`,
   `/niss`. Those still use click-to-LinkedIn.
3. Embed pop-up is DONE (opt-in `modal` flag). Auri must RE-COPY the embed from the deployed
   /speakers-2026 and re-paste on techbbq.dk — the previously pasted snippet won't self-update.
4. If we ever want the pop-up on team/niss/life-science embeds, pass `modal` on their CopyEmbed
   too (team has no bio, so it'd show "No description available yet.").

### Gotchas
- Data for `/speakers-2026` is Supabase Speaker Hub, NOT Airtable (bio = `biography`). The Airtable
  `/api/speakers` feed maps bio from `Text for website` → `Speaker Bio` → `Bio`.
- The Chrome extension renderer was very flaky this session (screenshots timing out); used
  `javascript_tool` DOM checks as a fallback to confirm behavior.

## Session 2026-07-14 (sync fix live + team-by-department view + staff adds)

### State
Speaker sync is LIVE (see earlier session note below). Added a department-grouped team
dashboard and two missing full-timers to `#TechBBCuties`.

### What was just done
- **Team-by-department page**: new `app/team/departments/page.tsx` (route `/team/departments`),
  linked in `components/TopNav.tsx` as "Team by dept". Reuses `/api/team` (same safe allow-list,
  no email/phone) and groups current members under department headings with per-dept counts.
  The original `/team` page (Elementor embed) is untouched. Verified locally: 29 members, 200 OK.
- **Staff adds to `#TechBBCuties`** (`tbldWne3PnvebIwif`): created Sille Hassert (Senior
  Partnerships Manager, Partnerships) + Charlotte Esmann (Head of Partnership Success,
  Partnerships), both `Active Team Member`=true. Both now show in the feed.

### Next steps
1. Divya Thangadurai = volunteer, NOT added (Auri confirmed). Iñigo still Archive-but-active-in-Slack.
2. Minor: Jean-Jacques title drift (base "Head of Partnerships" vs Slack "Senior Partnerships Manager").
3. Sille + Charlotte now have LinkedIn + Email + Photo in Airtable (Auri filled the rest).
4. Commit `/team/departments` + TopNav (branch + merge to main, auto-deploys) if wanted in prod.

### Decisions
- **Emails are PUBLIC (Auri's call, 2026-07-14).** Staff contact emails treated as public info.
  `Email` is in `SAFE_FIELDS`, so `/api/team` returns it and the `/team` page shows it. Phone +
  internal fields still excluded.
- **ONE team surface: `/team`.** Rewrote it to group by department, filter tabs, photo, email
  (mailto). The photo itself links to the person's LinkedIn (no separate icon). It still hosts
  the CopyEmbed for the techbbq.dk feed. Nav has a single "Team" tab → `/team`.
- **Removed the whole auth/internal experiment:** deleted `middleware.ts`, `app/api/internal/*`,
  `app/internal/*`, `/team/departments`, the `INTERNAL_USER/PASS` env (also removed from Vercel),
  and the `includeEmail` param on `fetchTeam`. Basic-auth was scrapped because emails went public.

### Gotchas
- New `#TechBBCuties` rows need `Active Team Member`=true or they never appear in `/api/team`
  (the gate is `AND({Active Team Member}=TRUE(), NOT(FIND('Archive',ARRAYJOIN({Department}))))`).
- Server cache TTL is 1h (`lib/rate-limit.ts`), so Airtable edits lag up to an hour on the live
  site. In dev, restart `next dev` to clear it immediately.
- The Slack "dreamteam" channel (64) is mostly volunteers; only current staff live in `#TechBBCuties`.

### Files
- `app/team/departments/page.tsx` (new, now with dept filter) · `components/TopNav.tsx` ·
  `lib/team.ts` (unchanged, reused, email deliberately excluded).

## Session 2026-07-09b (Partners->Brella CSV re-run + staff title updates)

### Partners 2026 -> Brella CSV (re-ran `scripts/partners-to-brella-csv.mjs`)
- Output: `scripts/out/partners-brella.csv`. **47 confirmed partners** (Status 2026 = Confirmed,
  view "Partners on Brella"). Columns: Company Name, Category(=Partnership Tier), Website, Logo URL.
- Fill: Tier 47/47, Website **2/47**, Logo **0/47** (same logo blocker as before, the Airtable logo
  lookup field is broken). Names + tiers are clean, which is the core Brella needs.
- Tiers: Challenger 17 · Core 9 · Pioneer 8 · Main 8 · Conqueror 4 · Prime 1.
- **Upload = manual**: Brella has no write API for sponsors. Path = Brella admin -> Sponsors ->
  Import/Export -> import this CSV -> map Company Name->Name, Category->tier. Auri does this in Brella.
- Logo plan: import names+tiers now, add logos directly in Brella per partner (not worth scripting 47).

### Staff title updates (#TechBBCuties `tbldWne3PnvebIwif`)
Website (`techbbq.dk/about-us/`) had newer titles than Airtable. Verified verbatim (2 reads), updated:
- Charles Kinga (`recKiMaqCcfNge3xJ`): Project Leader -> **Head of Africa**
- Shri Harsha (`recVrvKUcFgCYW9he`): Project Leader -> **Head of Asia Pacific**
Note: site WAF now blocks my direct curl (454), used the render-based fetch instead.

## Session 2026-07-09 (Special Offers populated + Airtable seat/billing audit)

### Special Offers 2026 (Offers table `tblWDtFY9DJfRSFAF`, view `viwbiWP2xi23ZnMN4`)
Populated the attendee Special Offers, first from the PDF, then enriched from the live page
`techbbq.dk/special-offers/`.
- Table = **Offers**. The Special Offers view is gated to `Offer for Who = Attendees`.
- Source 1 = `Downloads/Special Offers 2026.pdf` (3 offers). Source 2 = the live page (9 offers).
- **9 offers now live in the view**, each with description + link + an image in `Visual`:
  - Accommodation: Go Hotel (`TechBBQ2026`), AC Hotel Bella Sky (no code), Hoperfy (no code),
    Zoku Copenhagen (`ZokuLovesTechBBQ`).
  - Transportation: Donkey Republic (`TECHBBQ25`), Lime (`LIMEBBQ2025`).
  - Food & Beverages: Brite Drinks (`TECHBBQ20`), Matrikel1 Workbar (no code, show badge).
  - Support: Wing People (no code, no link).
- **Added a `Category` single-select** (Accommodation / Transportation / Food & Beverages / Support),
  the table had no field for the page's grouping.
- **Images**: read the real image URLs from page source, mapped each to its card, then had
  **Airtable fetch them** into `Visual`. My curl is blocked by the site WAF (454/455), but
  Airtable's own fetcher passes. All 9 have a visual (Airtable fetches async, larger PNGs lag a
  few seconds). SVG (Matrikel1) also stored fine.

**FLAGS to resolve:**
- **Donkey Republic + Lime carry 2025 copy/codes** ("TechBBQ 2025", `TECHBBQ25` / `LIMEBBQ2025`).
  These 5 (Transportation / Food / Support) are **hidden last-year sections still in the page
  markup**, NOT visible on the published page (which shows only the 4 Accommodation cards). Kept
  per Auri ("Brite still an option, maybe I'll add them"). CONFIRM the codes still work for 2026
  with the partners before publishing.
- Wing People has no link on the page. Its `Visual` uses `Tjena_circle_2000x2000.png` (odd
  filename, verify it is really their logo).
- Missing codes left blank on purpose (Auri: fine if no code): AC Bella Sky, Matrikel1, Wing People.

### Airtable seat / billing audit (workspace `wspUXPEi1gset4k0T`)
From `Downloads/Invoice-3BD9F1F-0046.pdf`:
- Plan = **NFP Monthly Pro** (nonprofit rate **$12/seat/month**, ~50% off standard Pro).
- **56 billable seats · $672/month · ~$8,064/year.** Invoice total $712.69 includes mid-cycle
  proration as seats grew 48 to 56 over May/June.
- Active team is only **27** (from `/api/team`), so ~29 seats beyond the active team. Big trim room.

**Billing model (for tomorrow):**
- Billed **per person per workspace**, NOT per base. One person on 3 bases in the same workspace
  = 1 seat. Different workspaces = separate seats. Keep bases in one workspace.
- Billed roles = **Owner, Creator, Editor**. **Read-only + Commenter are free.** No free "edit" tier.
- **Only Owner/Creator can invite people** (add paid seats). Editors cannot. Cost risk = anyone
  with Creator, and almost everyone here is Creator. Downgrading non-admins to Editor does NOT
  save money (both billed) but closes the add-a-seat hole. Only Read-only / Commenter / remove saves.
- Downgrade to Read-only should drop the seat. VERIFY: change one person, watch the Billing seat
  count go 56 to 55 (monthly plan gives a prorated credit).
- **Volunteers**: keep them OFF billable seats. Use **Forms** (free, unlimited, create-only, no
  account) for what they submit. Reserve Editor seats for the few who must edit existing records,
  and timebox those to event week + remove after (post-event sweep).

**Confirmed seats to REMOVE (do in the UI, API cannot manage collaborators):**
- Tansu Kjerimi `tkj@techbbq.org` (Archive; access points at a 2024 base)
- Allan Nielsen Hadzimahovic `alh@techbbq.org` (Archive)
- Sandra Frandsen `sfr@techbbq.org` (left; staff record still under Operations, move her to Archive)
- Andrei Ratcu duplicate `ratcuandrei3@gmail.com` (personal Gmail, he already has `anr@techbbq.org`),
  also a security cleanup.
- => ~4 seats ~= **$576/year**.
- Note: a second Owner besides Auri exists, Sadia Beg `sab@techbbq.org`. Confirm intended.

**Finding inactive volunteers on Pro (no Enterprise admin panel = no last-login report):**
- Proxy = add `Last Modified By` + `Last Modified Time` fields to main tables, group a view by
  modifier => shows each person's last footprint. No footprint = dormant seat.
- "Last Modified by **Anonymous**" = change by a non-account source (Form submission, editable
  share link, automation / API, or a since-removed collaborator). Never a billable seat, ignore it
  for the activity audit. If Anonymous edits are NOT from forms/automations, check for an open
  "anyone with link can edit" share.
- Simplest path: trim / downgrade volunteers to free, restore edit access on request.

### #TechBBCuties edit lock (RESOLVED)
Auri could not edit the `#TechBBCuties` table despite being Owner. Not synced, not field-locked,
a no-op API write succeeded (data is editable). Cause = a **locked view**. Fixed by creating a
fresh Grid view.

### Next (tomorrow)
1. Decide remove vs downgrade for the ~29 extra seats. Start with the 4 confirmed removals (~$576/yr).
2. Get the **Members list with last activity** (or add the Last Modified fields) to find the silent
   inactive seats. I will reconcile against the active-27.
3. Confirm Donkey Republic + Lime 2026 codes with the partners before those offers go public.
4. Re-pull staff whose `Active Team Member` box is unchecked (not just Archive), likely more hidden
   leavers. Sandra proved the unchecked-box signal is real.
5. Set up volunteer intake **Forms** so future volunteers do not consume seats. Add a post-event
   seat sweep to the calendar.

## Session 2026-07-08 (Prints 2026 board + day wrap-up)

**`Prints 2026` table (`tbluSfDoEXnvOquvE`, view `viwds5x6kwU2Mg1hP`) made project-based.** Mirror of
the Deadlines board approach. Added: **`Project`** single-select (same 15 projects + colors as the
Deadlines board), plus a date `Deadline`. NOTE Auri then edited the table live in the UI: renamed
the primary to **`Name of the Print`**, deleted the `Details` field I added and the `Attachment
Summary` aiText field, and added a **`Size`** multiline field for dimensions. Current fields:
`Name of the Print` (primary) · `Status` (Todo/In progress/Done) · `Attachments` · `Notes` · `Size` ·
`Deadline` · `Project` · `Assignee`. Group the view by `Project`.
- First print item added: **Startup Capital Roll-up Banner** (Project = Startup Capital, Size =
  "Roll-up banner, 85 x 200 cm", Status = Todo). Auri adds the print file to `Attachments`.
- Workflow going forward: Auri sends project + type + dimensions, I create the row + name it.

**MISTAKE + fix (important lesson):** I reused a record ID from an earlier fetch (when rows were
empty) and PATCHed it — but Auri had filled that row in the UI meanwhile, so I overwrote real data.
Auri restored it via Airtable cell revision history. **RULE: never reuse a stale record ID and never
overwrite existing rows in a table the user is actively editing. Always create a NEW row, and
re-fetch current state right before any write.**

---

### State of play for tomorrow (both Airtable boards, all UI-only steps left for Auri)

**Deadlines board (`tblKdmTuZRcCFMGjK`)** — DONE: 26 rows, one per deadline, across 15 projects.
Fields: `Project Name` (primary text) · `Project` (colored) · `Department` (colored, ownership) ·
`Deadline type` (select) · `Date` · `Days left`+`Flag` (auto) · `Lead` (linked to #TechBBCuties) ·
`Contact` (from page) · `Details` · `Page`. Leads set from page contacts on 22 rows.
Left for Auri (UI only — API can't do these):
- Group by `Department` → `Project`, sort by `Date`.
- Hide leftover fields: `Notes` (dup of Details), `Assignee` (use Lead), `Open date` (dup of Date),
  `Attachments` (empty). Optional: clear the 4 stray `Open date` values first (offered, not done).
- Assign `Lead` on the 3 blank projects: Startup Capital, Event Day Volunteers, TechBBQ Summit.
- OPTIONAL: to make the primary show the deadline type, edit the primary field → type Formula →
  `{Deadline type}` (API can't change field TYPE, only the UI can). Single-selects can't be primary.
- Re-run the site crawl each season (several source pages still showed 2025 dates).

**Prints 2026 board** — structure ready, 1 item in, Auri fills the rest.

**Team feed (`feature/team-feed`, unmerged)** — still needs: commit → review diff → merge to main;
confirm `ALLOWED_ORIGIN` on Vercel; paste `/team` embed into About Us. (See 2026-07-08 team entry.)

## Session 2026-07-08 (Brella) · Partners → Brella sponsors CSV

**Goal (Auri):** use the Airtable token to pull partner **name + tier + logo** and populate the
**Brella TechBBQ 2026 Sponsors page.** An external company reads the Brella API to render partners
on techbbq.dk; TechBBQ's job is getting the partners INTO Brella first.

**Key decision — it's two systems, two auths.** The Airtable token only READS Airtable. You cannot
write to Brella with it. Brella's write side: there is **no "Create Sponsor" API/Zapier action**
(Zapier only exposes Create Speaker/Invite; "New Sponsor Created" is a read-only trigger). So the
realistic path = **Brella admin → Import/Export Sponsor Profiles & Booths → CSV import.** Chosen
with Auri: **CSV import**, gate = **Status 2026 = Confirmed only**.

**Built:** `scripts/partners-to-brella-csv.mjs` → writes `scripts/out/partners-brella.csv`.
Reads `Partners 2026` (`tbl9V6ZtxEbR4uELC`) view **"Partners on Brella"**, keeps Status 2026 =
Confirmed, outputs columns `Company Name, Category(=Partnership Tier), Website, Logo URL`. Marketing-
safe allow-list (only those fields requested — deal/VAT/contacts never touched). Re-run anytime:
`node scripts/partners-to-brella-csv.mjs`. **Result: 47 confirmed partners, Name + Tier clean.**
Tiers: Challenger 17, Core 9, Pioneer 8, Main 8, Conqueror 4, Prime 1.

**Hard finding — logos are NOT usable from Airtable.** 0/47 confirmed have a usable logo. The
`Partner logo (from Partner logo (from Partner logo))` lookup returns the string `"0"` (broken) for
~30; 3 have `.zip` brand-asset bundles (not images); the rest blank. Airtable attachment URLs
(`v5.airtableusercontent.com`) also expire. Website is filled on only 2/47; LinkedIn/FB ~0. So the
CSV is effectively **name + tier**. Logos + socials must come from elsewhere.

**Source ambiguity to resolve:** Auri said "Partner Deliverables 2026", which is a REAL view
(`viw7FVbsTb9IRaWF0`) but on **`Marketing Project Overview`** (`tblTecOBecLQCNIeD`) — and per the
2026-07-07 note those rows are raw web-form submissions with almost no fields / no tier. The clean
tier+status data used here is the **`Partners 2026` CRM, view "Partners on Brella"**. Confirm which
source is the intended one before relying on the CSV.

**Next steps:**
1. **Confirm source view** — `Partners on Brella` (used, has tier) vs the `Marketing Project
   Overview` "Partner Deliverables 2026" view Auri named (no tier). One-line repoint in the script.
2. **In Brella:** create sponsorship **Categories** matching the tiers (Prime, Main, Core, Pioneer,
   Conqueror, Challenger) — Category is mandatory on import and must pre-exist.
3. **Import** `scripts/out/partners-brella.csv` via Import/Export Sponsor Profiles & Booths; map
   `Company Name`→Name, `Category`→category. Save as CSV (Comma Delimited) UTF-8, NOT MS-DOS.
4. **Logos:** marketing uploads 200×200 PNG/JPG per sponsor in Brella, OR enable Brella's **sponsor
   portal** so each partner self-uploads (recommended — offloads it). Airtable can't supply them.
5. Re-run the script as more partners flip to Confirmed to refresh the CSV.
6. **If full automation wanted later:** email Brella's integration team to confirm whether their
   REST API exposes sponsor create + get an API key + event ID; if yes, swap the CSV output for a
   direct push using the same mapping.

**Gotchas:**
- Airtable token **cannot write to Brella** — Brella needs its own credentials. Populating = CSV
  import (manual) unless Brella confirms an API sponsor-write.
- `source .env.local` in bash breaks on line 7 (`AIRTABLE_GATE_FIELD=On Website?` unquoted → shell
  parses `Website?`). The `.mjs` parses env itself, so run the script with `node`, not via sourcing.
- CSV is written with UTF-8 BOM + CRLF so Brella/Excel read `ø`/`ö` correctly.
- Two tier columns in `Partners 2026`: `Partnership Tier` (FORMULA, populated for all) vs `Tier`
  (manual single-select, blank for everyone). Always use `Partnership Tier`.

## Session 2026-07-08 · Team directory reconciled + new /api/team feed

**Reconciled `#TechBBCuties` (`tbldWne3PnvebIwif`, view `viwqFe9nMJGgytsRP`) against techbbq.dk/about-us.**
Source of truth = the public About Us page (27 people). Applied via Airtable REST (token has
records read+write, but NOT delete — see gotcha):
- Updated 6 stale titles (Benjamin +CIO, Thomas = Chief Projects and Strategy Officer, Maria
  Krupa = Growth & Data Scientist, Mette = Senior Event Manager, Roxy expanded, Jean-Jacques =
  Head of Partnerships). Fixed Mikael Hansen typo. Reactivated Jean-Jacques + Alixe (Alixe
  retitled to plain "Project Manager" per Auri).
- Added 8 new hires (Jutta Ruusunen CXO, Alev Burcin Aydin Jensen HR Manager, Maria Novytska,
  David Cabezon Egurrola, Mischa Dannerup Marais, Andrei Ratcu, Marie-Louise Nielsen, Sanne
  Gjedsted Sørensen) with name/title/email/photo/LinkedIn/department.
- Created a new **`LinkedIn`** URL field (`fldU5kG56RiVOFXem`); populated all 27 current people
  (URLs scraped off the About Us page via claude-in-chrome).
- **Replaced every current person's `Picture`** with their website headshot (all 27, verified
  ingested). Photos scraped as Elementor CSS-background URLs (`data-photo` tagging trick).

**Built the `/api/team` connector feed** (branch `feature/team-feed`, NOT merged). 4-file recipe:
- `lib/team.ts` — allow-list Name/Title/LinkedIn/Picture/Department ONLY (no email/phone/notes).
  Gate = `AND(Active=TRUE, NOT(FIND('Archive', ARRAYJOIN({Department}))))` — robust even while
  archived rows are still ticked Active. Optional `?department=` filter.
- `app/api/team/route.ts` — CORS + rate-limit + 1h cache, like the other feeds.
- `app/team/page.tsx` — dashboard w/ department filter tabs + CopyEmbed (bg-landscape-3).
- `TopNav` "Team" link; `embedSnippet` listKey union gained `"team"`.
- Verified: tsc clean, `/api/team` = 27, dept filter works, JSON has no PII keys, `/team` = 200.

**Decisions made w/ Auri:** feed exposes NO email (website shows it, but keep it out of a
machine-readable feed); gate = Active AND not-Archived.

**NOT done / next steps:**
1. Commit `feature/team-feed` → Auri reviews diff → merge to `main` (auto-deploys). Set/confirm
   `ALLOWED_ORIGIN=https://techbbq.dk` on Vercel. Copy `/team` embed into the About Us widget.
2. 16 people are `Department=Archive` but still ticked `Active` — untick to clean the table
   (feed already excludes them via the Archive guard). List captured this session.
3. New hires have no `Direct Report` (reporting lines) — needs managers from Auri.
4. 7 empty rows (1 fully empty + 6 department-only, blank Name) to delete — BLOCKED, see gotcha.
   Record ids: recCiVI7fTUhqhJF8, recun7VB0eFFoszOj, recUdIqY3yXruLdWo, rec62xJQqrtCVrfHF,
   recO8P8Qn2z0iL0qO, recSz3PqVqSImWBTj, rec44smW3zBaKmfuk. Plus 1 "IF big setup happens" note row.

**Gotchas:**
- **The Airtable token CANNOT delete records** (PATCH/POST work, DELETE → 403 INVALID_PERMISSIONS).
  Deletions must be done in the UI or the token/collaborator perms fixed.
- `Department` "Archive" is the existing convention for people who left; everyone off the public
  site already has it. Sandra Frandsen is the one exception (dept Operations, Active=False).
- Shell heredocs mangle `ø` — patch Sørensen by record id (`reco96rkUBbKnp8cw`), not by name match.

## Session 2026-07-08 (later) · Deadlines board set up

Built out the empty **`Deadlines`** table (`tblKdmTuZRcCFMGjK`, view `viw1eb9ExvXwvZv5t`
"Deadlines of projects and applications") into a project-deadline board per Auri's spec:
project name, lead, status, open date, close date, specific deadlines, associated page.
- Renamed `Date` -> **`Close date`** (formulas auto-follow by field id).
- Added fields: **Open date** (date), **Lead** (link to `#TechBBCuties`), **Specific deadlines**
  (multiline), **Page** (url).
- Added auto formulas: **Days left** = `DATETIME_DIFF({Close date},TODAY(),'days')`; **Flag** =
  Open / Closing soon (<=14d) / Expired.
- COULD NOT via API (token quirk): edit the `Status` single-select choices (rename + field-create
  work, but PATCHing select `choices` 422s every variant). Add `Open/Closing soon/Submitted/Won/
  Rejected` in the UI if wanted — the auto `Flag` already covers at-a-glance status. Also views
  can't be sorted/grouped via API (known limit) — do the date sort in the UI.
- **No data seeded from the base.** The base has NO current deadline data. Checked Projects &
  Fundraising (81 rows, all dated rows 2022-2025 / expired), Tasks (42 dated, 0 future), Marketing
  Project Overview (42 dated, 0 future). Held off dumping expired rows.
- **Seeded from techbbq.dk instead.** Crawled the site (WAF blocks curl -> use WebFetch; sitemap
  index at /wp-sitemap.xml). Fanned out 4 parallel agents over ~30 project/program/summit pages to
  extract real dates. Wrote **15 rows** (A: 6 application cycles + B: 9 dated 2026 events). Skipped
  stale prior-year pages (North Star 2025, Tech Talent 2025, Hardware 2023, Green Startups 2022,
  Board Summit/Policy Lounge/Side Events 2025) and no-date pages (Nordic 100, UrbanTech, Bridging
  the Gap, Founder Wellbeing, Social Impact, Impact Series, Register). Flag/Days left compute right
  (4 application cycles Expired, the Aug 25-27 summit cluster Open ~48d out).
- Lead left blank on all rows (Auri assigns). Next: assign Leads; refresh when 2026 pages update
  (several pitch pages still showed 2025 cycle info). Re-run the crawl each season to refresh.
- **Restructured to one-row-per-deadline (2026-07-08).** Primary field `Name` -> `Project Name`.
  `Close date` -> `Date`; `Specific deadlines` -> `Details`. Added `Deadline type` single-select
  (Applications open / Application deadline / Submission deadline / Announcement / Final pitch /
  Event / Other) — NOTE creating a NEW select w/ choices works via API; only EDITING an existing
  select's choices 422s. Exploded the 15 project rows into **26 rows**: multi-deadline projects
  (Life Science Pitch, Deep Tech Pitch, Startup Showcase, Hero, Volunteers) now have one row per
  milestone, each with its own Date + auto Flag/Days left; the 9 summits stay single Event rows.
  Approx dates (e.g. "end of June") stored as month-end with an "Approx" note in Details.
  UI-only left: group the view by `Project Name` + sort by Date (API can't edit views); hide the
  now-unused `Open date` and legacy `Assignee` columns.
- **Added colored `Project` + `Department` single-selects (2026-07-08).** Primary field can't be a
  select in Airtable, so `Project` (15 colored options) is a separate field for grouping/coloring.
  `Department` (8 dept options + auto-created "All departments") maps who owns each project:
  Program = Showcase/LS Pitch/Deep Tech Pitch/Hero/LS x Deep Tech; Partnerships = Family Office/
  Pension & Insurance/Investor Day/LP Forum/Startup Capital; Projects = Future of Fintech/Nordic
  India/Nordic-Africa; Event = Volunteers; All departments = TechBBQ Summit. Group by Department ->
  Project in UI. GOTCHA: setting a record's single-select to a NEW value with typecast:true
  auto-creates the option — the workaround for not being able to PATCH select choices directly.
- **Contact + Lead filled (2026-07-08).** Scanned each project page (3 agents) for the "who to
  contact" info -> new `Contact` text field, filled per project. Every contact is a real team
  member, so also set `Lead` (link to #TechBBCuties) from them: Jan Thordsen+Alixe Averty (LS/Deep
  Tech/LS x Deep Tech), Charles Kinga (Hero, Nordic-Africa), Marie-Louise Nielsen (Showcase), Rares
  Bagyo (Family Office/Pension&Insurance/Investor Day/LP Forum), Shri Harsha (Future of Fintech,
  Nordic India). Blank Lead: Startup Capital, Volunteers, Summit (no named page contact). Decided
  to use `Lead` (link, richer) over legacy `Assignee` (collaborator) — hide Assignee in UI.
  Used record IDs (not name+typecast) for links to avoid accidentally creating stray team rows.

## Session 2026-07-07 · Speaker sync (Supabase Hub -> Airtable)

**Re-ran the snapshot: Airtable 109 -> 115.** The Airtable "TechBBQ Summit" rows are a
COPY of the Supabase Speaker Hub, not a live sync, so they had drifted (Hub grew to 114).
Rebuilt the lost import script at `scripts/import_speakers.py` (dry-run by default, `--write`
to apply; idempotent, dedupes by normalized Full Name, only ADDS). Added the 6 missing
speakers (Dennis Green-Lieber, Johan Attby, Lishuai Jing, Nour Alnuaimi, Peter Carlsson,
Rui Eduardo). Airtable now 115; Supabase 114 (one Airtable name isn't in the Hub — harmless).

**Built an automatic sync as a protected Vercel route.**
- `lib/sync.ts` — `syncSpeakersToAirtable()`: reuses `fetchHubSpeakers` for the read,
  fetches existing Full Names (paginated), creates only the delta (batches of 10, typecast).
  One-way, add-only, never edits/deletes. Returns `{hubCount, existingCount, added, addedNames}`.
- `app/api/sync-speakers/route.ts` — GET+POST, gated by `CRON_SECRET` (constant-time compare,
  FAILS CLOSED if the secret env is unset). Vercel Cron / the Actions pinger send it as
  `Authorization: Bearer <CRON_SECRET>`. Tested locally: no-auth 401, wrong 401, correct 200/added:0.
- `vercel.json` — daily cron `0 6 * * *` (baseline; Hobby native cron only runs once/day, and a
  sub-daily schedule there can FAIL the deploy — kept daily on purpose).
- `.github/workflows/sync-speakers.yml` — every-3-hours pinger (the actual cadence, since Hobby
  cron can't). Needs GitHub secrets `SYNC_URL` + `CRON_SECRET`. Has `workflow_dispatch` for manual runs.
- `.env.example` updated (CRON_SECRET added; stale NISS gate vars replaced with the real NISS 2026 table/view).

**LIVE as of 2026-07-14.** Sync confirmed working (HTTP 200, ok:true, 128 hub / added 15).
Both schedulers now succeed: GitHub Actions every-3h pinger + Vercel daily cron backstop.
1. ~~Add `CRON_SECRET` to Vercel env~~ DONE — added to Production + Preview (matches `.env.local`), then redeployed prod so it takes effect.
2. ~~Branch + push / deploy~~ DONE — production redeployed via `vercel --prod`.
3. ~~GitHub repo secrets~~ DONE — `SYNC_URL=https://airtable-woad.vercel.app/api/sync-speakers` + `CRON_SECRET` (same value) set via `gh secret set`.
4. ~~Run workflow once to confirm~~ DONE — manual `workflow_dispatch` returned 200.

Root cause of the recurring failure emails: both GitHub secrets were never set (blank -> curl exit 3),
and even after that `CRON_SECRET` was missing from Vercel entirely, so the route failed closed with 401.
The daily Vercel cron had been failing the same silent 401 the whole time.

**Base-structure notes (from a Tier question, read-only — nothing wired to the connector):**
- The write target `Marketing Project Overview` (`tblTecOBecLQCNIeD`) also holds partner marketing
  rows. Its **"Partner Deliverables 2026" VIEW** = `viw7FVbsTb9IRaWF0` (54 records). Many are raw
  web-form submissions (Created by `anonymous+formpage@`) with almost no fields.
- **Two different tables get confused.** Deal amounts + working tier live in the **`Partners 2026`
  CRM** (`tbl9V6ZtxEbR4uELC`), NOT in Marketing Project Overview. The deliverables view is a separate
  table and its rows are **not linked** back to the CRM, so a partner's Deal/Tier never flows through.
- **Two tier columns in `Partners 2026`:** `Partnership Tier` = a FORMULA (auto, e.g. "Challenger",
  populated for everyone) vs `Tier` = a MANUAL single-select that is **blank for basically all rows**
  (nobody fills it). So "blank tier" almost always means "looking at the manual `Tier`, not the
  formula `Partnership Tier`." Marketing Project Overview's own `Tier` (single-select) is likewise
  manual, blank on 9/54, and its auto `Partnership Tier` link is empty because no rows are linked.
- Open idea (not started): auto-link deliverable rows to their `Partners 2026` record by company
  name so Deal/Tier populate automatically instead of by hand.

## Session 2026-07-02 · Side Events table + 2026 final-submissions view

Explored the **Side Events** table for the 2026 side-event submission flow (separate from the
NISS/Speaker feeds above; not yet wired into the connector).

- **Table:** `Side Events` = `tbljk4v9ivIc5b4YH` in base `appgXNjXJqpk9Ebxd`. Mixed schema (50+
  fields): event info, catering/lunch, barter deals, enquiry fields, per-year status fields.
- **2026 final-submissions view** = `viwGYLpFuwYLZi0Fi` ("Final submissions (side events) 2026",
  grid). Its filter is `Name is not empty` AND `Created is after <date>`. Started as
  `Created is after July 2, 2026`, which excludes anything created on July 2 (today) because
  `Created` is an auto timestamp that can't be back/forward-dated via API. Auri relaxed the
  operator so today's records show. Gotcha for future: rows created before the cutoff will
  never appear; only new submissions do.
- **Test records created via API (safe to delete):**
  - `recVslkJxjncpHhfB` — bare test row ("Test Entry · Claude").
  - `reccJSINPSjQUYyWL` — fully populated sample 2026 submission ("AI Workshop Demo Night 2026",
    Website status = Published, Date = August 27, Target Audience, etc.).
- **UTF-8 gotcha:** curl on this Windows box mangles `·` (U+00B7) into a display `�`, but the
  value stored in Airtable is correct — it's a terminal print artifact, not corrupted data.
  Verified via code-point readback (0xB7, no U+FFFD).
- **Form-for-2026 question — answered:** Airtable API can read/write RECORDS but CANNOT edit
  VIEWS, and a form is a view. So form title/text/layout/dates are **UI-only**. To make a 2026
  form, **duplicate the form view** in the UI (keeps 2025 intact) — both forms still write to the
  SAME table/fields; records are separated by the Created-date view filter, not by the form.
  DANGER: single-select options are shared table-wide — never RENAME/DELETE existing date options
  (e.g. `Date` = August 20-29, `Enquiry: Date` = 14/15 September) or you silently rewrite/strip
  2025 records. ADD new 2026 options instead. Field-option edits I CAN do via API; give dates.
- **Next if resumed:** get real TechBBQ 2026 dates → add (not rename) 2026 options to `Date`,
  `Enquiry: Date`, `Enquiry: Package type`; Auri duplicates + edits the form in the UI; decide
  whether to delete the two test rows.

## Current state (2026-07-02, NISS 2026 prod fix + NISS 2025 archive feed)

**Fixed prod NISS 2026 502.** Root cause was env drift, not code: Vercel still had a
stale `AIRTABLE_NISS_TABLE` (2025 table) from 2 days ago plus dead `AIRTABLE_NISS_GATE_FIELD`
/ `AIRTABLE_NISS_GATE_VALUE`, and no `AIRTABLE_NISS_VIEW`. Stale 2025 table + code's 2026
default view = Airtable 422 → 502. Fix: pinned table + view directly in `lib/niss.ts`
(removed the `process.env.AIRTABLE_NISS_*` reads) so leftover env vars can't override them.
Pushed to main (`ac7f019`), auto-deployed, verified all 4 prod feeds green. The three old
NISS env vars on Vercel are now dead (code ignores them) — delete when convenient. Same
session also confirmed the Supabase feed was fixed by adding `SPEAKERHUB_SUPABASE_*` on Vercel
(that was a separate missing-env issue — `/api/speakers-2026` was 503, now 200/109).

**Added NISS 2025 archive.** New feed for last year's roster (`tblyWVASxceyLRCaL`, same base).
Gate is `Status = "On website"` via filterByFormula (this table has no all-role public view;
the view Auri linked, `viwgis2pM9TepCjjN`, is Speakers-only and hides moderators). 38 people
live: 25 Speaker / 9 Moderator / 4 Team. Deleted / "delete from website" / "To be uploaded"
rows stay hidden. Safe fields: Name, Job title, Company Name, LinkedIn, Photo, Role (Note/copy/
Status kept internal). Table pinned in code, no env vars. Files:
- `lib/niss2025.ts` — fetch + Status gate + role filter (clone of `lib/niss.ts`, different field names).
- `app/api/niss-2025/route.ts` — proxy route, `?role=Speaker|Moderator|Team`.
- `app/niss-2025/page.tsx` — page with role filter (clone of `/niss`, bg-landscape-4).
- `components/TopNav.tsx` — new "NISS 2025" nav link.
Verified locally (all roles 200 with correct counts).

**Embed snippet refactored + per-page Copy buttons.** The Elementor snippet was duplicated
per page; extracted to one source of truth `lib/embedSnippet.ts` — `buildEmbedSnippet({path,
listKey})`. Targeting a table = the `path` (feed URL); `listKey` is the JSON array key
(`speakers` for the main feed, `people` for NISS). New `components/CopyEmbed.tsx` reusable
button (swaps `__ORIGIN__` → live origin on click). Added a filter-aware Copy button to
`/niss` and `/niss-2025`: it copies a snippet for the CURRENTLY selected role (e.g.
`/api/niss-2025?role=Moderator`), no hand-editing. `app/page.tsx` now uses the same generator
(removed its inline `EMBED_SNIPPET` constant). New `.copy-embed` pill style in globals.css.
Recipe to add a new event table (now ~4 files): `lib/<event>.ts` (table id + safe fields +
gate) · `app/api/<event>/route.ts` · `app/<event>/page.tsx` · one line in `TopNav` PROJECTS.

All of the above pushed to main this session; auto-deploys to airtable-woad.vercel.app.

**Reliability: 1h cache + stale fallback + fetch timeout.** Hardened all feeds. (1) In-memory
`cached()` TTL 5min→1h; on a failed refresh it now serves the last good value instead of
throwing (only errors if it never succeeded once). (2) CDN headers on all 4 routes 300s→3600s
`s-maxage`, `stale-while-revalidate` 600→86400 — Vercel edge serves cached JSON for an hour and
stale-while-revalidating for a day, so Airtable is hit ~once/hour/region. (3) New `lib/http.ts`
`fetchWithTimeout` (8s AbortController) used by all 4 feed libs so a hung upstream fails fast
instead of eating the Vercel function timeout. TRADE-OFF: an Airtable edit now takes up to ~1h
to appear (lower TTL_MS in rate-limit.ts + s-maxage if faster needed). Remaining risk not
covered: Supabase free tier pauses the 2026 project after ~7d idle (separate; move 2026 to
Airtable or keep it warm).

**Embed: photo-left row layout on mobile for moderators.** New `mobileLayout` option in
`buildEmbedSnippet` ("grid" default | "rows"). "rows" adds a `tbbq-rows` class → on
`max-width:600px` the card becomes flex (84px photo left, name+title right, single column).
Both NISS pages set `mobileLayout={role === "Moderator" ? "rows" : "grid"}`, so selecting the
Moderator filter and copying gives the row layout; presenters/team keep the 2-col grid. Desktop
unchanged (grid) for all. Re-copy the moderator block to apply.

**Embed: force fonts against theme override.** In WordPress the theme's typography was
overriding the card body text (title/company fell back to the theme font; name stayed Onest
because that was already explicit). Fix: `--sans` (Inter + system fallback stack) and `--head`
(Onest) CSS vars; `.tbbq-card__body p` and `h3` now set `font-family:var(--sans/--head)!important`
so the theme can't win. Re-copy embeds to apply.

**Embed: Load-more now optional; OFF for NISS 2025.** `buildEmbedSnippet` gained `loadMore`
(default true). NISS 2025 page passes `loadMore={false}` on its CopyEmbed — 2025 presenters
(25) would only reveal 5 more, not worth a button, so it renders all at once. Main feed (312)
keeps Load-more. NISS 2026 keeps it too (default). Re-copy the 2025 block to drop its button.

**Embed: unique id per copy (fixes two-blocks-on-one-page bug).** Two embeds on the same
WordPress page (e.g. "Previous Presenters" + "Previous Moderators") both used `id="tbbq-speakers"`,
so `getElementById` only found the first → the second block stuck on "Loading…". Now
`buildEmbedSnippet` takes a `uid` and both copy buttons generate a fresh id per click
(`tbbq-<rand>`), used for the section id + getElementById. Multiple embeds coexist. REQUIRES
re-copying both blocks and re-pasting into their HTML widgets.

**NISS 2025: curated moderators + status gate confirmed.** Status gate already excludes
`deleted` / `delete from website` / `To be uploaded` for ALL roles (only `Status = "On website"`
passes) — verified (Troels Licht = "delete from website" was already hidden). Added a curated
moderator allow-list in `lib/niss2025.ts` (`MODERATOR_ALLOW`, case-insensitive substring match):
only Zenia (Worm Francke), Christina Brinch (Clark), Julia Abrams, Nicolaj Geller (Christensen)
show as moderators. The other 5 on-website moderators (Eske, Mette, Mik, Kunal, Ashish) are
hidden. Speakers/Team unaffected. Counts: moderators 9→4, all 38→33. Hardcoded curation —
ideally moved to an Airtable Status/flag later.

**Embed snippet: Load-more + 2-col mobile.** The uploaded Elementor embed dumped all records
at once and collapsed to 1 column on phones. `lib/embedSnippet.ts` restructured: outer
`.tbbq-speakers` is now a block, inner `.tbbq-grid` holds the cards, plus a `.tbbq-more`
button. JS reveals 20 at a time (STEP=20) by appending (existing images don't reload). Mobile
(`max-width:600px`) forces `grid-template-columns:repeat(2,1fr)` = 2 presenters per row.
Applies to every copied embed (main + both NISS) since it's the shared generator. NOTE: the
dashboard NISS pages themselves still render all at once (no Load-more there yet) — only the
embed got it; main dashboard already had it.

**NISS pages: "speakers" → "presenters" (UI text only).** This event calls speakers
presenters. Renamed visible wording on `/niss` + `/niss-2025` only: h1, lede, and the role
tab. The tab still filters Airtable `Role = "Speaker"` — a `roleLabel()` helper decouples the
displayed word from the query value, so routes/JSON keys/embeds are untouched. Main + Supabase
pages keep "Speakers" (out of scope). Global meta description still says "speakers".

Next:
1. Delete the 3 dead NISS env vars on Vercel (`AIRTABLE_NISS_TABLE`, `_GATE_FIELD`, `_GATE_VALUE`).
2. Copy the embed from the DEPLOYED dashboard (not localhost) so `__ORIGIN__` bakes in the prod URL.
3. Optional: fix `.env.example` (still lists the old NISS gate vars — drift risk).
4. Optional: images are the main first-load cost — swap `<img>` for next/image or request a
   smaller Airtable thumbnail size (cards are small). API is 5-min server-cached already.
5. Optional: add a favicon (`public/` has none → harmless 404 in console).

## Current state (2026-07-01, hero backgrounds + repo consolidation)

Hero: replaced the animated OrbBackdrop blob with static TechBBQ brand images
(`public/backgrounds/bg-landscape-{1,2,4}.jpg`) via new `components/HeroBackdrop.tsx`
(image + left-weighted dark scrim for text legibility + bottom fade). Per page: `/`=bg-2,
`/speakers-2026`=bg-1, `/niss`=bg-4. Hero lede text brightened from grey #9a9a9c to
rgba(255,255,255,0.92); inline code in lede = pure white. `OrbBackdrop.tsx` now unused
(kept for now, safe to delete).

Repo: `Desktop/GITHUB/airtable` and this folder were TWO CLONES of the same repo
(`github.com/AuriDevcourse/airtable`, main). GITHUB one was stale at the last pushed
commit. Consolidated: committed all of today's work straight to main + pushed; GITHUB/
airtable is now the single home (pulled current, `.env.local` copied over since git can't
carry the gitignored secrets). The old `SideProjects/techbbq-airtable-connector` copy was
removed. WORK FROM `Desktop/GITHUB/airtable` GOING FORWARD.

## Current state (2026-07-01, NISS repointed to 2026 + Airtable import)

**NISS feed repointed 2025 → 2026.** Now reads `Nordic India Startup Summit (Registrants)`
table `tblfIPjV4t1c1628h`, gated on the curated VIEW `viwRMZMX5NeN68XX7` (env
`AIRTABLE_NISS_TABLE` + `AIRTABLE_NISS_VIEW`; old Status gate removed). `lib/niss.ts`
rewritten: safe fields = Full Name, Company Name, "Position at Company " (trailing space!),
Role, Linkedin/Social Profile link, Self Portrait (photo). No bio field in 2026 (bio="").
LinkedIn only used if it starts with http (field is free text, holds junk). Roles are now
Speaker / Moderator / **Team Member** (was "Team") — updated in route allow-list + page
ROLES + page heading (NISS 2026) + TopNav label. Feed verified: 3 people live (view is
still filling), role filter works. PII (email/phone/dietary/pitch decks) never exposed.
GDPR note: view is the gate; a `Confirm TechBBQ Usage of Information` checkbox exists if
we want to additionally require consent before showing someone.

**Airtable import DONE: 109 TechBBQ Summit speakers written.** Copied the 109 Supabase
`speaker_public_profiles` into Marketing Project Overview (`tblTecOBecLQCNIeD`, Speaker
view `viwfIcQFDNQ9ggSqx`) as new records, `Project Name = "TechBBQ Summit"` (option already
existed). Fields: Full Name, Company, Job Title, LinkedIn Handle (url), Profile Picture
(attachment, Airtable ingested all 109 from the Supabase photo URLs). Verified 109/109 with
photo + LinkedIn, 0 dupes. ONE-TIME snapshot, not a live sync. Re-runnable script (dedupes
by Full Name) at `scratchpad/import_speakers.py` — needs AIRTABLE_* + SPEAKERHUB_SUPABASE_*
env. Token has data.records:write on the TechBBQ base.

## Current state (2026-07-01, later)

**Speaker Hub source corrected → Supabase, not Airtable.** The real "Speaker Hub" is
a Lovable/Supabase app (zip: `Downloads/speaker-hub-techbbq.zip`), NOT the Airtable
`Speaker Hub 1:1` namesake table. Supabase project `dnzozouxwzxewguruoxr`. The Hub
ships a purpose-built public view **`speaker_public_profiles`** (PII stripped: no email/
phone/PA contacts; RLS gates who is public via `visible_in_directory`). Anon key reads
it fine → **109 speakers**, with linkedin + `ecosystem_role`.

New "TechBBQ Speakers 2026" feature:
- `lib/hub.ts` — now fetches Supabase `speaker_public_profiles` REST with the anon key
  (env `SPEAKERHUB_SUPABASE_URL` + `SPEAKERHUB_SUPABASE_ANON_KEY` in `.env.local`).
  Maps full_name/job_title/company/biography/photo_url/linkedin_profile/location/
  ecosystem_role. No extra gate — RLS/the view IS the gate.
- `app/api/speakers-2026/route.ts` — proxy route (same rate-limit + cache + CORS as others).
- `app/speakers-2026/page.tsx` — same card design as `/` (frame, glow, shimmer, search,
  Load More, mobile list). Cards link to LinkedIn.
- `components/TopNav.tsx` — new sticky top menu on every page: Speakers 2026 / Speakers
  (all) / NISS 2025. Add a project = one line in `PROJECTS`.
- Also this session: NISS card ported to the new design (was old layout); role badge
  recolored teal→orange; `scrollbar-gutter: stable` on <html> to stop the NISS role
  filter shaking the page.

Superseded: the earlier Airtable `Speaker Hub 1:1` approach (65 records, completeness
gate). The `AIRTABLE_HUB_*` env vars are gone. If any old code references them, remove.

Open decisions:
1. `ecosystem_role` values seen: co_founder, investor, journalist (+ more). This is the
   "types of speakers" Auri wants to section by. Journalists show in the public feed too
   — decide whether to filter roles or add a role segmented filter like NISS.
2. `segments_public` + `segment_speakers_public` views exist (stage, event_day, times,
   topic[], type) — the real "sections" (sessions/tracks). Not wired yet. Next if we want
   to group speakers by session/stage.
3. Confirm with TechBBQ that `speaker_public_profiles` (visible_in_directory) is the
   intended public list before this goes on techbbq.dk.

## Current state (2026-07-01)

Source-label pass: the eyebrow above each headline now names the speaker set + its
Airtable table, so it's obvious what data the page shows and where it comes from.
`app/page.tsx` → "TechBBQ main speakers · Airtable “Speakers” table" (was "TechBBQ ·
Airtable connector"). `app/niss/page.tsx` → "Nordic India Startup Summit · Airtable
“NISS 2025” table" (was just the summit name). Lede lines under each headline still
state the gate (`On Website?` / `Status = On website`) + JSON endpoint. Open follow-up:
main headline still says "Speakers preview" — swap to "Speakers 2026" if this is the
embedded-facing version.

Data recap (what actually leaves the server): `/api/speakers` returns 9 fields
(name, title, company, bio, quote, photo, linkedin, website) from `Speakers` gated
`On Website?`=TRUE. `/api/niss-speakers` returns 8 (name, title, company, bio, photo,
linkedin, role) from `NISS 2025` gated `Status="On website"`. Only NISS has a `role`
(Speaker/Moderator/Team) for segmenting; the main Speakers feed has NO type/track/stage
field pulled yet — if we want to split main speakers into sections, that column has to
be found in the ~200-field table first.

## Current state (2026-06-30)

Card redesign DONE (preview pages only): card is a padded dark frame (`.s-card`,
`padding: 8px`). Photo on top in `.s-card__media` (square `aspect-ratio: 1/1`, rounded
12px, `z-index: 1` so the hover glow can't bleed onto it), name + title in a padded
bottom band (`.s-card__overlay`, in normal flow below the photo). On **hover** a diagonal
glow fades in via `.s-card::after` (`inset: -8px` covers the whole card, reaches the true
bottom edge; gradient `115deg` black → red → orange → transparent, so the fire only shows
in the bottom band since the photo sits above it). Files: `app/page.tsx` (media wrapper +
overlay sibling), `app/globals.css` (.s-card / .s-card__media / .s-card__overlay /
.s-card::after / .s-card__name+meta white w/ text-shadow). `/niss` shares these styles.
STILL NOT ported to embed snippets — `public/elementor-embed.html` + `niss-embed.html`
keep the old photo-on-top + body-below layout. Port them next.
Tuning knobs: glow angle (115deg), black amount, red/orange stops, frame padding (8px),
photo shape (media aspect-ratio).

Per-image shimmer added (preview only): a `SpeakerPhoto` component (in `app/page.tsx`)
holds its own `loaded` state and shows `.s-card__media.shimmer` (+ `#1d1d1d` bg) until
its photo fires onLoad/onError. State lives in the component so SWR revalidation re-renders
can't restart the shimmer (the earlier classList.remove approach kept re-shimmering — bug
fixed). Reuses `tbbq-shimmer` keyframes. SkeletonGrid still handles the cold whole-grid
load. To see it: DevTools → Network → Slow 3G → hard refresh.

README: added top section "Add to a WordPress page (Elementor Pro)" — 7-step embed flow
(deploy → set ENDPOINT → drag Elementor HTML widget → paste snippet → publish → set
ALLOWED_ORIGIN).

Dashboard now self-serves the embed: the `.howto` `<details>` panel on `/` explains what
the snippet is and has a **Copy embed code** button (`copyEmbed`). It copies `EMBED_SNIPPET`
(constant in `app/page.tsx`) with `__ORIGIN__` swapped for `window.location.origin`. The
copied snippet is the NEW card ported to vanilla JS/CSS (frame, diagonal hover glow,
per-image shimmer via inline `onload`/`onerror`). So the canonical embed now lives in
page.tsx, generated fresh with the right feed URL. Gotcha: copy from the DEPLOYED Vercel
dashboard, else the baked-in ENDPOINT is localhost.

Preview now has search + pagination + responsive list (preview only, NOT in the embed
snippet yet): search bar filters by name/title/company; Load More shows `PAGE_SIZE` (12)
at a time and resets on search; under 640px the card grid is swapped for `.list-rows`
(60px thumbnail left, name/title right) via CSS media query; back-to-top button (`.scrolltop`,
fixed, appears after 600px scroll, Lucide-style chevron SVG). `SpeakerPhoto` now takes
`mediaClassName` so the row reuses it for the thumbnail + shimmer. All in `app/page.tsx`
+ `app/globals.css`. Heading still says "Speakers preview" (mockup said "Speakers 2026").
Defaults: `PAGE_SIZE = 20` (20 loaded, +20 per Load More). Desktop grid is `repeat(5, 1fr)`
(5 cols), 3 cols on tablet (641-1000px), list under 640px.

Next:
0. Decide if the WordPress embed (EMBED_SNIPPET) needs search + mobile list + Load More too,
   or if those stay preview-only. Currently the snippet is just the card grid.
1. The static `public/elementor-embed.html` + `niss-embed.html` still hold the OLD card —
   either regenerate them from EMBED_SNIPPET or just rely on the dashboard copy button.
2. Build a NISS variant of the copy button / snippet (`/api/niss-speakers`, role filter).
3. Deploy to Vercel (env vars + `ALLOWED_ORIGIN=https://techbbq.dk`), then test the copied
   snippet in a real Elementor HTML widget.

Pushed to GitHub: https://github.com/AuriDevcourse/airtable (`main`).

Photo crop fix: speaker headshots were center-cropped (`object-fit: cover` default
`50% 50%`), cutting foreheads/chins. Set `object-position: 50% 30%` in all three render
spots — `app/globals.css` (.s-card__img, covers `/` and `/niss`), `public/elementor-embed.html`,
`public/niss-embed.html`. Fixed heuristic, not per-face. If specific photos still crop
wrong, next step is server-side smartcrop focal points (smartcrop-sharp → `focusX/focusY`
in the JSON, computed once per image + cached, card uses `object-position: var(--focus)`).

## Earlier state (2026-06-26)

Working locally. Two feeds live and tested against the real base:

- `GET /api/speakers` — the big `Speakers` table, gated to `On Website?` = TRUE → 312 records.
- `GET /api/niss-speakers` — `NISS 2025` table, gated to `Status = "On website"` → 38 (25 Speaker, 9 Moderator, 4 Team). Optional `?role=Speaker|Moderator|Team`.

Both return only allow-listed marketing fields. No passport/DOB/email/phone leaves the server.

Preview pages styled to the TechBBQ design system (Onest + Inter, #0D0D0D, fire gradient,
orb backdrop, flat #131313 cards, pill segmented filter):
- `/` — Speakers preview
- `/niss` — NISS 2025 preview with role filter

Client UX: skeleton on cold load, `localStorage` stale-while-revalidate cache (instant
paint, background refetch, re-render only if data changed). Per-role cache keys.

## Architecture

```
Browser (techbbq.dk)  ──fetch──►  /api/* (token server-side)  ──►  Airtable
   no token, safe JSON only        allow-list + gate + cache
```

- `lib/airtable.ts` — Speakers fetch + `SAFE_FIELDS` allow-list + gate.
- `lib/niss.ts` — NISS fetch + allow-list + status gate + role filter.
- `lib/rate-limit.ts` — in-memory rate limit (60/min/IP) + 5-min response cache.
- `lib/useCachedList.ts` — client SWR-over-localStorage hook.
- `app/api/speakers/route.ts`, `app/api/niss-speakers/route.ts` — handlers (CORS, rate-limit, cache headers).
- `components/OrbBackdrop.tsx`, `components/SkeletonGrid.tsx`.
- `public/elementor-embed.html`, `public/niss-embed.html` — paste-into-Elementor snippets (TechBBQ-styled, load Onest via Google Fonts).

## Gotchas

- Token (`.env.local`, gitignored) is reused from the `docs-to-airtable` kit in Downloads.
  It now has `data.records:read`. If it ever 502s, re-check the scope at airtable.com/create/tokens.
- The raw `Speakers` table mixes marketing fields with passport numbers, DOB, emails. NEVER
  widen `SAFE_FIELDS` without checking what you're exposing.
- Server cache TTL is 5 min, so a fresh Airtable edit can take ~5 min to appear. Drop
  `TTL_MS` in `lib/rate-limit.ts` to 60s if faster updates are needed.
- Ran `npm run build` then `npm run dev` once → corrupted `.next` (404 chunks). Fix: stop
  dev, `rm -rf .next`, restart. Don't interleave build and dev on the same `.next`.

## Next steps

1. Deploy to Vercel; set env vars there + `ALLOWED_ORIGIN=https://techbbq.dk`.
2. Decide which feed/role the techbbq.dk page uses (speakers only vs incl. moderators).
3. Point the embed snippet `ENDPOINT` at the deployed URL, paste into an Elementor HTML widget.
4. Confirm every `On Website?` / `On website` record is actually meant to be public this year.
5. GDPR: public names/photos/bios need a lawful basis + a line in /privacy.
6. Optional: port skeleton + cache into the embed snippets; add a light-background embed variant.

## Run

```bash
npm install
npm run dev   # http://localhost:3000  and  /niss
```
