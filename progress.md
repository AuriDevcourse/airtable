# Progress · TechBBQ Airtable Connector

Server-side proxy that exposes a **safe slice** of the TechBBQ Airtable as JSON, so
techbbq.dk (WordPress + Elementor) can show speakers without the token or PII ever
reaching the browser.

> **Newest first. Sessions from 2026-08-13 and earlier are in
> [`progress-archive.md`](progress-archive.md)** — this file was split on 2026-08-17 at 486KB,
> because a handoff too large to open is not a handoff. Headings carry a DATE rather than a letter:
> two people writing in parallel had produced two (w)s, two (x)s, two (z)s and two (aa)s.

## SESSION · 2026-08-17 · THE PUBLIC FAQ ON techbbq.dk, 11 EDITS · NO REPO CODE CHANGED

**CURRENT STATE.** `techbbq.dk/faq` (WordPress post **15331**, Elementor) is corrected, saved and
**LIVE**. Nine of its 98 toggle items changed. Verified twice: 21 assertions against the Elementor
model before saving, then 20 against the published HTML. Zero failures at both stages. **Nothing in
this repo was touched** — this entry exists because the page is now the third surface that has to
agree with `lib/eventGuide.ts`, and because the method below is worth not rediscovering.

**WHAT WAS WRONG AND WHAT IT SAYS NOW**

| Item | Was | Now |
|---|---|---|
| Venue Location | **Emma Gads Vej 1** (a third wrong number: the guide had 23, the truth is 25) | Emma Gads Vej 25 |
| Opening hours | the literal word **"Tentative – Stage program ends"**, twice, on a public page | 17:30 Wednesday, 17:00 Thursday |
| Badge Claim | "Alternative Pre-Event Badge Claim Point **will be disclosed later in the year**" | both pickup points with dates, times, full address, plus a Pickup options block |
| Cloakroom | **8:00 – 28:00 on Thursday** | 21:00, and named as the Keypitt™ wardrobe with the KeyPass fast track |
| Cloakroom | "offered **free of charge**", contradicting the guide's 35 DKK | jackets free, luggage 35 DKK |
| Luggage Storage | no price, Thursday 21:00 | 35 DKK, so the two answers finally agree |
| Lost & Found | "visit the Info Desk" | Info Desk **in Hall E** |
| Info Desk | "conveniently located **near the check-in area**", Thursday 18:00 | Hall E, Thursday **19:00** |
| Food & Beverage | "will feature **barbecue setups** for you to enjoy" | food court, cafés, kiosk, hot and cold food, brisket |
| Relaxation | **Re-Charging Zone** | Longevity Lounge |
| Prohibited items | no mention of animals | "Animals, unless it is a service or assistance animal" |
| Startup Program stall | "applications open in **spring 2025**" | "open **each spring**" |

**TWO CONTRADICTIONS WERE INSIDE THE FAQ ITSELF**, not against us: the cloakroom closed at both 28:00
and 21:00 on the same Thursday in two adjacent answers, and it was free in one and priced in the
guide. A page that answers the same question twice will eventually answer it differently.

**ONE JUDGMENT CALL.** Auri approved "2026" for the Startup Program line, and by 17 August the 2026
applications are long closed, so "open in spring 2026" would have promised a date nine days in the
past. Written as "each spring": true every year, no maintenance. Flagged to him.

**LEFT ALONE:** the FAQ still says the cloakroom is "directly in front of the check-in area", which
agrees with the guide. Everything else — transportation, accessibility, water, payments, recycling,
WiFi, safety, first aid, code of conduct, health measures, and the whole ticketing and media sections
— has no stale years, no impossible times and no placeholders.

**HOW TO EDIT THIS PAGE AGAIN, because none of it is guessable:**
1. The FAQ is ~20 Elementor **Toggle** widgets, 98 items total. Structure is
   `.elementor-toggle-item > .elementor-tab-title + .elementor-tab-content`.
2. **Do not type into the page.** Use Elementor's own command API from the editor's top window:
   walk `elementor.documents.getCurrent().container` for `widgetType === 'toggle'`, read
   `model.get('settings').get('tabs')`, and write with
   `$e.run('document/elements/settings', {container: c.repeaters.tabs.children[i], settings:{tab_content: html}})`.
   `document/repeater/settings` does NOT exist in 4.2.2; the repeater CHILD container is the handle.
3. **Surgical string replace inside the existing HTML**, never a rewrite: the copy is wrapped in
   `<span style="font-weight: 400;">` and carries links, and replacing whole blocks loses all of it.
   Match on the plain sentence, not on tags you reconstructed from a text dump — that fails.
4. Save with `$e.run('document/save/update')`, then confirm `elementor.saver.isEditorChanged()` is
   false. Collapsed toggle content is in the DOM but invisible, so read it with `textContent`, not
   `innerText`.

**GOTCHAS**
- **`curl` against techbbq.dk returns 455 from the WAF** (733 bytes, not the page). A green run of
  assertions against that response is meaningless — every "absent" check passes on an empty body.
  Verify published pages through the browser.
- **The Chrome bridge blocks any JS result containing a URL or query string** ("BLOCKED: Cookie/query
  string data"). Strip `https?://…` and `?&=` out of anything you print, or the call returns nothing
  and looks like a code failure.
- A `remainingOld` count is a false alarm when the replacement text CONTAINS the string it replaced.
  Count occurrences in the result instead.

**FILE POINTERS** · none in this repo. The page is WordPress post **15331**;
`lib/eventGuide.ts` is the sibling surface that must keep agreeing with it.

---

## SESSION · 2026-08-17 · 23 PARTNER ROWS + 5 COMPANY LINKS WRITTEN TO AIRTABLE · JYSKE BANK → PIONEER

**CURRENT STATE.** Every confirmed partner now has a Partner Deliverables 2026 row: **211 confirmed,
0 missing, 220 rows**. Company Links: **8 empty → 3**, and the 3 left cannot be linked rather than
were skipped for caution. Jyske Bank Growth now renders in the **Pioneer** band, not Core.

**WRITTEN TO AIRTABLE TODAY — a git revert does NOT undo any of it.**
- 21 rows created, then 2 more (The Energy Consortium IIT Madras `rectnu6tS97RH2zYI`; Greeks in the
  Nordics `rec2WNf1a3YskerWf`). Auri then deleted 4 of the first batch, deliberately.
- 5 `Company Link` cells filled.
- Nothing was ticked "Put on web" and no logo was touched.

**TWO NEW SCRIPTS** (both dry-run by default, `--commit` to write)
- `scripts/add-missing-deliverables.mjs` — creates a deliverables row for every confirmed partner
  that lacks one.
- `scripts/link-company-links.mjs` — fills empty `Company Link` cells by Partner ID.

**THE TRAP THAT NEARLY UNDID AURI'S WORK.** "Idempotent" is not "safe to re-run". The add script
skips what already exists, and **a row Auri DELETED looks exactly like a row that was never
created** — so the second run was about to resurrect all four deletions. Hence `NEVER_CREATE`
(ids 62, 2550, 272, 1444) with a written reason per id. Any script that reconciles two tables by
absence needs this list, or it will fight the human.

**WHY THOSE FOUR ARE NOT PARTNERS.** The CRM files an upsell or add-on as **its own row with the deal
name appended** — "Ada Ventures promo" (62) beside "Ada Ventures" (2103), "Business Turku Oy Ab
upsell" (2550) beside "Business Turku Oy Ab" (2196). They are second INVOICE LINES, not second
companies, and a name match misses them because of the suffix. Plus "CPH Fintech" (272) = Copenhagen
Fintech Lab (1468), already live, and Novo Nordisk Denmark AS (1444), which Auri does not want on the
wall (it is genuinely distinct from Novo Nordisk Foundation, id 2091, Prime).

**THE LINKER'S GUARD, and why it is not optional.** A shared Partner ID does NOT prove two rows are
the same company: deliverables "AWS Startups" carries id **2222, which belongs to NVIDIA** in the
CRM. Linking on the id alone would have filed AWS under NVIDIA, silently and permanently. So a match
must also share a NAME TOKEN, with generic words (network, group, ventures, denmark, …) excluded so
"…Network" cannot match anything else ending in Network.

**MATCH ON THE ID, NOT THE LABEL.** Two rows were unfindable by name and instant by id:
"Professional Women of Colour Network (ProWoc)" is filed as "ProWoc - Professional Women of Colour",
and "rebriQ" as "rebriQ by Improve Business".

**JYSKE BANK → PIONEER** · `TIER_EXCEPTIONS` in `lib/partners.ts`. The band comes from DEAL SIZE, and
their 2026 deal of 157,500 reads as Core at any reading. But the CRM's own
`Partnership Success Tier/Type 2026` says "Pioneer Partner" and the deliverables
`Partnership Type 2026` says "Pioneer " — two human-set columns already agreed, only the
price-derived one dissented. That clears the table's documented bar ("the deal cannot express the
tier"). Delete the entry if the deal is ever repriced.

**GOTCHAS**
- `Partnership Type 2026` means DIFFERENT things in the two tables and shares no vocabulary. The add
  script translates via `TYPE_MAP` and leaves the cell BLANK where no mapping exists — a blank type
  means no tier resolves and the row stays off the wall, which is the honest state.
- The CRM type field is a MULTI-select and the mappable value is not always first: FailForward is
  `["Barter Deal", "Community Partnership (Non-commercial)"]`. Reading `[0]` threw away the half that
  translates.
- **There is almost nothing to copy from Partners 2026.** Of the 21: ZERO logos, ZERO LinkedIn URLs,
  ONE website (Cherry Ventures). The new rows are shells; the logo still has to come from the partner.
- Prior-year rows in the FULL deliverables table (3,811 rows, not the 220-row view) DO carry this
  data. Copenhagen Fintech and FailForward both already have white SVGs there.
- Greeks in the Nordics was added via `FORCE_INCLUDE` while its CRM status still reads "Contract
  Sent". Delete that entry once the status is corrected.

**NEXT STEPS**
1. **Finish the deploy** — `4dcdfa0` is on `origin/main` but production still runs the old build.
   `npx vercel login`, then `npx vercel --prod`. Beyond Beta and Jyske Bank are NOT in that commit.
2. Re-copy the NISS embed into Elementor after deploying (`PEOPLE=false` is baked into the paste).
3. **Fix AWS Startups' Partner ID** — 2222 is NVIDIA's. Pick the real AWS row (four exist, all "To Be
   Contacted"), confirm it, correct the id. That id is also the Brella key.
4. Crescita Partners and Erhvervsfremmebestyrelsen have **Partner ID 0** and cannot link; Crescita has
   no CRM row at all under any spelling.
5. Set the CRM status for Greeks in the Nordics to Confirmed.
6. **Consider reading `Partnership Success Tier/Type 2026` instead of hardcoding TIER_EXCEPTIONS** —
   it already said Pioneer for Jyske Bank unaided. Check how widely it is filled first.

**FILE POINTERS** · `scripts/add-missing-deliverables.mjs` (`NEVER_CREATE`, `FORCE_INCLUDE`,
`TYPE_MAP`) · `scripts/link-company-links.mjs` (the name-token guard) · `lib/partners.ts`
(`TIER_EXCEPTIONS`, `LOGO_SCALE`) · deliverables view `viw7FVbsTb9IRaWF0` · CRM `tbl9V6ZtxEbR4uELC`.

---

## SESSION · 2026-08-17 · BEYOND BETA'S LOGO BROKE ITS TILE · PARTNER DATA AUDITED (READ-ONLY)

**CURRENT STATE.** One code change, uncommitted: `LOGO_SCALE["Beyond Beta"]` in `lib/partners.ts`,
**1.96 → 0.94**. Verified in the browser — the mark now sits 257x140 inside a 309x185 tile with no
overflow. Everything else this session was READ-ONLY analysis of Airtable; nothing was written there.

**THE LOGO BUG, and it will recur.** 1.96 was correct when Beyond Beta's file was a thin wordmark in a
mostly-empty canvas. The partner replaced it with a TIGHT CROP: `scripts/measure-logo-ink.mjs` now
reports **ink at 100% of the image box**, AR 5.05, `cap` 0.94. The old nudge was doubling a logo that
already reached its own edges. **A stale nudge is worse than none** — re-run that script whenever a
partner replaces artwork.

**DO NOT "FIX" SKYTEK OR PSV.** A DOM sweep of all 191 logos flags Skytek (2.11) and PSV (2.92) as
overflowing their tile's bounding box. They are correct. Their files are 77% and 88% transparent
margin, so only the empty box overflows and no ink leaves the tile — PSV sits at 2.92 against a cap of
3.19, Skytek exactly on its cap. **Comparing `getBoundingClientRect()` to the tile is the wrong test
for this wall**; the ink measurement is the right one.

**PARTNER DATA FINDINGS (nothing changed, these are for Auri to action)**
- **rebriQ and "Improve Business" are ONE partner.** Partners 2026 calls it "rebriQ by Improve
  Business" (`rec7CNLgVenUt1LVh`, id 2886). The deliverables view has both as separate rows, one
  ticked. Delete one rather than ticking the other.
- The three unticked rows with no Company Link resolve by Partner ID:
  Global Stratalogues → `recDHm8Qsl13EZbH3` · Knowledgeboard → `recXehwBIIWOvLcQD` ·
  rebriQ → `rec7CNLgVenUt1LVh`. All three are Confirmed in Partners 2026.
- **Knowledgeboard is duplicated in Partners 2026 too**: a stray lowercase "knowledgeboard"
  (`recB6q1C1ljczEA23`, id 2939, To Be Contacted) beside the confirmed row.
- **21 Confirmed partners have no deliverables row** (209 confirmed vs 200 rows). Seven are Community
  Partnerships (AI Oresund, French Tech Copenhagen, Lithuanian Professionals, Lithuanian Youth
  Society, Mentorspace Lithuania, ProWoc, REBBLS). Six have NO type set so no tier can resolve. Three
  are Add-on/Tailored, which the wall filters out anyway. Several read as line items rather than
  partners ("Ada Ventures **promo**", "Business Turku **upsell**"). **DPIIT shares Partner ID 2060
  with the existing Embassy of India row**, so it is probably one relationship under two names.
- Earlier in the session the view went 213 → 200 rows as Auri deleted duplicates live. **Zero
  duplicates now remain among the ticked rows.** Numbers in older entries are stale by design.

**GOTCHAS**
- `viwDhqsDpfEf0PRyI` is **"2026 Overview", the whole 2,655-row pipeline**, NOT a confirmed list.
  "Confirmed" is a GROUP inside it. Filter `{Status 2026}="Confirmed"` instead, or you diff the entire
  CRM against the wall and get 2,306 false positives.
- `measure-logo-ink.mjs` needs the dev server up and matches on a loose name filter; "Beyond Beta"
  quoted returned nothing while `beyond` worked.
- Building over a running dev server fails with `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`.
  Stop the dev server and `rm -rf .next` first.

**NEXT STEPS**
1. **Finish the deploy.** `4dcdfa0` is on `origin/main` but production still runs the old build —
   `npx vercel login` then `npx vercel --prod`. The push alone triggered no build, and the commit
   author is Auri's normal identity, so check Project Settings → Git rather than assuming the
   Hobby author-block.
2. After deploying, **re-copy the NISS embed into Elementor** — `PEOPLE=false` is baked into the
   pasted snippet and no deploy reaches it.
3. Commit the Beyond Beta fix; it is not in `4dcdfa0`.
4. Link the three Company Links above, and resolve rebriQ vs Improve Business.
5. Decide which of the 21 confirmed-but-missing partners deserve a wall row.
6. Two NISS faces still blocked by DUPLICATE roster rows: Archana Jahagirdar, Anand Unnikrishnan.

**FILE POINTERS** · `lib/partners.ts` (`LOGO_SCALE`) · `lib/logoFit.ts` (area rule, nudge ceiling 3) ·
`scripts/measure-logo-ink.mjs` · deliverables view `viw7FVbsTb9IRaWF0` · Partners 2026
`tbl9V6ZtxEbR4uELC`.

---

## SESSION · 2026-08-17 · THE EMBED'S LINKS WERE WEARING THE HOST THEME'S FONT

**CURRENT STATE.** Links in the event guide now render as body text that happens to be clickable, in
both surfaces. Proved under a deliberately hostile theme in a real browser: every font property on the
anchor matches its parent exactly, where before the theme won. Not committed.

**THE BUG.** Auri, 2026-08-17, with a screenshot of the Wardrobe panel: the KeyPass link sat inside a
13px Inter sentence rendering a size larger, bolder and in a different typeface. Nothing was wrong with
our CSS. It simply never claimed those properties:
- `lib/eventGuideSnippet.ts` has a THEME RESET listing `h2, h3, p, ul, li, figure` and **not the
  anchor**. Its only anchor rule was `a{background:none;box-shadow:none;border:0}`.
- So a host rule like `a{font-family:Georgia;font-size:21px;font-weight:800}` lands ON the element,
  and an element-level declaration beats the 13px the anchor should inherit from `.eg-body`.

**THE FIX.** Every font property pinned to `inherit!important` on the scoped anchor selector, so a link
TRACKS ITS CONTAINER rather than matching a fixed value — it has to work inside 13px muted body copy, a
list item and a lead line. The only things a link may differ by are the brighter colour and the
underline, and the underline now carries `!important` too, because a theme with
`a{text-decoration:none}` would strip the one signal that survives for a reader who cannot see the
colour difference (SECURITY.md r9: colour alone is never the affordance).

`app/globals.css` `.eg-body a` gets `font: inherit` for the same reason. It has no hostile theme to
defend against, but the preview stops being a preview if the two drift.

**VERIFIED, not reasoned about.** A throwaway page under `public/` (same origin, so the feed's
techbbq.dk CORS pin does not block it) carrying the built snippet plus a theme demanding Georgia 21px
800 uppercase blue with no underline. All 5 links: **zero mismatched font properties against their
parent, underline intact, colour brighter than the body**. Same result on `/event-guide`, all 5 at 13px.
The test page is deleted; the recipe is this paragraph.

**SECOND PASS, SAME DAY: `!important` EVERYWHERE IT WAS MISSING** (Auri: "I think we do need to use
sometimes important"). The first pass fixed the anchor and left three leaks, all found by turning the
test theme up to `!important` on every property of every element:

1. **The reset's `font-size/line-height/font-weight:inherit` had no `!important`**, so a theme's
   `p{font-size:19px!important}` beat it and the panel scaled up. Now `inherit!important`.
2. **That change raised the stakes on every class rule below it.** `.eg-h` is the h2,
   `.eg-panel__title` the h3, `.eg-eyebrow`/`.eg-lead`/`.eg-day` are p, `.eg-tags li` is an li — all in
   the reset's selector list. Without `!important` on their own font declarations the reset would have
   flattened every heading, pill and lead line to 16px regular. Eight rules gained it. **With
   `!important` on both sides, specificity decides and a class beats an element, which is the order we
   want.** If you add a class rule setting font-size, font-weight or line-height on one of those six
   elements, it needs `!important` or it will not apply.
3. **THE LEAK THAT MATTERED MOST: `div`, `section` and `span` were never claimed.** Every reset says
   `font-*:inherit`, which faithfully inherits whatever the DIV above it computed. Under
   `div{font-family:Georgia!important;font-size:19px!important}` the eyebrow came out Georgia and the
   venue-details list came out 19px, because its `ul` sits inside an unclassed wrapper div. They now
   have their own **font-properties-only** rule. Not the box model, on purpose: `.eg-section` carries
   `margin:0 auto 88px` without `!important`, so a `margin:0!important` there would flatten the layout.
   That is why it is a separate rule rather than three more selectors on the reset.

Also `font-style` and `text-align` on the root, which a theme's italic and centring were overriding.

**MEASURED AFTER, under a theme setting every property `!important` on a, p, h2, h3, ul, li, figure,
div and span (Georgia 19px 800 italic uppercase centred, links blue and undecorated):**

| Element | Computed |
|---|---|
| `.eg-h` | 38px, 600, Onest, centred, normal |
| `.eg-panel__title` | 24px, 600, Onest |
| `.eg-eyebrow` | 10px, 600, Inter, uppercase (was **Georgia**) |
| `.eg-body p` | 13px, 400, Inter, normal (was 19px/800/Georgia/italic) |
| `.eg-list li` | 13px (was **19px**) |
| `.eg-tags li` | 9px, 600, uppercase |
| `.eg-tab` | 13px, 500, Inter |
| all 5 links | **zero** mismatched properties vs parent, underline intact |

**NOT hardened: `app/globals.css`.** The dashboard has no hostile theme and controls its own cascade;
`!important` there would be cargo-cult. Its only change is `font: inherit` on `.eg-body a`.

**GOTCHAS**
- **TWO DEV SERVERS WERE RUNNING FOR THIS REPO** and both were writing into one `.next`, which threw
  ENOENT on `_buildManifest.js.tmp` and `app-paths-manifest.json` and 500'd `/api/event-guide` for
  several minutes. Look for two `next dev --turbopack` processes before blaming the code:
  `wmic process where "name='node.exe'" get processid,commandline | grep airtable`, then check which
  pid owns 3000 with `netstat -ano | grep :3000`. Kill the one that owns nothing, clear `.next`,
  restart. Same family as the build-over-dev conflict in session (x).
- **NO BACKTICKS IN COMMENTS INSIDE THESE SNIPPET FILES.** The whole stylesheet is a template literal,
  so a backtick in prose ends the string. `tsc` caught it (TS1005 at the line); the browser would have
  got a syntax error and a blank widget.
- **The reset's `font-size:inherit` on `p` has no `!important`**, so my test theme's
  `p{font-size:19px!important}` did beat it and the whole panel scaled up. Deliberately not changed:
  that comment explains why `inherit` was chosen, techbbq.dk's theme only uses `!important` on h2/h3
  font-family, and my test was more hostile than reality. Since links now track their parent, the guide
  stays internally consistent even when a theme does resize it.
- Only `.eg-body a` is styled. A link anywhere else in the guide would inherit the reset but get no
  colour or underline; there are none today.

**FILE POINTERS** · `lib/eventGuideSnippet.ts` (the `#id a` reset and `.eg-body a`) ·
`app/globals.css` (`.eg-body a`, around line 3142).

---

## SESSION · 2026-08-17 · EVENT GUIDE: AURI'S CORRECTIONS, PLUS THREE CONTRADICTIONS THEY EXPOSED

**CURRENT STATE.** `lib/eventGuide.ts` carries Auri's 2026-08-17 corrections. All 15 changes verified
in the live `/api/event-guide` feed, `/event-guide` returns 200, `tsc` clean. One file, so the page,
the API and the pasted embed all move together. Not committed.

**APPLIED AS GIVEN**
| Panel | Change |
|---|---|
| Venue | Emma Gads Vej **23 → 25**. Wrong street number on a public page, and it was the venue's own entrance. |
| Badge Claim | 20 Aug now **11:00 – 18:30**; 24 Aug now **14:00 – 18:00** with the full address instead of just "Bella Center Copenhagen". |
| Badge Claim | Bulk partner collection is **the 20th only**. Unqualified it read as a standing offer, so a partner could arrive on the 26th expecting to collect for a whole company. |
| Lost & Found | Info Desk **in Hall E**. |
| Info Desk | Where: "You will find us in Hall E". Thursday hours **18:00 → 19:00**. |
| Venue Layout | Printed maps dropped, the app's virtual map named instead. |
| Prohibited Items | **"Animals, unless it is a service or assistance animal"** added. |
| Relaxation | Re-Charging Zone **→ Longevity Lounge**, all four mentions plus the eyebrow and the image alt. |

**THREE THINGS THE CORRECTIONS BROKE, fixed in the same pass:**
1. **The Info Desk was in two places.** Venue Layout said "Check-in, wardrobe and the Info Desk:
   straight ahead from Entrance 1" and the Entrance panel said "Check-in and the Info Desk visible
   immediately as you enter". Both now name Hall E or drop the desk. A guide that puts the help desk
   in two places is worse than one that names neither.
2. **The panel title outlived its copy.** "Maybe we should not promise a BBQ" fixed the paragraph but
   left the heading reading **BBQ Experience**, which promises the barbecue louder than a careful
   paragraph can take it back. Retitled **"Food and drink on site"**; the tab stays "Food & Beverage".
3. **"Signage are up"** → "Signage is up". Auri's wording, his grammar slip.

**IMAGES SWAPPED (four of the five Auri sent).** All five URLs return 200. I opened each one before
writing its `alt`, because the old alt text was describing photos nobody had looked at — see Lost &
Found below.

| Panel | New file | Alt now says |
|---|---|---|
| Venue | `2026/08/Venue.jpg` | Bella Center facade under the TechBBQ banner, attendees at the Entrance 1 doors |
| Entrance | **the same file** | the Entrance 1 revolving doors |
| Transportation | `Copy-of-27091709A1-…` | an attendee stepping out of a car, bicycles racked behind |
| Venue Map | `Copy-of-IMG_3701-2-…` | an elevated view across a hall, stands and walkways |
| Lost & Found | `Copy-of-28103228C3-…` | two staff at a service desk, tagged coats on racks behind |

- **Entrance reuses the Venue file** because Auri said "entrance the same", and it works: the doors in
  that photo are labelled Entrance 1. The cost is two adjacent tabs with one picture.
- **Lost & Found was the worst image in the guide** and nobody had noticed: the old file was a Silent
  Events crew member holding an armful of headphones, under alt text claiming it showed "the TechBBQ
  info desk where lost and found items are handled". Invented alt text on a public page. The new photo
  reads as the wardrobe (coat racks) rather than the Info Desk in Hall E, and is still far better.

**SEVEN MORE SWAPPED** (second batch, same session). All URLs 200, every photo opened before its
`alt` was written. **12 of the guide's 30 panels are now on 2026 photography**; the other 18 are still
2024/2025.

| Panel | New file | What the photo actually is |
|---|---|---|
| Wardrobe | `Copy-of-27091109C1-…` | the Keypitt desks with the **Fast track sign in shot** — best match in either batch |
| Info Desk | `Copy-of-27100543C1-…` | staff at laptops behind a desk |
| Water Stations | `Copy-of-27120416C1-…` | **the Garden Hall itself**, glass roof and planting. The panel is titled "Free water in the Garden Hall", so this shows somebody where to go in a way a close-up of a tap cannot |
| Event Platform | `Copy-of-28115820C3-…` | the **numbered** matchmaking tables: the platform's output, not its interface |
| Workspaces | `Copy-of-IMG_3405-scaled.jpg` | laptops on tall shared benches (note: no `-TechBBQ-2025` in this filename, unlike the rest) |
| Facility Safety | `Copy-of-27093727B1-…` | one person in a wide, clear hall |
| Prohibited Items | `Copy-of-27101335D1-…` | two attendees at a stand; scenery, like the audience shot it replaces |

**A BETTER ANSWER FOR THE ACCESSIBILITY PANEL FELL OUT OF THIS.** `Copy-of-27093727B1` (now on Facility
Safety) is a wide, clear, unobstructed walkway with one person crossing it — which is literally the
Accessibility panel's "Wide, clear walkways" bullet. If Auri wants that panel refreshed, this photo
answers it; the badge-on-a-table below does not.

**`2024/07/Networking-at-TechBBQ.jpg` IS USED TWICE**, on Brella and Table Reservation. Pre-existing,
not introduced here, and the Event Platform photo above would suit Table Reservation if it needs one.

**NOT SWAPPED · `Copy-of-27100938C1-TechBBQ-2025-scaled.jpg`, meant for "access".** That panel is the
**Accessibility** panel (accessible entrances, lifts, service animals, a support phone number) and the
photo is **a 2025 badge on a lanyard lying on a table**. Putting it there would say nothing about
access and would delete the one image whose job is to show it. It is also the only PORTRAIT file in the
set (1707×2560; the other four are landscape), so it will crop differently from every other panel.
It belongs on **Badge Claim**, which currently uses `2025/01/badge-claim.webp`. Waiting on Auri.

**PAGE WEIGHT.** The four "-scaled" files are 2560px and 436 KB to 953 KB each, against the 100-200 KB
WebP they replace. Nothing renders them at that size. Worth WebP versions before the guide is busy.

**OPEN QUESTIONS — none of these are guesses I should have made:**
1. **"hot and warm food"** was written as **"hot and cold food"**. Hot and warm is the same thing
   twice; cold is what a food court actually adds. Confirm.
2. **"Biohacking devices" KEPT** in the Longevity Lounge. Auri's list gave two items and was cut off
   mid-word ("Breathwork sessio"), so it is not evidence the third is gone.
3. **Is One Thirty Labs still co-hosting** the room under its new name? A rename cannot answer that.
4. **The wardrobe still closes at 18:00 on Thursday** while the Info Desk now runs to 19:00. Attendees
   with coats in the wardrobe have an hour where the desk is open and their jacket is locked up.
   Check-in also still reads 9:00 – 18:00 both days.

**FILE POINTERS** · `lib/eventGuide.ts` is the whole guide: `GUIDE_SECTIONS`, one entry per tab.
`lib/eventGuideSnippet.ts` renders it for WordPress and needed no change. `app/event-guide/page.tsx`
is the preview.

---

## SESSION · 2026-08-17 · TWO DESCRIPTIONS WRITTEN INTO BRELLA

`brella-set-descriptions.mjs`, dry run by default, `--commit` applied 2026-08-17. Copy from Auri.
Both rows verified by READING THEM BACK — a 200 from this API is not evidence that a field landed.

| Timeslot | Was | Now |
|---|---|---|
| 975699 · Nordic IPO & Stock Market Day | **empty** | 5 paragraphs, 923 chars |
| 975697 · Board Summit by Boardway | one line: the document name | 2 paragraphs, 337 chars |

**NORDIC IPO IS PURE GAIN.** Content was empty, which is why the block read as five hours with a
title and nothing else. It now shows on techbbq.dk too (938 chars with Brella's subtitle line) beside
the PDF link. Combined with session (x), Event Room 3 goes from the worst block on the board to a
described session with a full programme one press away.

**BOARD SUMMIT COST TWO THINGS, both flagged to Auri:**

1. **THE WRITE DESTROYED A HYPERLINK AND THE API CANNOT PUT ONE BACK.** The row's only content was
   the line "Boardway_TechBBQ_Program_2026", and that text was a LINK to the programme on Google
   Drive (`drive.google.com/file/d/1VDre9Bcf7tsKNrWr8XL9OdrjSy8bCGtz`). `content` writes as a plain
   string, which produces an empty entityMap, and the Draft.js shape is rejected outright. So the
   script restates the URL as **plain text on a second line**, pointing at our own copy on techbbq.dk
   rather than at Drive. One action in Brella's admin turns it back into a link; deleting the line
   leaves Auri's copy verbatim.
2. **IT DOES NOT REACH techbbq.dk.** `lib/boardOverride.ts` (session (x)) drops this row, so the
   blurb lives in the attendee app only. **This is new**: the Policy Stage's dropped row holds 42
   characters, the document's filename, so nothing was ever lost there. A programme blurb on the
   dashed band is the fix and it is not written.

**ONE EDIT TO AURI'S COPY, disclosed:** "their capital needs evolve — and a stock market listing"
became "evolve, and a stock market listing". His own no-em-dash rule, applied to his own text.

**GOTCHA** · pinned timeslot ids are the rot risk here, so the script ABORTS if an id is missing or
its title has changed. The 15:35 Investor Reverse Pitch was deleted and recreated during NASS, which
changed its id; writing a description onto whatever row now holds a stale id is worse than writing
none.

---

## SESSION · 2026-08-17 · SIX PROGRAMMES LINKED · THE BOARD SUMMIT COLUMN IS REAL NOW

**BRANCH** `board-summit-programme-link`, continuing session (w).

**CURRENT STATE.** Five PDFs wired, one wording for all of them, and the Board Summit column on the
Brella board is the real 14-session agenda instead of a blank rectangle. **Verified against the live
feed: 280 sessions, 14 in Day 3 Event Room 1, 19 sessions carrying a PDF link, Brella's all-day Board
Summit row gone.** Nothing deployed.

**THE DEV SERVER IS SERVING 500 ON EVERY ROUTE, AND IT IS NOT THESE CHANGES.** `.next/BUILD_ID` and
`.next/trace` were written at 15:36 while `next dev --turbopack` (pid 11560) was running. That is the
documented conflict — a production build writing into the dev server's `.next` — and it takes down
`/`, `/program` and `/api/*` alike. `tsc --noEmit` is clean and the feed capture above was taken after
every edit. **Fix: restart `npm run dev`.** Do not run `next build` while dev is running.

**1 · FIVE PDFs, ONE WORDING.** All in `lib/sessionProgrammes.ts`. The label is now the shared
constant `SEE_FULL` = **"See the full program (PDF)"** (Auri's words). It was per-entry before, which
with six entries just meant six slightly different sentences for one action.

| Session | Match | File |
|---|---|---|
| Beyond Unicorns | `^beyond unicorns` | `Closing-Loops-TechBBQ.pdf` |
| Board Summit | `^board summit` | `Board-Summit-Program-2026.pdf` |
| **Nordic IPO & Stock Market Day** | `^nordic ipo` | `Nordic-IPO-2026_Program_A4_Midnight-2pages.pdf` |
| **AI That Sells** (Microsoft) | `^ai that sells` | `TechBBQ-Ai-that-sells.pdf` |
| **CBC Initial Pitching** | `^creative business cup` | `CBC26-@TechBBQ-programme-overview.pdf` |
| **CBC Global Finals** | `^cbc global finals creativity` | same file |

The CBC Global Finals regex carries `creativity` on purpose: the pushed sub-session is titled exactly
"CBC Global Finals", so `^cbc global finals\b` would put the link on both the parent and the child.

**2 · `lib/boardOverride.ts`** · the fourth substitution, modelled on `policyOverride` and
`nassOverride`, wired in `app/api/program/route.ts` after the NASS merge with its own try/catch.
Drops Brella's all-day Event Room 1 row on the 27th and puts the 14 Airtable sessions in the column,
each with `programme: "Board Summit"` (which earns the dashed whole-day band), moderators-then-
speakers, and **`programmeUrl` on every row including Check-in and the break**.

The PDF on every session is not decoration: dropping Brella's all-day row drops the only pressable
thing that carried the link, because the band that replaces it is derived and cannot be clicked. Auri
asked for both ("if we have speakers and everything, let's add it up, but make sure to have also pdf
program").

**BAND MARGIN IS ZERO AT THE END.** The 14 sessions run 09:00 to 16:00, and `spansMorningToEvening`
needs start ≤ 11:00 and end ≥ 16:00. If Boardway ever moves Closing Remarks to end at 15:50, the
column silently loses its band and stops announcing itself as a whole-day programme.

**3 · TWO PDFs ARE MORE THAN A LINK — they contain agendas we do not have as data:**
- **Nordic IPO** · the PDF is the WHOLE programme: **14 timed items and 25 named speakers** (Sara
  Sjölin/Bloomberg, Adam Kostyal/Nasdaq, Øivind Amundsen/Euronext Oslo, Sander Janca-Jensen/Flatpay,
  Kjetil Houg/Folketrygdfondet…), 12:30 networking through the 16:55 closing bell. Typing it into the
  Sessions table the way NASS and the Policy Stage were is the real fix. Note it ends **17:15** where
  Brella books the room to 17:30.
- **AI That Sells** · the PDF has the times the Brella description lacks (14:30 doors, 14:40
  Microsoft, 14:50 Antler/Speedinvest, 15:20 Anthropic demo, 15:50 roundtables, 16:30 drinks).

**4 · THE CBC FILE ON techbbq.dk IS THE OLD ONE.** `CBC26-@TechBBQ-programme-overview.pdf` is
byte-identical (md5 `3ec8e307…`) to `Downloads/CBC26 @TechBBQ - programme overview.pdf`, PDF
creationDate **14 August**. The **17 August** revision is the `(1)` copy, still not uploaded. Upload
it OVER the same filename and no code changes. `CBC_2026_Program.pdf` is also uploaded and is
deliberately linked from nowhere: wrong weekdays, superseded times.

**5 · STILL MISSING, AND IT NEEDS A DECISION** (Auri supplied the content, 2026-08-17):
- **Event Room 4, 26 August = Defence & Dual Use Summit** (`techbbq.dk/defencedualuse-summit/`).
  Programme is `09:30 – 17:30 | Summit Sessions (TBA)` — one block, no agenda yet. The 27th's Defence
  Tech & Cyber Arena DOES have times (09:30 keynote, 09:40 panel, 10:00 fireside, 10:15 keynote,
  10:30 roundtables) plus the 08:00 Royal Reception, which is already on the board as a side event.
- **Event Room 6, 27 August = Dansk Svensk Summit (TechBBQ), 09:30–14:00.** Title and span only.

Both rooms are **EMPTY IN BRELLA**, so neither a PDF link nor an override helps: there is no row to
hang anything on. Two ways in, and it is Auri's call: **push the blocks to Brella** (fixes the
attendee app too, which matters more than our board, but writes to the live event) or **type them
into the Sessions table and add an override** (our board only). Recommended: push to Brella, since an
attendee looking at Event Room 4 on the 26th currently sees nothing at all.

**6 · NOT DOING** (Auri): Northstar Pitch finalists ("we have it in mind for now, but we dont do it"),
the Fundraising Bootcamp workshop ("should be fine"), Future of Fintech descriptions ("seems to be
fine").

**FILE POINTERS** · `lib/sessionProgrammes.ts` (six entries, `SEE_FULL`) · `lib/boardOverride.ts` ·
`app/api/program/route.ts` (the fourth merge).

---

## SESSION · 2026-08-17 · BOARD SUMMIT: PDF LINK + THE 4 MISSING PEOPLE · CBC PROGRAMME CHANGED

**BRANCH** `board-summit-programme-link`, off `main` (which was carrying session (v)'s uncommitted
NISS flag; that change came along and is untouched).

**CURRENT STATE.** Boardway's run of show is linked from both surfaces that show the Board Summit, and
all 31 of its people are now published. `needsRole` is empty for the first time. Nothing is deployed.

**1 · THE PDF LINK** · `https://techbbq.dk/wp-content/uploads/2026/08/Board-Summit-Program-2026.pdf`
(Auri uploaded it to WP media). Two surfaces, because the Board Summit is two different objects:
- **The Brella board** carries it as ONE all-day row, 31 people heaped on it, no times — the Beyond
  Unicorns shape. One entry in `lib/sessionProgrammes.ts` (`/^board summit\b/`) puts the link on that
  card, and therefore on `/brella-program`, the pasted embed and `/api/program?event=brella` at once.
- **The agenda embed** (`?event=board`, 14 real sessions) gets a new `doc` option in
  `lib/agendaSnippet.ts`, wired on the `board` entry in `app/program/page.tsx`. **ONE link above the
  list, not one per session** — the same document answers all fourteen rows, and Auri's ask ("add this
  link to all the sessions") is satisfied by it being unmissable once rather than repeated fourteen
  times. Say the word if he wants it per row instead.
- The link also renders on the `/program` dashboard itself, so it can be checked without pasting a
  snippet into WordPress.

**2 · THE 4 MISSING PEOPLE** · `scripts/board-summit-fill-roles.mjs` (dry run by default, `--write`
applied 2026-08-17). One cause, two symptoms: the four people with no `Role` in Marketing Project
Overview were both **off the roster wall** (the `BOARD_ROLES` gate in `lib/boardsummit.ts`) and
**missing from their sessions**. Roles read off the PDF's own labels, per Auri: Interviewer/Moderator
→ Moderator, Interviewee/Speaker/Panel/Keynote/Founders → Speaker.

| Person | Role | Session | Cell was |
|---|---|---|---|
| Barbara Myhre Isaksen | Moderator | Human Judgment in AI | empty |
| Henrik Horn Andersen | Moderator | Technology, Trust & Society | `TBC` |
| Line Kloster Pedersen | Speaker | Boardroom Dilemmas | not listed |
| Frederikke Schmidt | Speaker | Boardroom Dilemmas | not listed |

Verified live: 8 moderator slots, 27 speaker slots, **every one of the four has a face**, roster
`counts` now `{Speaker: 25, Moderator: 6}`, `needsRole: []`.

**3 · WHAT THE PDF SAYS THAT WAS NOT WRITTEN** — deliberate, all four need a human:
- **"Can Europe Compete?" lists Bjarne Corydon as MODERATOR and names no panel.** He is currently a
  Speaker. Moving him leaves a card with a moderator and nobody speaking, which is worse than the
  mislabel. **Ask Boardway who the guest is.**
- **"Stable Talk" moderator is blank in the PDF too.** The cell still says `TBC`.
- **Two name spellings disagree.** PDF `Bianca Bruun` vs CRM `Bianca Bruhn`; PDF `Thomas Koefod` vs
  CRM `Thomas Koefoed`. The CRM's spelling is what the rest of techbbq.dk shows, so nothing changed.
- **Two counts in the PDF disagree with its own lists**: "Panel (4x)" on Technology, Trust & Society
  names 3; "Founders (3 x)" on Boardroom Dilemmas names 2. One person may still be unnamed on each.
- The PDF's "Live Interview" files Henriette Divert under *Interviewee* and Viktor Axelsen under
  *Speakers*. That is the PDF's typo — she is Interviewer on the two sessions either side — and the
  data already has it the right way round.

**4 · CBC: THE PROGRAMME WE PUSHED TO BRELLA IS OUT OF DATE.** Not fixed, only found. Auri has four
files; the newest is `Downloads/CBC26 @TechBBQ - programme overview (1).pdf`, PDF creationDate
**2026-08-17**, vs `...overview.pdf` at 2026-08-14 and `CBC_2026_Program.pdf` (the one
`brella-push-cbc.mjs` was built from) older still. The new programme is a **different agenda**:

| | old (in Brella now) | new (17 Aug PDF) |
|---|---|---|
| 26 Aug | 14:00–17:00, pitching blocks | **15:00–18:00**, Welcome · Creativity & AI panel · CBC Denmark jury · Keynote · Winner |
| 27 Aug | 09:30–13:00, 7 sub-sessions | **09:30–12:30 Global Finals + 12:30–13:00 Winner announcement** |
| weekdays | Tue 26 / Wed 27 (**wrong**) | Wed 26 / Thu 27 (correct) |

So the **13 CBC sub-sessions live in Brella are wrong on times and titles**, and the parent Day 1
block (15:00–17:30) matches neither. It also names people the old one did not: Rasmus Wiinstedt
Tscherning, Ondrej Spala, Sarthak Ahuja, Anne Rahbek, Petra Kaukua, Michael Bjørnlund, Edina Bugar,
Mthabisi Bokete, Anna Sofia Abrahamson. **Next: rewrite `brella-push-cbc.mjs` off the 17 Aug PDF and
delete the stale sub-sessions.** Do not run the old `--parent` fix; its 14:00 start is from the dead
version.

**5 · THE LINK WAS THERE AND COULD NOT BE FOUND** (Auri, 2026-08-17: "on here there is no link
whatsoever"). Both halves of that are true, and the second is the bug. Verified in his own Chrome: the
anchor renders correctly in the dialog, and the board gave no sign it existed — the mark now does.
- **`ProgrammeBadge` / `ProgrammeIcon`** (`components/ProgramTimeline.tsx`, Lucide file-text via
  `PROGRAMME_ICON_PATHS` in `lib/brellaTheme.ts`, `.bp-doc` in `globals.css`). On any card whose
  session has `programmeUrl`: the pill with the word on a list card and on an all-day block, the bare
  icon inside the title on a timeline card (which can be 24px tall).
- **A mark, not a link.** The card is already a `<button>`; an anchor inside it is invalid markup and
  a coin-flip for which one a tap hits. The PDF stays in the dialog.
- **The board also opens on DAY 1 (26 August) and remembers the last day you chose.** Board Summit is
  27 August, so it is not on the tab you land on. Not changed, but it is half of why he saw nothing.

**6 · THE REAL FIND: BRELLA HYPERLINKS ARE BEING THROWN AWAY.** Auri: "there is a Google Drive link".
There is — inside Brella's Draft.js `content.entityMap` — and `lib/brellaprogram.ts` flattens the
content to text and drops every one. **26 of 303 timeslots carry a link.** 21 are sign-ups already
captured separately as `registerUrl`, so the losses are:

| Session | Dropped link |
|---|---|
| Beyond Unicorns | Drive `14D4qkms_RlRv4L0z8qKNQF0Rc3DCWcIe` |
| Board Summit by Boardway | Drive `1VDre9Bcf7tsKNrWr8XL9OdrjSy8bCGtz` |
| CBC Initial Pitching | Drive `1pH9lanDlZ45Dlrke7HLMJlnN7Hxx_JhH` |
| CBC Global Finals & Creativity & AI | Drive `1s5P_Wnn4udz24Eta6vxF7Jyz2qMZcLwb` |
| Policy Stage | Drive `1Mz5TiwWsuOXKfvHnp8Qutcaviy1NoBa9` |
| **Scaling Europe** | `cloud.google.com/events/scaling-europe` — and its description ends with the dead words "REGISTRATION LINK". No `registerUrl` on this row, so the sign-up is unreachable. A real bug, not a nicety. |

**Proposed, NOT DONE, needs Auri's call:** read `entityMap` in the mapper and use the first link as a
**fallback** for `programmeUrl`, with `lib/sessionProgrammes.ts` overriding it wherever we host the
PDF on techbbq.dk. Then no programme can silently lose its document, the hand-maintained list shrinks
to "which ones do we serve ourselves", and Scaling Europe's sign-up comes back. The reason to ask
first: it puts **Google Drive URLs on a public techbbq.dk board**, where a sharing permission nobody
re-checks is a dead link in front of attendees.

**GOTCHAS**
- **`Role` in Marketing Project Overview is a `multipleSelects`, not a single select.** A bare string
  422s with "Cannot parse value for field Role". Options: Speaker, Moderator, Keynote, Managing
  Partner, Host. The script writes `["Moderator"]` and **keeps an existing role** rather than
  replacing it.
- **`GET /v0/<base>/<table>/<recordId>` does not accept `fields[]`** — it 422s on one. Use the list
  endpoint with `filterByFormula=OR(RECORD_ID()='…')` to keep the field allow-list.
- A 422 rejects the **whole** PATCH batch, so the first failed run wrote nothing. That is the reason
  `typecast` is off here.
- Three CRM names carried **double spaces** ("Barbara  Myhre   Isaksen"), visible on the public roster
  wall. Collapsed in the same PATCH. The name join folds whitespace anyway, so nothing depended on it.
- Both board feeds sit behind a 1h cache. Use `?fresh=1` or the dashboard refresh button.

**FILE POINTERS** · `lib/sessionProgrammes.ts` (both PDF entries) · `lib/agendaSnippet.ts`
(`AgendaOptions.doc`, `escapeHtml`, the `.tbbq-agenda__doc` CSS, `var DOC`) · `app/program/page.tsx`
(the `board` entry's `doc`, `CopyAgendaEmbed`, the dashboard link) ·
`scripts/board-summit-fill-roles.mjs` (rerunnable, idempotent).

---

## SESSION · 2026-08-17 · NISS REWIRED TO THE TYPED CELLS + A ROSTER ON /program

**CURRENT STATE.** `/program?event=niss` publishes the people from `Speaker Details` /
`Moderator Details`, matching Airtable exactly: **41 people across 10 sessions, 37 with a face**. A
**speaker & moderator roster** now sits under the agenda on the NISS tab only. Dev server only,
nothing deployed.

**WHY THE REWIRE (Auri's call).** NISS was the one programme reading LINKED records
(`Session Lineup` → `tblfIPjV4t1c1628h`). Those links disagreed with the typed cells on **eleven of
thirteen** sessions, and the typed cells are what the NISS team keeps current — Brella agreed with
the cells, not the links. Two sessions ("Nordic VC Outlook 2026", "Nordic Founder Pitch") were linked
to the SAME four people, i.e. a copy-pasted cell. The link fields are left in the table, unread.

**THE PARSER HAD TO LEARN NISS'S FORMAT.** Other programmes write "Name, Title, Company · …". NISS
writes "Thomas Heshe – EasySBC · Tim B. Madsen – Copenhagen Quantum" and sometimes joins two people
with ";". `parsePeople` now splits name/meta at whichever comes FIRST, a dash or a comma
(earliest-wins keeps every older programme byte-identical), and the dash rule is deliberately narrow:
an en/em dash always, a plain hyphen ONLY when a space follows. Without that last part
"Peter Winther-Schmidt" and "Co-Founder" get cut in half.

**THE SEMICOLON IS OPT-IN, AND THAT MATTERS.** Splitting on ";" globally silently broke **NASS on six
sessions** — it uses ";" INSIDE a job title ("Development Economist; Diaspora & Transnationalism"),
so it invented nameless phantom people. Now `semicolonSplitsPeople: true`, set on NISS alone. Do not
turn it on for a source whose cells you have not actually read.

**FACES COME FROM THE ROSTER.** Reading typed cells lost the portraits the links used to bring (20 of
41). Added `facesFromView` → the NISS table's "NISS Speaker and Moderator List 2026"
(`viwRMZMX5NeN68XX7`), joined by name, which took it to 37. The session's own photo cell still wins
where filled — that is how Sara Resvik got a face without existing in the roster at all.

**THE ROSTER SECTION** · `NissRoster` in `app/program/page.tsx`, consuming the pre-existing
`/api/niss-speakers` (same table, same view — no new feed was needed). 40 people, Moderators then
Speakers, portrait + title + company + LinkedIn. Anyone the roster holds that **no session names** is
flagged "not on the agenda", recomputed per render, because Auri explicitly does not want to
cross-check two lists by hand. NISS only; verified absent on NASS and Policy Stage.

**GOTCHAS**
- **Honorific matching order.** Strip punctuation FIRST, then the honorific. `mr\s+` never matches
  "mr." while the dot is there, and Manish Prabhat was flagged as missing from the session he opens.
  Same fix covers "Dr.Rajneesh".
- **Duplicate roster rows are dropped as ambiguous**, not guessed. Three names appear twice (one
  "Speaker", one "already on the website"): **Anand Unnikrishnan, Rajat Tandon, Archana Jahagirdar**.
- Photo counts that disagree with people counts mean photos are dropped for that whole group, by
  design. A wrong face beside a wrong name is worse than none.
- The roster grid is ~40 lazy images; they load on scroll. 76 images "pending" in a headless check is
  `loading="lazy"` doing its job, not a broken proxy (measured: 10 parallel proxy reads in 1.4s).

**STILL OPEN IN AIRTABLE (no code can fix these)**
1. **`Colin Brown Sparkmind Capital`** in India Shark Tank has no separator — needs "Colin Brown –
   Sparkmind Capital". Until then it is one long name with no face.
2. **`Anand Unnikrishan`** in the session cell vs **`Unnikrishnan`** in the roster.
3. The three **duplicate roster rows** above.
4. **Thomas Marschall** is in India Shark Tank but exists NOWHERE in the 469-row NISS table.
   LinkedIn: https://www.linkedin.com/in/thomas-marschall-bb280a6/ . Auri: leave unplaced people
   alone, so this is informational.
5. Ten roster people are flagged "not on the agenda". Five are spelling drift (Chandra R Srikanth vs
   **Chandra Ranganathan**, Tim Bruun/Tim B., Amit Kumar/Amit K., Bendjazia/Bendjazi,
   Unnikrishnan/Unnikrishan); five are genuinely unplaced and Auri is fine with that.

**VERIFIED** · `tsc --noEmit` clean · `npm run audit:fields` clean · before/after diff across all
nine programmes shows **only NISS changed** · roster renders on the NISS tab and no other.

**FILE POINTERS** · `lib/program.ts` (the `niss` source, `semicolonSplitsPeople`, `parsePeople`) ·
`app/program/page.tsx` (`NissRoster`, `nameKey`) · `lib/programFaces.ts` (the name join) ·
`lib/niss.ts` + `app/api/niss-speakers` (the roster feed, unchanged).

---

## SESSION · 2026-08-17 · NISS EMBED DROPPED ITS 8 SPEAKERS · ONE FLAG

**CURRENT STATE.** The `/program` copy-embed for **NISS 2026** now renders its line-up. Verified in a
real browser: 13 rows, **8 people, 8 photos loaded**, Moderator/Speakers labels correct. One line of
config changed, no API or data change.

**WHAT WAS WRONG.** `/program` renders `onStage` for every event **unconditionally**
(`app/program/page.tsx:540`), but the copied snippet gates faces behind a `PEOPLE` flag
(`lib/agendaSnippet.ts`, `function people(st){ if(!PEOPLE||!st) return ""; }`). The flag is opt-in per
event in the `EVENTS` array, and **NISS never set it** — it was written before any programme named
people, and nobody revisited it when NISS gained a line-up. So the dashboard showed 8 people and the
snippet you pasted showed none. The data was always there.

**THE FIX** · `app/program/page.tsx` · `people: true` on the `niss` entry. That is the whole change.

**AUDITED THE REST.** Cross-checked all 9 events' `onStage` data against their `people` flag. NISS was
the only mismatch — nass 52, fintech 21, policy 34, board 31, pension-summit 23, family-office 9,
lp-forum 20, investor-day 15 people, all already flagged. NISS had 8 and no flag.

**GOTCHAS**
- **The snippet fetches PRODUCTION, always.** It hard-rejects a localhost ORIGIN and falls back to
  `https://airtable-woad.vercel.app`, so nobody pastes a dev URL into WordPress. Good guard, but it
  means **this fix does nothing until deployed** and cannot be tested by pasting locally.
- To test an embed locally you must strip that fallback from a throwaway copy. CORS on the real feed
  is pinned to `techbbq.dk`, so a localhost test page is refused by the production API by design.
- The copy button writes to the clipboard, and `navigator.clipboard.readText()` hangs on a permission
  prompt under automation. Patch `navigator.clipboard.writeText` before clicking and read the captured
  string instead.
- `public/niss-embed.html` is **unrelated legacy** · a NISS **2025** speaker wall on
  `/api/niss-speakers`, not the agenda. It has no `PEOPLE` flag and needed no change. Do not "fix" it.
- **This class of bug is not covered by `npm run audit:fields`.** That audit checks Airtable field
  types; this was a page-config flag. The general shape — the dashboard renders something the embed
  silently omits — has no guard yet.

**NEXT STEPS**
1. **Deploy.** Sessions (t), (u) and (v) are all dev-server only. The NISS embed on techbbq.dk still
   drops its speakers until this ships.
2. When any programme starts naming people, set `people: true` on it. The type comment in
   `lib/agendaSnippet.ts` now says so at the definition.
3. Consider a guard for the real pattern here: an event whose feed carries `onStage` while its config
   has `people` off is always a mistake, and could fail a check rather than wait for someone to notice.
4. Re-check the 6 NISS sessions still marked `lineupPending` once the NISS team fills them.

**FILE POINTERS** · `app/program/page.tsx` (the `EVENTS` array, the flag, and `OnStage` at :540) ·
`lib/agendaSnippet.ts` (the `people` type comment + the `PEOPLE` gate).

---

## SESSION · 2026-08-17 · THE SAME BUG, MADE UNREPEATABLE · `npm run audit:fields`

**CURRENT STATE.** A schema audit now cross-checks **every** Airtable field this repo reads against
its real type in the base. It found a **second live instance** of the session (t) bug, which is fixed.
All feeds verified, `tsc --noEmit` clean. Nothing written to Airtable, nothing deployed.

**WHY.** Session (t) fixed `/policy-stage` by hand. That fixes one field. The actual problem is that
Airtable lets anyone flip single-select to multi-select from the UI, the cell silently changes from
`"Speaker"` to `["Speaker"]`, `str()` returns `""`, and **nothing throws, nothing type-errors, no test
fails**. The feed just quietly serves nothing. It cannot be caught by reading the code, because the
code looks right.

**THE NEW GUARD** · `scripts/check-field-types.mjs`, run with **`npm run audit:fields`**.
Pulls the live base schema (53 tables) and checks all 64 lib files for:
1. **Reader vs real type** · `str()` on a multi-select / attachment / linked-record is BROKEN, since
   those arrive as arrays. Also `num()` on text, `firstPhoto()` on a non-attachment, and so on.
2. **Fields that no longer exist** · a renamed or mistyped column reads as empty forever.
3. **Fields read but never requested** · Airtable returns only what `fields[]` asks for, so reading a
   column absent from the allow-list gives `undefined` every time.
Exits **1** on anything BROKEN, so it can gate CI. Handles formula/rollup unwrapping via
`options.result.type`, and both allow-list spellings (a `SAFE_FIELDS` array and inline
`params.append("fields[]", …)`).

**WHAT IT CAUGHT** (beyond the known Policy Stage one)
- **`lib/lsstartups.ts` · `Country` is a multi-select read with `str()`.** Verified live: **all 44**
  Life Science startups were emitting `country: ""`. Fixed to `firstTag()`. Not visible on
  `/ls-startups` (logos only, by Auri's instruction), but the API served the empty string to anyone
  consuming it.
- **`lib/policystage.ts` · `Link to LinkedIn` read but not requested.** Closed by adding it to
  `SAFE_FIELDS`. Was harmless only because all 31 rows happen to have `LinkedIn Handle` filled.

**ALSO** · `lib/fields.ts` · the `str()` docstring now spells out the array trap and points at
`firstTag()` and the audit command, since that docstring is where the next person looks.

**VERIFIED**
- `npm run audit:fields` → "Every field read matches its Airtable type." exit 0
- `/api/ls-startups` → 44 startups, **0 empty countries** (3Sonic → Denmark, Ai2Ai Oy → Finland)
- `/api/policy-stage?role=all` → 31, `{Speaker: 28, Moderator: 3}`, 0 missing LinkedIn
- `npx tsc --noEmit` → clean

**GOTCHAS**
- The audit needs the sops env. `npm run audit:fields` wraps it; plain `node scripts/…` exits 2.
- It reads the **live** base, so a schema change makes it fail on a branch that did not change. That
  is the point, but it means a red audit is not always your diff's fault.
- It only scans `lib/`. Field reads inside `scripts/*.mjs` and the one-off `*.mjs` at the repo root
  are not covered.
- Still unresolved from (t): `Role` offers **Keynote / Managing Partner / Host** but `POLICY_ROLES`
  allows only Speaker and Moderator. The audit cannot catch that one, it is a values question, not a
  types question. A person tagged only `Keynote` still vanishes with a log line.

**NEXT STEPS**
1. Decide the Keynote / Managing Partner / Host question and either extend `POLICY_ROLES` or leave it.
2. Add `npm run audit:fields` to CI (or a pre-deploy step) so a UI-side field change fails loudly
   instead of emptying a public page.
3. Consider widening the scan to `scripts/` and the root `*.mjs` writers, which touch the same tables.
4. Fill `Hierarchy` on the Policy Stage rows if alphabetical order is not wanted.
5. Ship · both fixes are still dev-server only, no deploy has run.

**FILE POINTERS** · `scripts/check-field-types.mjs` (the audit) · `package.json` (`audit:fields`) ·
`lib/fields.ts` (`str` vs `firstTag`, now documented) · `lib/lsstartups.ts:207` ·
`lib/policystage.ts` (SAFE_FIELDS + the role read).

---

## SESSION · 2026-08-17 · POLICY STAGE SERVED ZERO PEOPLE · ONE-LINE FIX, NOW 31

**CURRENT STATE.** `/policy-stage` and `/api/policy-stage` return all **31 people (28 Speakers,
3 Moderators)**. Before this session both returned **0**. Nothing was written to Airtable; one code
file changed.

**WHAT WAS DONE.** Auri opened `/policy-stage`, saw nothing, and pointed at the Airtable view
(`viwfIcQFDNQ9ggSqx`) where every row is filled. The data was fine, the reader was not.

**THE BUG.** `Role` in `tblTecOBecLQCNIeD` is a **multipleSelects** field, so the cell arrives as
`["Speaker"]`. `lib/policystage.ts` read it with `str()`, which returns `""` for an array by design.
Every row then failed the `Speaker | Moderator` allow-list and was skipped. The log line said
`31 row(s) are not published because their Role is not Speaker or Moderator: ... (no role yet)`,
which reads like an Airtable gap and is not one. **A "no role yet" log on a full table means a field
TYPE mismatch, not missing data** — check the shape before chasing the humans.

**THE FIX** · `lib/policystage.ts:126` · `str(f["Role"])` → `firstTag(f["Role"])`. `firstTag` already
existed in `lib/fields.ts` for exactly this and reads both shapes, so a conversion back to
single-select cannot re-break it. Import on line 22 widened.

**GOTCHAS**
- **`Role` now offers five options** · Speaker, Moderator, Keynote, Managing Partner, Host. Only the
  first two are in `POLICY_ROLES`. A person tagged only `Keynote` still vanishes silently, the same
  way all 31 just did. Not hit today because every row is Speaker or Moderator.
- **`Hierarchy` is empty on all 31 rows**, so the page is pure alphabetical (Adina Schildt Gillion
  first). Curated order needs that column filled in Airtable, no code change.
- **`Link to LinkedIn` is read but never requested.** Line 137 passes `f["Link to LinkedIn"]` to
  `linkedinUrl()`, but the field is absent from `SAFE_FIELDS`, so it is always `undefined` and only
  `LinkedIn Handle` ever counts. Harmless today (all 31 have the handle), latent otherwise.
- Dev server needs the sops env: `npm run dev`, not `next dev`. `npm run dev:plain` skips secrets and
  the feeds 503.

**NEXT STEPS**
1. Decide whether `Keynote` / `Managing Partner` / `Host` should map into the Speaker tab or stay
   unpublished, then either extend `POLICY_ROLES` or leave the log line as the warning.
2. Add `"Link to LinkedIn"` to `SAFE_FIELDS` in `lib/policystage.ts` to close the latent gap.
3. Audit the other feed libs for the same `str()`-on-a-multi-select trap: `grep -n 'str(f\["' lib/*.ts`
   and check each against the field type in the base schema.
4. Fill `Hierarchy` in Airtable if the Policy Stage should not be alphabetical.
5. Ship it · this only exists on the dev server so far, no deploy was run.

**FILE POINTERS** · `lib/policystage.ts` (source + publish rules) · `app/api/policy-stage/route.ts`
(role filter, `groups` contract for the tabbed embed) · `app/policy-stage/page.tsx` (tabs, copy-embed,
refresh) · `lib/fields.ts` (`str` vs `firstTag`, the whole point of this session).

---

## SESSION · 2026-08-14 · DEADLINES TABLE AUDITED AGAINST THE LIVE SITE · READ-ONLY, NOTHING WRITTEN

**NOTHING WAS WRITTEN ANYWHERE.** No Airtable writes, no code changes. The token in `.env.local` is
scoped `data.records:read`, so the fixes below are a list, not an applied diff. Only this file changed.

**WHAT WAS DONE.** Auri asked whether the *Deadlines of Projects and Applications* table
(base `appgXNjXJqpk9Ebxd`, table `tblKdmTuZRcCFMGjK`, view `viw1eb9ExvXwvZv5t`) still makes sense for
2026. Pulled all **26 records across 16 projects** via the REST API and checked every date against the
project's own page on techbbq.dk. 20 of 26 date values are correct.

**FOUR ERRORS FOUND**
1. **The summit is Aug 26-27, not Aug 26-28.** Confirmed three ways: `/techbbq2026/`, the LP Forum page
   and the Pension Summit page all say 26-27, Bella Center. Two records carry the wrong span in
   `Details` · `TechBBQ Summit 2026` ("Main summit: Aug 26-28, 2026") and `Life Science x Deep Tech`
   ("Summit Aug 27-28").
2. **Startup Showcase says "Final pitch during Summit: 27-28th of August" on the live page**, which
   runs a day past the summit. The record inherited it. This is a real contradiction on a public page,
   not a table typo, so it needs an internal answer.
3. **Future of Fintech time is wrong in the table:** record says 09:00-12:00, the page says
   **09:30-13:00, Event Room 3**. Note this agrees with session (r) above, where the hand-typed
   programme in `tblSlpTzDi2oVYwqv` also sits in Event Room 3 on 27 August.
4. **Investor Day venue is the Maersk Tower, 15th floor** (University of Copenhagen), not Bella Center.
   Dinner is at D'Angleterre. The record records no venue at all.

Also thin: Deep Tech Day should carry **09:00-17:00, Event Room 6**.

**"Matrikel1, Copenhagen" IS NOT A VENUE.** It is the office address in the site footer and it leaks
into every scrape of techbbq.dk. Do not let it into a venue field.

**FIVE 2026 ITEMS WITH REAL DATES HAVE NO ROW AT ALL**
- **Media accreditation deadline · August 16, 2026** (from `/media/`). Two days out at time of writing.
  Highest-priority gap.
- **Defence & Dual-Use Summit** · Aug 26 09:30-17:30 · Aug 27 Royal Reception 08:00-09:30 (registration
  only) + Defence Tech & Cyber Arena 09:30-11:30 · Bella Center.
- **The Policy Stage** · Aug 27 · Event Rooms 5, 6, 7 · Bella Center.
- **Nordic IPO & Stock Market Day** · Aug 26, 12:30-17:15 · Bella Center. Lives on an external domain
  (`nordic-ipo-stockmarketday26.fbv.dk`), which is likely why it was missed.
- **Board Summit** · no row, and no 2026 date published either.

**SIX THINGS THE WEBSITE CANNOT ANSWER** (someone internal has to)
1. **Startup Capital** · applications open / deadline / announcement are all literally "TBD" on the
   live page with the pitch on **Nov 3**. The page also still promises an email "no later than May 5th",
   left over from an earlier cycle.
2. **Board Summit 2026** · programme block renders "Loading…", page still lists 2025 speakers only.
3. **Nordic-Africa 2026 programme** · same "Loading…" state.
4. **Volunteer application deadline** · never stated. Sign-up opened Mar 20, briefing is "TBA".
5. **Ticket price tier cutoffs** · not published anywhere.
6. **`/startup-program/` is stale in public** · says "Applications open April 2025" and lists Hero
   Academy as "Applications open April 30th" when Apr 30 was the *deadline*. Wrong year on a live page.

**TABLE STRUCTURE VERDICT: sound.** Project / Deadline type / Date / Flag / Lead / Page covers the job
and the `Days left` formula computes correctly. Two weaknesses · `Details` is doing too much work
(session dates, times and venues buried in free text where nothing can sort or flag them, so Time and
Venue deserve real fields), and there is no `Source verified on` field, which would make an annual
re-check like this cheap.

**NEXT STEPS**
1. Widen the Airtable token scope to `data.records:write` (or have Auri edit by hand) and apply the
   four fixes + five missing rows above.
2. Chase the media accreditation deadline into the table before Aug 16.
3. Ask the Startup Showcase owner which is true: Aug 27 or Aug 27-28. Fix whichever is wrong,
   including the public page.
4. Ask Rares / the Startup Capital owner for the November application timeline, it is ~11 weeks out
   with no open window.
5. Fix `/startup-program/`'s "April 2025" and the Hero Academy open/deadline mislabel on the live site.

---

## SESSION · 2026-08-14 · FUTURE OF FINTECH MOVED INTO THE SESSIONS TABLE, WITH PEOPLE

**WRITTEN TO AIRTABLE TODAY, a git revert does NOT undo it:** 8 new rows in the Sessions table
(`tblSlpTzDi2oVYwqv`) with `Name of the Event = "Future of Fintech"` —
`rec55GJwcljdRNSqz, recqjSFuQlIdYKkeL, recnrl9beVUPpoumY, recDKWSXEerOWifoE, recEsQDPSsYp3FFLO,`
`recP3elWndUtQB3gq, rechb6qDFGHaLGojZ, rec17JOcSu1d4YYET`. Written by
`scripts/seed-future-of-fintech.mjs`, which prints its plan first and REFUSES to run if the event
already has rows, so it cannot duplicate the programme.

**WHY THE MOVE.** Auri asked for the Brella content to be pulled into Airtable. Brella turned out to
be the POORER source: its Event Room 3 column for 27 August has the same 8 titles, **empty
descriptions on all of them**, and names only TWO people (Sander Janca-Jensen, Ken Villum Klausen).
Meanwhile the old "Future Of Fintech" table already held **18 confirmed speakers with photos**. That
table is a SPEAKER REGISTRATION FORM (Email, Phone Number, dietary requirements, GDPR consent on 18
rows) with 8 programme rows wedged in beside them, and no field that could carry a line-up. So the
programme moved to where every other hand-typed agenda lives, and Auri chose that himself
("You can write it in here. Create another event: Future of Fintech").

**WHAT THE 8 ROWS SAY.** Titles and times are the fintech team's own, copied across. Every row has a
`Session Type` now: Networking & Drinks, Keynote, Fireside Chat, Keynote, then four Panels.
- Three sessions carry a line-up in `Speaker Details`: Sander on the 10:00 keynote, Sander + Ken on
  the 10:15 fireside with **Sara Sjølin, Bloomberg** as moderator, Ken on the 10:40 keynote.
- The 10:15 fireside is the only row with a DESCRIPTION anywhere, taken from Brella's own shell copy.
- **THE FOUR PANELS NAME NOBODY, deliberately.** 18 speakers are confirmed and not one is assigned to
  a panel in either system. Auri: "I don't know who is in panel 1 or 4. It's completely fine."
  An empty cell says "not decided"; a guess would say something false on techbbq.dk.
- Sara as the fireside moderator is INFERRED, from Brella's sentence "Sander joins Ken and Sara for
  the fireside chat" plus her `Role = Moderator` on her own row. Everything else is copied, not judged.
- `When Is it` left EMPTY on purpose: its options are `Day 1 | Day 2 | Natalie Becker` (somebody
  typed a name into a select), and no source read it, so guessing which "Day" 27 August is was not
  worth polluting it further.

**CODE**
- `lib/program.ts` · the `fintech` source now reads `tblSlpTzDi2oVYwqv` filtered on
  `{Name of the Event}="Future of Fintech"`, with the full hand-typed people fields, `room` from
  `Event Room`, and `type` back (the Sessions table HAS a `Session Type` select).
- **FACES COME FROM THE REGISTRATION FORM**, via `facesFromView` → `tbleh7Lqv1zMQaUKx` view
  `viwsqDRAVlgJh3STT`, `Name` + `Attachments`, feed `fintech` (already in lib/photo.ts). These people
  are NOT in the CRM's Marketing Project Overview — they registered through the fintech team's form —
  so the NASS-style view join is the only thing that finds them. **5 of 5 seats get a face** — 3
  distinct people across 5 seats, since Sander and Ken each appear twice.
- `app/program/page.tsx` · the fintech tab gains `people: true`, `heading: "August 27th"`,
  `sub: "Event Room 3 · Hall C"`.

**THE OLD 8 ROWS IN `tbleh7Lqv1zMQaUKx` ARE NO LONGER READ** and were left in place, exactly as the
NISS ones were. If the fintech team keeps editing there it will silently drift from what publishes.

**VERIFIED.** `tsc --noEmit` clean. Feed: 8 sessions, all typed, 3 with people, 5/5 seats with a face. Rendered
in a real browser on /program → Future of Fintech.

**NEXT STEPS**
1. **Get the four panel line-ups from the fintech team** and put them in `Speaker Details`, read back
   from Airtable so the ids are right:
   `recEsQDPSsYp3FFLO` 11:05 Panel 1 Build Fintech ·
   `recP3elWndUtQB3gq` 11:30 Panel 2 Scale Fintech ·
   `rechb6qDFGHaLGojZ` 12:05 Panel 3 Capital, Scaling & Exits ·
   `rec17JOcSu1d4YYET` 12:30 Panel 4 AI Native Fintech.
   Format: `Name, Title at Company · Name, Title at Company`, moderator in its own cell. Faces then
   resolve on their own for anyone in the speakers view.
2. **Confirm Sara Sjølin really moderates the fireside**, since that one line is inferred.
3. **Descriptions are empty on 7 of 8 rows.** They are what makes an agenda say what is happening.
4. **The 18th speaker, Nikita Thakrar, is marked `canceled`** in the registration table. Nothing
   reads that flag; it only matters once panels are filled in.

## SESSION · 2026-08-14 · FUTURE OF FINTECH CAME BACK · A RENAMED COLUMN CAN NO LONGER KILL AN AGENDA

**CURRENT STATE: fixed locally in `lib/program.ts`, UNCOMMITTED, so PRODUCTION IS STILL BROKEN.**
`https://airtable-woad.vercel.app/api/program?event=fintech` returns
`{"error":"Could not reach the program source."}` until this is pushed. Locally the tab serves all 8
sessions. Nothing was written to Airtable in this session.

**WHAT HAPPENED.** Auri: "why did the program of Future of Fintech disappear?" Airtable was refusing
the whole request:

```
[program:fintech] fetch failed 422 {"error":{"type":"UNKNOWN_FIELD_NAME",
  "message":"Unknown field name: \"Type of Session\""}}
```

The `fintech` source pinned a column called `Type of Session`. It is not in the table's schema any
more. **Airtable 422s the ENTIRE request when one name in `fields[]` is unknown**, so eight intact
rows became a 502 and the tab rendered empty. NOT a code regression: `git log -S "Type of Session"`
shows that string untouched in this source since `67c9c6d`, 29 July. The table was reworked at the
Airtable end — it now carries `Session Description`, `Hierarchy` and `Role at the event ( optional )`,
which reads like the programme table was merged with the speaker registration form.

**THE ROWS WERE NEVER LOST**: 8 in view `viw0mk6kOUKxNqgzU`, 09:30 Networking Breakfast, two founder
talks, Panels 1 to 4, ending 12:50.

**WHAT WAS CHANGED, all in `lib/program.ts`:**
- `PROGRAM_SOURCES.fintech` · `type` REMOVED. Deliberately NOT repointed at
  `Role at the event ( optional )`, the only vaguely similar column: it describes a PERSON and would
  have printed "Speaker" as a session type. Cards now show time and title with no kicker.
- `PROGRAM_SOURCES.fintech` · `description: "Session Description"` ADDED. It exists in the table and
  was simply never read. **Empty on all 8 rows today**, so it renders nothing until somebody fills it.
- `AirtableSource.fields.type` is now OPTIONAL, and the read is `f.type ? str(r[f.type]) : ""`.
- `fetchProgram()` · the paging request moved into `requestPage()`, which reads `UNKNOWN_FIELD_NAME`
  off a 422, drops the field Airtable named, and re-requests. Bounded at `wanted.length` attempts.
  **`f.name` and `f.timeSlot` are never dropped** (the `essential` set) — a list of blank rows at
  unknown times is worse than an error somebody has to look at. It `console.error`s on EVERY read, so
  a rename still gets fixed rather than living behind the recovery forever.

**GOTCHA, do not "simplify" this away:** `fields[]` stays PINNED rather than fetching whole records.
That table also holds Email, Phone Number, dietary requirements and a GDPR consent checkbox, and the
allow-list is the only thing keeping them out of a public feed (security rule 3). The recovery drops
one field; it never opens the request up.

**VERIFIED.** `tsc --noEmit` clean. Feed returns 8 sessions; `/program` → Future of Fintech renders
all 8 in a real browser. The recovery path was tested for real by pointing `description` at a column
that does not exist: still 8 sessions, then reverted.

**NEXT STEPS**
1. **Commit and push `lib/program.ts` to main** — production is broken until then. Auri had not
   given the go-ahead when the session ended.
2. **Ask Auri whether he wants session-type kickers back.** If yes: add a single-select to the
   Future Of Fintech table and name it in `PROGRAM_SOURCES.fintech.fields.type`. One line.
3. **`Session Description` is empty on all 8 rows.** Filling it is what makes this agenda say what
   is actually happening, which is the same complaint that produced the Beyond Unicorns PDF link in
   session (p).
4. **Check the other Airtable-sourced agendas against their tables' live schemas.** This one broke
   silently for an unknown number of days. The recovery now stops a repeat from being fatal, but a
   rename still costs a column until somebody reads the log.

## SESSION · 2026-08-14 · A SESSION CAN NOW LINK ITS OWN RUN OF SHOW

**Built on `feat/session-programme-pdf`, merged to `main` and pushed on Auri's instruction, so it
deploys.** Nothing was written to Airtable, Brella or any other live system in this session — the
only live effect is what techbbq.dk renders.

**THE PROBLEM.** Brella models a partner's all-day takeover of an event room as ONE timeslot.
"Beyond Unicorns - Building Europe's Resilient Industries" is Event Room 1, 26 August, 13:30 - 17:30,
with 17 people hung off it and no time on any of them. An attendee can tell that Randi Wahlsten is
somewhere in those four hours and nothing more (Auri: "it's difficult to understand when exactly they
are speaking and what is happening specifically"). The run of show exists, as the host's PDF, and it
was already uploaded to techbbq.dk with nothing linking to it.

**WHAT WAS BUILT.**
- `lib/sessionProgrammes.ts` (new) · a list of `{ match: RegExp, url, label }`, matched on
  `titleKey(session.name)`. One entry today: `/^beyond unicorns\b/` →
  `https://techbbq.dk/wp-content/uploads/2026/08/Closing-Loops-TechBBQ.pdf`. Https enforced there,
  and a rejected url is `console.error`'d rather than silently not appearing.
- Matched on the TITLE, not the Brella timeslot id: an id dies when somebody deletes and recreates
  the row, which is what happened to the 15:35 Investor Reverse Pitch during NASS.
- `lib/program.ts` · `ProgramSession.programmeUrl?: { url, label }`.
- `lib/brellaprogram.ts` · set while mapping the feed, so /brella-program, the pasted embed and
  `/api/program?event=brella` all carry it. Same reasoning as `roomAlias()` and `HIDDEN_TRACKS`
  living at the source.
- Rendered in BOTH dialogs — `components/ProgramTimeline.tsx` and `lib/brellaEmbedSnippet.ts` —
  above the speaker list, and counted by both copies of `hasDetail()` so a row that is nothing but
  an all-day booking and a PDF can still be opened. Outlined in the stage colour
  (`.bp-modal__cta--doc` / `.tbbq-bp__cta--doc`) so it does not compete with Register where a
  session has both; link text inherits its colour, because several track colours fail 4.5:1 as text.

**VERIFIED.** `tsc --noEmit` clean. The feed carries it on exactly 1 of ~230 sessions. Dialog opens
with the button on the dashboard AND in the generated embed rendered in a real browser (the embed
tested by pointing a copy of the snippet at the local feed); no console errors; the PDF answers 200
`application/pdf`.

**TO ADD ANOTHER**, e.g. the four confusing PDFs in the other event rooms: one entry in
`lib/sessionProgrammes.ts`, nothing else. **THE REAL FIX** for the same complaint is typing a run of
show into the Sessions table the way NASS and the Policy Stage were done, which gives per-slot times
and faces instead of a document. Not attempted here; Auri asked for the link.


---

## Older sessions

Everything from **2026-08-13 and earlier** now lives in [`progress-archive.md`](progress-archive.md)
(6,036 lines). Moved on 2026-08-17: this file had reached 486KB, which is too large to read at the
start of a session, and a handoff nobody opens is not a handoff.
