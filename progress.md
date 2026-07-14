# Progress · TechBBQ Airtable Connector

Server-side proxy that exposes a **safe slice** of the TechBBQ Airtable as JSON, so
techbbq.dk (WordPress + Elementor) can show speakers without the token or PII ever
reaching the browser.

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
