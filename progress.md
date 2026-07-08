# Progress · TechBBQ Airtable Connector

Server-side proxy that exposes a **safe slice** of the TechBBQ Airtable as JSON, so
techbbq.dk (WordPress + Elementor) can show speakers without the token or PII ever
reaching the browser.

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

**NOT LIVE YET — remaining manual steps (Auri):**
1. Add `CRON_SECRET` to Vercel env (value is in local `.env.local`). Token also needs `data.records:write`.
2. Branch + push (repo auto-deploys from main; don't edit main directly — WORKFLOW r1). Merge to deploy.
3. GitHub repo secrets: `SYNC_URL=https://airtable-woad.vercel.app/api/sync-speakers` + `CRON_SECRET` (same value).
4. Then run the Actions workflow once manually (Actions tab -> Run workflow) to confirm.

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
