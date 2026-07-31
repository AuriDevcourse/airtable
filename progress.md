# Progress · TechBBQ Airtable Connector

Server-side proxy that exposes a **safe slice** of the TechBBQ Airtable as JSON, so
techbbq.dk (WordPress + Elementor) can show speakers without the token or PII ever
reaching the browser.

## Session 2026-07-31b (Codebase audit: bug fixes + de-duplication)

State: DONE, uncommitted. `tsc --noEmit` clean, `npm run build` clean, all 17 feed responses
verified **byte-identical** to pre-change output (A/B'd against the original code fetched at
the same moment — see "How this was verified" below).

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
