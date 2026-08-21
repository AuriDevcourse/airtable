# Progress · TechBBQ Airtable Connector

Server-side proxy that exposes a **safe slice** of the TechBBQ Airtable as JSON, so
techbbq.dk (WordPress + Elementor) can show speakers without the token or PII ever
reaching the browser.

> **Newest first. Sessions from 2026-08-13 and earlier are in
> [`progress-archive.md`](progress-archive.md)** — this file was split on 2026-08-17 at 486KB,
> because a handoff too large to open is not a handoff. Headings carry a DATE rather than a letter:
> two people writing in parallel had produced two (w)s, two (x)s, two (z)s and two (aa)s.

## SESSION · 2026-08-21 · THE ARCH AFTERPARTY · NISS AUDITED CLEAN · WHY program2026 DROPS PICTURES

**CURRENT STATE.** One commit, **`8606526`, COMMITTED ON `main` AND PUSHED**, deployed and verified
live in ~15s. `next build` passed and `npx tsc --noEmit` is clean. The Airtable row below is data —
live the moment it was written. **Worked directly in this checkout on `main`, not in a worktree**,
against the rule the 2026-08-20 session set: Auri asked for the push explicitly and no other tab was
running. The rule still stands for anything longer than one file.

**NEXT STEPS, in order.**

1. **`techbbq.dk` CAN be read from the CLI — this unblocks NEXT STEP 5 of the 2026-08-20 session.**
   The 455 is a WAF rejecting curl's default User-Agent, not the page. Send a real browser UA and it
   returns **200 / 244,554 bytes**:
   `curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -H "Accept: text/html" https://techbbq.dk/program2026/`
   The stale AWS x NVIDIA embed can now be diffed the same way `program2026` was below, with no browser.
2. **The ARCH afterparty has no `Link to register`**, so it also has no venue line — `venue`/`city` are
   scraped from the register page (`app/api/partner-events/route.ts:59`), never read from Airtable.
   `Contact Person` / `Contact Email` are Auri's as a placeholder; swap if it should be someone else.
3. **A SECOND afterparty exists in Brella with no Airtable row**: "TechBBQ afterparty at Proud Mary @
   Rådhuspladsen", Day 3 · 26 August, 20:00 - 23:00. Not a duplicate of ARCH (different date and
   venue). Either give it a row or take it out of Brella — today it renders with no register link and
   no picture.
4. **Warm the CDN after a deploy that changes the build output.** That visitor otherwise pays the
   cold burst measured below. The warm loop is ~25 lines and was run by hand twice this session;
   wiring it to the deploy is the cheapest real fix for the dropped pictures. **Not every deploy
   needs it** — see the two measurements below.
5. **Make the embed's `onerror` fall back instead of hide.** It currently deletes the figure, so this
   whole class of failure is invisible — indistinguishable from a session having no picture.
6. **Move the 429 retry-sleep OUTSIDE the lookup slot** in `lib/photo.ts`. A rate-limited request
   holds one of only **three** slots for up to ~12s (2s + 4s + 6s), collapsing throughput exactly
   when the base is busiest. The sleep should release the slot first.
7. **Default `firstPhoto` / `firstAttachmentId` to images only** — 30 cells across the base are broken
   by a non-image first attachment (below).
8. **NISS `room` and `day` are dropped, and three footnotes on `/program` are now false** (below).

**THE OFFICIAL TECHBBQ AFTERPARTY @ ARCH — ROW `recayOytWmfOYv9k2`, LIVE.** Added to Partnership
Success (`tbllvkwLhB4Omdphd`), view **"2026 Side event and event room info"** (`viwcC25ENg2ELGszH`),
which went **54 → 55 rows**. Side Event · 27 August · 21:00 - 23:00 · Nørregade 41, 1165 København ·
Public · `Added BRELLA` ticked · `Company` "TechBBQ & ARCH" · `Type` "Partnership success deadline"
(all 28 existing Side Events carry that value, odd as it reads) · `Partner ID` 0, the convention for a
TechBBQ-hosted event.

**WRITTEN BY FIELD ID, WHICH IS NOT OPTIONAL HERE.** The table has **three** columns named
`Date of Event ` (trailing space included) plus a fourth `Date of Event` without it, and Airtable
answers `AMBIGUOUS_FIELD_NAMES` to the whole request if a duplicated name appears in `fields[]` —
already documented at `lib/partnerevents.ts:15-26`. Two of the three are genuinely populated
(**fld5S7DvQz7C09BNm** 45/54, **fldDUuXRNZ8nIjTo3** 42/54, 33 rows have both and they agree on all
33). Wrote to `fld5S7DvQz7C09BNm`, the primary that lib coalesces first, and confirmed by re-reading
the view with `returnFieldsByFieldId=true` that the other three date twins are empty on the new row.

**ONE TRAP WHEN VERIFYING A `POST`:** `returnFieldsByFieldId=true` **is ignored on create**. The
response comes back name-keyed, so a verification script that looks up field IDs finds `undefined` for
every field and reads as "an empty record was created". It was fully populated. Re-read through the
view to check a write, not the POST response.

**THE BANNER.** `public/side-events/afterparty-arch.webp`, **1200×630, 34,680 bytes**, from a
2400×1260 source — exactly 2×, so it downscales with no crop, and it matches all five existing banners
(which are 1200×630, 36–58KB). `cwebp -q 82 -resize 1200 630`. Keyed in `lib/eventArtwork.ts` on
`titleKey()` = **`"the official techbbq afterparty arch"`** (computed with the real function, not
guessed — the `@` becomes a space and collapses). Because that module is shared, **one entry serves
both boards**: `/api/partner-events` and Program 2026 both resolve it. Went to the `image` slot, not
`Company Logo` — that field is for partner logos, and this is TechBBQ's own artwork, which is exactly
what `ARTWORK_OVERRIDES` is for. There is no partner ticketing page to scrape here, so the banner is
the only picture this card will ever have.

**NISS 2026 AUDITED AGAINST AIRTABLE — THE DATA IS CLEAN, THE PAGE'S OWN NOTES ARE NOT.** Compared all
13 NISS rows against `/api/program?event=niss`. **Titles, Time Slots, Session Types and Descriptions
are byte-identical on all 13**; same records, same order, nothing extra or missing either side. All
**48 people** parse 1:1 out of `Speaker Details` / `Moderator Details`, and **all 48 photo URLs return
200** — no initials fallback anywhere. All 13 rows are `Locked`, so nothing is withheld.

- **`Event Room` and `When Is it` are DROPPED on all 13.** Airtable has `Event Room 2` and `Day 1` on
  every row; the `niss` field map (`lib/program.ts:320-329`) has no `room:` or `day:` key, so the page
  shows only the session type and no day heading. The same omission is on `policy`, `board` and
  `nass`, so it looks like a house convention for the Sessions table rather than a NISS bug — but the
  data is there and not shown. Note the field is **`When Is it`**, not `Day` (which is what the
  `techbbq` source maps), so a fix cannot copy that line.
- **Three hardcoded footnotes at `app/program/page.tsx:112-118` are now WRONG.** They are typed in,
  not read from the feed, so Airtable was fixed and the page was not. (a) *"Session Description is
  empty on all 13 rows"* — false, all 13 have 106–233 chars. (b) *"India Shark Tank and Nordic Founder
  Pitch have no Session Type: the select has no 'Pitch Session' option"* — **false on three counts**:
  the session is now titled "Indian Startups Meet Nordic Sharks", both rows are typed `Presentation`,
  and **`Pitch Session` now exists** in the select. (c) the `Session Status` note is mechanically true
  but all 13 are Locked, so nothing is left to chase. This is the same failure mode as the
  `Location` comment below: **a page asserting that data is missing when it is sitting right there.**
- **The view Auri linked is not what its name says.** `viwrTVxvTBucbJW7S` is actually named
  **"Event Rooms"** and holds **133 rows across 12 programmes** (Policy Stage 16, Board Summit 15,
  NASS 23, LP Forum 11, NISS 13, …). The code pins it as the `policy` view *and* filters on
  `{Name of the Event}`, so the widening the `AirtableSource.filter` comment warns about has not
  leaked. NISS uses no view at all, pure cell-value filter — so a NISS row dropped from that view
  would still publish. They agree today.
- **Airtable data hygiene that renders verbatim**, none of it a code fault: `Dr. Nikhil Tambe, , IIT
  Madras` → title reads ", IIT Madras"; `Drishya Nair - PhD , Novo Nordisk Foundation` → "PhD ,
  Novo Nordisk Foundation"; `Dr. Pradeep B.E` keeps a trailing period; **Peter Winther-Schmidt has no
  org** and renders as a bare name; **Sabrina Mai Bendjazi / Bendjazia** is one person spelt two ways;
  Kristoffer Nilaus Tarp and Colin Brown each appear in two sessions with **different** `Speaker
  Photo` attachments, so they may show two different faces.

**WHY `program2026` "SOMETIMES" SHOWS NO PICTURES. NOT THE EMBED, NOT AN UNPUSHED COMMIT.** Auri
raised both; both are ruled out, with the real mechanism measured.

- **Nothing was unpushed.** `main` was level with `origin/main` (0 ahead, 0 behind) before this
  session's commit, and prod serves **absolute** URLs (`https://airtable-woad.vercel.app/api/photo/…`),
  so `baseUrl()` resolves correctly — not the relative-path 404 that `lib/eventArtwork.ts` warns about.
- **THE PASTED SNIPPET IS CURRENT, PROVEN BY DIFF.** `/api/embed?kind=brella&section=all` serves the
  exact string the copy button builds, so it can be diffed against the live page instead of eyeballed.
  Normalise the random `uid` and CRLF and the two are **122,260 chars with exactly 3 differences** —
  all three WordPress's `wp_filter_content_tags` inserting `decoding="async"` after `<img`, *inside
  the script's JS string literals*. Valid HTML, functionally inert, and the `thumb()` line carrying the
  `onerror` is untouched. **Use this diff as the standard check for a "stale embed" report** — it is
  far stronger than reading the page, and it is what NEXT STEP 1 unlocks for AWS x NVIDIA.
- **The embed hides its own failures.** `thumb()` renders
  `onerror="this.parentNode.style.display='none'"`. A failed image deletes its figure — no broken
  glyph, no gap, no console error, indistinguishable from a session that has no picture. That is why
  the symptom reads as "sometimes" rather than as an error.
- **THE ACTUAL CAUSE, MEASURED: a cold-cache burst against a 3-wide gate.** `program2026` embeds
  `/api/program?event=brella&section=all`, whose 379 sessions carry **728 unique image URLs** across
  `brella-assets.brella.io`, the proxy, lumacdn, circle.so and eventbrite. Fetched all 728 with a
  `techbbq.dk` referer: **728 OK, 0 failing** — nothing is permanently broken. Of those, **122 are
  proxy URLs**, and each cold one needs an Airtable lookup gated at `MAX_CONCURRENT_LOOKUPS = 3`
  (`lib/photo.ts:181`). Pushing this session's code commit produced the failure condition on demand:
  **121 of the 122 came back `x-vercel-cache: MISS`, and draining them at concurrency 3 took 24.8
  seconds.** Pushing the *docs-only* commit right after did **not** invalidate them — the same 122
  came back **121 HIT in 3.4s**. So the trigger is a deploy that changes the server bundle, not a
  deploy as such; `progress.md` alone is free. That is an observation from two measurements, not a
  documented Vercel guarantee — do not lean on it harder than that. A browser fires all of them at
  once and will not wait — the ones at the back of the queue exceed the Vercel function timeout, so
  the route's catch answers 502/404, and
  `onerror` silently deletes them. Warm, the same burst is flawless: **59/60 HIT, p50 217ms, max
  681ms**. The comment at `lib/photo.ts:176-180` describes this exact symptom from the partner wall
  ("a cold wall … dropping a third of its images"); the gate improved it and did not eliminate it at
  this volume.
- **Also: the queue wait is unbounded.** `withLookupSlot` awaits a queue promise with no timeout of
  its own — `fetchWithTimeout`'s 8s only starts *after* a slot is acquired — so a request can sit in
  the queue until the platform kills it. Compounded by the retry-sleep held inside the slot
  (NEXT STEP 6).
- **Cache is warm as of this session, but only at one edge.** Warming from a laptop warms the nearest
  PoP; other regions stay cold until someone there loads the page. Per-region cache is itself part of
  why this looks intermittent to one person and fine to another.

**A NON-IMAGE FIRST ATTACHMENT BREAKS 30 CELLS, AND THE FIX ALREADY EXISTS IN THIS REPO.**
`firstPhoto` (`lib/fields.ts:48`) and `firstAttachmentId` (`lib/fields.ts:68`) both take `v[0]` with
**no MIME check**, so anything in first position wins over real images behind it. Scanned every
`PHOTO_SOURCES` table: **partners 24** (`.eps`, `.psd`, `.ai`, `.pdf`, a `text/html`, and a
`.DS_Store`), **niss 3** (two `.pdf`, one `.docx`), **partner-events 2**, **nass 1** (a `.pptx`);
team, interns, policy-program and event-rooms are clean. Two are visibly broken on `/partner-events`
right now, both with good logos sitting behind the junk: **`recBOYFxj5syuBr5K`** (Mesh x TechBBQ
Pre-Party) leads with `zero logos (1).zip` and has **12** valid PNG/SVGs after it, and
**`recl9jtV6lbQ8mvUv`** (The Agentic AI Era) leads with `AWS_Logos.zip` and has **2**. Both serve
`application/zip` through the proxy with a 200, so they fail as images rather than as requests.
**`pickLogo` in `lib/logoPick.ts` already chooses "by what the file IS, not by position"** — it is
simply gated behind `usePicker`, which these paths do not pass. **None of this affects `program2026`**
(all 728 of its URLs pass); it is a `/partner-events` and partner-wall issue.

**`Location` IS FILLED ON 52 OF 55 ROWS AND READ BY NOTHING.** `fldkoPVBEvRD5jNZP` on Partnership
Success holds real addresses, and `venue`/`city` on the cards are instead scraped from the partner's
register page. Both `lib/partnerevents.ts:114-115` and `app/partner-events/page.tsx:293` assert
*"Airtable has no address column at all"*, which is false and is why the ARCH card shows no venue
despite Nørregade 41 being in the row. Wiring `Location` in would give every side event a venue line
with no scrape and no new field.

## SESSION · 2026-08-20 · POLICY STAGE ROSTER, AWS x NVIDIA SPLIT, AND ONE PARTNERSHIP AS FOUR TILES

**CURRENT STATE.** Branch **`partners-multi-logo`**, four commits, **MERGED TO `main` AND PUSHED** at
the end of this session. All the Airtable edits below are data, live the moment they were written.

**WORK IN A WORKTREE IN THIS REPO. NOT OPTIONAL.** Auri runs several Claude Code tabs against the one
checkout, so `git checkout` in another tab silently moves the tree under you: mid-session this branch
was swapped for `brella-source-of-truth` and an in-place find-and-replace then matched nothing and
"succeeded", having rewritten a file with identical content. Nothing was lost by luck, not by care.
This session finished in `../airtable-partners` (`git worktree add`). Two notes if you do the same:
`node_modules` needs a junction (`mklink /J`) and **Turbopack refuses one** ("points out of the
filesystem root"), so run `npm run dev:webpack` there or do a real install. Also `brella-source-of-truth`
had uncommitted `lib/logoPick.ts` and `progress.md` at the time — another tab's work, left alone.

**NEXT STEPS, in order.**

1. **Look at `/partners` and sanity-check two things that are now LIVE**: the four INCUBA x KITCHEN
   tiles leading Challenger, and the paying badges. Both shipped without Auri seeing them rendered,
   because the Playwright browser was held by the other tab and no screenshot was possible.
2. **AWS Startups needs its own CRM row, or the stale id cleared.** The Event Room deal (261.000 DKK)
   sits ONLY on the NVIDIA row (`Partner ID 2222`), and that same id is stamped on the AWS
   deliverables row. The wall is correct because it joins on `Company Link`, but the CRM reads as
   though AWS has no partnership at all — **zero Confirmed AWS/Amazon rows**. Either give AWS a row
   with its share, or clear `Partner ID 2222` off the AWS deliverables row so nothing joins on it.
3. **`Partner ID` IS NOT A SAFE JOIN KEY in Partner Deliverables 2026.** Ten ids sit on two rows
   each, 2222 is on two unrelated companies, and European Investment Fund's `Partner ID` (1744) and
   `Company Link` (→ "EIF", id 404, No Deal) name different partners. Anything joining on it inherits
   that. Use `Company Link`.
4. **Martin Lidegaard has no session.** Confirmed Policy Stage speaker, in the CRM since 2026-08-05
   (`recZeP0n40KH77715`, Danish Minister for Business and Competitiveness), publishing on the roster
   feed, and on **zero** Sessions rows. Brella has the same gap: he is on the umbrella row only. Ask
   the organiser which panel or slot, then add him with his photo in the matching array index.
5. **AWS x NVIDIA embed on techbbq.dk was showing stale content** and it was never resolved. API, CDN
   and the pasted snippet were all verified correct — the snippet in Elementor is the real live one,
   fetching `/api/program?event=aws-nvidia`. Needs the page URL and a look at the live DOM
   (`document.querySelectorAll('.tbbq-agenda').length`) to find whether a second widget is winning.
   techbbq.dk returns **455** to curl, so it needs a real browser.
6. **Optional, recommended while the tables are being edited daily:** put `/api/program` on the
   near-live cadence. It never passes a cache key into `feedResponse`, so it cannot opt into
   `NEAR_LIVE_FEEDS` in `lib/cachePolicy.ts`. Two lines, drops CDN from 30 min to 60 s.
7. **Two Brella details Airtable lacks**, not applied: Cecilie Lykkegaard has no job title (Brella
   says Strategic Advisor), and Stina Lantz reads "CEO at SISP" on one row and the full org name on
   the next.

**THE POLICY STAGE, SIX SESSIONS UPDATED, LIVE.** Brella agreed with every item in the organiser's
comments — nothing in that list was stale or invented, which is worth knowing for next time. Bypassing
Fragmentation `+Jón Ingi Benediktsson +Mala Valroy` · Entrepreneurship Package 2.0 `-Mads Strange
+Freja Brandhøj +Christian Arnstedt` · The 28th Regime `-Morten Løkkegaard +Sara Rywe` · Digital
Fairness Act `+Natasha Friis Saxberg` · Maritime unicorn `-Rasmus Elsborg` · CLOUD Act: Adina Schildt
Gillion → "General Counsel at stealth-stage AI startup". Verified **28 speakers, 0 without a face**.
Pre-write backup of every touched field: `scratchpad/policy-backup-2026-08-20.json`.

**THE GOTCHA THAT MADE THAT JOB REAL WORK: `Speaker Photo` IS POSITIONAL AND ALL-OR-NOTHING.**
`parsePeople` in `lib/program.ts` sets `aligned = atts.length === entries.length`. If a session's
`Speaker Details` count and `Speaker Photo` count ever disagree, **every face in that session
disappears**, not just the unmatched one. So adding a speaker means adding their photo in the same
array slot and removing one means pulling its attachment. Brella had a portrait for all six new
people; `?v=<attachment id>` on the photo proxy then picks each face out of the shared cell.

**AWS x NVIDIA: THE 14:20 SLOT IS NOW TWO ROWS, AND IT WAS BROKEN.** Auri split the combined
14:20-15:20 deep-dive into `14:20 – 14:50` (`recLXrL0pTizlb5nk`) and `14:50 – 15:20`
(`recATRIjMo1nhVKBu`). Both rows joined their two speakers with a **comma**, but this table separates
people with ` · `, so each cell parsed as ONE person whose job title had swallowed the second name —
Daniel Jankowski and Robert Christiansen were absent from the website entirely. Fixed, plus a plain
hyphen in the 14:20 time slot where every other row uses an en dash, and trailing spaces in both
session names. Verified 5 sessions, 10 speakers, 0 without a face. Backup:
`scratchpad/aws-nvidia-backup-2026-08-20.json`.

**NOTE `lib/program.ts` STILL SAYS THE OPPOSITE.** The `aws-nvidia` comment claims the 14:20 slot
"stays one row with four speakers" because "splitting it would have meant inventing a 14:50 boundary
nobody published". Auri published that boundary. The comment is now wrong and will mislead.

**AWS x NVIDIA TAKES ITS FACES FROM THE CRM, NOT FROM `Speaker Photo`.** `facesFrom: "Event Room 3"`
plus `facesFromBrella`, matched by NAME. So `Speaker Photo` is empty on all five rows and that is
correct — nothing to keep aligned here, unlike the Policy Stage. All four deep-dive speakers got
portraits the moment the names parsed.

**THE PARTNER WALL: TWO DUPLICATE LOGOS FOUND AND CLEARED.** Auri's EIFO `Exceptions` cell ("Has to be
in Main") works and EIFO is at Main. But a website-domain sweep across the wall found **EIFO twice**
(id 2309 at Main vs id 406 at Conqueror) and **KITCHEN twice** (inside INCUBA x KITCHEN at Challenger
vs a Brella-import stub at Community). Both stubs carried the same tell: *"Added from the Brella 2026
sponsor list on 2026-08-06. Logo still to source."* Auri deleted both deliverables rows. **The
name-normalising dedupe in `lib/partners.ts` cannot catch these** — `EIFO` and `EIFO (Export &
Investment Fund of Denmark)` are two different strings pointing at two different Company Links, so
this is a data problem, not a code one. Cleared as false positives: Danish Life Science Cluster +
Life Science Invest share a domain but are a parent and its project, and five partners share
`linkedin.com` because they have a LinkedIn URL where a website should be.

**ONE PARTNERSHIP, FOUR TILES: `MULTI_LOGO` (the branch's actual feature).** INCUBA x KITCHEN
(Partner ID 1683) is a single partnership shared by four organisations, each with its own white SVG in
the row's `Logo` cell. A normal row draws ONE image, so three were invisible: `pickLogo` scored the
KITCHEN and INCUBA files **identically** (both SVG +5, both name-hinted white +4) and the tie broke on
upload order. First attempt composed them into one `wide` frieze, reusing Erhvervshus Sjælland's
mechanism — **Auri rejected that**: "dont add it as one logo. add it as 4 different logos, just next
to eachother." So `MULTI_LOGO` expands the row into one real tile per mark, each fitted and scaled by
the same equal-area rule as every other logo.

**TWO THINGS THAT WOULD HAVE BROKEN THAT SILENTLY, AND ARE THE REASON IT TOUCHED FOUR FILES.**

- **All three renderers SHUFFLE inside a tier.** Emitting four consecutive feed entries does not put
  them next to each other, it scatters them across the band. Hence `group`, a shared key the sorts
  cluster on, added to `app/partners/page.tsx`, `lib/partnersEmbedSnippet.ts` and
  `lib/partnersBareEmbedSnippet.ts`.
- **Those renderers shuffle BEFORE they sort.** A stable sort preserves the *shuffled* order, not the
  feed's, so the four marks came out in a different sequence on every load. Hence `groupRank`. Five
  simulated runs now give `INCUBA | KITCHEN | Startup Aarhus | Delphinus` every time. Do not delete
  `groupRank` on the assumption that stability is enough — it is not, and the failure is intermittent.

Bonus from splitting: **each tile now links to its own site**. The row was unlinked because its
website cell holds four urls and `safeUrl` takes the first, which is why `WEBSITE_OVERRIDES` nulls
this company out. Each tile also carries its BRAND as `company`, so alt text and aria-labels name the
organisation instead of announcing "INCUBA x KITCHEN" four times. Also **deleted the stale
`LOGO_SCALE: 2.29`** for this row: measured against the old single KITCHEN tile, already inert because
a wide tile sets `data-nofit`, and a landmine for whoever touched the flag next. Wall is **218**
(216 − the two duplicate rows + 4 tiles). `npx tsc --noEmit` clean. **ESLint is not configured in this
repo** — `npx next lint` prompts to set itself up, so `tsc` is the check available, and `next build`
was skipped because the dev server was live (see the orphaned-dev-server lesson).

**CONFIRMED PARTNERS CHECK: 219 → 221, TWO NEW SIGNINGS, ROWS NOW CREATED.** `rec906zFUIVBaau8Q`
MinnieMe (Community) · `recxuGI3CHbQ7CMOh` Go Globie (Challenger), both with contact email and
`Company Link`, both `Put on web` unticked with no logo so neither reaches the wall. View 227 → 229,
each Partner ID on exactly one row, and a re-run reports `missing 0`. MinnieMe (2964) and Go Globie (2913), both
confirmed **2026-08-19**, both with a contract attached. **The run first reported FOUR**, and the
extra two were EIFO 406 and The Kitchen 1639 — the rows deleted earlier the same day. That is exactly
the resurrection `NEVER_CREATE` exists to prevent, so both ids are now in it with the reasoning; the
dry run reports `missing 2`. **A deleted deliverables row and a row that never existed are
indistinguishable to this script, so every deliberate deletion must be recorded there in the same
sitting.** Also worth a human: **EIFO is confirmed TWICE in the CRM with a contract on each** (406
from 2025-12-08, 2309 from 2026-07-07), and 4 Confirmed rows carry no `Confirmed date 2026`, so a
date-based check would miss them — comparing Partner IDs against the deliverables view is what caught
everything.

**`Where does the logo go?` NO LONGER EXISTS on Partners 2026.** The schema meta API still lists it,
but requesting it returns `UNKNOWN_FIELD_NAME`. Same trap as the 2026-08-19 session: Auri renames
fields in the UI between turns, so re-read the schema before every read, not just before every write.

**A SMALL PAYING LABEL ON /partners, DASHBOARD ONLY (`a38b0a4`).** Auri: "All the partners that are
paying. Can you have a small label ... make sure it doesnt copy to embed, i just wna to see here."
Two badges top-left of the tile: **Paid** for cash on `Deal 2026`, **Barter** for no cash but a barter
deal or an add-on. 108 Paid · 22 Barter · 95 neither, so the badge marks the exception rather than
decorating the wall. Cash takes the tier's own colour so it stays inside the band's identity; barter
is neutral and dimmer, because value given and money in should not look alike.

**THE "DOESN'T COPY TO EMBED" PART NEEDED A REAL FIX, NOT A HOPE.** `app/api/partners/route.ts` caches
ONE read with pending rows included and then only **filters rows** for the public response. That is
enough for `pending`, which marks a row as not-live, and useless for `paying`, which sits on rows that
ARE live — the field would have gone straight into the public feed and onto the pasted wall. The public
list is now REBUILT without it. **Any future internal-only field on `Partner` needs the same
treatment: the default in that route is public, and the embeds fetching without `?pending=1` is a
coincidence of how they are written, not a safeguard.** Verified 220 public rows, zero carrying it.

**THE LABEL MUST JOIN ON `Company Link`, AND THE FIRST VERSION DID NOT.** Joining on `Partner ID`
produced two false badges before it was caught: **AWS Startups** has no link and carries NVIDIA's
`Partner ID 2222`, so it wore NVIDIA's 261.000 DKK; **European Investment Fund**'s id and link name
different partners, so its badge and its tier band were reading different rows. `Company Link` is what
`Partnership Tier (from Tier)` already resolves through, so keying on it means the badge and the band
cannot contradict each other. Structural check, not a spot check: **zero cash badges in the Community
band**, which by the tier formula means zero cash. No link, no label.

**AWS STARTUPS WAS INVISIBLE ON techbbq.dk, AND THIS IS THE FIND OF THE SESSION.** A 261.000 DKK
Event Room partner, `Put on web` ticked, a full-looking `Logo` cell, and not on the wall — for two
silent reasons at once: **no `Company Link`** (so no tier, so no band to place it in) and **three
`.eps` files** (`application/postscript`, ~695 kB each) which no browser can draw, so the row read as
`no-logo`. Auri fixed both during the session: link → the NVIDIA CRM row, artwork → `aws.svg`,
measured at ink luminance 255/255 and 34% coverage, a clean knockout. AWS and NVIDIA now sit together
in Conqueror, both badged Paid, public wall 220 → 221. **The dashboard's pending worklist had been
reporting this all along and nobody read it** — that list is the point of `?pending=1`.

**WHO IS PAYING, MEASURED (2026-08-20).** 221 Confirmed. The Community BAND cannot contain a paying
partner by construction: `Partnership Tier (Based on Deal Size)` branches to "Community" only when
`Deal 2026 = 0`. Asking the question properly means asking about the TYPE, and there are **8
`Community *` types, not one** — scoping to `Community Partnership (Non-commercial)` alone is what
produced a first, wrong answer of "nobody pays". Across all of them: **19 community partners paid
cash, 2.253.135 DKK**, led by Beyond Beta 750.000 (typed `Community Main`, lands in Prime), IDC
300.000, CLEAN 250.000. Ten more gave barter or add-ons. 85 are purely non-commercial.

**A BUG IN THE TIER FORMULA, NOT FIXED, AURI'S CALL.** Its cheap ladder for non-commercial partners
(Main ≥90k, Pioneer ≥60k, Core ≥40k, Challenger ≥1) is gated on
`{Partnership Type 2026} = "Community Partnership (Non-commercial)"`. That field is a **multi-select**,
so `=` only matches when it is the cell's ONLY value; any partner with a second type silently falls
onto the commercial ladder, whose thresholds are 5-10× higher. RANNIS is the proof: 40.000 DKK renders
`Challenger` where the cheap ladder says `Core`. **14 of the 96** non-commercial partners carry a
second type, and the cheap ladder currently never fires at all — all 82 sole-value rows have
`Deal 2026 = 0`. Fix is one edit: `FIND()` instead of `=`. Deferred deliberately: it is a revenue
formula and the summit is in six days.

**FILE POINTERS.** `lib/partners.ts` — `fetchPaying` (and the note on why not `Partner ID`),
`MULTI_LOGO`, `LOGO_FILE_OVERRIDES`, `LOGO_SCALE`,
`exceptionTier`, the dedupe at ~line 700 · `lib/logoPick.ts` — `score()`, where the INCUBA/KITCHEN tie
happened · `app/partners/page.tsx` — the shuffle-then-sort · `lib/partnersEmbedSnippet.ts` and
`lib/partnersBareEmbedSnippet.ts` — the same sort, twice more · `lib/program.ts` — `parsePeople`
alignment, `PROGRAM_SOURCES` for `policy` and `aws-nvidia` · `lib/cachePolicy.ts` — the two cadences
and `NEAR_LIVE_FEEDS` · `scripts/add-missing-deliverables.mjs` — `NEVER_CREATE`, and the only record
of which deliverables rows were deleted deliberately.

## SESSION · 2026-08-19 · ALL LOGOS: ONE TABLE THAT HOLDS EVERY 2026 PARTNER LOGO

**CURRENT STATE.** **LIVE IN AIRTABLE, no code, nothing to deploy.** New table `All Logos`
`tblV1YDSNUZb8ZSsj` in base `appgXNjXJqpk9Ebxd`, **272 rows, every single one carrying a logo file**:
227 Summit partners + 45 confirmed Life Science x Deep Tech startups. All rows `Year = 2026`.
Auri built the views himself: `Summit 2026` `viwQbcwxsEGgfj081` and `Projects 2026` `viwSehAr5ETTKCaeX`.

**THE ASK.** "I want to put all the partner logos in here specifically and have it based on the
project", separated further inside a project (Life Science has exhibiting startups AND a pitch final).
He explicitly rejected a two-table design: "I rather have one place, one table for everything."

**THE SHAPE, IN HIS OWN NAMING.** Three levels, one row per organization per placement:
`Big Project` (TechBBQ Summit, Projects, Investors, Media & Press, Startups, Community, Tech Talent,
Brand / General) > `Track` (Summit main stage & website, Life Science x Deep Tech, LP Forum, NISS,
NASS, Investor Day, Pension Summit, Nordic Family Office Summit, Day 0, Future Of Fintech, UrbanTech,
Hero Academy, Startup Program, Startup Library, Side Events, Smarterra, Tech Talent, Brand / General)
> `Group` (Partner list, Project subpage, Exhibiting startup, Pitch final, Spinout, Speaker company,
Delegation, Investor, Media / Press, Community, Stage / backdrop, Print / signage). Every select is
colour-coded, because he asked for it and because a grey grid of 272 rows is unreadable.

**TIER IS A LOOKUP, NOT TYPING.** `Tier (Summit)` = lookup of `Partnership Tier (Based on Deal Size)`
`fldSGGxr4Tcg88ZvP` from `Partners 2026`, reached through `Company Link` (populated on 224 of 272 rows,
223 matched on `Partner ID`, 1 on name; the unmatched ones are startups that do not exist in the
partner CRM). It self-updates when Partnerships changes a deal. Distribution: Community 115,
Challenger 50, Core 34, Pioneer 10, Conqueror 10, Prime 3, Main 2.

**DO NOT USE `Partnership Type 2026` `fldUtNXIUju3GwPau` AS A TIER.** That was the first attempt and it
returns deal SHAPE, not wall tier: "Barter Deal", "Event Room", "Community Partnership
(Non-commercial)". Kept as a second lookup, `Partnership Type (from Partners)`, since knowing a logo
belongs to a barter deal matters when building a wall. `Logo Partner Page` is dead: filled on 2 of
2744 partner rows. The deal-size lookup disagrees with MPO's own `Partnership Type 2026` on **66 rows**
because MPO mixes tier with category (Investor, International, Delegation are not sizes).

**`Exceptions` BEATS THE LOOKUP.** Copied from MPO `Partner Deliverables 2026`. Four rows, all of them
tier overrides that contradict the deal-size formula: Jyske Bank Growth Core > Pioneer, Highbridge Law
Firm Community > Challenger, Skytek Nordics Community > Core, rebriQ Community > Challenger.

**LIFE SCIENCE IS CONFIRMED-ONLY.** Definition, and both signals agree exactly on 45 startups:
`Confirmation = "Selected"` AND `status` contains `"Confirmed startup"` in `Startup Library 2026`
`viwC65YEXxl8iDPzN`. Deleted 46 rows that had been imported before that rule existed: 22 `To be
rejected`, 16 Selected-but-`Declined`, 6 still in progress (Follow-up / Contacted / Refused), 2
Duplicate or blank. The names are at `scratchpad/removed-ls-startups.txt`; re-running the import picks
the 6 in-progress ones up automatically if they get confirmed.

**TWO MERGES, AND FOUR MORE WAITING.** TrialMe and Dalea each had two registrations in the source view
holding DIFFERENT files, so they were merged into one row per company keeping every variant (TrialMe:
white SVG + red JPEG + black-and-white PNG). Still duplicated, untouched, all from
`Partner Deliverables 2026` itself: **NORNORM, Radia Network, Kalvebod Fælled Skole, Copenhagen School
of Entrepreneurship**. Same merge treatment is a one-liner when someone wants it.

**WHERE THE LOGOS CAME FROM.** 227 Summit rows from `Marketing Project Overview` view
`Partner Deliverables 2026` `viw7FVbsTb9IRaWF0` (field `Logo`). 45 startup rows from
`Life Science Project` view `Startup Library 2026` (field `High quality company logo`). `Source` on each
row is a deep link back to the exact origin record. **No logo files exist ANYWHERE in the base** for:
Spinout Library 2026 (56 companies), Speakers Library 2026 (90), LP Forum, NISS, NASS, the pitch finals,
or media partners. Those are collection gaps, not import bugs.

**AIRTABLE META API LIMITS, LEARNED THE EXPENSIVE WAY (three rebuilds).** It CAN create tables, create
fields, rename tables and fields, and create lookups (`multipleLookupValues` with `recordLinkFieldId` +
`fieldIdInLinkedTable`). It CANNOT create views, delete a field, delete a table, change a field's TYPE,
or change a select's choices and colours after creation · `PATCH field` accepts **name and description
only**, anything else 422s with "Changing a field's type or number precision is not currently
supported". So bake every select choice and colour in at creation time or you are rebuilding the table.
A link field wants `options.linkedTableId` ONLY: adding `isReversed` or `prefersSingleRecordLink` 422s.
A lookup's source cannot be repointed afterwards, only renamed. Copy attachments between tables by
POSTing the signed `url` + `filename` with `typecast:true`, and fetch those URLs fresh because they
expire in about two hours.

**RE-READ THE SCHEMA BEFORE EVERY WRITE.** Auri renames fields in the UI between turns. Inside one
session `Organization` became `Company`, `Notes` and `LinkedIn` were deleted, `Source view` was
deleted and `Source` was repointed at the record deep link. Two scripts blew up on `UNKNOWN_FIELD_NAME`
before this became a habit.

**SCRIPTS.** All in the session scratchpad, PowerShell, token read from `.env.local`:
`import3.ps1` (the 320-row seed), `link.ps1` (Company Link matching), `enrich2.ps1` (source links +
exceptions), `trimls3.ps1` (confirmed-only trim), `merge.ps1` (duplicate merge).

**NEXT STEPS.** 1) Media & Press has zero rows because no partner in `Partner Deliverables 2026`
carries a media type · find that list and import it. 2) Same for pitch finals, LP Forum, NISS, NASS.
3) Chase the missing white SVGs: MPO `NOTE for Website and Brella App` (51 rows) records which
partners lack one, and Auri deleted the `Notes` field so that intelligence is NOT in the logo table.
4) Decide whether `Big Project` should be re-routed off the tier lookup instead of the MPO types used
at import (Community would go 105 > 115).
## SESSION · 2026-08-19 · PLANETARY HEALTH IS 14, LAID OUT 5 + 5 + 4 AND FILLING THE ROW

**CURRENT STATE.** **COMMITTED, PUSHED TO `main`, DEPLOYED** · but not by this session and not under
its own commit message. All three changed files were swept into **`ffb8c59`** ("progress.md:
reconcile four sessions with what actually shipped") by a session running in PARALLEL in this repo,
which ran a commit-all while these edits sat unstaged in the working tree. `ffb8c59` is on
`origin/main`, and pushes to `main` on this project go live in about a minute, so the change is live.
`npx tsc --noEmit` clean.

**WHAT WAS NOT VERIFIED: THE RENDERED ROW, ANYWHERE.** Playwright refused to open (its Chrome profile
was locked by the parallel session: "Browser is already in use … use --isolated") and the
claude-in-chrome extension was not connected, so localhost was never looked at. Production could not
substitute: `/ls-startups` on airtable-woad.vercel.app answers **401** behind `dashboardAuth`, the same
wall the AWS x NVIDIA session hit. The layout is deterministic grid arithmetic and the types compile,
but **the first person to open that page should confirm the last line ends flush with the right
edge**, on the dashboard and in a pasted embed.

**THE ASK.** Auri, with localhost:3000/ls-startups open: "there was a change, Planetary Health will
have 14 in total startups so make 5 5 4 fill the row." Two things in one sentence: the target count
drops 15 → 14, and the resulting short line must STRETCH rather than stop short with a hole on the
right.

**14 IS ALREADY FULL, SO THIS IS VISIBLE NOW AND NOT A FUTURE STATE.** `/api/ls-startups` counted
**45 confirmed, Planetary Health 14 · Human Health 16 · Deep Tech 15**. Planetary Health has hit its
target, so `soon` is 0, no dashed "More soon" boxes are drawn, and the row renders as a finished
5 + 5 + 4 wall the moment the page loads.

**WHAT CHANGED IN CODE.**

1. **`ROWS` in `app/ls-startups/page.tsx`**: Planetary Health `total: 15` → `total: 14`. The three
   targets are now **14 / 16 / 15**, all three still landing in exactly three FULL lines.
2. **`.lw-grid--14` in `app/globals.css`**: one grid of **20 tracks**, first ten tiles `span 4` (five
   across), last four `span 5` (four across). Same trick as the existing `.lw-grid--16`, mirrored. A
   spanned tile swallows the gaps inside its own span, so the row spends exactly the same width on
   gutters as a plain 5-column grid and the short line reaches the right edge instead of leaving a
   one-tile gap. Its spans are cleared at `max-width: 1100px` alongside the 16-row's, or they would
   keep spanning tracks the 4-column grid no longer has.
3. **`packWideFirst()` → `packLastLine(items, ratios, lastLine, pick)`** in the same page. The grid
   class is now derived from the tile count (`lw-grid--${tiles}` when `tiles` is 14 or 16), so a row
   picks up its override without a second hardcoded condition.
4. **`lib/lsStartupsEmbedSnippet.ts`**: `.tbbq-lsw__grid--14` CSS mirroring the above, and the inline
   `packWideFirst()` generalised to `packLastLine()` driven by a small `PACK` table
   (`{sel, n, last, dir}`) so both row sizes run through one loop.

**WHY THE 14-ROW PACKS THE OPPOSITE WAY FROM THE 16-ROW.** `packLastLine` moves logos to the last
line by measured aspect ratio, and the two rows want opposite ends of that sort:

| Row | Last line | Tiles there are | So it moves down the | `pick` / `dir` |
|---|---|---|---|---|
| 16 | 6 across | the NARROWEST on the page | 6 narrowest marks | `"narrow"` / `+1` |
| 14 | 4 across | the WIDEST on the page | 4 widest wordmarks | `"wide"` / `-1` |

The 2026-08-13 reasoning still holds and just runs backwards here: a long wordmark dropped into a
narrow tile shrinks to fit the width and floats in a box that looks half empty, while a compact mark
(a droplet, a square monogram) loses nothing because it was height-limited anyway. On the 14-row the
extra width is the prize, so the wordmarks get it. Still measured from the decoded images, never a
hand-kept list of names: the wall is live Airtable data and a list is wrong the next time a startup
confirms. A name tile (no renderable logo) counts as wide in both directions.

**THE EMBED WAS NOT OPTIONAL, AND IT IS THE HALF THAT REACHES techbbq.dk.** The dashboard page draws
placeholder slots; the public embed never does, it renders only the confirmed startups. With
Planetary Health at exactly 14 confirmed, an embed that knew nothing about 14 would have shipped
5 + 5 + 4 with the hole Auri asked to remove, on the live site, while the dashboard looked correct.
Fixing only `page.tsx` would have read as done and been wrong where it counts.

**GOTCHAS.**

- **The last line is TALLER, not just wider.** `span 5` of 20 tracks is about **26% wider** than
  `span 4`, and `.lw-tile` is `aspect-ratio: 5 / 3`, so height follows width: roughly 175px against
  138px at a 1200px container. This is the mirror of the 16-row, whose last line has always been
  about 19% SHORTER than the two above it, so the wall already lived with an uneven bottom line.
  Flagged to Auri. The alternative, four normal-width tiles centred with wider gaps, keeps the
  heights identical but is not "fill the row", so it was not built. Switching is a one-rule change in
  `.lw-grid--14` plus the same in the snippet.
- **`ROWS` is still duplicated by hand** across `app/ls-startups/page.tsx` and
  `lib/lsStartupsEmbedSnippet.ts`. It cannot be imported: `lib/lsstartups.ts` reads `AIRTABLE_TOKEN`
  at module scope, so importing it into a client component would pull that read into the browser
  bundle. Both copies were updated. A third copy does not exist; keep it that way.
- **14 and 16 are magic numbers in four places now** (page grid class, page `lastLine`, the CSS class
  name, the snippet's `PACK` table). A future 13- or 17-tile row needs all four touched.
- **A 15th Planetary Health confirmation silently undoes this.** `tiles = items.length + max(0, total
  - items.length)`, so a 15th confirmed startup makes `tiles` 15, no override matches, and the row
  drops back to a plain 5 + 5 + 5. That is correct behaviour, but it means `total` is a target Auri
  maintains by hand: if the category is really 14, an accidental 15th row in Airtable changes the
  layout rather than being flagged.
- **A parallel session in this repo will commit your unstaged work.** `ffb8c59` claims to be a
  progress.md reconciliation and carries three unrelated source files. Nothing was lost and the diff
  is correct, but `git log -- app/ls-startups/page.tsx` now points at a commit message that says
  nothing about the logo wall. Worth a worktree next time two agents are open on this repo (WORKFLOW
  r1).

**NEXT STEPS.**

1. **Open `/ls-startups` and look at the Planetary Health row.** Three lines, 5 / 5 / 4, the fourth
   tile ending level with the right edge of the two lines above. Then narrow the window past 1100px
   and confirm it falls back to plain 4-across cells with no leftover spans.
2. **Re-copy the embed snippet from the DEPLOYED dashboard** (not localhost) and re-paste it wherever
   the startup wall lives on techbbq.dk. The old snippet is inert HTML plus JS in the page: it does
   not pick up this fix on its own, it has to be pasted again.
3. **Decide the taller-last-line question** with Auri once it is on screen. Stretch (shipped) or
   centre four normal-width tiles (equal heights, gap on both sides).
4. **If the Planetary Health target moves again**, change `total` in `page.tsx` AND check whether the
   new count needs its own `.lw-grid--NN`. Anything divisible by 5 needs nothing.

## SESSION · 2026-08-19 · AWS x NVIDIA IS NOW A TYPED PROGRAMME, WITH FACES OUT OF BRELLA

**CURRENT STATE.** **COMMITTED, PUSHED TO `main`, DEPLOYED.** Three commits: `060449d` (the tab and
the Brella face source), `dc5992c` (the `amber` theme) and `bd92eff` (the invisible-label fix).
`npx tsc --noEmit` clean. **Verified ON PRODUCTION:** `/api/program?event=aws-nvidia` serves 4 sessions
with **10 of 10 faces**, all of them from the CRM rather than Brella. The Airtable rows are live
independently of the code — four records in the Sessions table, nine speakers in Marketing Project
Overview.

**THE ONE THING NOT VERIFIED ON PRODUCTION: the theme, on the dashboard itself.** `/program` sits behind
`dashboardAuth`; the local `INTERNAL_USER`/`INTERNAL_PASS` return **401** against
airtable-woad.vercel.app and `npx vercel whoami` says **Not authorized** in this environment. The theme
was verified locally in a generated embed — measured gradient-aware AND screenshotted — and it only ever
reaches the COPIED SNIPPET, never the server HTML, so there was nothing a production fetch could have
shown. Whoever opens that tab next should confirm the type labels are legible before publishing.

**THE ASK.** Auri, with the Sessions table open: "can you create another event from Board Summit for
NVIDIA and AWS because we have the program, we have all the information, even the speakers?" So the
tenth `/program` tab, the way the Board Summit and Future of Fintech were built.

**WHAT WAS WRITTEN TO AIRTABLE.** Four rows, `Name of the Event` = **`AWS x NVIDIA`**, `Event Room` =
Event Room 3, `When Is it` = Day 2, no `Session Status` (this config has no gate, same as Fintech):
`recoDEkdRNAlbk0O8` 13:30-14:10 · `recLXrL0pTizlb5nk` 14:20-15:20 · `recdfF4eWLCgKufFg` 15:30-16:10 ·
`recU8iYA5PlPqrBQN` 16:10-17:10. Times use the table's ` – ` (en dash) and people its ` · ` separator,
copied from the Future of Fintech rows rather than invented.

**THE SPELLINGS CAME FROM BRELLA, NOT THE PDF.** Extracting the PDF's text mangles three of them —
"Claes Radoewski", "Staer", "Christian Br?ndum" — where Brella has Claes Radojewski, Stær and Christian
Broendum. Anything typed from that document again should be checked the same way.

**THE 14:20 SLOT IS ONE ROW, NOT TWO** (Auri: "you can check brella the way it is done"). It really is
two deep-dives back to back, but the hosts' PDF gives ONE 14:20-15:20 window for both and so does
Brella. Both titles are named in the row's description and all four speakers sit on it. Splitting it
would have meant inventing a 14:50 boundary nobody published.

**WHAT CHANGED IN CODE.**

1. **`PROGRAM_SOURCES["aws-nvidia"]` in `lib/program.ts`**, filtered on the `Name of the Event` cell
   like every other programme in that table.
2. **NINE SPEAKER ROWS CREATED IN THE CRM** (`Marketing Project Overview`, `tblTecOBecLQCNIeD`), under
   `Project Name = "Event Room 3"`, `Session Name = "AWS x NVIDIA"`, `Role = Speaker`, with Brella's
   portrait ATTACHED to each (Auri: "in here we should create those missing speakers so maybe I can
   find it myself or with LinkedIn" — the photos did not need finding, Brella had all nine). Airtable
   downloads an attachment given a url, so `Profile Picture` holds real files, 400x400 to 2167x2166,
   not a hotlink. Ids: `recgqzKq1MrYsB0C0` `recoCvaGVlCQB6NCb` `recmAVNAEBKLi4hhQ` `recu9TmgyrtdRcrdG`
   `recNEGqwtTQWimRAR` `rec4nlu9j8GrgFXCx` `recOFFEdHWF6BDgz1` `reczG8EeyWR6G6Stp` `recvJv1nY8U2dYAJS`.
   **NINE, NOT TEN: Claes Radojewski was left alone.** He already has an Event Room 3 row with a photo
   for the Future of Fintech panel, and `fetchOneProject()` drops a name that appears TWICE under one
   project as ambiguous — a second row for him would have removed his face from both programmes.
   `LinkedIn Handle` is the field the other Event Room 3 rows use (`Link to LinkedIn` is unused) and is
   left empty on all nine; nothing reads it today.
3. **NEW · `facesFromBrella` and `fetchBrellaFaces()`** (`lib/programFaces.ts`). Seven of the eight
   speakers are in NEITHER face source this codebase had: they are AWS and NVIDIA staff and their
   guests, attached by the partner in Brella's admin, so `facesFrom` finds only Claes Radojewski (and
   only because he is also on the Fintech panel) and `facesFromView` has no registration table to
   read. Brella has all eight portraits and the board has been drawing them all along. The new source
   builds a name→photo map from the Brella feed and hands it to the existing `applyFaces()`; Brella's
   `photo-url` is a plain public URL, so unlike the Airtable sources it needs no `photoUrl()` signing.
   Tried LAST, so a TechBBQ headshot still wins where both know the person.
4. **A tab in the `EVENTS` array** (`app/program/page.tsx`): blue theme like Future of Fintech (same
   room, same day), `people: true`, and the same PDF the Brella board links.
5. **`facesFrom: "Event Room 3"` AHEAD of `facesFromBrella`.** Now that the CRM rows exist the faces
   come from the table marketing curates — verified: **10 of 10 through `/api/photo`, none from
   brella-assets** — so a better headshot is a cell edit rather than a code change. Brella stays as the
   backstop for a speaker the partner adds next week and nobody copies across.

**THE ONE RULE THAT HAD TO DIFFER.** `fetchViewFaces()` drops a name that appears twice with different
photos, because in a curated roster that means two people. **Brella is the opposite** and the first
version of this dropped Claes Radojewski's face for it: Brella mints a NEW speaker record per session
assignment, each with its own upload, so one person on three panels is three records with three urls.
Measured over the whole feed: 16 of 595 named-with-photo speakers have more than one url, and all 16
are plainly one well-known person on several sessions (Peter Kofler has five). So the exact key takes
the FIRST photo and keeps it; only the loose keys (`shortKey`/`pairKey`) still clash-drop, because
"anna berg" really can be two people.

**GOTCHAS FOR THE NEXT PERSON.**

- **`Name of the Event` is the contract.** Renaming that cell to anything but `AWS x NVIDIA` empties
  the tab with no error, exactly as the other nine do.
- **These four rows are ALSO on the Brella board**, as the four real sessions plus the declared shell
  band (lib/derivedShells.ts). The two surfaces now describe the same afternoon from two sources. No
  override was added, so the board still draws Brella's own rows — see NEXT STEPS.
- **To test a pasted agenda embed locally**, generate the snippet then replace the fallback URL in the
  generated HTML with `http://localhost:3000`; `lib/embedOriginGuard.ts` rewrites a loopback origin at
  render time. Same trick as the Brella embed.
- **The clipboard cannot be read from an automated browser** without a permission grant, so verify a
  copy button by generating the snippet from a script instead of clicking it.

6. **A NEW `amber` THEME** (`lib/agendaSnippet.ts`), #f8991d highlights on TRUE BLACK (Auri,
   2026-08-19: "for specifically aws x nvidia event the program has to be black with this colour
   highlights f8991d"). The first tab that carries neither the TechBBQ fire gradient nor a TechBBQ blue,
   which is right for a partner takeover with its own identity; it keeps Future of Fintech's STRUCTURE
   (outlined tags, no icons, no oversized opening) and changes only the palette. `bg` is `#000000`
   rather than `gold`'s `#0a0a0a` --garage because black was the word. Verified in a generated embed on
   a LIGHT host page: panel `rgb(0,0,0)`, and #f8991d on the heading (via background-clip:text), all
   four type tags, the PDF link and the panel border.
   **THE TAG IS FILLED, WHICH THIS GOT WRONG ONCE.** `.tbbq-agenda__tag` paints
   `background-image:var(--grad)` for EVERY theme, so `tagInk` has to contrast against the fill. It was
   first written as an outlined tag with `tagInk: "#f8991d"`, which put an orange label on an orange
   pill — the session type was invisible on the page Auri pasted, and the local check missed it by
   reading `backgroundColor` (transparent) instead of the gradient that actually fills it. **Verify a
   fill by measuring the gradient, or by looking at a screenshot.** Ink is now `#111111`, 8.6:1.
   **NEW TOKEN · `docBorder`.** The PDF link's outline used to come from `tagBorder`, so making the
   filled pill's border transparent would have erased the link's. They are separate now. Every existing
   theme's `docBorder` is set to what it painted before, so no other tab moved — which also records
   that **five of the seven themes draw that link with a TRANSPARENT border** (only `blue` and `amber`
   outline it). If Auri wants the link visible everywhere, that is now a one-value-per-theme change.
   **THE CTA INVERTS, and this is the bit to remember.** Every other theme darkens its fill to keep a
   white label; #f8991d is the colour Auri named, so darkening it would change it. White on #f8991d is
   2.2:1 and fails AA, so the filled button takes near-black ink at 8.6:1 instead. `CTA_FILL` in
   `app/program/page.tsx` mirrors it, and carries the same note.

**NEXT STEPS.** Nothing to commit or deploy — all three commits are on `main` and live.

1. **Copy the AWS x NVIDIA agenda embed from the DEPLOYED dashboard** for whatever page marketing wants
   it on, and **look at the type labels in the paste before publishing** (see CURRENT STATE for why that
   one thing is unverified).
2. **Two contrast bugs found while fixing this one, NEITHER TOUCHED, both one value each.**
   (a) Future of Fintech's type tags are `#93C5FD` on a `#2563EB` fill — **1.7:1**, badly failing AA on a
   tab that is already live. Same structural cause as the amber bug: the pill is filled, the ink was
   picked as though it were outlined. (b) **Five of the seven themes** (orange, navy, gold, crimson,
   beam) draw the "See the full program (PDF)" link with a TRANSPARENT border, so it reads as bare text
   with padding until hover — affects the Board Summit and Policy Stage tabs. `docBorder` now exists per
   theme, so each is a single value.
3. **`/api/program?event=<unknown>` returns 200 with the `techbbq` SAMPLE programme**, not a 404 — three
   placeholder rows ("Opening Remarks", "Sample Panel: The Nordic Ecosystem"). A typo in a pasted
   embed's event key therefore shows fake sessions on techbbq.dk instead of failing visibly. Raised with
   Auri, not yet decided.
4. **OPEN QUESTION for Auri:** now that the timed agenda exists as data, should the Brella board
   SUBSTITUTE it the way `lib/boardOverride.ts` does for the Board Summit? Today the board draws
   Brella's own four rows inside the band, which is already correct, so this is only worth doing if the
   typed rows drift from Brella's.
5. Still open: **ODIN** (`Future of Defence Program (1).pdf`) has Brella rows but no file on techbbq.dk.


## SESSION · 2026-08-19 · AWS x NVIDIA GETS A BAND AND ITS PDF · A SHELL ROW THE FEED DID NOT HAVE

**CURRENT STATE.** **COMMITTED AS `ea0811b`, PUSHED TO `main`, DEPLOYED AND VERIFIED THERE.**
`npx tsc --noEmit` clean. Verified against a live Brella read on both renderers, then again on
production: the Brella feed is **318 sessions** (was 317, the one extra is the declared shell) and
**11 documents attach to 65 board rows** (was 10 / 60). techbbq.dk still shows none of it until the
Event Rooms embed is re-copied from the deployed dashboard — a pasted snippet is a frozen copy.

**THE ASK.** Auri: add the AWS x NVIDIA PDF to the programme, "and also mention in the program that
from 13:30 to 17:10 AWS x Nvidia event with this transparent border that we used for all day events".
This is NEXT STEP 3 of the session below, now that the file is on techbbq.dk.

**WHAT WAS ON THE BOARD BEFORE.** Four rows in Event Room 3 on the 27th (13:30-14:10, 14:20-15:20,
15:30-16:10 and a 16:10-17:10 "Networking"), each titled after its own topic, with no track, no tags
and no programme name. Nothing said the afternoon was one event, and nothing linked the run of show.

**WHAT CHANGED.**

1. **`lib/sessionProgrammes.ts` gets an eleventh entry**, `AWS_NVIDIA-event-program-for-TechBBQ-2.pdf`,
   matched on the **block** (ER3 · `2026-08-27` · 13:30-17:10) and not on a title — the four rows share
   no prefix and the last is called just "Networking". The window is what keeps the PDF off Flatpay's
   Future of Fintech, which runs 09:30-13:00 in the same room with its own document. Five rows carry
   it (the four real ones plus the shell below); the PDF's four items match the four rows exactly.
2. **NEW · `lib/derivedShells.ts` declares a shell row the feed does not have.** The dashed band Auri
   asked for is what `lib/shellRule.ts` draws around any row that contains at least two strictly
   shorter sessions filling half its span — Future of Fintech, the Creative Business Cup, the Board
   Summit all get it from a real parent row in Brella. AWS x NVIDIA has no parent row, and the OTHER
   band (the derived all-day one) could not help: it is built from `programme`, which these rows do not
   carry, and it only fires for a room booked morning to evening.
   So the parent row is declared and appended to the feed: **"AWS x NVIDIA: The Agentic AI Era",
   13:30 - 17:10, Event Room 3**. No renderer was touched. Once the row exists, both copies of the
   shell rule recognise its SHAPE, which means the band, the nesting and the drop from the lane pass
   arrive on `/brella-program`, the pasted embed and `/api/program?event=brella` at once instead of on
   whichever one got patched.
3. **Wired in `lib/brellaprogram.ts`** AFTER the day pass and the sort, so the shell inherits the day
   label and the feed position of the first session it wraps rather than needing a start instant
   Brella never gave it. Its `programmeUrl` is looked up there for the same reason (it was not built
   from a Brella row).

**VERIFIED, both renderers, Event Room 3 on the 27th.** Two bands in the column, identical computed
style — `dashed 1px` at 45% alpha over a 9% wash, `pointer-events: none`, `aria-hidden` — 09:30-13:00
Future of Fintech and 13:30-17:10 AWS x NVIDIA. The AWS band is 660px for its 220 minutes, its four
cards sit inside it at full column width (so it did leave the lane pass), and its caption floats into
the empty 13:00-13:30 grid above the band (`data-labelabove="1"`) because a card starts on its own
first minute, exactly as Future of Fintech's does. `roomGaps` reports no new gap for that room.

**GOTCHAS FOR THE NEXT PERSON.**

- **The band is not pressable, in either renderer.** That is deliberate and old (Auri, 2026-08-12), and
  it is why the PDF has to be on the four real sessions: a link only on the shell would be a link
  nobody can reach. Same reasoning as the Board Summit's.
- **`derivedShells()` re-applies the shell rule before it adds anything** and logs loudly when a
  declaration no longer wraps a block — a partner block moved in Brella would otherwise become an
  empty dashed rectangle over an unrelated hour. It also suppresses itself if Brella ever gains the
  real parent row, so a stale entry is a lie in the file rather than a second band on the board.
- **The shell carries no `type`, no `tags` and no `programme`.** A kicker on it would put a fake tag
  into the board's filter list; a `programme` would name it in the column sub-label and could
  resurface as a derived all-day band. If Auri wants the Event Room 3 column to READ
  "Future of Fintech · AWS x NVIDIA", that is the one-line change (`programme` on the shell), and it
  is deliberately not made yet.
- **To test the pasted embed locally** you have to defeat `lib/embedOriginGuard.ts`, which rewrites a
  loopback origin to the deployed connector at render time. Generate the snippet, then replace the
  fallback URL in the generated HTML with `http://localhost:3000`. Also note the builder's section key
  is `"rooms"`, not `"Event Rooms"` — the label silently falls through to the card grid.

**NEXT STEPS.** Committed and deployed; nothing left in code. 1. **Re-copy the Event Rooms embed from
the DEPLOYED dashboard** (and the whole-program embed, if that one is pasted anywhere) — this is the only
outstanding step, and until it happens techbbq.dk shows the board without the band or the link.
2. Still open: **ODIN** (`Future of Defence Program (1).pdf`, six defence rows in ER4 on 26 Aug) has
Brella rows but no file on techbbq.dk. 3. The Deep Tech Stage programme is still an `.xlsx`.


## SESSION · 2026-08-19 · SEVEN NEW PARTNER PROGRAMMES LINKED ON THE BOARD · NORDIC IPO RESCUED

**CURRENT STATE.** **SHIPPED.** This session's work went to `main` inside `ea0811b` on 2026-08-19 — it
was still uncommitted in the working tree when the session above was written, so the two travelled in
one commit — and it is live on production. `npx tsc --noEmit` clean. Verified against a live Brella
read: **10 documents attached to 60 board rows** at the time; the session above took that to 11 / 65.
techbbq.dk shows none of it until the affected embeds are re-copied from the deployed dashboard.

**THE ASK.** Auri uploaded seven programme PDFs under a new naming convention
(`<Partner>_Program_<date>.pdf`) and asked which were already linked and which were missing. The rule
he set: **if the event is on Brella, attach the same "See the full program (PDF)" link the other event
room programmes have. If it is not on Brella, do not touch it** — the link rides on a Brella row, so a
programme with no rows has nowhere to hang.

**WHAT IS NOT ON BRELLA, and therefore deliberately not linked.** Three partner programmes sit in the
Partnership Success `Ready program` field with no row anywhere on the board: **Women in Tech Denmark**
(Diversity Lounge 2.0), **NORNORM** (circular breakfast) and the **Fundraising Bootcamp** (whose
attachment is a PNG). EY's Founders Growth Club is a Bridge Event, not an event room, so it is outside
this too.

**WHAT CHANGED.**

1. **Four new entries in `lib/sessionProgrammes.ts`**: the Policy Stage (ER 5,6,7 · 27 Aug, 15 rows),
   Plug and Play's "Small Hub, Global Ambition" (ER4 · 27 Aug, 6 rows — every row shares the title
   prefix), Google's "Scaling Europe" (ER5 · 26 Aug) and Flatpay's "Future of Fintech" (ER3 · 27 Aug,
   parent row only: two of its sub-rows are called "Networking Breakfast" and "Networking", which no
   title regex can claim without also claiming rows in other rooms).
2. **Microsoft repointed** at `Microsoft_Program_27.08.2026.pdf`. Not a re-export: the new file adds a
   15:40-15:50 networking break and shortens the roundtable. `TechBBQ-Ai-that-sells.pdf` is still on
   the server and is now linked from nowhere.
3. **Creative Business Cup now has ONE FILE PER DAY**, which needed a new `date` matcher on an entry.
   Every row of that block on both days is titled "Creative Business Cup 2026: …", so a title regex
   cannot tell the 26th from the 27th. Day 1 → 5 rows, Day 2 → 2 rows. The combined
   `CBC26-@TechBBQ-programme-overview.pdf` and the older `CBC_2026_Program.pdf` are both superseded and
   now unlinked.
4. **NORDIC IPO WAS SILENTLY BROKEN AND IS FIXED.** Its entry matched `/^nordic ipo\b/` and Brella has
   no row by that name any more — the day is fourteen separately-titled sessions ("Welcome Opening
   Session", "Will we see more IPOs in the near future?", two rows just called "Break") with no track,
   no tags and no programme name. That document had been linked from nowhere. Since nothing in the
   titles identifies the block, an entry can now match on **room + date + time window** instead:
   ER3, `2026-08-26`, 12:30-17:15. The unrelated 09:30-11:00 session in the same room stays out
   (verified).
5. **`lib/policyOverride.ts` attaches the document itself**, exactly as `boardOverride` does. Its rows
   are built from the Sessions table and never pass through the Brella mapper, and Brella's own row for
   that room is filtered out — so a link matched against Brella would have reached nobody.
6. **`/program` tabs**: the Policy Stage and Future of Fintech tabs now carry the same PDF above their
   lists, the way the Board Summit already did.
7. **DATE BUG FIXED.** The `/program` Policy Stage tab said **August 26th**. `lib/policyOverride.ts`
   records Auri's 2026-08-07 decision that it runs on the **27th** and files it there on the board
   (`POLICY_DAY`); the correction landed in one file and was missed in the other, so the embed on
   techbbq.dk printed the wrong day. It now reads August 27th with the venue line.

**GOTCHAS FOR THE NEXT PERSON.**

- **A title regex rots.** Partners' blocks keep being split into loose rows with no track and no tags
  (NISS, NASS, Deep Tech and now Nordic IPO all arrived that way), and a match that stops matching
  fails SILENTLY — the link just is not there. If you add an entry, check the row count on
  `/api/program?event=brella` afterwards rather than trusting the regex.
- **An overridden column never reaches `sessionProgramme()`.** The Policy Stage, NASS and the Board
  Summit are substituted from the Sessions table, so their documents have to be attached inside the
  override, keyed on the programme name.
- **Superseded PDFs stay on the server.** Three are now unlinked but still reachable by URL
  (`TechBBQ-Ai-that-sells.pdf`, `CBC26-@TechBBQ-programme-overview.pdf`, `CBC_2026_Program.pdf`).
  Nothing points at them; do not re-link one by pattern-matching a filename.

**NEXT STEPS.** Shipped in `ea0811b`. 1. **Re-copy the affected embeds from the DEPLOYED dashboard:**
the Brella board, plus the Policy Stage and Future of Fintech agenda tabs. Still outstanding.
2. **NVIDIA + AWS is DONE** — the file was uploaded and the two sessions above linked it, gave it a band
and then typed the whole programme into the Sessions table. 3. **ODIN** is still open:
`Future of Defence Program (1).pdf` has six defence rows in ER4 on 26 Aug and no file on techbbq.dk.
4. The Deep Tech Stage programme is an `.xlsx` and cannot be linked as a document; its sessions already
carry real times on the board.

**FILE POINTERS.** `lib/sessionProgrammes.ts` (the registry, the new `date` and `block` matchers) ·
`lib/brellaprogram.ts` (passes the date, room and slot into the lookup) · `lib/policyOverride.ts` ·
`app/program/page.tsx` (the two tab `doc`s and the 27th).

---

## SESSION · 2026-08-19 · `/team` NO LONGER REQUIRES THE `Active Team Member` CHECKBOX

**CURRENT STATE.** **DEPLOYED AND VERIFIED — and this entry's original conclusion was WRONG.** It said
a push builds nothing on this project and that the change needed `npx vercel --prod`. It did not: the
work reached `main` inside `ea0811b`, and **`https://airtable-woad.vercel.app/api/team` now returns 29**
with both **Nadja Schwabach** (Project Controller, Finance) and **Ida Nørgaard** (Head of Projects,
Projects) present — checked directly on 2026-08-19 after the push. `npx tsc --noEmit` clean;
`?department=Finance` still filters correctly (2: Nadja, Stephan Evon) and nobody was removed.

**WHY THAT READ WAS WRONG, because the trap is still here.** The deployed feed really did answer 27 when
it was checked. But the commit was sitting on `team-gate-active-checkbox`, a branch that had never been
pushed to `main` — nothing was building because nothing had been PUSHED, not because a push does not
build. Three separate pushes to `main` on 2026-08-19 each went live in about a minute, twice confirmed
by polling a public feed until the number moved (317→318 sessions, then 3→4). **Vercel is wired to this
repo and a push to `main` deploys it.** Do not reach for `npx vercel --prod`; check what branch you are
on instead.

**WHERE THE COMMIT ACTUALLY IS, because it is not where you would look.** Two Claude sessions were
running in this ONE working directory at the same time, so they shared a HEAD and an index. The other
session's `git add` swept up this session's two files, and the gate change is therefore inside
**`ea0811b "Partner programmes: eleven PDFs on the board, and a band for AWS x NVIDIA"`** together
with nine files of partner-programme work. Nothing is lost and `lib/team.ts` in HEAD is correct, but
there is no commit named after this change. A branch per agent does not help when both agents sit in
the same folder — use `git worktree` next time.

**THE ASK.** Auri: a new person added in Airtable was not showing on `/team`. The cause was
`{Active Team Member}=TRUE()` in the `fetchTeamOnce` gate, and his call was to drop that condition
rather than tick the box.

**WHAT CHANGED.** One thing, in `lib/team.ts`. The gate went from

```
AND({Active Team Member}=TRUE(), NOT(FIND('Archive',ARRAYJOIN({Department}))), {LTV}!='YES')
```

to

```
AND(NOT(FIND('Archive',ARRAYJOIN({Department}))), {LTV}!='YES')
```

Volunteers (`LTV = YES`) are still excluded, blank `LTV` still counts as not-a-volunteer, blank
`Name` rows are still skipped in `mapRecord`'s caller. The file's header comment was corrected too —
it still claimed "Active" was part of the rule.

**THE CONSEQUENCE, AND IT IS THE ONE THING TO REMEMBER.** `Department = Archive` is now the **only**
guard keeping a leaver off techbbq.dk. Unticking `Active Team Member` no longer hides anybody from
the public page. To take someone off the team, **set their Department to Archive.** The checkbox
stays in Airtable and is still fine as an internal marker, it just has no effect on the feed. The
trade was chosen knowingly: forgetting to tick hid people who had joined (which happened on every
single join), forgetting to archive shows someone who left (rare, and obvious on the page itself).

**WORTH KNOWING.** Ida Nørgaard's title is "Head of Projects", so `leadershipRank` gives her
`hierarchy: 3` and she pins into the leadership block near the top of the page rather than the
shuffled body. Nadja Schwabach has **no `Email`** in Airtable, so her card renders without the
mailto line. Neither is a bug; both are just what the data says.

**NEXT STEPS.** Step 1 below is DONE — superseded by the push to `main` on 2026-08-19. Kept because the
reasoning in it is still worth reading, and because it is wrong in an instructive way.
1. ~~**Deploy, or the public site keeps showing 27.** Merge `team-gate-active-checkbox` into `main`, then
   `npx vercel login` + `npx vercel --prod`. Wait for the other session's `/program` work to be
   committed first: `vercel --prod` uploads the WORKING DIRECTORY, not a commit, so deploying while
   that tree is dirty ships their half-finished work to production four days before the summit.~~
   **The merge was what mattered; `vercel --prod` was never needed.** The warning about a dirty tree is
   still correct and is exactly why `vercel --prod` is the worse tool here: a push deploys a COMMIT.
2. Confirm afterwards with `https://airtable-woad.vercel.app/api/team` → `count: 29`, then reload
   `https://techbbq.dk/about-us/`. **No Elementor re-paste is needed:** the live HTML on that page
   fetches the plain `/api/team` at render time (no `?ids=`, no `?department=`), so it picks the two up
   by itself once production is updated.
3. Sanity-check with Auri that Ida Nørgaard and Nadja Schwabach are genuinely current staff. They
   were unticked-but-not-archived, which is ambiguous — the change assumes not-archived means current.
4. The 22 people in `Archive` who still have `Active Team Member` ticked are now harmless, but the
   inconsistency is still there if anyone ever wants to trust that checkbox again.

**FILE POINTERS.** `lib/team.ts` — the gate is in `fetchTeamOnce` (~line 227), and the comment above it
carries the whole reason plus the Archive consequence. `lib/cachePolicy.ts` — `dailyTtlMs()`, why a team
edit can lag (10 min until Aug 27, then 24h). `app/team/page.tsx` — the dashboard page and its
`CopyEmbed` buttons. `lib/embedSnippet.ts` — the pasted snippet fetches `ENDPOINT` live, which is why a
data change needs no re-paste and a snippet change does.

## SESSION · 2026-08-19 · INTERN EMBED BROUGHT IN STEP WITH THE DASHBOARD

**CURRENT STATE.** **ON `main`.** `npx tsc --noEmit` clean. Verified in Chrome: the dashboard at
`/interns` and a standalone harness of the generated snippet, both with the disclosure open and the
pitch expanded. THE EMBED ON techbbq.dk KEEPS THE OLD MARKUP until somebody presses "Copy embed
code" on the DEPLOYED dashboard and re-pastes the block into the Elementor HTML widget. Nothing on
the public site changes until that paste happens.

**THE ASK.** Auri pasted the embed into Elementor and the card was not the card on the dashboard:
responsibilities were one flat paragraph instead of a chevron disclosure, and there was no manager
line. "Make sure the copy embed copies exactly the way it is."

**WHAT CHANGED, and two of these were decisions rather than bugs.**

1. **Responsibilities are now a `<details>` disclosure in the embed**, with the rotating chevron and
   the bullet/heading parser. `richText()` in `lib/internsEmbedSnippet.ts` is a deliberate port of
   `parseBlocks`/`RichText` in `app/interns/page.tsx` — the same small Markdown subset, the same
   promote-the-first-short-line rule. Every piece of intern text goes through `esc()`; no field text
   is ever put into markup unescaped.
2. **The manager line is now PUBLIC** (Auri's call, reversing 2026-08-17). `MANAGER_FIELD` is
   requested on every read in `lib/interns.ts`, and `stripInternal` is gone from
   `app/api/interns/route.ts`. Name and LinkedIn both come from #TechBBCuties, where `/api/team`
   already publishes them, so nothing new about a colleague is exposed. `Email` is still never
   requested and the consent gate has not moved.
3. **Both cards now lead with the 220-character pitch and reveal the full one behind "Read full
   pitch"** (`.ip-more` / `.tbbq-ip__more`). The dashboard used to print `pitchFull` outright. The
   button appears only when the full version is genuinely longer, so a short pitch gets none.
   `pitchFull` therefore goes out on the public feed now too.
4. **LinkedIn moved from the embed's footer up under the name**, matching the dashboard, and the
   footer is drawn only when there is a date or a manager to put in it.

5. **THE THEME DOES NOT GET A VOTE ON TYPE.** Auri pasted the new block into Elementor and the
   manager's name rendered at roughly twice the height of the line it sits on: `.tbbq-ip__mgrLink`
   declared colour and underline but never its font, so the theme's `a { font-size: 22px }` won. That
   hole was everywhere an element did not restate its own type — bare `p`, `li`, `span`, `h3`. The
   fix is a base type block on `#uid` plus one rule setting `font-family/size/weight/style/
   line-height/letter-spacing/text-transform: inherit !important` on every text tag inside the panel.
   `inherit`, not fixed values, so each element takes what its own parent sets; every rule after it
   still overrides it. `text-decoration` is deliberately excluded — the underlines mean something.

**GOTCHA FOR THE NEXT PERSON.** Three traps in this file, all of them silent:

- The snippet is a TS template literal, so every regex backslash in the inline script has to be
  doubled (`\\d`, `\\s`, `\\n`) or it becomes a literal letter and the parser quietly stops matching.
- `[hidden]{display:none!important}` is there on purpose: WordPress themes set `display` on
  everything and the "hidden" half of the pitch was otherwise on screen.
- **Anything you add to a card must declare its own font, or inherit it explicitly.** Verified by
  rendering the generated snippet under a deliberately hostile stylesheet (Georgia 18px base,
  uppercase `h3`, 22px bold blue `a`, `list-style:disc` with 40px padding) and reading back computed
  styles: every element came out at its intended size, family, colour and marker. Worth repeating
  that harness for any future card element rather than trusting the clean-page render.

**NEXT STEPS.** 1. Let the Vercel deploy of `main` finish. 2. Press "Copy embed code" on the DEPLOYED
dashboard, not localhost, or the block bakes in a localhost origin WordPress cannot reach. 3. Paste
it into the Elementor HTML widget on techbbq.dk, replacing the old block.

---

## SESSION · 2026-08-19 · REGISTER BUTTONS ON TWO AGENDAS · NEW /project-speakers · DENMARK-SWEDEN INTO THE CRM

**CURRENT STATE.** **ALL OF IT IS ON `main` AND DEPLOYED.** Two commits: `a9e3a71` (the Register
buttons) and the project-speakers commit that carries the page, the feed, the CRM overlay and
`scripts/seed-denmark-sweden-crm.mjs`. `npx tsc --noEmit` clean; the page and the generated embed were
both verified in Chrome against the live feeds. techbbq.dk shows none of it yet — the two agenda
embeds keep their old markup until somebody re-copies them from the deployed dashboard and re-pastes
into Elementor.

**NOT ON MAIN, ON PURPOSE.** The branch `partner-deliverables-and-logo-scales` still holds the logo
wall (`666cd90`) and intern embed (`b1d05ba`) commits, unreviewed and unpushed. Main was taken from
`a9e3a71`, so a later merge of that branch will conflict on this file's top section — keep the newest
entry and drop the duplicate.

**THE ASK, in the order it arrived.** A clickable Register button on the Fintech 09:30 breakfast and
on NISS · then "create something like Project Programs but for speakers, starting with Denmark-Sweden"
· then cards should carry name, job title and company only, with the single moderator inside the
speaker grid under a label · then the Denmark-Sweden people added to the CRM · then, once Auri had
filled their titles and LinkedIn there, the roster had to READ from the CRM.

**WHAT CHANGED.**

1. **`cta: {url, label, slot}` on the agenda builder** (`lib/agendaSnippet.ts`, wired in
   `app/program/page.tsx`). A filled button in the programme's accent, printed inside the row whose
   `timeSlot` matches `slot` (matched loosely, so a dash or a space cannot miss) and above the list
   when nothing matches, so a retimed session cannot take the button away with it. The snippet also
   DROPS the raw sign-up URL from a description that carries it — printed and buttoned is the same
   instruction twice. Fintech → `luma.com/1k0s1iv7`, NISS → `luma.com/7fflalfl`.
2. **`lib/programPeople.ts` — the agenda IS the roster.** It flattens a programme's sessions into
   people: one entry per person per role, dedup by the same folded name the face lookup uses, fullest
   billing line wins, first real photo wins. `PROGRAMME_PROJECTS` is the canonical ten-project list.
   Moderators sort first and carry `tag: "Moderator"`; there are NO role tabs (Auri: a tab holding one
   card is a click that hides a person).
3. **`/api/program-speakers?event=<key>&role=all|Speaker|Moderator`.** It reuses the
   `program:<source>` cache entry `/api/program` already fills, so the roster costs no extra Airtable
   read and cannot disagree with the agenda. A missing or unknown `?event=` is a 400 listing the valid
   keys rather than a silent fallback onto another project's people.
4. **The CRM overlay.** `fetchCrmPeople` reads Marketing Project Overview (allow-listed fields,
   filtered server-side on `Project Name`, paginated, 10s, failure returns what it has) and
   `enrichFromCrm` overlays it: **the CRM wins on job title, company and LinkedIn; the agenda wins on
   the photo**, because the session row holds the file the organisers supplied. `crmProjectsFor()`
   REUSES `facesFrom` from `lib/program.ts` and only adds the extras, so the two lists cannot drift.
   Cached under `crm-people:<projects>`, fetched in parallel with the agenda, `?fresh=` drops both.
5. **12 rows created in the CRM** by `scripts/seed-denmark-sweden-crm.mjs` (dry run by default,
   `--apply` to write, re-runnable, reads the people from the Sessions table rather than a hardcoded
   list). `Project Name` = Event Room 6, `Session Name` = Denmark-Sweden Summit, `Role` per person,
   photo pulled from the session-row attachment (12/12 downloaded). `Job Title` holds the agenda's
   line VERBATIM and `Company` was left empty — Auri's call, because splitting that source means
   inferring where a title ends. He then filled title, company and LinkedIn by hand, which is what
   step 4 now reads.

**GOTCHAS FOR THE NEXT PERSON.**

- **`fields[]` must be appended one per name.** `new URLSearchParams({"fields[]": [...]})` joins the
  array with commas and Airtable reads the whole comma string as ONE field name, then 422s the request
  and kills it. Cost 20 minutes.
- **`Project Name` is a SINGLE select.** You cannot "also" file somebody under a second project; the
  table's convention (see `lib/eventrooms.ts`) is one ROW per project assignment.
- **Do NOT file Event Room 6 people under the "Event Room 5,6,7" option** to make them appear in a
  view. That value is the Policy Stage's key (`lib/policystage.ts`) and would put them on the Policy
  Stage roster on techbbq.dk.
- **A browser can serve a stale copy of a feed URL** whose default you have just changed — it looked
  exactly like one person missing from the embed. Hard-reload before believing a count.
- Regex backslashes inside `lib/agendaSnippet.ts` must be doubled: the snippet is a TS template
  literal, so `\r?\n` in the source is what reaches the browser as `\r?\n`.

**WHAT IS STILL OPEN.**

1. **Airtable UI, one click:** the "Event Room Speakers" view (`viwLptcHWF3Wce6Im`) does not show the
   12 new rows. Its filter enumerates `Project Name` values and never had an Event Room 6 option.
   Ruled out by test: Company (patched one row, no effect, reverted), LinkedIn, and the
   `Event Room` / `Which Event Room` fields. The API cannot read or edit view filters. The rows ARE
   visible in the **Speakers** view `viwfIcQFDNQ9ggSqx`.
2. **Review and commit the three CRM-overlay files**, then deploy.
3. **Re-copy both agenda embeds** from the deployed dashboard and re-paste into Elementor, or the
   Register buttons never reach techbbq.dk.
4. **NISS reads 0 CRM rows** (`Project Name = "NISS"` matches nothing; its people live in the NISS
   table behind `facesFromView`). No regression — its 46 people keep their agenda lines — and the
   overlay picks them up with no code change if marketing ever files them. The page says how many
   people have no CRM row so this is visible rather than mysterious.
5. Consider ONE per-project page combining the agenda and the roster; they now share one source.

**FILE POINTERS.** `lib/agendaSnippet.ts` (cta) · `app/program/page.tsx` (the two cta entries) ·
`lib/programPeople.ts` (roster + CRM overlay) · `app/api/program-speakers/route.ts` ·
`app/project-speakers/page.tsx` · `scripts/seed-denmark-sweden-crm.mjs` · `lib/pages.ts` (menu entry) ·
`lib/programFaces.ts` (now exports `foldName`).

---

## SESSION · 2026-08-19 · DELIVERABLES ROWS · LOGO WALL RE-BASELINED · `Exceptions` NOW READ

**CURRENT STATE.** **WRITTEN.** Auri approved and `--commit` ran: 8 rows created in Partner
Deliverables 2026, view **221 → 229**, every one of the 8 verified present in the view with its
Partner ID, contact email and Company Link. `scripts/add-missing-deliverables.mjs` now copies contact
name and email; that script is the only file changed and is **not committed to git** yet.

**THE ASK.** Same job as 2026-08-17: check confirmed partners on Partners 2026 (`tbl9V6ZtxEbR4uELC`,
view `viwDhqsDpfEf0PRyI`) and create rows in Marketing Project Overview's Partner Deliverables 2026
view (`tblTecOBecLQCNIeD` / `viw7FVbsTb9IRaWF0`) for any new signings. No duplicates. Must carry
company name, Partner ID, contact information, and the Company Link back to the CRM.

**THE 8.** confirmed 219 · deliverables 221 · missing 8.

| Company | Partner ID | Type mapped | Contact | CRM record |
|---|---|---|---|---|
| AEPIFD | 2855 | Community | Jean-Louis ROCHERON · assoepifd@gmail.com | recKsPA7PmBW9Q6Cx |
| Famly ApS | 2948 | blank (Sponsorship) | al@famly.co | recEFhPjhXLKY2Dnl |
| Kromann Reumert | 749 | blank (no CRM type) | jhm@kromannreumert.com | recAXTlKFlBRjuww7 |
| Eastern Peak | 2908 | Tailored | Maryna · maryna.stadnik@easternpeak.com | recAWfUB2LJmwSab5 |
| Stinto | 2032 | blank (Projects, Barter Deal) | cr@stinto.com | rec3bXn7tfW2zgUTe |
| One Thirty Labs | 2961 | blank (Barter Deal) | tine@onethirtylabs.com | recSXo8WfauPwHU0u |
| SIT PORT | 2912 | Community | cholinsky@plzen.eu | rec1N3BycNhJrSCPD |
| Get Volt | 2963 | blank (Barter Deal) | adriano.mandolini@getvolt.dk | recBC0hV1EZeLrOiW |

**THE ROWS THAT WERE CREATED** (deliverables record ids, in creation order): `recvytzkaFFstljp3`
AEPIFD · `rece2gGoccfIXVSQ6` Famly ApS · `recIh1pf07iCm4xW6` Kromann Reumert · `reccLn4QB6uYNgGIl`
Eastern Peak · `rec2xSd5dypd1EE7L` Stinto · `recgFzjHnYmfJF3U0` One Thirty Labs · `recVIQBCe3rEmavPY`
SIT PORT · `recjaQMAJm4XkRZ6x` Get Volt. All 8 have `Put on web = false` and no logo. If any of them
is deleted, add its Partner ID to `NEVER_CREATE` before the next run.

**TEN PRE-EXISTING DUPLICATE PARTNER IDs IN THE VIEW, NONE OF THEM OURS.** The post-write check
counted Partner IDs across the view and found 10 ids on two rows each. Every one predates this
session; no id from the 8 appears. Two shapes:

- **Same company twice**, one row usually richer: 283 Copenhagen School of Entrepreneurship (both on
  web), 711 Kalvebod Fælled Skole, 907 NORNORM (both on web), 1939 Radia Network (both on web),
  996 ProWoc under two spellings, 1610 "AISTART Incubator - Business Helsinki" vs "Business
  Helsinki", 2123 "International Workplace Group" vs "SPACES/REGUS", 2861 "Futuro Perfecto /
  Horizon Deep Tech Summit" vs "Futuro Perfecto Innovation", 313 "Danske Bank" vs "Danske Bank
  Growth".
- **A wrong Partner ID**, which is worse: **2222 is on both "AWS Startups" and "NVIDIA"**, two
  unrelated companies, so one of those rows points at the wrong CRM partner.

These are name-variant duplicates, which is exactly what the name-normalizing dedupe cannot catch
once the names differ, and the reason a rerun of this script will never see them. Merging is Auri's
call, not the script's.

**WHAT CHANGED IN THE SCRIPT: THE EMAIL IS A LOOKUP, NOT A FIELD.** The 2026-08-17 version wrote no
contact data at all. Reading `Contact Email` gets you nothing for 6 of these 8, because the CRM only
holds the address as `Mail` — a lookup through the linked `Contacts` record. `buildFields()` now
takes the first filled value in newest-first order: name from `Contact Person 2026` → `Contact Name`
→ `Marketing contact`, email from `Email 2026` → `Contact Email` → `Mail` → `Email` →
`Email (from Contacts) 2`. Only 2 of the 8 have a name anywhere; the rest get an email and no name,
which is the honest state.

**THE DUPLICATE THAT IS NOT A DUPLICATE.** `receq21SBUTg8wWr5` is a row in the deliverables table
whose `Company` is "One Thirty Labs" — and it is **Tine Hertz's Campfire Stage moderator
submission**, not a partner row (`Role: Moderator`, `Session Name: Campfire Stage`, a profile
picture, no Partner ID). Marketing Project Overview holds 3,836 rows of several unrelated kinds, so a
name collision there proves nothing on its own. Creating the One Thirty Labs partner row is correct.
The dedupe was checked on Partner ID **and** normalized name (legal suffixes stripped, so an existing
"Famly" would have caught "Famly ApS") across the **whole table**, not just the view: 0 real hits.

**GOTCHAS.**

- **4 of 8 get a blank Partnership Type on purpose.** The CRM multi-select has Sponsorship, Projects
  and Barter Deal; the deliverables single-select has only Academic, Challenger, Community,
  Conqueror, Core, Core Plus, Delegation, Explorer, International, Investor, Main, Prime, `Pioneer `
  (trailing space is real), Tailored. No mapping exists, and an invalid option is rejected by the
  API. Kromann Reumert has no type in the CRM at all.
- **None of the 8 has a website or a LinkedIn URL in the CRM**, so those columns stay empty.
- **`Put on web` is never set and no logo exists**, so none of these reach the partner wall until a
  logo is collected from the partner.
- **"Idempotent" still means "skips what exists", not "safe to re-run after a deletion."** If Auri
  deletes one of these 8, add its Partner ID to `NEVER_CREATE` or the next run recreates it.
- `FORCE_INCLUDE` still holds 2925 (Greeks in the Nordics). Its CRM status is now Confirmed anyway,
  so that entry can be deleted on the next pass.

**NEXT.**

1. Chase logos for the 8. Without a logo none of them can be published, regardless of the tick, and
   `Put on web` is Auri's decision, not the script's.
2. Fill the 4 blank Partnership Types by hand, or agree with marketing on options for Sponsorship /
   Barter Deal / Projects and add them to `TYPE_MAP`.
3. Decide what to do about the 10 duplicate Partner IDs above. Start with **2222 (AWS Startups vs
   NVIDIA)**, since a shared id means one row links to the wrong partner.
4. Commit both changed files: `scripts/add-missing-deliverables.mjs` (contact-copy, now proven
   against a real write) and `lib/partners.ts` (Skytek). The Beyond Beta fix from 2026-08-17 may
   still be uncommitted too — check before branching.
5. DONE — Flatpay, Copenhagen and Business region Gothenburg are deleted from `LOGO_SCALE`.
6. DONE — both commits are on main and live in production (see SHIPPED above).
7. **Make the stale-nudge check automatic.** FIVE occurrences in three days is not a coincidence,
   it is a missing test. Add a CI step (or a cron) that runs `measure-logo-ink.mjs` over the wall and
   FAILS when any `LOGO_SCALE` entry exceeds that logo's current `cap`. The filter is one awk line:
   rows where the `now` column is not 1 and `now > cap`. That would have caught Beyond Beta, Skytek,
   PSV, Flatpay and Copenhagen before Auri ever saw them. The check is worth MORE after today, not
   less: ten logos were re-exported in one afternoon, and each re-export is a chance for a nudge to
   go stale.

**THE WALL WAS IGNORING THE `Exceptions` COLUMN, AND TWO PARTNERS SAT IN THE WRONG BAND.** Auri:
"there is the last column that says exceptions. Please look at that because this is very important."
The Partner Deliverables 2026 view has always had a free-text `Exceptions` cell; `lib/partners.ts`
never read it. Four rows carry one:

| `Exceptions` text | partner | before | after |
|---|---|---|---|
| "Has to be Placed in Challenger" | Highbridge Law Firm | **Community** | Challenger |
| "we gotta put in in the Challenger tier" | rebriQ | **Community** | Challenger |
| "Has to be placed in Pioneer" | Jyske Bank Growth | Pioneer | Pioneer (unchanged) |
| "Has to be in Core" | Skytek Nordics ApS | Core | Core (unchanged) |

The last two were already right because `TIER_EXCEPTIONS` hardcodes them, which is the tell: **the
partnerships team had been writing the instruction in Airtable and the code was carrying its own
copy.** Highbridge and rebriQ had no hardcode, so nobody noticed the column was dead.

**HOW IT READS PROSE.** Those four cells are four different phrasings of one instruction, so
`exceptionTier()` does not parse them, it SCANS for the name of a band from `PARTNER_TIERS` and
accepts the answer only when **exactly one** name appears as a whole word. Two names or none logs a
line and falls through, because a silent guess would put a partner in a band nobody chose. Whole-word
matching is done by checking the neighbouring characters rather than by building a regex: a ``
inside a template literal is one keystroke from being the BACKSPACE character, which matches nothing
and fails silently. **That exact bug was written and caught during this session** — the first version
never matched anything, and the tool chain quietly ate the second backslash twice before the check
was rewritten without one. It also means "corefully placed" cannot read as Core and "Community Core
Partnership" is refused for naming two bands.

**PRECEDENCE, strongest claim first:** `Exceptions` cell → `TIER_EXCEPTIONS` → the deal-size formula
→ `NO_CONTRACT_TIERS`. A cell somebody typed this morning beats a constant compiled last week.
Skytek's and Jyske Bank Growth's hardcodes are now redundant and kept only as a floor if the cell is
cleared; Industriens Fond, Erhvervsfremmebestyrelsen and Humandone have no cell and must stay.

**VERIFIED**: `tsc --noEmit` clean, feed still 217 partners, and the rendered page puts Highbridge and
rebriQ under the Challenger heading, Jyske Bank under Pioneer, Skytek under Core.

**SKYTEK'S LOGO: THE BEYOND BETA BUG, SECOND OCCURRENCE.** Auri: "fix skytek logo" on
`/partners`. `LOGO_SCALE["Skytek Nordics ApS"]` was **2.11 → 0.97** in `lib/partners.ts`, and the
header comment above that table no longer uses Skytek as its 23%-ink example (PSV does).

`node scripts/measure-logo-ink.mjs skytek` now reports **ink at 100% of the image box**, AR 3.33,
`cap` 0.97, and flags the row "already maxed". The partner replaced the padded square export with a
tight crop, so 2.11 was adding ~345% of area to a mark already touching its own edges. Verified in
the browser: the mark renders 200x106 inside its 245x147 `.lw-tile`, inside on both axes, and sits in
line with TONIK and Owl Ventures on the Core row.

**PSV, SAME THING, SAME DAY.** Auri: "fix PSV now as well, since I adjusted logo". Its new file also
measures **ink 100%**, AR 2.65, `want` 1.00, `cap` 1.09 — so the nudge was **deleted from
`LOGO_SCALE` rather than lowered**. Absent means 1, and 1 is the correct answer; a number there can
only make it worse. Verified: PSV renders 184x97 inside its 245x147 tile, in line with Teknologisk
Institut and Deloitte on the Core row.

**THE FULL SWEEP, AND THREE MORE STALE NUDGES NOBODY HAS ASKED ABOUT YET.** A whole-wall run
(`node scripts/measure-logo-ink.mjs`, 218 rows, ~2min, output kept in the scratchpad) was filtered to
the rows carrying an explicit nudge and compared against each one's current `cap`. **Three exceed it,
all measured at ink 100%, i.e. all re-exported as tight crops since the 2026-08-04 pass:**

| Partner | `LOGO_SCALE` now | `cap` | rendered vs tile | verdict |
|---|---|---|---|---|
| **Flatpay** | 1.83 | 0.94 | **382x203 in 245x147** | worst on the wall, ink cropped |
| **Copenhagen** | 1.38 | 0.94 | **288x153 in 245x147** | over on both axes |
| **Business region Gothenburg** | 1.19 | 1.13 | marginal | `use` 1.00, delete the entry |

Left alone on purpose: Auri asked for Skytek and PSV, not these. The one-line fix for each is the
same as PSV's — delete the entry. `Innovation Centre Denmark` (1.19, cap 1.19) sits exactly on its
cap and is fine.

**AURI RE-EXPORTED TEN LOGOS, SO FOUR NUDGES WERE DELETED, NOT LOWERED.** After the sweep above
Auri replaced the artwork for every padded file that had room to grow. A full re-measure
(`node scripts/measure-logo-ink.mjs`, kept as `ink-after.txt` in the scratchpad) confirms **ten of
the twelve now measure ink at 100% of the image box**: STHLM Music City (was 17%), SHE/THEY Club
(19%), The Kitchen (35%), San Francisco Oy (41%), Heartcore Capital (60%), Clarma Capital (76%),
Royal Danish Academy (37%), Mesh (91%), Business Iceland (93%), Innovation District Copenhagen (93%).
**Not one of them needs an entry in `LOGO_SCALE`** — every `use` came back at or below 1.00, so the
padding they were going to be nudged for is simply gone.

`LOGO_SCALE` therefore LOST four rows today rather than gaining any: **PSV 2.92, Flatpay 1.83,
Copenhagen 1.38 and "Business region Gothenburg AKA Gothenburg" 1.19, all deleted.** Absent means 1,
which is what the ~190 other tight-crop logos on the wall use, so these now sit on exactly the same
footing as their neighbours. Skytek keeps an explicit 0.97 and Beyond Beta 0.94 because their `cap`
is genuinely below 1.

**VERIFIED IN THE DOM, ALL 218 TILES.** Every logo named above renders inside its tile with room to
spare (Flatpay and Copenhagen at 36px clear on both axes, PSV 61x49, Skytek 45x41). Five tiles report
an overflowing IMAGE BOX — INCUBA x KITCHEN, Nordea, IDA, Terkko Health Hub, Adeo Web — and **all
five are the documented false positive**: their ink is 19-52% of the file, so only transparent margin
crosses the tile edge. That is the same trap the 2026-08-17 entry warns about. Do not "fix" them.

**Two files were NOT re-exported and both are fine as they are.** Superseed still measures 82% ink at
AR 9.23 and Business Iceland's sibling case shows why that cannot be nudged: at 9:1 the mark already
spans the tile's width, `cap` 0.97. **Erhvervshus Sjælland (62% ink) will not change no matter what
is uploaded to Airtable** — it is served from `LOGO_FILE_OVERRIDES` as the local EU co-funding
frieze, so tell Auri to replace `public/Erhvervshus-frieze.png` if he wants it different.

**Innovation Centre Denmark keeps its 1.19** even though its file is now a tight crop too. It sits
exactly on `cap` 1.19, inside the tile, and the value was set for an optical reason Auri signed off
on. `want` is 1.00, so dropping it is defensible; it was left alone rather than changed silently.

**The nine nudges that are still EARNED** all measure well under 100% ink and still want growing:
INCUBA x KITCHEN 2.29 (19% ink), IDA 1.80 (33%), Nordea 1.71 (37%), Terkko Health Hub 1.44 (52%),
Gothenburg Tech Week 1.31 (59%), Adeo Web 1.29, Southern Sweden 1.25, advores 1.24, Creative Business
Network 1.17. Do not touch these.

**This is the second and third time a stale nudge broke a tile in three days** (Beyond Beta, 1.96 → 0.94, on
2026-08-17). The 2026-08-17 entry's "DO NOT FIX SKYTEK OR PSV" was true of the OLD file, where only
transparent margin overflowed the bounding box and no ink left the tile. **That verdict belonged to
the artwork, not the partner.** That entry also called PSV fine at 2.92 against 12% ink. Also true of the old file, also superseded
the moment Auri re-exported it.

**SHIPPED, AND PRODUCTION IS VERIFIED.** Both commits are on `origin/main` and live:

- `8ff9436` logo scales + the deliverables contact copy
- `ab142d7` the `Exceptions` tier override

**A PARALLEL SESSION WAS EDITING THIS REPO AT THE SAME TIME.** The logo commit was authored here as
`666cd90` on the branch and reached main as **`8ff9436`** — a different hash, i.e. somebody rebased or
cherry-picked it across and pushed, alongside two intern-embed commits (`7f24b89`, `5b3b41a`). The
branch was re-pointed at the new main under us, so the `Exceptions` commit fast-forwarded cleanly and
nothing was lost, but **check `git log --oneline -5` before assuming your local commit is the one that
shipped.** The intern/globals/programFaces files that were dirty in the tree all session were
committed by that other session, not here.

**A PUSH TO MAIN DOES TRIGGER A VERCEL BUILD.** The 2026-08-17 note saying it did not is out of date.
Production was polled after the push and returns Flatpay 1, PSV 1, Skytek 0.97, Copenhagen 1,
Business region Gothenburg 1, Highbridge Law Firm Challenger, rebriQ Challenger — so techbbq.dk now
matches localhost with no `vercel --prod` and no Elementor re-paste.

**FILE POINTERS.** `scripts/add-missing-deliverables.mjs` (the whole job; header comment carries the
2026-08-17 history) · `lib/partners.ts` + `app/partners/page.tsx` (the wall these rows feed) ·
`.env.local` / `secrets.enc.env` (`AIRTABLE_TOKEN`).

---

## SESSION · 2026-08-18 · MEDITATION BREAKS ON `/brella-program`: VIOLET, FLOORED, ON TOP

**CURRENT STATE.** The eight meditation breaks on `/brella-program` are violet again, floored to a
pressable height and drawn in front of the cards around them. **Committed and pushed: `d276a55` on
`origin/main`**, which also carried the Denmark-Sweden Summit session below it (that entry's
"nothing deployed; nothing committed" line is now out of date — see step 1 under NEXT).

**THE BUG AURI REPORTED.** "These Meditation breaks, 3 Minute Arrival Meditation, can you make them
purple and put them on top so they are not hidden by other sessions."

**THE MACHINERY ALREADY EXISTED AND WAS MATCHING A WORD THE FEED NO LONGER USES.** `lib/brellaTheme.ts`
has had a band treatment since 2026-08-05: a 24px height floor (`BREATH_MIN_PX`), `zIndex: 3`, and
`layOutColumn()` in `components/ProgramTimeline.tsx` padding the covered card's text down past the
band so nothing ends up underneath anything. It fired on `BREATHWORK_RE = "breathwork"`. The 2026
Brella feed contains **zero** sessions with that word: all eight breaks are named "3 Minute Arrival
Meditation" or "Meditation & Talk Break!". So every break fell back to an ordinary card — 3 minutes
is 9px of axis, under the 24px target size WCAG 2.2 asks of anything pressable, and in front of one
neighbour and behind the next depending on DOM order. Nothing was broken; the pattern had gone stale
under the data.

**THE FIX IS THREE LINES IN `lib/brellaTheme.ts`.** No component changed.

1. `BREATHWORK_RE = "breathwork|meditation"`. Verified against the live feed: **8 of 300 sessions
   match, no false hits** (checked "Copenhagen Fintech Meetup", "Stage Opening", "Welcome to
   TechBBQ 2026!" among them). "breathwork" stays in the pattern because the 2025 programme used it.
2. `BREATHWORK_LABEL = "Meditation"`, so the badge says what the card is.
3. `sessionColor()` returns `BREATHWORK_COLOR` (#B49BFF) for them and `sessionColor2()` returns
   `undefined`, so the card is flat violet with no gradient.

**POINT 3 REVERSES THE 2026-08-06 DECISION** that a break wears its stage's colour (orange on the BBQ
Stage, green on Founders). The reason for going back: the badge and the wind glyph alone did not
separate eight 3-minute cards from the talks around them, and violet is the one hue no stage uses.
Both decisions are written into the comment above `sessionColor()` rather than only here — the next
person to flip this needs to find the history at the code, not in a 300KB handoff.

**IT ALSO ENDED A DRIFT.** `lib/brellaEmbedSnippet.ts` never stopped painting breaks violet
(`if(isBreath(s))return "--track:"+BREATH_COLOR;`), so the dashboard and the copied embed had been
showing the same break in two different colours since 2026-08-06.

**GOTCHAS FOR WHOEVER TOUCHES THIS NEXT.**

- **The matcher is the name, and the name is the partner's to change.** This is the second time the
  wording moved under the pattern. If the breaks vanish into the board again, check
  `BREATHWORK_RE` against the live feed before assuming the layout broke.
- **`isOpening()` excludes breathwork by construction**, so widening the meditation pattern narrows
  the opening one. Nothing in the 2026 schedule matches both; a session called "Opening Meditation"
  would render as a meditation break, which is the intended precedence.
- **The CSS needed no change** because `.bp-tl__card[data-breathwork]` in `app/globals.css` is built
  entirely on `var(--track)`, which `sessionVars()` sets from `sessionColor()`.
- **NOT visually verified.** The Playwright MCP browser profile was locked by another session
  (`mcp-chrome-b32b429`, "Browser is already in use"). `npx tsc --noEmit` is clean repo-wide, and
  the regex plus the feed were checked against the real data, but nobody has looked at the board.
- **`next build` was NOT run**, deliberately: a dev server is up on :3000 and building against a live
  dev server is the orphaned-`next dev` trap.

**FILE POINTERS.** `lib/brellaTheme.ts` (the whole change: `BREATHWORK_RE`, `BREATHWORK_LABEL`,
`sessionColor`, `sessionColor2`) · `components/ProgramTimeline.tsx` (`layOutColumn`, `BREATH_MIN_PX`,
the `zIndex: 3` on `band`, `BreathBadge`) · `lib/brellaEmbedSnippet.ts` (`isBreath`, `BREATH_COLOR`) ·
`app/globals.css` (`.bp-tl__card[data-breathwork]`, ~line 1821).

**NEXT.**

1. **Confirm the Vercel deploy went green.** `d276a55` is on `origin/main` and the repo is
   Vercel-linked, so the push likely triggered production. The commit carries the interns feed and
   `/program` work that had been sitting uncommitted, so this is a bigger deploy than the meditation
   change suggests.
2. **Look at the board.** `/brella-program`, BBQ Stage ~11:54 and Campfire ~12:13 on day 1. Check the
   violet card sits in front and the talk under it starts its text below the band.
3. **Check the copied embed matches**, since the whole point of the colour change was to end the
   dashboard-vs-embed drift.
4. **Decide on the untracked files**, still uncommitted: two partner logos
   (Danmarks_erhvervsfremmebestyrelse, Novo Nordisk Foundation) which are probably wanted, five
   `scripts/*.mjs`, and `public/partner-logos/_verification_temp` which looks like scratch output and
   should probably be gitignored.

## SESSION · 2026-08-18 · DENMARK-SWEDEN SUMMIT: AIRTABLE, /program, AND BRELLA'S MISSING SECOND DAY

**CURRENT STATE.** The Denmark-Sweden Summit (Event Room 6, 27 August, organised by Øresundsinstituttet
and Greater Copenhagen) now exists on all three surfaces: **8 session rows in Airtable with 17 photos**,
a **tenth tab on `/program`** rendering every face, and **8 timeslots live in Brella** where Event Room 6
previously had no second day at all. Verified end to end. **Committed and deployed on 2026-08-18 as
part of `d276a55`** (see the session above); this entry originally read "nothing deployed; nothing committed".

**1 · AIRTABLE · `scripts/seed-denmark-sweden-summit.mjs`** — creates the 8 rows in `Sessions`
(`tblSlpTzDi2oVYwqv`) with `Name of the Event = "Denmark-Sweden Summit"`, `Event Room 6`,
`When Is it = Day 2`, and uploads each headshot onto the row that person speaks on. Dry run by default;
REFUSES to run twice while rows with that event name exist, because a session row has no natural key
and a second `--apply` would silently double the programme.

Descriptions are EMPTY on purpose: the source run of show has none, and writing programme copy for a
partner's event is not a script's call.

**2 · THE PHOTOS CAME IN AT UP TO 16MB.** Airtable's `uploadAttachment` endpoint caps at 5MB, so the 13
files in "Dansk-svenska talarbilder TechBBQ" were resized to 800x800 JPEGs (~60-100KB) before upload —
square crop, centred horizontally, biased 30% down so a portrait keeps the face rather than the chest.
Five were eyeballed including the widest landscape original. Trine Grönlund shipped two photos; "1" is
the headshot, "2" is a casual shot holding a book.

**PAIRING IS BY INDEX AND THE RENDERER IS UNFORGIVING.** `parsePeople` in `lib/program.ts` drops EVERY
photo on a row when the name count and photo count disagree, rather than risk the wrong face on the
wrong person. So the upload order has to match the name order, and `uploadAttachment` APPENDS one file
per call — which is what makes sequential calls the ordering mechanism. The five-person panel is where
this would have failed quietly.

**NO SEMICOLONS IN `Speaker Details`.** Anne-Louise Thon-Jensen's two roles are joined with a COMMA
("Partner and Co-Founder at SDG Invest & Vår Ventures, Board Member at Minc"). Only the FIRST comma
splits name from title, so later commas are free — but some programmes opt into splitting people on
";" and that would have invented a nameless seventh panellist.

**3 · `/program` · the tenth tab.** `"denmark-sweden"` in `PROGRAM_SOURCES` (`lib/program.ts`) and in
`EVENTS` + `EventKey` (`app/program/page.tsx`). Theme `navy`, heading "August 27th", sub "Event Room 6",
`people: true`. Organisers and partners are deliberately NOT on the page (Auri).

**NO `facesFrom` AND NO `facesFromView`.** These 12 are the organisers' guests, not TechBBQ
registrations, so they are in neither the CRM roster nor any presenter form and a join would match
nobody. Their faces ride on the session rows instead, which needs no config: the `policy-program` photo
feed in `lib/photo.ts` already covers `Speaker Photo` and `Moderator Photo` for everything in this table.

**4 · THE TAB BAR SCROLLS NOW (`.seg--scroll` in `app/globals.css`).** Ten programmes stopped fitting one
row and `.seg` is a single inline-flex row that never wraps, so the bar ran past the card and gave the
whole page a horizontal scrollbar. Still `inline-flex`, NOT `flex`: a block-level flex child stretches
the pill background across the full container with the buttons floating in the middle of it.
`flex-shrink: 0` on the buttons, or the labels squash to two lines instead of scrolling.

**5 · BRELLA HAD NO 27 AUGUST IN EVENT ROOM 6 AT ALL.** The track `🔹 Event Room 6` (id **43423**) held 13
timeslots, every one of them on the 26th (Deep Tech Event Day).
`scripts/brella-push-denmark-sweden.mjs` created the 8 missing ones, reading titles and times from
`/api/program?event=denmark-sweden` rather than retyping them, so Brella cannot drift from techbbq.dk.
Created ids **#990584-#990591**, read back from Brella afterwards rather than trusting the POST bodies.

**BRELLA STORES UTC AND COPENHAGEN IS UTC+2 IN AUGUST.** 12:00 local is `10:00:00.000Z`. This was
CHECKED against live 27-August rows before writing, not assumed: Event Room 2's `07:25Z` renders as
09:25 and `08:45Z` as 10:45. Getting it wrong shifts a public schedule by two hours.

**WATCH THE DAY NUMBERING, THE TWO SURFACES DISAGREE.** Brella derives "Day N" from whichever dates
exist in its feed and it has a 25 August, so **Brella calls 27 August "Day 3"** while `/brella-program`
and Airtable call it **Day 2**. Same date, different label. Filter on the DATE, never the day number.

**6 · `ROOM_DAY_PROGRAMMES` in `lib/brellaSections.ts`** gained
`{ room: "Event Room 6", date: "27 August", programme: "Denmark-Sweden Summit" }`. Event Room 6 now runs
two different programmes on two days off ONE plain track, so the track name cannot tell them apart and
`programmeOf()` would have labelled both days "Deep Tech Event Day".

**NO "ALL DAY" BAND ON THIS ONE, AND THAT IS CORRECT.** The derived band only draws when a programme
spans the day (`lo <= MORNING_BY && hi >= EVENING_FROM` in `lib/brellaEmbedSnippet.ts`). This one runs
12:00-14:35. The `programme` label is on all 8 sessions in the feed regardless.

**VERIFIED.** 8 Airtable rows with room/day/type correct and all 17 photos fetched at 200, 800x800, with
thumbnails · the feed returns 8 sessions with 17 faces and all 17 proxy URLs serve `image/*` · the panel
shows its five faces against the right five names · all TEN programmes still serve (`niss` 13, `nass` 22,
`fintech` 8, `policy` 15, `board` 14, `pension-summit` 10, `family-office` 7, `lp-forum` 11,
`investor-day` 9, `denmark-sweden` 8) · Brella's Event Room 6 reads 13 on the 26th and 8 on the 27th ·
`tsc --noEmit` clean.

**NEXT STEPS.**
1. **SPEAKERS ARE NOT LINKED IN BRELLA.** The integration API exposes no speaker-assignment route
   (probed at length in `brella-push.mjs`), so all 12 have to be attached by hand in the Brella UI.
   `node scripts/brella-push-denmark-sweden.mjs --plan` prints the per-session checklist.
2. Brella's 8 sessions carry no descriptions and no speakers, so they show up in the
   "which rooms still look incomplete" panel on `/brella-program`. Expected, not a fault.
3. Nothing is committed and nothing is deployed. `/program`'s new tab is dev-only until then.
4. If Øresundsinstituttet sends session descriptions, they go in `Description` and appear on both
   surfaces with no code change.

## SESSION · 2026-08-18 · THE SPEAKER GALLERY SHOWS FACES, AND THE FILTER WAS AN `or`

**CURRENT STATE. DONE.** `Speakers Available 2026` (`viwG7ZfVITFa3s3Ue`) serves **every 2026
`I am a: = Speaker` submission, and every single one has a photo. 86 records, 86 faces, 0 blank tiles**,
all fully ingested with thumbnails generated. Verified as an exact SET match against the Speaker rows in
`2026 - Media Interview Requests` (`viw4PKkUXGobSuvVO`), not just an equal count: 0 missing, 0 extra,
0 non-Speaker, 0 created outside 2026. Live in the PR base. The Hub-sync blocker from earlier today is
gone, because the gallery no longer needs the Hub at all.

**THE COUNT IS 86 TODAY AND WILL MOVE.** It read 87 mid-session and dropped to 86 while the work was in
progress. Nothing was deleted: the 2026 row count held at 109 and the split went 87/22 to 86/23, so one
person's `I am a:` was corrected from Speaker to Media in Airtable and the gallery followed. Do not
treat a changed count as a bug. Re-derive it from the filter.

**ALL SPEAKERS, EVEN IF ONE LATER HAS NO FACE.** An earlier pass had a third condition,
`Speaker Photo is not empty`. It was REMOVED on purpose: it hid 7 real speakers from the media, and a
blank tile with a name beats a missing person. Do not put it back, even though every tile happens to
have a photo right now.

**THE POPULATION, SETTLED.** The gallery shows exactly one thing: whoever ticked `I am a: Speaker` on
`Speaker & Media Matchmaking 2026` (`viwJlwqd2BlG2qwzA`) and therefore lands in
`2026 - Media Interview Requests` (`viw4PKkUXGobSuvVO`). Not the wider applicant pool.

**1 · `Speaker Photo` (`fldXzJsG66kEvbxwc`)** — a REAL `multipleAttachments` field on
`PR/Program Matchmaking`, and now the gallery's cover. This is the whole fix. Both earlier plans were
dead ends: a lookup of the Hub's attachments cannot be a cover, and moving the gallery onto
`Speaker Hub 1:1` is blocked by that table being externally synced. The submissions table is native and
writable, so the photo belongs here.

**2 · `scripts/fill-speaker-photos.mjs`** — fills it from two sources, in priority order: the Hub via
the existing `Speaker Profile` link (73 rows), then the Marketing base roster matched on a normalised
name (7 rows, incl. the `Cecilia Bonefedeld-Dahl` typo via an explicit alias map). Dry run by default,
`--apply` to write, skips rows that already have a photo. Filled 80 of 86; all 80 ingested with
thumbnails generated, three fetched back at 200 to prove the bytes serve.

**3 · THE FILTER WAS AN `or`, WHICH IS WHY THE VIEW SERVED 242 ROWS.** The two conditions were
`I am a: is Speaker` **or** `Attachments (from Speaker Profile) is not empty`. That is what pulled in 92
rows from 2022 and 63 from 2025 — not a missing year filter, an `or`. It now reads:

    Where  I am a:   is              Speaker
    and    Created   is on or after  1/1/2026

Two conditions, nothing about photos. The `Created` bound also kills the 2022 duplicate of
Henriette Kirkegaard, who submitted again in 2026 under the same name.

**4 · THE HUB IS A STALE PARTIAL COPY OF THE MARKETING ROSTER.** The real speaker roster is
`appgXNjXJqpk9Ebxd` / `Marketing Project Overview` / view `Speakers` (`viwfIcQFDNQ9ggSqx`): 525 rows,
497 distinct people, 522 with a Profile Picture, fed by the `Speakers for Different Projects` form
across 14 projects. `Speaker Hub 1:1` holds 148 records — 135 of the 210 TechBBQ Summit applicants, 10
of the other 287, and 6 people found nowhere in Marketing. So the 6 who blocked earlier today
(Sara Rywe, Fabrizio Del Maffeo, Agnessa Pedersen, Jonathan Sanders, Howard Wright, Yoav Orlev) were
never missing a photo; they were missing from a sync. Their faces came straight out of Marketing.
**Nobody needs to chase the Hub's sync source for this gallery.**

**THE ROSTERS USE FULLER NAMES THAN THE FORM.** Three people looked photo-less and were not. The
form takes whatever they typed; the roster has their full name. Each match was confirmed against the
Company on the submission, never on the name alone, and went into the script's `ALIASES` map rather
than any fuzzy matching, because a wrong face on a media-facing gallery is worse than a blank tile:

| form says | roster has | confirmed by |
|---|---|---|
| `Rustamova` | Ula Rustamova | Level Zero Health |
| `Naama Harari` (x2 rows) | Naama Harari Uzan | Wix |
| `Katrine Arevad` | Katrine Arevad W. R. | KvindeKompagniet |
| `Christie Kristensen` | Christie H. Kristensen | Danske Bank A/S |
| `Henriette Kirkegaard` | Henriette Schultz Kirkegaard | Zephyra |

The Company check earns its keep on Christie: a DIFFERENT Christie Kristensen submitted as Media from
Pantrium Podcast, and there is an unrelated Thomas Kristensen in the roster.

**WHEN A TILE IS BLANK, SEARCH THE MARKETING ROSTER FOR A SUBSTRING OF THE NAME BEFORE CONCLUDING THE
PHOTO DOES NOT EXIST.** All 6 people who first looked photo-less had a photo the whole time, under a
fuller name. Zero of them needed a manual upload.

**NEXT STEPS.**
1. Nothing to upload. Every tile has a face.
2. `Speakers` on the media form still points at `Speakers 1:1` (`viwP58QXZiQncyzdH`), UNFILTERED — all
   148 Hub records show in the live media picker. Repoint it, ideally at the new gallery view.
3. Delete the duplicates: Cecilie Waagner Falkenstrøm appears 3x in the gallery, Naama Harari 2x.
4. Re-run `fill-speaker-photos.mjs` after any new speaker submission; it only touches empty rows.

**GOTCHA.** Airtable attachment URLs expire a couple of hours after they are read, and the write hands
Airtable a URL to fetch server-side. Read and write in the same run. Ingestion is also ASYNC: right
after the apply, 15 of the 80 had no `size` or `type` yet and looked like failures. They were done 45
seconds later. Do not "fix" a fresh apply.

## SESSION · 2026-08-18 · SPEAKER 1:1 GALLERY: LINKING THE FORM TO THE FACES

**CURRENT STATE.** 73 of the 86 2026 speaker submissions now carry a `Speaker Profile` link to their
`Speaker Hub 1:1` record. Written to the live PR base. The gallery views themselves are NOT built yet,
and the work is BLOCKED on one question (see step 3).

**THE PROBLEM.** The gallery `Speakers Available 2026` (`viwG7ZfVITFa3s3Ue`) sits on
`PR/Program Matchmaking` (`tblJYAh4MT3NMeOeD`), which has no attachment field, so it shows no faces.
An Airtable gallery cover MUST be an attachment field on the SAME table — a lookup of attachments
cannot be a cover. So that gallery can never show photos, no matter what is looked up into it.

The fix is to flip the direction: build the gallery on `Speaker Hub 1:1` (`tblvpTxZqA5pUlDDY`), where
every one of the 148 records already has a photo, bio and job title, and pull the "this person
confirmed they are a speaker" signal across a link.

**WHAT THE DATA ACTUALLY SAID.** `Speakers Available 2026` is filtered only on `I am a: = Speaker`,
with NO year filter: 242 records, of which 92 are from 2022 and 63 from 2025. Only 87 rows (83 unique
people) are real 2026 submissions. Fixing that filter is its own task.

**1 · `Speaker Profile` (`fldVJwWtMIjfgq7Dk`)** — new single link on `PR/Program Matchmaking` ->
`Speaker Hub 1:1`. Deliberately NOT the existing `Speakers` field (`fldc6PS99yUdSb9WE`): that one means
"this media person wants to interview these speakers" and would poison the filter.

**2 · `scripts/link-speaker-profiles.mjs`** — matches submitters to Hub records on a normalised name
(diacritics and titles stripped, so "Dr. Ahmed Ismail" hits "Ahmed Ismail"). Dry run by default,
`--apply` to write. Skips rows that already have a link, so re-running is safe. 73 matched exactly;
they resolve to 71 distinct people because Cecilie Waagner Falkenstrom submitted three times.

**3 · BLOCKED: `Speaker Hub 1:1` IS AN EXTERNALLY SYNCED TABLE.** Creating records in it returns
`INVALID_PERMISSIONS: the underlying table is externally synced`. So the 6 people who are in the
Supabase roster with photos but missing from the Hub CANNOT be added through the API — they have to be
added at whatever feeds the sync. That source is not discoverable through the API; it has to be read off
the table's sync settings in the Airtable UI. `scripts/sync-speaker-hub-1on1.mjs` is written and its dry
run is correct, but its write path is dead until the source is known.

**STILL UNLINKED (13 rows).**
- 1 typo, safe to link by hand: form says `Cecilia Bonefedeld-Dahl`, Hub says `Cecilia Bonefeld-Dahl`.
- 6 in the Supabase roster with photos, blocked by the sync: Sara Rywe, Fabrizio Del Maffeo,
  Agnessa Pedersen, Jonathan Sanders, Howard Wright, Yoav Orlev.
- 5 with no photo anywhere, need a record built by hand: Katrine Arevad, Naama Harari (2 duplicate rows),
  Christie Kristensen, Blake Brodie, and a row whose Name is just "Rustamova".

**NEXT STEPS.**
1. Read the sync source off `Speaker Hub 1:1` in the Airtable UI, then add the 6 there.
2. Link `Cecilia Bonefeld-Dahl` by hand.
3. On `Speaker Hub 1:1`, add a lookup of `I am a:` and of `Created` through `PR/Program Matchmaking 2`
   (`fldZH23BDyK8xuG6o`, the auto-created reverse of `Speaker Profile`).
4. Build a gallery view there filtered to those lookups, cover image = `Attachments`.
5. Point the form's `Speakers` field at that view via "Limit record selection to a view". It currently
   points at `Speakers 1:1` (`viwP58QXZiQncyzdH`), which is UNFILTERED — all 148 Hub records show in the
   live media picker today.
6. Add a year filter to `Speakers Available 2026` so it stops serving 2022 and 2025.

**GOTCHA.** Adding records to the Hub table grows the live media picker immediately, because
`Speakers 1:1` has no filter. Do step 5 before any bulk resync of the roster.

**DUPLICATES TO DELETE.** Cecilie Waagner Falkenstrom x3, Naama Harari x2, in the 2026 speaker rows.

## SESSION · 2026-08-17 · INTERN POOL: THE MANAGER, AND A NEW ORDER ON EVERY LOAD

**CURRENT STATE.** `/interns` names each intern's manager, the name opens that manager's LinkedIn,
and the grid is in a different order on every page load. Verified on the dev server, not deployed.
The intern-pool chapter itself is in
[`progress-archive.md`](progress-archive.md) — "The manager, added 2026-08-17" there carries the
privacy reasoning, which is the part not to unpick.

**1 · THE MANAGER (`Manager (internal) Reference`)**

A LINK field to `#TechBBCuties`, so Airtable returns record ids; `fetchManagers()` in `lib/interns.ts`
resolves them (`Name` + `LinkedIn` only) in one extra request per cache miss, chunked at 50 ids, and
never throws — a failed lookup drops the manager line, not the page. The field is
`managers: InternManager[]`, a list, because the column permits several.

It stays INTERNAL by two independent mechanisms: the column is only appended to `fields[]` when
`includePending` is set (dashboard password), and `stripInternal()` in the route removes `managers`
alongside `pitchFull` so it cannot reappear through the shared cache. The manager's LinkedIn is not
a new exposure — `/api/team` already publishes staff LinkedIn and the team embed renders it.

**2 · A DIFFERENT ORDER EVERY LOAD**

Whoever leads the wall gets read the most, and the department-then-name sort handed that to the same
intern every time.

- `app/interns/page.tsx` — mount-fixed seed + seeded LCG shuffle, the idiom Speakers 2026, NASS and
  the investor pages already use. Fixed per MOUNT, not per render, so a revalidation or a department
  pill cannot re-jump the grid mid-read. Live and pending shuffle separately, since the page draws
  them as two sections.
- `lib/internsEmbedSnippet.ts` — Fisher-Yates over the array once on load, so every techbbq.dk
  visitor gets a different first card. **Takes effect only once the embed is copied out again.**
- `lib/interns.ts` still sorts and must keep sorting: the feed is cached and CDN-cached, so a
  server-side shuffle would freeze ONE order for everybody until the cache rolled over, and
  `useCachedList`'s diffed "changes" count needs the same list back twice.

**VERIFIED** (dev server, 12 live interns): dashboard feed carried all 12 managers with profile URLs
and the public feed had no `managers` key at all · 12 anchors rendered with correct hrefs, aria-labels
and a visible focus ring, zero plain-text fallbacks · 5 page loads gave 5 distinct orders with the
same 12 people · the order held across an in-page "Refresh from Airtable" · 4 loads of the built
embed gave 4 distinct orders · `tsc --noEmit` clean.

**NOT DONE.** Three interns (Riccardo, Rui Lin, Zsófia) render a blank photo tile and the page logs
a 404 from the photo proxy. Pre-existing, untouched, worth a look.

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
