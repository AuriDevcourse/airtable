# Progress · TechBBQ Airtable Connector

Server-side proxy that exposes a **safe slice** of the TechBBQ Airtable as JSON, so
techbbq.dk (WordPress + Elementor) can show speakers without the token or PII ever
reaching the browser.

## Session 2026-08-10 (m) · Board Summit speakers, and faces by name

### 27 rows written into Marketing Project Overview

Under `Project Name = "Event Room 1"`, `Session Name = "Board Summit"` on all 27. 23 Speakers,
4 Moderators. Deduped by name across the 14 sessions: Henriette Divert moderates three, Stine
Colding Alstrup and Victoria Bager open and close.

They first went in with the individual session title in `Session Name` and Auri had them retitled
the same day: in a CRM row the useful fact is WHICH PROGRAMME this person belongs to, not which of
fourteen panels — the panel is already in the Sessions table and a person on three of them cannot be
one row. Nothing in code reads this field for the Board Summit; the face match keys on `Project
Name` + `Full Name`, so the rename needed no deploy.

WHY THERE: Brella carries the Board Summit as ONE all-day row in Event Room 1 with **zero speakers
attached**, and only 2 of the 27 exist anywhere in Brella's 356 speakers (for other sessions). There
were no faces to import and nothing to link to. `Project Name` has no "Board Summit" option and
adding one edits the schema of a 3,670-row live CRM, so the existing Event Room 1 option was used —
the six older rows there are the "Beyond Unicorns" session and never collide by name.

Titles were parsed at the FIRST comma of "Name, Title, Company". Last-comma reads
"CEO, The Lundbeck Foundation & Chair, Ørsted" as a job title. Five people legitimately have no
company ("Board Professional", "Olympic Champion", "Neuroscientist & Author").

### Faces come from the CRM now, matched by name

lib/programFaces.ts, opt-in per source via `facesFrom`, set only on `board`. Upload a headshot once
on the person's CRM row and it appears in the agenda; the Sessions row's own photo cell still wins
where it is filled. The alternative was 27 uploads into `Speaker Photo` cells in the same order as
the typed names, with no way to check the pairing by looking at it.

Three headshots already existed elsewhere in the CRM (Erik Balck Sørensen, Sander Janca-Jensen, Ken
Villum Klausen) and were copied onto the new rows, which is what proved the join. **The remaining 24
need a photo uploaded in Airtable** — nothing in code is waiting on anything.

The name match is the whole limitation: a duplicate name is left faceless on purpose, and a name
spelled differently in the two tables silently keeps its initial. If a face is missing, check the
spelling in Marketing Project Overview against the Sessions cell before suspecting the code.

### NEXT SESSION (2026-08-11) · headshots + LinkedIn for 24 Board Summit people

The only thing standing between the Board Summit embed and a finished page. No code is waiting on
this: drop a photo into `Profile Picture` on the person's row and it appears in the agenda on the
next cache fill (or press Refresh on /program). The three who already have one are done.

Where to fill it in: Marketing Project Overview `tblTecOBecLQCNIeD`, filter
`Project Name = "Event Room 1"` AND `Session Name = "Board Summit"` (27 rows).

- **Photo** → `Profile Picture`. This is what the agenda reads, through the name join.
- **LinkedIn** → `LinkedIn Handle` (a URL field) or `Link to LinkedIn` (text). All 27 are empty.
  `linkedinUrl()` in lib/fields.ts already reads both and normalises them. NOTE: the agenda embed
  does NOT link names to LinkedIn today — the speaker GRIDS do (/policy-stage and friends). If the
  Board Summit names should be clickable, that is a change to lib/agendaSnippet.ts, not data.

Every name is spelled here exactly as the Sessions table spells it. **Do not "fix" a name on one
side only** — the face join matches on the name, and a one-sided correction silently drops the face.

- [ ] Anja Monrad · Board Professional
- [ ] Anne Malberg Horsager · DTU Board Education & Certificates
- [ ] Bianca Bruhn · CEO, Google Denmark
- [ ] Bjarne Corydon · Director General, DR – Danmarks Radio
- [ ] Bodil Sidén · General Partner, Kost Capital
- [ ] Camilla Ley Valentin · Board Professional
- [ ] Christian Thrane · CEO, TDC Brands
- [ ] Christina Kjær · Head of Research, Erhvervslivets Tænketank
- [ ] Helle Uth · General Partner & Co-founder, PSV Tech
- [ ] Henriette Divert · Executive Advisor, Bcc
- [ ] Jakob Beck Thomsen · Head of Business Banking Denmark, Nordea
- [ ] Jakob Riis · CEO & President, Falck
- [ ] Jan C. Olsen · CEO, EY Denmark
- [ ] Karina Wellendorph · CEO, Visma e-conomic
- [ ] Katarina Gospic · Neuroscientist & Author
- [ ] Keld Reinicke · Co-founder, Veo Technologies
- [ ] Lars Rasmussen · Chair, Committee on Corporate Governance
- [ ] Lene Skole · CEO, The Lundbeck Foundation & Chair, Ørsted
- [ ] Ossi Lindroos · President & CEO, Solita
- [ ] Søren Pind · CEO, Association of Active Ownership
- [ ] Stine Colding Alstrup · CEO & Co-founder, Boardway
- [ ] Thomas Koefoed · Partner, Netcompany
- [ ] Victoria Bager · CCO & Co-founder, Boardway
- [ ] Viktor Axelsen · Olympic Champion

Done: Erik Balck Sørensen, Ken Villum Klausen, Sander Janca-Jensen (photo carried over from their
existing TechBBQ Summit / Event Room 3 rows; still no LinkedIn).

Two of these have a title where a company belongs and no company at all, which is correct for
"Board Professional" and "Olympic Champion" but worth a second look on Anne Malberg Horsager, whose
source cell gave one value with no comma to say which it was.

### Still open

- The embed says "Event Room 1 & 2" because Auri asked for it. **Brella says Event Room 1** only.
- August 27th is confirmed by Brella ("Day 3 · 27 August"). The Policy Stage tab still says
  August 26th for rows whose `When Is it` also reads "Day 2" — the two Airtable day numberings do
  not agree with Brella's, so check the Policy date the same way before the summit.

## Session 2026-08-10 (l) · Board Summit, and an Airtable view that stopped filtering

New `/api/program?event=board`: the Board Summit (hosted by Boardway), 14 sessions on Day 2, read
from the same Sessions table as the Policy Stage. Dark blue rather than the fire gradient — the
`navy` theme in lib/agendaSnippet.ts. Tab + copy-embed button live at /program. Deployed, both
feeds verified in production.

### A VIEW IS NOT A CONTRACT

The Sessions table now holds THREE programmes: The Policy Stage (15), Board Summit (14), Defence &
Dual Use (7). `viwrTVxvTBucbJW7S` was pinned as "The Policy Stage" and had since been widened to the
whole table, so `?event=policy` was quietly serving **36 sessions** with all three agendas
interleaved by start time — the Policy Stage embed on techbbq.dk showed the Board Summit inside it.
Nothing in this repo changed; somebody edited a view in the Airtable UI.

Both sources now carry an optional `filter` (filterByFormula) on `{Name of the Event}`. Filter on
the CELL, not on a view, whenever one table holds several things. Defence & Dual Use is the obvious
third source when it is wanted; it needs one entry in `PROGRAM_SOURCES` and one tab.

Also: `parsePeople` drops TBC/TBA/TBD. Four Board Summit rows have "TBC" in the moderator cell while
the booking is open, and the embed drew a circle with a "T" in it and billed TBC as the moderator.

`heading: "August 27th"` on the Board tab is HAND-SET (every row says only "Day 2"). The Policy tab
says August 26th for rows that also say Day 2, so one of the two is wrong — check before the summit.

## Session 2026-08-10 (m) · Team: a hand-picked embed, and department embeds that say so

### Per-department embeds already existed

The copy button on /team always targeted the selected tab. Nothing on the button said so, so it read
as one generic "copy the team" and Auri never noticed it (2026-08-10). The label now names the tab:
`Copy embed (Marketing)`, `Copy embed (Marketing, no emails)`, with the line beside it saying whether
a filter row travels along. No behaviour change, only a discoverable one.

### New: ?ids= on /api/team, plus a picker

Auri wanted one block for six people who sit in Management, Partnerships AND Marketing, so no
`?department=` can express them and naming them is the only honest answer. Commit `d6d84d2`.

- **Record ids, not names.** "Schiott" arrives spelled three ways and a name changes when someone
  marries. A rec id is stable and safe in a URL pasted into WordPress and forgotten.
- Validated to `/^rec[A-Za-z0-9]{14}$/`, capped at 60. An id list is the one part of this feed a
  stranger can make arbitrarily long.
- Unknown ids are DROPPED, not 404'd: a block on techbbq.dk must not go blank because one person
  left the team. The response echoes `requested`, so "asked 6, got 5" is readable from the JSON.
- Filters the WHOLE cached team in memory. Keying the cache per id combination would mint an
  Airtable read for every distinct selection anyone ever pastes.
- Returned IN THE ORDER ASKED FOR, and the picker records CLICK order. Choosing six people is
  choosing a layout, so the first name is the first card and shuffle is off for a custom list.

The picker groups all 27 by department, numbers each picked chip with its position so the order is
visible while it is built, and reuses `.bp-tags__chip` rather than inventing a toggle style. Both
email variants, because `?email=0` (do not send) and the snippet flag (do not draw) are different
promises.

Verified by rendering the copied snippet as a widget would: exactly the six, in click order, photos
and titles, no addresses, no filter row. Junk ids rejected; a well-formed unknown id counts toward
`requested` and draws nothing.

## Session 2026-08-10 (l) · Embed tabs are the masthead headings, not small pills

The dashboard had moved its kind switcher to `.bp-sections` (the oversized Onest headings Program
2026 uses) and the embed kept the small dark pill row. That was the last thing making the two read as
different products: Auri's "missing the top word" (2026-08-10). Commit `48425f6`.

Ported one-for-one from app/globals.css: `clamp(26px,4.2vw,40px)`, weight 600, `-.02em`, muted until
selected, transparent, wrapping and centred, each kind's colour as an em-sized dot on the OUTER edge
of the pair (red left of Side Events, blue right of Event Rooms) at .45 opacity while muted. Still
buttons, not styled text, so the control stays tabbable and announced.

The bracketed counts moved into `title=`, which is what the dashboard does, because Program 2026
prints no numbers on these words. It also retired a bad comparison: 17 Side Event cards against 79
Brella sessions are not the same unit, and printing both invited reading one tab as 4x the other.
To bring numbers back, it is `COUNTS` in lib/eventEmbedSnippet.ts.

Two headings WRAP on a phone rather than becoming a swipeable strip: at 40px a horizontal scroller
puts half the control off-screen with nothing to say it moves.

## Session 2026-08-10 (k) · Event Rooms in the pasted embed is the programme board

The embed's two tabs now match the dashboard. Side Events is the Airtable card grid; Event Rooms is
the Brella timeline, with room columns, topic filters, search, all-day bands, faces and the session
dialog. Auri's call when shown the three options (2026-08-10). Commit `c819c66`.

### Composed, not reimplemented

`buildBrellaEmbedSnippet({section:"rooms"})` already builds that board, so `eventEmbedSnippet`
mounts it in a second panel behind the Event Rooms pill and toggles which panel is shown. One
timeline exists, in one file. The board's own section pill row is empty in single-section mode, so
nothing duplicates the host's pills.

### Three things it needed

1. `[hidden]` is the lowest-specificity UA rule there is, and both panels declare `display` with
   `!important`, so the attribute alone did NOTHING: the timeline rendered below the cards with both
   visible. Two explicit `!important` rules are what make the tabs work.
2. The board now hands a host `relayout()` and its session total through `window.__tbbqBp[id]`.
   Card geometry is arithmetic from minutes, so it lays out correctly while hidden, but
   `applyFloor()` measures children and a `display:none` panel measures zero, so the scroll floor is
   retaken when the panel is revealed.
3. The total listener is attached AT PARSE TIME, not inside the event snippet's fetch. Both
   snippets fetch; the board's request is fired first (its script is above), so its loaded event
   beat a listener registered in our own `.then` every single time and the pill stayed blank.

### The pill counts sessions

Event Rooms shows the Brella SESSION count (79), not the Airtable row count (10), because sessions
are what that tab holds and what can be clicked. No number at all until the board answers. If Auri
wants the 10 back, it is `COUNTS["event-room"]` in lib/eventEmbedSnippet.ts.

### How it was verified

By rendering the COPIED snippet the way a widget does, not by reading the source: a throwaway page
under `public/` re-created each `<script>` (innerHTML does not execute them) and rewrote the deployed
origin to the dev server, since the API echoes an Origin only on an exact allow-list match. Fresh
load opens Side Events with 17 cards and 17 posters and the board hidden; the pill switches both
ways; the board draws 7 columns, 30 sessions on day 1 and 68 on day 2; a session dialog opens with
its room, host and four speaker photos. Harness deleted after.

Gotcha for the next test: many `.tbbq-bp__ev` cards are plain `div`s with no `data-id` and open
nothing, by design. Clicking the first one and concluding the dialog is broken wasted a pass here.
Click `button.tbbq-bp__ev[data-id]`.

### Left as cards on purpose

The single-kind `?kind=event-room` copy (`kindTabs={false}`) is still a card grid: there is no tab to
hang a second layout off, and a page that wants only the schedule has the dedicated Brella rooms
embed on /brella-program. Pass `roomsBoard={false}` to force cards on the combined one.

## Session 2026-08-10 (j) · Two regexes eaten by the snippet template literals

The snippet builders return one big template literal. `\s` is not a valid escape there, so JS drops
the backslash and the browser receives a bare `s`. Two regexes shipped that way:

- `lib/eventEmbedSnippet.ts` `venue()` - `fold()` collapsed the letter "s" instead of whitespace,
  so "Sankt Petri Passage" folded to "ankt petri pa age". Both sides of a comparison were mangled
  identically so the same-as-host suppression usually still agreed, which is why it went unnoticed.
- `lib/brellaEmbedSnippet.ts` `toTerms()`: the pasted program embed split search queries on "s"
  rather than on whitespace, so its search tokenised differently from the dashboard's. Line 670 of
  the same file already had the doubled form, and that inconsistency is what exposed it.

Both doubled and verified against the GENERATED snippet, not the source. The source reads correctly
either way, which is the whole trap: `\s` and `\\s` look equally plausible in the editor.
Commit `a848dec`.

### Rule for this repo

Inside a snippet template literal, DOUBLE every regex backslash. Same family as the backtick trap
already documented at the top of those files. Verify by reading the copied snippet, never the source.
Suspect any line matching `\[sdwbSDW]` that has no `\\` in it.

### Still to do

Paste the re-copied snippets into the techbbq.dk widgets. `/side-events/` still runs the OLD widget
(`tbbq-ev-2qxnhu`, three pills, no posters). The code is deployed; the widget is a frozen copy and
changes nothing until it is replaced by hand.

## Session 2026-08-10 (i) · Embed origins audited, event embed brought up to date

### Every embed on techbbq.dk, audited
Fetched all 56 pages in page-sitemap.xml and grepped the SOURCE for pasted snippets, which is
enough to spot a bad origin without rendering anything. 15 pages carry an embed.

**0 pages point at a local machine.** Partners is fixed. The other 14 were always correct — the
localhost bug only ever affected the one snippet that happened to be copied from a dev server.
All 15 predate the self-repair guard, which is harmless: their origins are right, and the guard
only matters if one is hand-edited or re-pasted from an old copy.

CORRECTION to session (e): `/side-events/` is NOT an empty page any more. It carries
`tbbq-ev-2qxnhu` against /api/partner-events and renders 27 cards with the three-pill row. Auri
added the widget after that entry was written.

### The event embed was still the old card wall
Auri: "/partner-events copy embed has old code." The deploy had landed (the live embed carries the
guard), so this was the DESIGN, not the origin. Brought in line with the dashboard:

- **Poster first, logo second, initial last**, the same order the dashboard uses. A poster gets
  `.tbbq-ev-card__media--art`: full-bleed on a dark ground with no padding, because artwork is not
  a mark to be letterboxed. The logo keeps the light panel, since partner logos are mostly
  dark-on-transparent PNGs that vanish on a dark ground.
- **"Hosted by X"** on the company line and a **venue line** under it, with the same rule as
  lib/venueLabel.ts reimplemented in the snippet's own vanilla JS (the builders emit standalone
  strings and cannot import).
- **Two pills, no "All events"**, each carrying its kind's colour as a dot on the outer edge, and
  the board opens on the first pill's kind so pills and content agree on load.

Verified against the generated snippet: 2 pills with 2 dots, 17 cards on load, **17 posters and 0
logo fallbacks**, "Hosted by Rockstart", venue "København" (host correctly suppressed), and
switching to Event Rooms gives 10.

NOT done: the embed's Event Rooms is still CARDS, not the room timeline the dashboard now shows.
A vanilla-JS timeline already exists in lib/brellaEmbedSnippet.ts, so the website route to a room
schedule is that embed's Event Rooms section rather than rebuilding one inside this snippet.

### Gotcha worth keeping
lib/eventEmbedSnippet.ts is ONE BIG TEMPLATE LITERAL. A backtick in a comment inside it
terminates the literal and produces a syntax error hundreds of lines away. The partners snippet
already carried a warning about this; now this one does too.

The self-repair guard also makes the old local test impossible on purpose: injecting
localhost into a copied snippet is now overridden by the guard, so a local render test has to
rewrite the guard's fallback as well.

## Session 2026-08-10 (h) · /partner-events brought up to the Program 2026 design

The page was already sharing `.bp-*` cards and the modal since 2026-08-08, but three things still
made it read as a different product:

1. **Kind tabs were small `.seg` pills.** Now the same `.bp-sections` big headings Program 2026
   uses for Stages / Event Rooms / Grill Sessions / Side Events, with the count carried as a
   small superscript (`.bp-sections__n`, new) so the restyle loses no information. A kind with
   zero events is disabled rather than hidden, matching that page.
2. **No search.** Added `EventSearch`, the same `.bp-search` box, magnifier and clear button.
   It searches host, title, description and kind label, accent-folded so "Erhvervshus" is found
   by typing without the Danish spelling. It FILTERS rather than dims, unlike Program 2026:
   there is no clock to keep aligned in a card grid, so removing non-matches is the honest
   answer. The hint line is empty at rest and hidden by the same `:empty` rule.
3. **Day headings read "TUESDAY 25 AUGUST".** Now "25 AUG", and the undated bucket is "DATE TBC"
   rather than a sentence, so the headings read as one set.

The search is applied after the kind filter and before the day split, so a search that empties a
day removes that day's heading with it instead of leaving a bare date above nothing. Verified:
mesh, euvc, erhvervshus and board each return their one event; a miss says "No event matches
that search." rather than "Nothing scheduled here yet."

### Then the thumbnails, which was the real difference
Program 2026 shows the POSTER a partner made for their event; this page only ever had the Airtable
company logo. That one thing is what still made them look unrelated (Auri, 2026-08-10).

The artwork already existed in `lib/eventPages.ts`, scraped from `og:image` on each registration
page — `/api/program` used it, `/api/partner-events` did not. Now the route attaches `image`,
`venue` and `city` on its OWN six-hour cache (`luma:side-events`, the same key and TTL the program
route uses, so the two share one warm entry) rather than this feed's one-minute cadence: a poster
does not change, and a near-live feed hammering third-party sites every minute is rude.

The whole lookup is wrapped in try/catch. Artwork is a nice-to-have and must never take the feed
down; on failure the cards fall back to logos, which is what they showed before.

`PartnerLogo` now picks: artwork full-bleed on the dark `.bp-card__thumb`, logo contained on the
LIGHT panel. The two need opposite grounds, which is why it is one component — partner logos are
dark-on-transparent PNGs that vanish on a dark wash. Event Rooms carry no register link, so
nothing to scrape, so they look exactly as before. Result: 14 of 27 events show their own poster,
13 fall back to a logo, 0 show nothing. All 14 URLs verified 200 + image/*.

Venue came free with the same lookup, so the card now has Program 2026's second line: host with a
building icon, venue with a pin. `venueLine()` drops the city when the venue already contains it —
one Luma page gives "København, Denmark" and joining printed "København, Denmark · København".

### Making it EXACTLY the same, which took two more fixes
Auri compared the two side by side. The posters were right; two smaller things were not.

**1. The venue line printed the host twice.** Program 2026 read "Hosted by Rockstart" then
"København"; this page read "Rockstart · København". Program 2026 had a `venueLabel()` inside
lib/sideEvents.ts that suppresses the venue when it only repeats the host — a host running the
event at their own office puts their own name in Luma's location field. This page had grown a
near-copy of that helper without the rule.

Fixed by EXTRACTING it: new `lib/venueLabel.ts`, pure and dependency-free so a client component
can import it, now used by both lib/sideEvents.ts and the page. One function, so the rule cannot
change on one page and not the other — the near-copy is exactly how they diverged.

**2. The "Side Event" / "Event Room" badge does not exist on Program 2026's cards.** Now shown
only on the mixed "All events" tab, where it is the only thing naming the kind in words. Filtered
to one kind it repeated the heading above it, so the card matches Program 2026 exactly there.

Verified by reading the first card's lines off both pages: "09:00-11:00" / "Amplify Europe Jam
Session" / "Hosted by Rockstart" / "København" — identical. Badges: 0 on the Side Events tab,
27 on All events.

### The three hand-drawn banners, and a THIRD near-copy avoided
Three side events publish no artwork of their own: CTO Connect, TechBBQ BioTech University
Spinouts Discussion 2026, The Nordic Paradox. Auri pointed at the progress.md in
`Desktop\Side Events\` to have banners made — but they were already built (2026-08-08,
`make_banner.py`), already converted to webp in `public/side-events/`, and already wired into
Program 2026 by an `ARTWORK_OVERRIDES` table inside lib/sideEvents.ts.

They were invisible on /partner-events only because that override was not reachable from there.
So, third extraction of the day: new `lib/eventArtwork.ts` holds `titleKey()` and the override
table, imported by lib/sideEvents.ts and the /api/partner-events route. All 17 side events now
carry artwork, 0 logo fallbacks.

Precedence preserved at both call sites: `d?.image ?? artworkOverride(...)`. The partner's own
og:image always wins, because a hand-drawn banner is a stand-in carrying whatever date and venue
were true the day it was drawn. If the scrape fails entirely the route still resolves the local
banners rather than dropping all the way to logos.

BSR Go-abroad stays deliberately absent from that table even though a banner for it exists on the
Desktop: its date and venue were guesses, and Eventbrite's real artwork works now that
lib/eventPages.ts decodes `&amp;`.

### Event Rooms as a schedule: BLOCKED on the source data
Auri asked for the Event Rooms tab to look like Program 2026's, which is a TIMELINE with a column
per room. That cannot be built from this table: of 16 event-room rows, **2 carry a Location** and
those two disagree in format ("Event Room 1" vs "Event Room 6, Bella Center, Copenhagen"). Room
columns need a room on every row.

Program 2026 can draw it because it reads BRELLA, where every one of these sits on a proper
`Event Room N` track. Auri chose the honest option over mirroring Brella: a time-ordered
single-column schedule built from what Airtable actually knows.

Built as `ScheduleRow` + the `.bp-sched` block in globals.css. Fixed 104px time column so every
title starts on the same line — a ragged left edge is a list, not a schedule — tabular-nums so
09:30 and 13:00 do not drift, the same `--track` spine and tokens as `.bp-card` so the two views
read as one design, and the clock stacks above the title under 560px.

No poster column on purpose: these rooms publish no artwork at all, so it would be a column of
company logos, and a logo repeats the host line directly beside it.

### Then the tabs were cut to two (Auri, 2026-08-10)
"All events" is gone. Two headings only, `● Side Events` and `Event Rooms ●`, the kind's colour as
a dot on the OUTER edge of each so the markers do not point at each other. Default is Side Events.
Counts moved off the heading into the button's `title`, because Program 2026 prints none there.

Killing the mixed tab removed two pieces of scaffolding it had needed: the "Side Event" /
"Event Room" badge is off the cards entirely (with one kind per tab it repeated the heading), and
a day block can no longer hold two layouts at once. The badge survives in the DIALOG, which is a
standalone context — once open, nothing else on screen says which kind you are looking at.

WHICH VIEW WHERE, matching how Program 2026 splits them:
  Event Rooms tab   schedule
  Side Events tab   poster cards
Verified: 10 schedule rows and 0 cards on Event Rooms, 17 cards and 0 rows on Side Events.
Sorting restarts per day and "Time TBC" sorts last within its day.

### Then the Event Rooms tab became Program 2026's ACTUAL board
Auri chose the Brella route. So the timeline is no longer approximated — it is the same component.

**`components/ProgramTimeline.tsx` is new and holds ~1100 lines lifted out of
app/brella-program/page.tsx**: the `Session`/`Speaker` types, the card/timeline vocabulary
(sessionVars, trackVars, withLanes, layOutColumn, Avatars, hhmm, matchesSpeaker, matchesTags,
peopleSummary, the icons, the badges), `StageTimeline` itself, `PersonRow` and `SessionDialog`.
Both pages import from it. Nothing in it fetches — it renders whatever `Session[]` it is handed,
so the caller decides where that came from.

/partner-events now reads TWO sources on purpose, and the file says so at the call site:
  Side Events tab   Airtable — the only source that knows all of them and carries the sign-up links
  Event Rooms tab   Brella  — the only source that knows which ROOM each one is in
Its own day pills for the board (DAY 1 / DAY 2, since a timeline draws one day), the existing
search box feeds `terms`, and clicking a session opens the same `SessionDialog`.

Verified after the move: Program 2026 unchanged on all four tabs (7 room columns, 30 timeline
cards, the NISS all-day band, tag box, popular row, dialog opens with its tags) and zero console
errors on either page. The new board draws 7 room columns, 30 cards on day 1 and 68 on day 2, with
the Nordic India band on day 1 and Board Summit / Nordic Africa / Roundtables on day 2.

`ScheduleRow` and the `.bp-sched` CSS block are deleted — that single-column schedule was the
stopgap this replaced.

REFACTOR HAZARD, recorded because it cost real time: extracting by brace-matching a
`function Foo({ size = 12 }: {...})` signature matches the DESTRUCTURED PARAMETER's brace, not the
body, and a `/**...*/` doc-comment regex with `(?:.|\n)*?` will happily start at a comment hundreds
of lines earlier. Both fired, which scattered TagSearch, SpeakerSearch and the page header into the
new module. Recovered by reassembling both files from explicit line ranges. Cut by DECLARATION
BOUNDARIES (the line of the next top-level decl), never by brace counting.

NOT changed, still true from the earlier entry: the WordPress embed (`lib/eventEmbedSnippet.ts`)
draws the OLD card wall. The dashboard and the embed are two different designs by decision.

## Session 2026-08-10 (g) · NISS schedule reconciled, whole-day band restored

Auri pasted the Nordic India Startup Summit schedule and asked whether it matched. It did not:
the NISS Airtable feed had all 13 rows, Brella had 11, and the two disagreed on a time.

| | before | after |
| --- | --- | --- |
| Opening title | Brella: "The Nordic–India Startup Bridge" | "Opening: Why the Nordic–India Startup Bridge" |
| Lunch & Networking 12:20-13:20 | missing from Brella | created, `#984583`, Hall C, Event Room 2 |
| From Research to Market | Brella 16:00-16:25 vs Airtable 15:40-16:00 | Brella wins; Airtable corrected to match |

Auri's call was that Brella is authoritative for that session, so the NISS Airtable row was
corrected rather than Brella. That also removed a real clash: at 15:40 it overlapped the Nordic
Founder Pitch (14:55-15:55) in the same room.

Still missing from Brella by choice: the 09:00-09:30 Arrival, Registration & Networking Breakfast.

### `tags` on a timeslot takes NAMES, not ids
Setting the tag by id created a NEW tag literally named "345379" and attached it. `tag_ids` in
any form is accepted with a 200 and silently ignored. The working call is:

    PATCH /timeslots/<id>   {"timeslot": {"tags": ["Nordic-India"]}}

Anything not already a tag on the event is CREATED by that call, so a typo here invents a tag.
The junk one was detached (it now belongs to nothing and has left the API's tag list); there is
no DELETE route for tags, both candidates 404, so an orphan row may still sit in the Brella UI.

### The whole-day band was not broken, its input was
`.bp-tl__allDayCard--prog` derives an all-day band for a room whose sessions span morning to
evening, and the comment in the page says it was built for NISS specifically. It had stopped
appearing because `programme` was null: NISS lost its own Brella track and its sessions now sit
on the plain "Event Room 2" track, which `programmeOf()` cannot match. Nordic Africa already had
this exact problem and was solved with `ROOM_DAY_PROGRAMMES`, keyed on room + date. Added NISS
to the same table:

    { room: "Event Room 2", date: "26 August", programme: "Nordic India Startup Summit" }

Event Room 2 on the 26th now shows "All day · Nordic India Startup Summit" with its twelve
sessions drawn inside the band. Day 2's Nordic Africa band still renders, unchanged.

## Session 2026-08-10 (f) · Duplicate speakers across ALL of Brella

`brella-duplicate-speakers.mjs` (read-only) checks all 403 speakers five ways: EXACT name,
SAME-FILE (Brella stores photos as `/uploads/speaker/photo/<id>/<hash>.jpg` and the hash is
per-FILE, so a shared hash is the same image uploaded twice — the strongest signal, no downloads
needed), SUBSET, TYPO (whole-name edit distance, company ignored) and INITIAL (Nick/Nicholas).

**5 duplicate people** once photos were compared pixel-wise (see the re-run below). Both uncertain pairs were confirmed by looking at the
photographs, not by name alone.

| people | records | verdict |
| --- | --- | --- |
| Stina Lantz | `#418781` 1 session · `#418637` 0 | delete `#418637`, identical photo hash |
| Nick / Nicholas Sando | `#417792` 1 session · `#420553` 0 | delete `#420553`, same man, Molten |
| Ulla Sommerfeldt / Sommerfelt | `#421568` 1 · `#418069` 1 | MERGE, both on sessions |
| Sander Janca-Jensen | `#418009` 1 · `#422264` 1 | MERGE, both on sessions |
| Lars Jensen vs Lars Horsholt Jensen | `#417765` Scale Capital · `#417007` EIFO | NOT duplicates, leave |

### One of them is mine, and it shows the limit of the guard
`#421568` Ulla Sommerfeldt was created by this session's grill push. Brella already held her as
"Ulla Sommerfel**t**" (`#418069`, Femtech Studios, with a real bio). The `sameHuman` guard needs
every word of the Airtable name to appear in the Brella name, and `sommerfeldt` != `sommerfelt`,
so it read as a different person. Word matching cannot survive a one-letter surname difference —
the SAME-FILE and TYPO passes above are what catch that class, and they belong in the push script
as a pre-flight, not only in an audit run afterwards.


### Re-run with photo pixels + company/title (Auri asked for a wider net)
Comparing photo FILE hashes only catches the same upload twice. Downloading all 403 and reducing
each to a 16x16 greyscale signature catches the same person uploaded from two different files,
which is what found the fifth:

**Safa Sharif** `#419004` (2 sessions) vs **"Sara Serif"** `#417512` (0 sessions) — photo diff 5.5,
same company (WSI Consulting), same role. The name is simply mistyped on the spare. Neither name
matching nor file hashing would ever have paired those two strings.

The company+title pass mostly produces false positives and is tiered REVIEW for that reason: two
Policy Officers at DG GROW, two MEPs at EPP and two Founding Partners at Navisalma are all real
distinct people. Same-surname-only is tiered WEAK, 32 pairs, all coincidence.

CONFIRMED NOT duplicates, do not re-flag: George Storm / Sara Storm (N.Rich, both on the GTM
panel), Robert Falck / Linnéa Kornehed Falck / Robert Westerdahl (Navisalma), Anders Thorup-Jensen
/ Lars Horsholt Jensen (EIFO), Lars Jensen (Scale Capital) / Lars Horsholt Jensen (EIFO),
Marie Adam / Ramona Ocak, Henrik Dahl / Arba Kokalari.

Merging needs the Brella UI: assignments have no API endpoint, so the sessions have to be moved
by hand before the spare record can be deleted.

## Session 2026-08-10 (e) · Side events, tag search, dashboard polish

### Side events: how often they refresh
Three sources, three cadences, which is the thing to know before anyone asks "why has my edit
not appeared":
  Airtable spine (`partnerevents`)  ~1 min   near-live override, 60s memory + 60s CDN
  Brella times   (`program:brella`) 30 min   fast window until 27 Aug, hourly after
  Luma venue/artwork lookups        6 hours  fixed, third-party politeness
A GitHub Action warms every feed every 30 min so nobody lands on a cold copy.

### The duplicate BSR side event, and what actually caused it
The programme showed "BSR Go-abroad Co-**ce**ation Seminar" (no link) next to the real one.
The linkless copy was BRELLA's, not an Airtable row, so DELETING it would have pulled the
session out of the attendee app. `lib/sideEvents.ts` pairs the two systems by title
containment and a missing letter defeats that. Fixed the typo in Brella instead: the two merged
into one entry carrying Brella's time AND Airtable's link. 16 side events -> 15.

### Side events audit
- All 15 Airtable side events are published. Nothing missing, N.Rich's GTM Secret Dinner included.
- **`techbbq.dk/side-events/` is an EMPTY PAGE.** No embed root, no connector reference, no
  endpoint — the widget was never put on it. The data is fine and renders on /program2026.
- Airtable duplicates, all Event Rooms so they do not reach the programme: Nordic IPO
  (`recROMbxfKGI1OMNi` / `recQCNnYwH3jz1Z09`), Beyond Unicorns (`recJAbHydrQRAGFll` /
  `recBCZc0pJNZL37HF`), plus 4 empty rows (`recTF4eqJAOiV8Kbe`, `recQN1NRvJAgMhUfS`,
  `recx6Rm1yKr8Th3xd`, `recIWYxWn89otvbsr`). Untouched, awaiting Auri.

### Side-event card artwork comes from the PARTNER, not from us
`lib/eventPages.ts` scrapes `og:image` off each registration page. N.Rich's card shows their own
HubSpot thumbnail and we cannot change it without an override. Auri chose to leave it. The panel
graphic he supplied went on the Brella session cover instead (`#977272`), only the 2nd of 280
sessions to have one. Route used: park the file on an Airtable attachment for a moment, hand the
URL to Brella, which re-hosts it, then remove the parked copy. Write key is `cover_image`.

### Grill descriptions
Auri stripped the presenter blurbs. Verified across all 21: zero descriptions still name their
own speakers. Found and fixed a gap of my own making — the two sessions created earlier had
EMPTY descriptions, because they were built from title/time/track only. Backfilled both from
Partnership Success (`recYHWaiGLLyYtRTR`, `recTJv4z1EQItWHqd`).

### Tags
The feed already caps at 3 and strips room/hall labels, so 54 Brella tags become 45 real topics
and no published session exceeds three. **Brella itself has one session with 4**: `#973349`
InvestEU. The website drops the fourth silently, so app and web disagree. Left alone: which of
the four InvestEU policy windows to drop is an editorial call.

### Dashboard changes (localhost only — techbbq.dk needs the embed re-pasted)
- **"All grills" -> "All Grill Sessions"** in `lib/brellaEmbedSnippet.ts` (x2, tab row and phone
  picker) and the dashboard page. Siblings are still "All rooms"/"All stages".
- **Topic type-ahead** replaces the row-of-45-chips: type, arrow, Enter or Add. Chosen tags are
  removable chips, hard cap of 3 (input disables at three), live match count, suggestions scoped
  to the board on screen. Now on ALL boards, not just Event Rooms. Multi-select is ANY not ALL,
  as before — three disjoint tags ANDed returns nothing.
- **Popular row** under the box: the six busiest topics on that board, one click to add.
- **The board is remembered across a refresh** (`bp-section-v1` in localStorage, validated with
  `isBrellaSection`). Ctrl+R on Grill Sessions used to dump you back on Stages.
Note: Side Events carries no tags, so the tag box correctly does not render there. Auri's call:
leave it, nothing to sync from, revisit another way later.

### Dashboard, second pass (same day)
- **Popular row** under the topic box: the six busiest topics on that board, one click to add.
- **One hint block, not two.** The speaker box's line ("Type a name to spotlight…") moved down to
  sit with the topic hint; `speakerHintText()` is now a module-level function so both renderers
  print identical wording, and `SpeakerSearch` takes `showHint` (still true in the list view and
  on Side Events, where there is no topic block to move it into).
- **The modal lists every tag**, up to three, in `.bp-modal__tags`. The meta line used to print
  `s.type`, which IS the first tag, so a session tagged Panel / Business Building / Founder
  Stories showed one third of itself. The single meta chip now renders only when there is no tag
  list, so the first tag is never printed twice.

## Session 2026-08-10 (d) · Grill work finished end to end

Auri did the linking in the Brella UI. Final state, verified on the live site:

- **All 60 grill presenters are in Brella**, 0 missing, 0 duplicates, 58 with a photo.
  The last two, held back over bad Airtable data, went in once he fixed the rows:
  Gertrude Chilufya `#422259`, Fabio Cavaliere `#422260`. `HOLD` in `brella-push.mjs` is now empty.
- **19 of 19 grill sessions have their speakers attached.** The only two grill timeslots still empty
  are `From Research to Reality` and `The "Third Way" of Digital Sovereignty`, which have no
  Airtable submission at all, so nobody knows who speaks at them.
- **techbbq.dk/program2026 renders it**, Grill Sessions tab: three colour columns, sessions with
  speaker avatars, including the two timeslots created today. Chain confirmed end to end:
  Brella -> `/api/program?event=brella` -> the Elementor embed.

### Name typo that nearly created a duplicate
Airtable says **"Jennifer Monatgue"**; Brella has her correctly as "Jennifer Montague" `#421576`.
Word matching cannot bridge a transposition, so the script wanted to create her a second time.
There is now an `ALIAS` map at the top of `brella-push.mjs` holding exactly that one mapping.
**Fix the Airtable cell** and the alias becomes dead weight. Also `Gertrude Chilufya`'s Company has
a leading space; the script trims, Airtable is still untidy.

### The real remaining gap: moderators
Airtable records **59 Speaker and 1 Moderator** across all 60, and the one is Gertrude on The Bridge
Effect. Ten of the nineteen sessions are panels of 3+ with nobody marked as moderating, which is
the submission form defaulting rather than the truth. For contrast the rest of TechBBQ 2026 has 88
Moderator assignments. Brella also offers `Panelist` (44 in use), which fits a grill panel better
than `Speaker`. Nothing here can be derived — it needs asking the partners.

### Speaker Hub cross-check (asked for mid-session)
The Hub (`speaker_public_profiles`, Supabase) holds 195 public speakers, all with photos, and
**overlaps the grill presenters by zero** — grill people come in through partner forms, Hub people
onboard themselves. `grill-hub-photos.mjs` fills Airtable from the Hub and is dry-run by default;
today it had nothing to do.

Separately, of the **205** rows in this view that DO exist in the Hub, 194 are byte-identical and
**11 differ**. Seven are genuinely new photographs the speaker uploaded; the rest are re-crops.
Every Hub photo is normalised to 800x800, so it never wins on resolution, only on being current.
Not acted on — see the table in the chat log. Notable: Tina Tarighian's "new" Hub photo is the same
polaroid Airtable already holds at 1960x2412, so Airtable's copy is the better one.

## Session 2026-08-10 (c) · Grill presenters pushed into BRELLA

Auri filled the remaining photos in Airtable (57/60), then asked to get the grill presenters into
Brella. **This is the first code in this repo that WRITES to Brella.** Everything before it was
GET-only. `brella-push.mjs` is the script; it is idempotent, dry-run by default.

### Done, verified live
- **2 timeslots created**: `#984464` Scaling Deep Tech in Europe (EIC), Green, 26 Aug 10:40Z ·
  `#984465` From AI Hype to Real Deal Execution (GetAccept), Green, 27 Aug 10:40Z.
  All 19 grill sessions now exist in Brella.
- **54 speaker records created**, on top of 4 already there. 56 of the 60 presenters now carry a
  photo that Brella has re-hosted onto `brella-assets.brella.io`.

### THE THING TO KNOW: Brella reads JSON:API and writes Rails
Every write is `Content-Type: application/json` with a snake_case wrapper. A JSON:API body is
rejected with an **empty 400** (speakers) or an **empty 500** (timeslots), which tells you nothing.
This cost most of the session to find.

    POST /speakers    {"speaker":  {"first_name","job_title","company_name","photo"}}
    POST /timeslots   {"timeslot": {"title","start_time","duration","location","track_id"}}

- The photo key is **`photo`**, and it takes a URL. `photo_url` and `remote_photo_url` both 400.
  Brella downloads the image and re-hosts it, so the source URL only has to be alive at that moment.
- Photos are passed as `/api/photo/marketing/<recordId>` on the deployed connector, never as raw
  Airtable attachment URLs — those are signed and dead within ~2 hours.
- Grill track ids: Green `43273`, Orange `43274`, Blue `43275`. Airtable's `Project Name` colour
  and the Brella track agree on all 19 sessions, checked.

### NOT done, and why: speaker → session links
The integration API has **no speaker-assignment route**. Not `/speaker-assignments`, not nested
under a speaker, not nested under a timeslot; all 404. The only remaining candidate is a PATCH on
the live timeslot embedding the assignment, and whether that merges or REPLACES the row is unknown.
Not worth risking a live session's title and description 16 days out.

So the 60 links are done by hand in the Brella UI. `BRELLA-LINKING-CHECKLIST.txt` (regenerate with
`node brella-push.mjs --plan`) lists every session with its Brella timeslot id and the people to
add, moderator first.

### Two bugs caught mid-run, both worth remembering
1. **Duplicate speaker.** Existing-speaker detection first read the `included` of `/timeslots`,
   which only contains speakers ALREADY ATTACHED to a session. A speaker created but not yet
   linked is invisible there, so the script created a second Andreas Schwarz. Deleted `#421560`,
   kept `#421562`. Detection now pages the full `/speakers` collection. Do not change that back.
2. **Middle names.** Airtable's "Jussi Pyysalo" is "Jussi Petteri Pyysalo" in Brella. Exact-name
   matching would have duplicated a real person. Matching now requires every word of the Airtable
   name to appear in the Brella name.

`DELETE /speakers/{id}` works and returns the deleted record, which is how the duplicate was undone.

### Held back on purpose · 2 people
In the `HOLD` map in `brella-push.mjs`. Fix the Airtable cell and re-run; the script picks them up.
- **Fabio Cavaliere** · Company is `Ideon Science Park - fabio.cavaliere@ideonsciencepark.se`.
  Creating that publishes his email address to every attendee. Should be `Ideon Science Park`.
- **Gertrude Chilufya** · Job Title is `Moderator`, Company is `Founder | Reframe Tech`. The fields
  are swapped. Moderator is her ROLE and is already carried separately.

### PICK UP HERE
1. Link the 60 speakers to their sessions in Brella, from `BRELLA-LINKING-CHECKLIST.txt`.
2. Fix the two Airtable rows above, then `node brella-push.mjs --commit --only-speakers`.
3. Confirm with the programme team: the planning sheet puts **GetAccept in two consecutive Green
   slots on day 2** (12:40-13:20 and 13:30-14:10). One 40-minute slot was created. If it is really
   an 80-minute booking, widen it in Brella.
4. Fix the mangled Brella title `The Bridge Effect: Why Top Talent is Choosing the Øresund Region
   Discover Dutch Tech at the Orange Stage` — two session names run together.
5. Three grill timeslots exist in Brella with NO Airtable form submitted, so nobody knows who
   speaks: `From Research to Reality` (Blue, 27th 09:00), `The "Third Way" of Digital Sovereignty`
   (Orange, 27th 10:40), and the Bridge Effect row. Chase those partners.
6. Still no photo anywhere: Maarten Kas, Yuval Temam. Created in Brella without one.

### Pre-existing, not ours
`Stina Lantz` has two speaker records in Brella (`#418781`, `#418637`). Predates this session.

## Session 2026-08-10 (b) · Grill Session photos: 15 → 27 of 60

Twelve portraits written to `Profile Picture` on the Grill Session rows. `grill-photos.mjs`
carries all twelve with a per-person source note; the reject list at the top of that file now
also records what was looked at and thrown away, so nobody re-finds the same dead ends.

Written: Kasper Hulthin, Andreas Schwarz, Mårten Skogh, Martin Keller, Rogier Brakshoofden,
Juuso Juhila, Thomas Eaton, Olli Huhtinen, Maarten Everts, Pia Hardy, Richard Holborow,
Frank Kjerstein.

### What actually moved the needle
1. **Check this base first.** New `grill-crossref.mjs` walks every table in the base and asks
   whether a photo-less person already has an attachment somewhere else. It found Kasper
   Hulthin's headshot sitting in the `Speakers` table. Own asset, best possible source. Run this
   before any web hunting.
2. **A real browser, not `fetch`.** Most of these team pages are Webflow/Next/HubSpot and render
   portraits in JS, so a server-side fetch sees an empty page. Driving Playwright and reading
   `img.currentSrc` after paint is what surfaced Acodis, Limula, evogencebio and NextNextYear.
3. **Match on the caption when the filename is useless.** Limula files their CFO's portrait as
   `Tom_LIM4471.jpg`; the only thing tying it to Thomas Eaton is the heading directly above it.
   Same for Pia Hardy (`pia_.jpg`), corroborated instead by the page text repeating her exact
   NVIDIA title.

### Traps hit this round, all avoided
- `businessturku.fi` offers `mari-kivinen-...jpg` for **Anna** Kivinen. Different person.
- `achucarro.org` has a Fabio Cavaliere: a Basque neuroscientist, not the Ideon one.
- Domain guessing by company name lands on impostors: pexelz.com vs pixelz.com, alicetech.com
  vs alice.tech, nrich.com vs n.rich, linksight.com vs linksight.nl. Never trust a guessed
  domain without checking the page identifies the right company.
- DuckDuckGo's HTML endpoint now serves a bot challenge to scripted fetches. Bing still returns
  parseable results in a real browser, but wraps every href in `bing.com/ck/a?...&u=a1<base64>`,
  so the real URL has to be base64-decoded out of `u=a1`.

### Safety check, same ritual as the previous write
Hashed all 11 live feeds before and after: byte-identical. These rows stay out of every public
feed. Verified after the write: grill rows with a photo went 15 → 27, missing 45 → 33.

### PICK UP HERE
The remaining 33 are genuinely not findable from open sources. Per-person reasons are in the
reject block in `grill-photos.mjs`, including several where a photo exists but should not be
used (group shots, candids, a stunt pose, one identity nobody can confirm off LinkedIn). The
only route that closes the rest is the partner chase-list: the submission form already has a
per-presenter upload field, so ask the ~15 partner orgs to fill it in.

## Session 2026-08-10 (a) · Partner wall dead on techbbq.dk/partners · localhost baked into the embed

### What was broken
`https://techbbq.dk/partners/` showed the partner wall stuck on "Loading…", zero logos.
Nothing was wrong with the connector: `/api/partners` returns 200 with 154 partners in 8
tiers both locally and on `airtable-woad.vercel.app`, and a cross-origin fetch to it *from
techbbq.dk* succeeds (CORS fine).

The pasted Elementor snippet itself carried the bug:

    var ORIGIN="http://localhost:3000";
    var ENDPOINT=ORIGIN+"/api/partners";

The wall was copied from the dashboard while it ran on localhost, so every visitor's browser
tried to fetch the feed from their own machine. Swept all 56 pages in `page-sitemap.xml` for
`localhost:` — `/partners/` is the only page affected.

### Fix in this repo
New `lib/embedOrigin.ts`. `embedOrigin()` returns `window.location.origin` normally and the
deployed connector (`NEXT_PUBLIC_EMBED_ORIGIN`, default `https://airtable-woad.vercel.app`)
whenever the dashboard is on localhost/127.0.0.1/::1. Every copy button now calls it instead
of `window.location.origin` — the 9 sites were CopyApiSnippet, CopyBrellaEmbed, CopyEmbed,
CopyEventEmbed, CopyInternsEmbed, CopyLsStartupsEmbed, CopyPartnersEmbed, `app/program/page.tsx`,
`app/speakers/page.tsx`. Copying from a local dashboard can no longer produce a dead embed.

Verified: `npx tsc --noEmit` clean, and clicking Copy embed code on `localhost:3000/partners`
now yields `var ORIGIN="https://airtable-woad.vercel.app"` with no `localhost` anywhere in the
15KB snippet.

### PICK UP HERE · the WordPress side is NOT fixed
This repo change does not touch the live page. In Elementor on `techbbq.dk/partners/`, open the
HTML widget holding `#tbbq-pw-op1o1m` and change the one line to:

    var ORIGIN="https://airtable-woad.vercel.app";

then Update. Re-pasting a fresh snippet from the deployed dashboard works too, but the one-line
edit keeps the existing widget id and styling.

## Session 2026-08-09 · Grill Session presenters: LinkedIn handles + photos

State: **PARTIAL, and honestly so.** LinkedIn 51/60. Photos 15/60. The gaps are documented
below with the reason for each - they are not "not tried yet".

### PICK UP HERE
Two scripts do the writing, both idempotent, both dry-run by default (`--commit` to write):

    sops exec-env secrets.enc.env "node enrich.mjs"        # LinkedIn Handle + Bio
    sops exec-env secrets.enc.env "node grill-photos.mjs"  # Profile Picture

To add people: append to the `FOUND` / `PHOTOS` array. **Match `name` to the Airtable Full Name
BYTE-FOR-BYTE** - it is an exact string compare, and three rows are booby-trapped:
`Dr. Ilya Burkov` (title prefix), `MONIKA KANDA` (all caps), `Manuel\tMejia` (literal TAB).
A mismatch prints "NOT FOUND in grill rows" rather than failing loudly, so read the dry run.

Before any write, repeat the feed check - it is the thing that makes writing to this table safe:

    for f in partners policy-stage event-room-presenters main-speakers investor-speakers \
             life-science all-speakers speakers-2026 program niss-speakers team; do
      printf "%-24s %s\n" "$f" "$(curl -s http://localhost:3001/api/$f | md5 -q)"
    done

Hash before, hash after, diff. All 11 must be byte-identical. Dev server: `npm run dev` (it
takes port 3001 when 3000 is busy).

Remaining work, in the order I would do it:
1. **The photo chase-list** - 45 people, ~15 partner orgs. This is the only route that actually
   closes the gap; the per-presenter upload fields already exist on the submission form.
2. **The row-level data errors below** - several are wrong facts about real people and should be
   fixed before any of this is published.
3. The 9 missing handles, but see the per-person reasons - most genuinely have no public LinkedIn.

### Rule kept from yesterday
Only write a handle when the company or job title is corroborated by a NON-LinkedIn source.
Where only LinkedIn itself corroborated it, the handle was still written but a caveat went into
the Bio field, so the doubt is visible at the row and not just in a chat log.

### Safety check repeated before EVERY batch, 4 batches
Hashed all 11 live feeds before and after each write: byte-identical every time. Also grepped
`all-speakers`, `speakers-2026` and `life-science` for Grill names and for the string "Grill" -
zero hits, which proves those feeds genuinely exclude these rows rather than being cache-stale.

### Two bugs fixed in enrich.mjs (both would have fired on this run)
- `{"Bio": f.bio}` sent `undefined` for anyone with no bio, which **blanks an existing Bio**.
  Now only researched fields are sent.
- Airtable PATCH caps at 10 records; batch 1 was 13. Now chunked. Also added an idempotency
  guard so re-running is safe and prints OVERWRITE + the old value if a handle ever changes.

### PHOTOS - the route that works, and the one that does not
Airtable ingests attachments by **fetching a public URL server-side**. LinkedIn's image CDN is
auth-gated with expiring tokens, so LinkedIn photos cannot be filled in that way even in
principle. Everything here came from org team pages, press releases and conference speaker pages.

Automated matching is genuinely dangerous and this run proved it FOUR times:
- boras-ink.se serves `Mats-Ekman_1.1.jpg` with `alt="Annelie Rådhall"`. **Alt text is scrambled
  on that site.** Trust the filename, never the alt.
- klak.is's only "Magnus" image is `KLAK_VMS_portrett_magnus_ingi_oskarsson` - a different Magnus.
- Dealfront's press-release og:image is a stock 3D cartoon ID card, not Jillian Als.
All three would have put a wrong face on a speaker. Every photo written was eyeballed first or
came from a dedicated single-person page where filename AND alt agree. See grill-photos.mjs,
which carries the rules and a REJECTED list with reasons - do not silently re-add those.

### Row-level data problems found (NOT fixed - they are yours or the submitters' to correct)
- **Maarten Everts is CTO, not CEO.** Linksight's CEO is Martine van de Gaar.
- **Bue Fisker** - every source puts him at KIRKBI as Senior Investment Manager, not LEGO
  Foundation as Director of Investments. Separate legal entities.
- **"Pexelz" is a typo for Pixelz Inc** (Katrine Rasmussen).
- **"Jennifer Monatgue" is a typo for Jennifer Montague.**
- **Nadia Lodroman** is a Dublin-based independent Oracle EPM consultant (lodroman.com), not a
  Skytek Nordics employee. The Company field looks like it inherited the SUBMITTING PARTNER's
  name - worth checking whether other rows have the same artifact.
- **Fabio Cavaliere's row is form noise**: Job Title "POINT OF CONTACT", Company field contains
  his email address. Probably the submitting contact, not someone on stage.
- **`Manuel	Mejia`** has a literal TAB inside Full Name. **Anders Rosenqvist**'s company is in
  Unicode mathematical-bold characters, not letters - breaks matching and screen readers.
- Title mismatches, softer: Mårten Skogh (row says Head of Quantum Technology, sources say
  Development Engineer / WACQT Project Leader), Anna Kivinen (Project Director / Liaison Manager),
  Thomas Eaton (row says CFO, sources say CEO), Gertrude Chilufya (row says Founder of Reframe
  Tech; sources say she runs their AI Fluency Circles), Vahid Sohrabpour (sources tie him to
  Saveggy, not Orchestrable).

### The 9 with no LinkedIn, with the reason
- **Ramona Ocak** - no public LinkedIn exists. Verified as a real EU official via an InvestEU PDF,
  which puts her at DG ECFIN, not DG GROW as the row says.
- **Andreas Schwarz** - title confirmed exactly by the Commission's own CV PDF and ZEW. No LinkedIn.
- **Agnieszka Chlad** - correct spelling is **Agnieszka Chłąd**. Verified at EISMEA/EU Commission
  in Brussels, but her public presence is X (@aga_chlad), not LinkedIn.
- **Marie Adam** - name too common to disambiguate against DG GROW.
- **Catarina Mendonça** - two candidate profiles, neither says New Dawn Bio. Common PT name.
- **Manuel Mejia** - many profiles, none at Hayden Biotech. Their site shows first names only.
- **Lisa Nyman** - role confirmed exactly (si.se, sharingsweden.se) but no handle surfaced.
- **Yuval Temam** - a Netherlands profile exists but its headline reads SES, not Lighthouse Lab.
  Not written; that is a guess, not a match.
- **Ulla Sommerfeldt** - the known unresolvable. No Company on the row, and the search splits
  between Ulla Sommerfelt (one t, Norwegian, Mother Hen Ventures) and a Danish PreSeed investor.

### The Chrome extension pass (what it did and did not fix)
Used it for exactly the class of failure a server-side fetch cannot handle: JS-rendered team
pages and bot-blocked hosts. Results:
- **Isabella Vahdati FOUND** on brighteyevc.com/team, which renders portraits in JS. Matched by
  **DOM adjacency** - the img sitting next to the text "Isabella Vahdati / Principal" - because
  that site files portraits by INITIALS (`IV_blue.avif`), so no filename or alt match was ever
  going to hit it. DOM adjacency is the stronger technique; prefer it.
- **Yohanna Gustafsson: confirmed negative.** Opened cse.cbs.dk/team/yohanna-gustafsson/ in a real
  browser - the page genuinely carries no portrait, only her name. That is an answer, not a failure.
- **Anders Rosenqvist rejected.** seoday.dk now redirects to s360digital.com and its only "Anders"
  image is anders-lynggaard-poulsen.jpeg. A loose first-name match would have written a stranger.
- n.rich/about-us redirects to nrich.io and lists no team at all.
Airtable accepts `.avif` and `.webp` on ingest, so no format conversion is needed.

### Photos: 45 still missing, and why
The org-page route is now exhausted for everyone researched. The remaining people mostly have no
public portrait on any page their org controls - several are EU officials, and several work at
companies whose sites render team photos in JS or publish none at all. **This is where the
partner-chase is the only real answer**, and the per-presenter upload fields already exist on the
Grill Session submission form. The chase-list groups to roughly 15 partner orgs, which is 15
emails rather than 60 lookups.

## Session 2026-08-08 (sixth) · Grill Session presenters written into Airtable

State: **DONE.** 60 speaker rows created, then re-assigned to the right room. Two enriched with a
researched LinkedIn + bio. Every live feed verified unchanged on a forced live read.

### Why the Grill Sessions had no avatars
Not a bug. Brella has **zero speaker-assignments** on all 19 Grill Sessions. Proven with a control:
Brella's stage sessions list 57 assignment refs and this connector resolved 57/57, so nothing is
being dropped by `lib/brellaprogram.ts:245`. The slots are empty at source. 74 of 210 published
sessions have no speaker in Brella; the holes are Event Room 2 (17 of 17) and the 19 Grill Sessions.

### Where the presenters actually live
`Partnership Success` (`tbllvkwLhB4Omdphd`), view `viwmxcuIN0SFe2tkF` — the Grill Session
submission form. 21 submissions, each with `1st..5th Presenter details` as STRUCTURED text:

    Name: Fabrizio Del Maffeo
    Position: CEO and Co-Founder
    Company: Axelera AI

67 slots filled, 64 fully parseable, 2 are `TBC`. This is a far better source than scraping the
`Presenters:` block out of the Brella description prose, which was the first thing tried and is
unreliable (line breaks split surnames, moderators named in sentences).

### What was written
60 rows into `Marketing Project Overview` (`tblTecOBecLQCNIeD`), view `Speakers`
(`viwfIcQFDNQ9ggSqx`): Full Name, Job Title, Company, Session Name, Role, Project Name.
5 people were SKIPPED because they already exist under another project — worth knowing they are
double-booked: Fabrizio Del Maffeo and Sander Janca-Jensen (TechBBQ Summit), Lars Horsholt Jensen
(Event Room 1), Amit Vadi (Event Room 5), Peter Winther-Schmidt (Event Room 2).

Roles: 59 Speaker, 1 Moderator (Gertrude Chilufya, detected from her job title). The source has no
role column, so moderators named only in description prose are not caught — fix by hand.

### THE SAFETY CHECK THAT MADE THIS OK — repeat it before any future write here
`tblTecOBecLQCNIeD` feeds SEVEN live things (eventrooms, hierarchy, investors, mainpage, partners,
photo, policystage). Every one filters by `Project Name` ("TechBBQ Summit", "Event Room N",
"Event Room 5,6,7", investor names) or by `Main Page = YES`, and partners.ts reads its own view.
"Grill Session" matches none, so the rows cannot reach techbbq.dk. Verified by writing ONE record
first, then forcing live reads past both caches: partners 154, policy-stage 28,
event-room-presenters 46, main-speakers 11 — all unchanged before and after.

### Room assignment, after Auri split the select option
Auri renamed "Grill Session" to "Green Grill Session" and added Orange and Blue. **Renaming a
single-select option in Airtable rewrites every row using it**, so all 60 landed on Green. Fixed by
reading the real room from the live Brella schedule (its room field is literally "Blue/Green/Orange
Grill Session") and matching on session title. 40 rows moved:

    Green 20 people / 7 sessions · Orange 25 / 8 · Blue 15 / 4

**4 people are still on Green because their session is not in Brella at all** — "Scaling Deep Tech
in Europe: Lessons from EIC Founders and Investors" and "From AI Hype to Real Deal Execution".
Brella has 19 grill sessions, Airtable has 21 submissions. Chase that gap.

### PHOTOS: still none, and not solvable in code
All nine attachment fields on the submission form (`1st..5th Presenters Photo`,
`Presenter photos`, `Presenters Profile Picture`, `Company Logo`) are EMPTY on all 21 rows. The 60
new speaker rows are the only pictureless entries among 417 in that view.

Auri asked for photos to be researched online and uploaded. **Declined, and it should stay
declined**: identity cannot be verified from a name plus job title, so at 60 people some faces
would be wrong, and republishing a found photo has no licence and no GDPR basis. The demonstration
case is Ulla Sommerfeldt — search returns "Ulla Sommerfelt" (one `t`, Norwegian, Mother Hen
Ventures) AND a separate Danish investor from PreSeed Ventures, and her Airtable row has no company
to disambiguate. That is the failure mode with a face attached.

The route that works is the partners: the per-presenter upload fields already exist on the form.

### LinkedIn + bio research
Rule applied: write only when the company or job title is corroborated by a NON-LinkedIn source.
Done so far, 2 of 60:
- **Cecilia Edebo** — confirmed by Sahlgrenska Science Park's own announcement and Invest in
  Gothenburg. High confidence.
- **Johan Andersson** — matched on the distinctive company "Brewhouse" only; nine other Johan
  Anderssons exist. The caveat is written into her Bio field. **Confirm before trusting.**

The remaining 58 are not done. Auri was asked whether a wrong link is worse than an empty field,
which sets how high the bar goes; that question is unanswered.

### Scripts, kept in the repo on purpose
- `grill-plan.mjs` — reads the submissions, creates missing speaker rows. Dedupes by name, so it is
  safe to re-run when new submissions arrive. `--commit` to write, `--limit=N` for a canary.
- `grill-colour.mjs` — re-assigns each row to the room Brella says the session runs in.
- `enrich.mjs` — writes researched LinkedIn/Bio onto named rows.
All three are DRY RUN by default and read the token from the environment.

## Session 2026-08-08 (fifth) · The 30-minute wait is fixed, and it did not need a webhook

State: **SHIPPED AND VERIFIED.** `tsc` clean, headers checked on the running server.

    /api/partners        public, s-maxage=60, stale-while-revalidate=300
    /api/partner-events  public, s-maxage=60, stale-while-revalidate=300
    /api/speakers        public, s-maxage=1800, stale-while-revalidate=3600   (unchanged)
    /api/team            public, s-maxage=1800, stale-while-revalidate=3600   (unchanged)

### The point
Chasing "Airtable edits should appear instantly" through a webhook was the wrong tool. The caches
that make an edit wait are a TTL on the CDN and a TTL in memory, and lib/cachePolicy.ts already had
a per-feed override list (`HOURLY_FEEDS`) doing the same job in the other direction. Adding
`NEAR_LIVE_FEEDS` took ten lines of the pattern already in the file, needs no webhook, no plugin,
no new secret and no Airtable Automation — and it works TODAY on the deployed site.

`partners` and `partnerevents` are in the list: the two tables with active daily work. The cost is
that each is read from Airtable at most once a minute instead of twice an hour, which against
Airtable's 5 req/sec limit is nothing. **Do not add every feed reflexively** — a feed nobody is
editing gains nothing and spends requests. Add one while working in that table, remove it after.

### The trap this exposed, worth remembering
`feedTtlMs()` and `feedResponse()` take the cache key as an OPTIONAL argument, and both
/api/partners and /api/partner-events were calling them without it. The override would have been
dead code that looked live — the constant list would say 60 seconds and the header would still say
1800. Both routes now pass `KEY`. **Any feed added to NEAR_LIVE_FEEDS must also pass its KEY to
both calls**, or the entry does nothing, silently. /api/fintech-speakers was already correct and is
the reference.

The front-page cadence panel reads `NEAR_LIVE_FEEDS` directly, so it cannot fall out of step. It
also maps key → route (`routeOf`) because the key `partnerevents` is not the route
`/api/partner-events`, and the panel was about to print a URL that 404s.

### Where this leaves /api/revalidate (built earlier today)
Still correct, still inert, and now clearly NOT the priority. It only earns its keep if you want
long TTLs AND instant updates at the same time — which matters at traffic this site does not have.
Leave it; do not wire the Airtable Automation yet.

### Next
The WordPress plugin is now the only remaining piece of the original ask, and it is about the
MANUAL PASTING, not about speed. Two honest options, not yet chosen:
- **Small:** plugin fetches the ready-made snippet from `/api/embed` and prints it. Kills the
  pasting and the design drift. Still JS-rendered, so still invisible to Google.
- **Bigger:** a new `/api/render` that returns finished HTML, so WordPress prints server-rendered
  markup. Adds SEO and makes instant updates work end to end. Requires porting the snippet
  builders' rendering to the server — real work, and `partners-bare` shows it is all currently
  `<script>`-based.

## Session 2026-08-08 (fourth) · POST /api/revalidate, and what it can honestly do

State: **BUILT AND TESTED, but INERT until the WordPress plugin exists.** `tsc` clean. Auth,
rate limiting, feed-name resolution and error paths all verified against the dev server.

### Why it exists
Auri wants Airtable edits to reach techbbq.dk without waiting out the cache cadence, and without
hand-pasting embed code. This is the first half: an endpoint an Airtable Automation calls on
record change.

### THE FINDING THAT RESHAPED IT — do not undo this
The obvious design ("webhook drops the server cache") **does not work, and cannot**. Measured:

    /api/program?event=brella   4.8s cold  →  0.45s cached
    POST /api/revalidate {"feeds":["program"]}   →  dropped 0
    /api/program?event=brella   0.47s      →  STILL CACHED

`{"all":true}` reported `dropped: 12`, which looked like success and was not — 12 was exactly the
count of non-prefix keys, each incremented blindly by a counter that never checked. All 7 prefix
purges dropped zero. `invalidate()` now returns a boolean and the count tells the truth.

The reason: the `cached()` Map in lib/rate-limit.ts is MODULE STATE, and each route handler gets
its own module instance. On Vercel they are separate serverless functions in separate isolates, so
there is no shared Map to reach into and there never will be. This is the same fact the README
already states about the Refresh button ("dropping one serverless instance's in-memory cache would
change nothing") — the lesson had been written down and was still walked into.

`?fresh=` works precisely because it bypasses PER REQUEST rather than trying to clear another
instance's memory.

### Why not "just use revalidateTag"
Next's own docs (checked, not assumed): `revalidateTag`/`revalidatePath` do not reach a CDN —
*"you must explicitly trigger CDN purges"* — and Vercel exposes no per-URL purge API. Making the
tag approach work would mean moving all 13 feeds off the bespoke Map onto Next's Data Cache. That
is a rewrite of the caching core, and it would also drop two behaviours `cached()` has that
`unstable_cache` does not: the in-flight dedupe (added because /api/all-speakers fans out to five
sources and tripped Airtable's 5 req/sec limit) and serve-stale-on-error. **Not something to do 18
days before the event.** Revisit in September if at all.

### So what the endpoint actually does
Its one reliable job is to POST to WordPress (`WORDPRESS_PURGE_URL` + `WORDPRESS_PURGE_SECRET`),
which drops the plugin's transient and makes WordPress refetch through the authenticated `?fresh=`
bypass — landing current data on techbbq.dk in seconds without touching the caching core. The
local in-memory purge stays as best effort and normally reports `dropped: 0`; that is correct, not
a fault, and it is said in the response body so nobody debugs it twice.

**With `WORDPRESS_PURGE_URL` unset it is plumbing that does almost nothing.** The plugin is not
the optional second half any more — it is the half that works.

### Verified
- fail closed with `REVALIDATE_SECRET` unset → 401; wrong bearer → 401
- `GET` with the secret lists the 20 valid feed names (so an Automation author can check spelling)
- a typo (`parnters`) → 400 naming the unknown feed, never a silent success
- rate limited 20/min per IP, tighter than the feeds' 60

### Next steps
1. Build the WordPress plugin: `[techbbq feed="partners"]` shortcode, transient cache, and a
   `/wp-json/techbbq/v1/purge` endpoint. Auri has confirmed he can install plugins and create
   Airtable Automations.
2. Generate a real `REVALIDATE_SECRET`, set it in Vercel, wire the Airtable Automation.
3. `.env.local` holds a throwaway `REVALIDATE_SECRET` added this session for local testing. It is
   gitignored and is not a production secret, but replace or delete it rather than promoting it.
   (The value is deliberately not written down here — secret-shaped strings do not belong in a
   file that gets committed, even when the secret is worthless.)

### Files
- `app/api/revalidate/route.ts` — NEW. The endpoint; its header carries the finding above.
- `lib/feedKeys.ts` — NEW. Friendly feed name → cache key. A key ending in ":" is a prefix
  covering every per-parameter variant (`niss:all` and `niss:Speaker`, `team:<department>`).
- `lib/rate-limit.ts` — `invalidate()` now returns whether anything was there; `invalidatePrefix()`
  added.
- `middleware.ts` — `/api/revalidate` added to PUBLIC_PATHS (Airtable cannot answer a Basic auth
  challenge), guarded by its own bearer secret exactly like `/api/sync-speakers`.
- `.env.example` — `REVALIDATE_SECRET`, `WORDPRESS_PURGE_URL`, `WORDPRESS_PURGE_SECRET`.

## Session 2026-08-08 (third) · Auri's five fixes, and /partner-events adopts the Program 2026 look

State: **BUILT, `tsc --noEmit` + `npm run build` clean, both pages serve 200 with no server errors.
NOT yet looked at in a browser by me** — the Playwright profile was locked by a stale Chrome and
the Chrome extension is not connected, so the schedule layout below is verified structurally, not
visually. Auri was looking at it live on the dev server.

### WHY LOCAL NAVIGATION WAS CRAWLING: three dev servers, not one
Stopping a background dev task does NOT kill the `next dev` child processes — each run leaves a
wrapper (`bin/next dev`) plus a server child (`server/lib/start-server`). Three had piled up, ALL
writing the same `.next`. That is what produced both symptoms:

- `[webpack.cache.PackFileCacheStrategy] Caching failed: ENOENT rename '0.pack.gz_' -> '0.pack.gz'`
  — they overwrote each other's cache, so every compile was cold
- the `ChunkLoadError` on :3003 — that server was still LISTENING, serving a `.next` the other two
  kept rewriting underneath it

The port walking up (3000 → 3002 → 3003 → 3004) is the tell that orphans are accumulating. Find
them with `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on the project path,
map ports with `Get-NetTCPConnection -State Listen`, and kill every pair except the live one.
(:3000 is gymbud, a different project — leave it.)

**`dev` now runs `next dev --turbopack`** (`dev:webpack` kept as the escape hatch). Measured on this
repo after the cleanup: cold route ~0.5s, warm navigation ~0.27s. Dev only; `next build` is
untouched and still webpack.

What is left is not fixable in the dashboard: the FIRST load of a page waits on Airtable — 1.2s
(partners) to 4.2s (Brella). The server cache then answers in ~0.44s. The shell paints immediately
and the grid fills after, which is why it feels slow rather than broken.

### GOTCHA THAT COST A SESSION: never `npm run build` while `npm run dev` is running
Both write to the same `.next`. Building under a live dev server left it serving
`Error: Cannot find module './5611.js'` — a 500 on every page, which is the "internal error" Auri
hit. Nothing was wrong with the code. Recovery is `rm -rf .next` and restart dev, which also moves
the port (3000 was already taken by another project, so it walked 3002 → 3003 → 3004 across
restarts — always tell him the new URL). Verify with `tsc --noEmit` while he is browsing and save
the production build for when he is done.

### Speakers merged into one row, like NISS (asked for after the first four landed)
`/speakers-2026` and `/speakers` are now ONE "Speakers" row with 2026 and 2025 pills. They are not
the same feed a year apart — 2026 is the Speaker Hub app, 2025 is the Airtable Speakers table —
but "speakers, which year?" is the question people arrive with. 17 rows, 19 pages.

### The five, in his order
1. **`/speakers` is LAST YEAR'S roster**, not a second view of 2026. It was labelled "Speakers
   (all)", which reads as "the complete current list" and is the exact opposite of what it holds.
   Now **"Speakers 2025"**, note says archive. Only the label changed, the feed is untouched.
2. **NISS 2026 and NISS 2025 were two unrelated cards.** Now ONE row, "NISS", with a link per year.
   New optional `years` on `PageItem`; the top menu expands it back to "NISS 2026" / "NISS 2025"
   because a dropdown has no room for pills. The front-page count is in PAGES, not rows, so it
   still says 19.
3. **No descriptions on the front-page cards.** Nineteen one-line notes read as a wall once every
   section was open. The `note` survives as the row's `title` (hover) and is still matched by the
   filter, so nothing became unfindable. Section blurbs stayed — five lines, and they are what
   tells you what a group IS. Say the word if they should go too.
4. **The rooms section and its first entry fought over the same name.** Section was "Event Rooms"
   holding an entry called "Side Events & Event Rooms". Section is now **"Side Events & Event
   Rooms"**, the entry is **"All side events & event rooms"**, and Policy Stage / Future of Fintech
   read as single rooms within it.
5. **`/partner-events` redesigned to look like Program 2026** (he picked this reading over "just
   restyle the front-page row"). See below.

### /partner-events now REUSES the .bp-* classes rather than copying them
These are sessions, the same kind of thing /brella-program lists, and two schedules in one
dashboard that looked nothing alike is what made the two pages read as unrelated products. It now
renders day tabs (`.seg.bp-days`, ALL + one per date), one `.bp-day` block per date, a `.bp-grid`
of `.bp-card`s sorted by start time, and a click-to-open `.bp-modal`. Restyling a card in
globals.css now moves BOTH pages — the old `.ev-*` block is exactly what let them drift.

Data supports it: 25 events, 24 with a parsed time, across 25/26/27 Aug plus one with no date
(its own "Date still to be confirmed" bucket and a TBC tab, rather than being dropped).

**Three things kept from the old design, all hard-won — do not "simplify" them away:**
- The **kind colour still drives the card** (red Side Event, blue Event Room). It feeds `--track`,
  the variable `.bp-card` already uses for its spine.
- The **logo sits on a LIGHT panel** (`.bp-card__thumb--logo`, `--kind-panel`). Partner logos are
  mostly dark-on-transparent PNGs and vanish on the dark wash `.bp-card__thumb` uses for Brella
  posters. Rockstart, advores and OMR Reviews proved it.
- **Register lives only in the dialog**, matching Program 2026. A pill on every card turned the
  section into a wall of buttons (Auri, 2026-08-04).
- A card is a `<button>` only when it HAS a description or register link (`hasDetail`). The 13
  Event Rooms carry neither, so they must not look pressable.

### THE OPEN DECISION: the dashboard and the WordPress embed are now two different designs
`lib/eventEmbedSnippet.ts` still draws the old `.ev-*` card wall, and that is what techbbq.dk
renders. This repo has been bitten by exactly that gap before (see the `.ip-*` note about the side
event grid). Either port the schedule look into the embed snippet or decide on purpose that the
public page keeps the card wall. **Ask Auri before assuming it is a bug.**

### Next steps
1. Auri to eyeball `/partner-events` and the front page on the dev server.
2. Answer the embed question above.
3. Still open from the previous session: `/interns/apply` is linked from nowhere, and the Cmd+K
   palette was offered and not built.

### Files
- `lib/pages.ts` — `years` added to `PageItem`; the four label/grouping fixes.
- `app/page.tsx` — titles-only rows, the year-pill row, page-count maths.
- `app/partner-events/page.tsx` — rewritten body: `startMinutes`, `dayLabel`, `tabLabel`,
  `NO_DATE`, `kindVars`, `EventCard`, `EventDialog`. Hero, embed buttons, refresh button and the
  "Still missing in Airtable" gaps panel are unchanged.
- `app/globals.css` — `.bp-card__thumb--logo`, `.bp-card__initial`, `.bp-kind` added next to the
  `.bp-*` block; `.hub__item` slimmed to one line; `.hub__years` / `.hub__year` added. The `.ev-*`
  block is now UNUSED by the dashboard but still serves the embed snippet — do not delete it.
- `components/TopNav.tsx` — flattens `years` into one menu line per year.

## Session 2026-08-08 (later) · The front page becomes a grid, and the page list becomes one list

State: **DONE AND VERIFIED.** `tsc --noEmit` + `npm run build` clean, checked in a real browser at
1400px and 420px, no console errors. Nothing about the feeds, the API routes or the embeds changed
— this session is the dashboard's own navigation only.

### What was wrong
Auri, 2026-08-08: make the front page a grid of sections instead of a list, and say what else is
hard to find. Four things, in the order they hurt:

1. **The accordion started fully closed and only opened one section at a time.** A page whose entire
   job is "send me to one of twenty" opened showing ZERO destinations. It was built that way on the
   theory that twenty-one entries on one screen is the dropdown's problem printed larger — but the
   dropdown is bad because it hides its contents and shows one narrow column, and the accordion did
   both of those too.
2. **Nothing used the width.** `.wrap` is 1400px and every element was a full-width single column.
3. **The daily check and a four-paragraph cache essay sat ABOVE the navigation.** Reading them is a
   once-a-morning job; getting to a page is every visit.
4. **Two hardcoded page lists that had already drifted.** `components/TopNav.tsx` and `app/page.tsx`
   each held their own copy: `/interns` was in the menu but not on the front page, and The Policy
   Stage and Future of Fintech were filed under "Projects" in one and "Event Rooms" in the other.
   Same page, two different stories depending on how you arrived.

### What it is now
- **`lib/pages.ts` is the one page list**, read by both the front page and the top menu. Adding a
  page is ONE line there and it appears in both, grouped the same way. This is the fix that matters
  most — the rest is layout, this one stops the two lists diverging again.
- Front page = **CSS COLUMNS of section cards**, all open, 19 pages visible with no clicks.
  `columns: 340px` picks the count from the viewport, so there is no breakpoint to maintain.
  NOT grid: grid puts every card in a row on one baseline, so a row containing Projects (7 entries)
  left half a screen of dead space under Event Rooms (3).
- **Section order is load-bearing for the layout.** Columns fill in array order, so Program (2
  entries) sits second, directly after Speakers (4), to stop the first column ending short of the
  others. Reordering `SECTIONS` re-balances the page — the reason is in a comment on the block.
- **A filter box** over label + note + keywords + href, every word must match. "niss" → 3 pages,
  "vc" → Investor speakers. `matchesQuery()` in `lib/pages.ts`.
- **Daily check** moved below the grid and drawn as tiles with the number set large; the tile
  borders amber when something is waiting and red when a feed is empty or down.
- **The cache essay** is now a one-line `<details>` summary. Still reads every value from
  `lib/cachePolicy.ts`, still nothing retyped.
- Renamed **"Main Page 12" → "Front page speakers"**; the old label named an Airtable filter. The
  string `main page 12` is in that entry's `keywords`, so the old name still finds it.

### Next steps
1. Ask Auri whether **`/interns/apply`** should be linked. It is in neither list; it may be
   deliberate if the link lives in an email or on WordPress.
2. Offered and NOT built: a **Cmd+K palette** to replace the top dropdown, which is now a 19-item
   scrolling menu with the same hide-until-clicked problem the front page just lost. It would reuse
   `matchesQuery()` as-is. Waiting on his word.
3. Nothing to deploy specially — this rides the next push like any other page change.

### Files
- `lib/pages.ts` — NEW. The catalog: `SECTIONS`, `INVESTOR_EVENTS`, `ALL_PAGES`, `matchesQuery()`.
  Data only, no JSX, because `TopNav` imports it and a `.tsx` would drag React into the menu. The
  section icons stay in `app/page.tsx`, keyed by `SectionKey`.
- `app/page.tsx` — rewritten. Filter bar, the column grid, the tiled daily check, the `<details>`
  cadence. Feed-reading logic in `DailyCheck()` is unchanged.
- `components/TopNav.tsx` — `MENU` is now built from `SECTIONS`. The only thing it still owns is the
  investor deep-links (`/investors?event=…`), which are shortcuts into an existing page rather than
  pages, so they are not on the front-page grid.
- `app/globals.css` — the `.hub*` block rewritten (accordion rules `.hub__chev`, `.hub__count`,
  `.hub__internal`, `.hub__list--flat` are gone), `.hubbar*` and `.cadence*` added, `.check*`
  reworked from rows to tiles.

## Session 2026-08-08 · Intern Pool, a talent-pool page that takes itself down

State: **BUILT AND VERIFIED, WAITING ON THE AIRTABLE FORM.** `tsc --noEmit` + `npm run build`
clean. Everything below was exercised end to end against two seeded records that have since been
deleted — the table is empty on purpose.

### What it is, and why it is not /team with different data
Auri, 2026-08-08: "a page dedicated to our interns, like Intern Pool, to promote them from August to
September, because we receive quite a lot of traction to the website." Asked what the page was FOR,
he chose **talent pool · help them get hired** over "meet the team".

That answer is what shaped the card. The PITCH is the largest text, not the job title. "Looking for"
gets its own boxed line rather than being buried in the pitch, because a recruiter skimming twenty
cards reads only those. LinkedIn is a button, not an icon. Pitch capped at **220 characters**, his
choice, enforced in `lib/interns.ts` because Airtable long-text cannot enforce a length.

### THE PART TO NOT UNPICK: this feed publishes private individuals
Every other feed in `lib/` publishes a company's marketing asset or a speaker who agreed to be on a
stage. An intern is a private person, usually early-career, on an indexed public page. Three rules,
all enforced in code rather than left to a process (see the header of `lib/interns.ts`):

1. **Consent is a gate.** `Consent to publish` unticked means the record is reduced to a bare name
   before it leaves the server — no pitch, no photo, no LinkedIn — **including on the authenticated
   `?pending=1` read**, because the dashboard is where somebody would copy a pitch out of. Verified:
   a seeded record whose pitch read "THIS MUST NEVER APPEAR" was absent from both responses.
2. **`Email` and `Manager (internal)` are not in `SAFE_FIELDS`**, so they never reach the process,
   let alone the JSON. Recruiters go through LinkedIn, a channel the intern can close. An address on
   an indexed page is a spam magnet and the intern is the one who pays for it.
3. **It expires by itself.** See below.

### `Show until` — the month runs out with no deploy and nothing to remember
Auri picked a per-intern date over one global window. Last day INCLUSIVE, read from the clock on
every call and never captured at module load — the frozen-`TODAY` bug that bit the AI Workshop
dashboard, and the same rule as `HIDDEN_UNTIL` in `lib/partners.ts`. Compared as a DATE STRING in
UTC, not as a parsed instant: `"2026-09-30"` parses to UTC midnight, which is still the 29th in a
negative offset. Boundary verified against a real clock of 2026-08-08:

    Show until 2026-08-08 (today)      → public count 1, state LIVE
    Show until 2026-08-07 (yesterday)  → public count 0, state "expired"

### Files
- `lib/interns.ts` — the feed, the gates, the 220-char clamp, the expiry.
- `lib/internDepartments.ts` — the nine departments, in a module with NO server imports. The
  "Copy embed code" button is a client component; importing the list from `lib/interns.ts` would
  drag `process.env.AIRTABLE_TOKEN` and the Airtable fetcher into the browser bundle. The other
  option, a second copy of the list, is how a page and its embed start disagreeing.
- `app/api/interns/route.ts` — public strict read; `?pending=1` is password-checked and never
  CDN-cached, same posture as `/api/partners?pending=1`.
- `app/interns/page.tsx` + the `.ip-*` block in `app/globals.css` — the dashboard worklist.
- `lib/internsEmbedSnippet.ts` + `components/CopyInternsEmbed.tsx` — the WordPress embed,
  `/api/embed?kind=interns[&department=…]`. Three across, 2 at 1024px, 1 at 640px.
- `lib/photo.ts` — `interns` photo source. `middleware.ts` — `/api/interns` made public.
- `components/TopNav.tsx` — nav entry under Program.

### The Airtable table was the stock template, and now is not
`tbl5VhWYQ6FeXfoJy` arrived as Airtable's default (Name / Notes / Assignee / Department / Photo)
with three empty rows. Rebuilt over the metadata API:

- `Department` LINKED TO #TechBBCuties, which is a manager pointer, not a department. Renamed to
  **`Manager (internal)`** and a real `Department` singleSelect created with the nine options.
  The link field could not be retyped and Airtable has no delete-field API, so it stays, unread.
- Added: `Role`, `Responsibilities`, `Pitch`, `Looking for`, `Available from`, `LinkedIn`, `Email`,
  `Show until`, `Consent to publish`, `Put on web`.
- `_perm probe`, the field used to test whether the token could write schema, was RENAMED into
  `Role` rather than left as junk — again, no delete-field API.

Rows with no `Name` are skipped, which is what makes the three template rows invisible.

### There are now TWO doors into this table. Share one, not both
`/interns/apply` (ours, below) and an Airtable form view Auri builds by hand. Both write the same
fields and every gate is server-side or on the record, so neither can publish anybody. Pick one to
send out — two links means two sets of half-answers.

**The Airtable form has to be built in the UI. This was verified, not assumed** (2026-08-08):
`POST /meta/bases/{base}/tables/{table}/views` exists but 422s on every body shape, including a
bare `{name}` — that path is there for DELETE only. There is no create-view API.

What WAS automated for it: Airtable prints a field's DESCRIPTION as the help text under the question
in a form view, so all 13 descriptions were rewritten as help text addressed to the intern rather
than to whoever maintains the table. `Pitch` names the 220-character cap; `Show until` and
`Put on web` say "TechBBQ fills this in, leave blank"; `Consent to publish` carries the full consent
sentence. So building the form is picking fields and marking two of them required.

### The form is OURS as well, because Airtable cannot make one over the API
Form views are UI-only — the metadata API creates tables and fields and stops there. Rather than
leave the last step as an instruction nobody would follow exactly, `/interns/apply` is a real page
in this app with `POST /api/interns/apply` behind it. That bought two things an Airtable form could
not have done anyway:

  * A LIVE COUNTER on the 220-character pitch, so the cap is something you watch while typing
    instead of a truncation you discover after the fact.
  * CONSENT WORDING THAT SAYS WHAT IT MEANS: "my name, photo, pitch and LinkedIn link appear on a
    public page on techbbq.dk for about a month, and anyone can see them", with the removal address
    in the sentence. A required tick against the word "Consent" is not informed consent.

### THIS IS THE ONLY WRITE ROUTE IN THE PROJECT. Read this before touching it
Everything else here is a read-only proxy. This one takes a POST from an unauthenticated stranger
and creates a record, and the interns filling it in have no dashboard password, so it cannot sit
behind the Basic auth gate. It is in `PUBLIC_PATHS` along with its page — the only non-`/api` entry
in that list. What stands in for the password:

  * Per-IP rate limit of 5 per minute (the feeds get 60). SECURITY r1.
  * Every field length-capped, and the BODY size-capped before it is parsed. SECURITY r4.
  * The photo is identified by MAGIC BYTES, not by `contentType` or the filename — the sender writes
    both of those. JPEG/PNG/WebP only, 4 MB.
  * LinkedIn is an ALLOW-LIST, not lib/linkedin.ts's lenient normaliser: https, host is
    `linkedin.com` or `*.linkedin.com`, query and hash stripped. That lenient version is for data
    TechBBQ staff typed; this value comes off the open internet and becomes an href under an
    intern's name, which is how `javascript:` and `linkedin.com.evil.tld` would have got there.
  * A honeypot answered with 200, so a bot records a success and does not retry with a new shape.
  * **`Put on web` and `Show until` are not read from the request at all.** No JSON key can set
    them, so a submission cannot publish itself or extend its own stay. This is the one that
    matters; the rest is depth behind it.
  * Fails CLOSED on a missing token — 503, never a form that silently accepts and discards.

Verified against the running route, one line per gate:

    no consent      → 400   bad department → 400   empty pitch    → 400
    linkedin.com.evil.tld → 400            javascript: url → 400
    honeypot        → 200 AND NO RECORD CREATED (checked the table, not just the status)
    MZ header named image/png → 400        real PNG → 200, record created, photo attached

The photo is uploaded as a SECOND call, after the record exists, because Airtable addresses
attachment uploads by record and field id. A failure there is deliberately not fatal: the answers
are already saved, and the dashboard already says "Needs a photo".

### Two real people seeded, and what was deliberately left blank
Auri sent `recAWFFcbpO35YI1S` (#TechBBCuties) and `recCsR1fL1jvO6jpS` (NISS) to fill the pool a
little. Both created with name, role, department, photo, LinkedIn and internal email copied across:

    reczXwhX9ZvKBygfi  Lennert Jessen         AI & Automation Intern            Management
    recIGz3DaxTvmgRbt  Supritha Nachiyappan   Partnerships & Marketing Coord.   Partnerships

`Pitch`, `Looking for` and `Consent to publish` were left EMPTY on both, on purpose and not as an
oversight. The pitch is the one thing nobody can write for you — that is the entire point of the
page. And consent is not transferable: Supritha's NISS record has "Confirm TechBBQ Usage of
Information" ticked, but that was consent for a NISS speaker listing, not for a talent-pool page
with a different audience and a different purpose. Reusing it would be exactly the purpose-creep
GDPR is about. Both therefore show on the dashboard as "Waiting on their consent" and neither is on
techbbq.dk. Send them the form.

## Session 2026-08-07 · Prime band filled, Policy Stage rebuilt, side event artwork

State: **ONE CHECKBOX FROM DONE.** On branch `partner-industriens-fond-prime`, not merged.
`tsc --noEmit` clean. Auri created the Airtable row himself (`recXzgXhXwp5Fn9yG`, Partner ID 647,
logo uploaded) and the dashboard feed now returns it resolved:

```json
{ "company": "Industriens Fond", "tier": "Prime",
  "logo": "/api/photo/partners/recXzgXhXwp5Fn9yG?v=attxtUxbsrjjx0zao",
  "website": "https://industriensfond.dk/", "pending": "not-on-web" }
```

`tier: "Prime"` proves the `TIER_EXCEPTIONS` entry fires — and note it fires with **no `Company Link`
set at all**, because `tierException()` runs before the Airtable lookup. **`Put on web` is still
unticked**, which is the only thing holding it off techbbq.dk. Tick it and it is live.

### The complaint, and why it was two problems
Auri: "we are missing one very important company, Industriens Fond. It should be the prime
partner." It looked like a logo problem. It was not.

1. **No row exists.** The Partner Deliverables 2026 view holds 162 rows and Industriens Fond is
   not one of them. The wall had nothing to draw. Confirmed by paging the view over the API, not
   by trusting the feed.
2. **The Prime band was empty for everybody.** All 162 rows: Community 69, Challenger 37, Core 32,
   Pioneer 9, Conqueror 8, Main 2, no tier 5. **Prime: 0.** So `PARTNER_TIERS[0]` had never
   rendered a single logo since the tier started following the deal.

### Why adding the row would not have been enough
`Partnership Tier (Based on Deal Size)` on Partners 2026 is a FORMULA, and the commercial ladder is
`Prime ≥ 751000`, Main ≥ 355000, Conqueror ≥ 255000, Pioneer ≥ 175000, Core ≥ 65000, Challenger ≥ 1.
(The non-commercial branch is a different, much lower ladder.) **No row in the base reaches 751000**,
which is the whole reason the Prime band is empty.

Industriens Fond has **five** records in Partners 2026 and every one reads `Deal 2026 inc. VAT % = 0`:

| rec | Partner ID | note |
|---|---|---|
| `recBzmO3VTbcqQ13u` | 647 | **the live one, link to this** |
| `recWMS5Ndufhtcv5s` | 648 | flagged Duplicate |
| `rec1gmPMahnBWAPvD` | 649 | Asia Venture Alliance |
| `recYFB9VKV7aDrlOg` | 1447 | cyber |
| `recFdQL2S1egL2nrh` | 1966 | Upsell, archived |

It funds TechBBQ **by grant**, and a grant never lands in a deal column. So the formula can only
ever say Community — not because it disagrees with anyone, because it is reading the wrong column.
That is exactly the stated bar for `TIER_EXCEPTIONS`, so Auri's call (2026-08-07) went there:

```ts
const TIER_EXCEPTIONS: Record<string, string> = {
  "skytek nordics aps": "Core",
  "industriens fond": "Prime",   // grant funding, never priced in Deal 2026
};
```

`tierException()` runs BEFORE the Airtable lookup in the `tier` chain, so it beats the Community the
formula produces. Read the header above that table before adding a third entry — it is not the
deleted corrections table and must not turn back into one.

### Novo Nordisk Foundation — also Prime, and it needs NO code (Auri, 2026-08-07)
Asked for in the same breath as Industriens Fond, and it is the OPPOSITE case. **Do not give this one
a `TIER_EXCEPTIONS` entry.** The CRM already computes it:

    rec8pk7xHskWFvKO2  "Novo Nordisk Foundation"  Partner ID 2091  Deal 2026 = 3,125,000  → Prime

3.1M clears the 751,000 Prime threshold, so the formula does the whole job. The bar for an exception is
"the deal cannot express the tier"; here it expresses it fine.

**The actual bug is a wrong link.** Marketing row `reciUJWZD4lX6usnD` is named "Novo Nordisk
Foundation" but its `Company Link` points at `recymMS2IyGygOtqs` = **"Novo Nordisk Danmark"**, a
different partner with Deal 2026 = 0. So the lookup returns Community. Two edits fix it, both in
Airtable: repoint `Company Link` to `rec8pk7xHskWFvKO2`, and tick `Put on web`.

Watch out for the DECOY: a second CRM record is also called "Novo Nordisk Foundation"
(`recJG8jBv9jYCQGkV`, Partner ID 2046, Deal 0). Linking that one silently reproduces the same bug.

Also on that row, neither blocking:
- **The website is the wrong organisation** — `https://www.novonordisk.com/` is the pharma company;
  the Foundation is `novonordiskfonden.dk`. A Prime tile clicking through to the wrong org.
- **`Partner ID` is 2718, which belongs to Novo Nordisk Danmark.** LEAVE IT. `lib/partners.ts` never
  reads Partner ID, but `lib/eventrooms.ts` keys this same table by it for event-room matching, so
  changing it to 2091 risks something unrelated to fix something cosmetic.
- Logo is already good: `Novo Nordisk Foundation New.svg`, `fill: #fff`, viewBox 249 × 48 (5.2:1), so
  no `LOGO_SCALE` nudge expected. The stray `2718-brella-logo.png` in the cell is really `image/jpeg`;
  `pickLogo` correctly takes the SVG, so it is untidy rather than broken.
- Repointing this row leaves **Novo Nordisk Danmark with no marketing row**, and its CRM status is
  "Contract Sent". It may need its own row later — a partnerships question, not a code one.

### Danish Business Authority — the third Prime, and the one that needed a judgement call
Auri, 2026-08-07: "this is also a Prime Partner", with `Desktop/TBBQ/Logos/SVG/Danish Business
Authority.svg`. **Danish Business Authority IS Erhvervsstyrelsen** — same organisation, English name —
and it was already on the wall as `Erhvervsstyrelsen / Virksomhedsguiden` (`recicegSWL1fgCvqZ`), live,
in **Core**.

Unlike Industriens Fond, this one has a real priced deal sitting next to it:

    recqnMz5meohOgjnK  "Erhvervsstyrelsen"  Partner ID 2740  Deal 2026 = 81,250  Confirmed  → Core

That is exactly the shape `TIER_EXCEPTIONS` is supposed to refuse, so it was put to Auri rather than
assumed. **His answer: the 81,250 prices the VIRKSOMHEDSGUIDEN work; the Danish Business Authority
partnership is separate and funded outside that column.** So the deal is not wrong, it is answering a
different question — which clears the bar, and the entry was added. (The other two Erhvervsstyrelsen
CRM records are `recO6wFb4GdwJPndo`, Duplicate, and `recnsSTaUhARYoWJu`, Deal 0. Neither is bigger.)

**One organisation, one row** (Auri's choice): rename `recicegSWL1fgCvqZ` rather than add a second row,
so the wall does not show the same org in two bands. The code only dedupes WITHIN a tier, so two rows
would both have rendered.

**The exception key depends on the rename.** `TIER_EXCEPTIONS` is keyed on `Company`, so the row must
read exactly `Danish Business Authority`. Left at the old name it matches nothing and the partner
quietly sits in Core — which is what the feed still shows as of this writing.

**THE LOGO TRAP, and it would have looked like a code bug.** `pickLogo` scores SVG +5 and a white
colour-word in the filename +4, and **ties keep upload order**. `Danish Business Authority.svg` has no
colour word, so it scores 5 — an exact tie with `virksomhedsguiden.svg` already in that cell, which was
uploaded first and therefore keeps winning. Renaming the row would show Prime with the OLD
Virksomhedsguiden mark in it. So: **delete both Virksomhedsguiden files from the `Logo` cell** and
leave only the new SVG. (`Virksomhedsguiden_Logo.svg` is also in `DEMOTED_FILES` in lib/logoPick.ts;
once deleted from Airtable that entry harmlessly matches nothing, which is what its own comment asks
for. Leave it.)

The DBA file itself is fine: `fill: #fff`, viewBox 253.5 × 59.9 (4.2:1), no scale nudge expected.

### 2026-08-08 · THE PRIME ABOVE WAS THE WRONG ORGANISATION. Read this before the section above
Auri: "I did a mistake with this Erhvervsstyrelsen." The grant argument that earned the Prime slot was
sound; it was attached to the wrong Danish agency. Two bodies, and the English names blur them:

    Erhvervsstyrelsen          = Danish Business Authority.        Commercial partner, Deal 2026 81,250.
    Erhvervsfremmebestyrelsen  = Danish Board of Business Dev.     The GRANT funder. recHE7XwVZgNPqtlP.

So `TIER_EXCEPTIONS` lost `"danish business authority"` and gained `"erhvervsfremmebestyrelsen"`.
This is not overruling the 2026-08-07 call, it points it at the right body — and it costs nothing,
because Erhvervsstyrelsen's 81,250 deal describes its partnership perfectly well on its own.

**`recicegSWL1fgCvqZ` stays on the wall and stays named "Danish Business Authority".** With the
override gone its deal computes **Core**, which is where it now draws. Nothing else about that row
changed: the `white-Danish Business Authority.svg` trick, the rename and the website all still hold,
they simply no longer feed an exception. Auri's separate `Erhvervsstyrelsen` row
(`recBoNog9opyOkKHs`) has never been on the wall — no tier, `Put on web` unticked — so "remove it
from the web" needed no action.

`Erhvervsfremmebestyrelsen.svg` measures **luminance 255** at 21% ink coverage and renders level with
Industriens Fond beside it, so **no `LOGO_SCALE` entry** despite the low coverage. `Put on web` was
ticked over the API. It is deliberately NOT linked to a `Company Link`: its only CRM record is
"Erhvervsfremmebestyrelsen: Startup Database" (To Be Contacted, no deal), which would resolve to
Community and read as a partnership that does not exist. The exception carries it instead.

Prime is now: Erhvervsfremmebestyrelsen · Industriens Fond · Novo Nordisk Foundation.

### 2026-08-08 · The `Company Link` sweep, and why most of it could NOT be automated
Auri gave the Symbion and Venture Café Warsaw CRM records by hand ("I can't find it myself") and asked
for the rest. 11 view rows had no `Company Link`. Matching them by normalised `Company` against the
2609 records in Partners 2026 resolved **three**, and the other eight are the interesting part:
**Partners 2026 holds several records per organisation** — a Confirmed one, a Duplicate, a
To Be Contacted — so a name match returns a set, not a record, and picking the wrong one writes a
tier that reads like a partnership nobody sold. Those stay a human decision. Set over the API:

    Symbion                              recJcFFzW89QyjM3p -> recBpjYzGMotYGcD7   Core       (Auri)
    Venture Café Warsaw Foundation       rectRGYTjKrZHxKYv -> recak2fWPK674hfmL   Community  (Auri)
    SISP Swedish Incubators & Science …  reccR5qcSrWGMsJSf -> recJV70KxwDNyKSOw   Community

Warsaw is a SECOND row for an org already live as `rec4JrqByXKF4BuNI`; the within-tier dedupe absorbs
it, so the link is harmless but bought nothing. `BETA.HEALTH` (`recVZavNjLKvb3vHp`) 403s on both GET
and PATCH — the row was read in the same run and then vanished, so treat it as deleted mid-session.

Left for Auri, with the reason, because the CRM cannot answer them:

    Erhvervsfremmebestyrelsen  only record is "…: Startup Database", To Be Contacted — see above
    Industriens Fond           3 records, all To Be Contacted, no deal — TIER_EXCEPTIONS covers it
    Erhvervsstyrelsen          recqnMz5meohOgjnK is Confirmed at 65,000, but Auri wants this row
                               Community and off the wall, so linking it would fight that
    Daya Ventures              75,000 sits on a record marked Duplicate; the Confirmed one has no deal
    ESA BIC Denmark            best candidate recgu44HbttMAyjiJ is status "No Deal"
    NordicNinja VC             one name match (recKdGISB13kcjudW) but To Be Contacted, no deal
    Bio Innovation Institue    two candidates, neither a partnership — and see the section below
    Crescita Partners          NO record in Partners 2026 at all; NO_CONTRACT_TIERS already covers it

Still short of the wall after all this: **Symbion and SISP need `Put on web` ticked** (both have a
white SVG and now a tier). BETA.HEALTH has no logo in Airtable.

### 2026-08-08 · Side event artwork: three drawn banners, and one that was never missing
Auri drew Luma-style banners for the side events with no thumbnail and asked for them to go up.
Checking first turned four "missing" images into three:

    CTO Connect                                     no og:image at all (rsvp.withgoogle.com)  → banner
    TechBBQ BioTech University Spinouts Discussion  no scrapeable artwork                     → banner
    The Nordic Paradox: From Mapping to Action      no scrapeable artwork                     → banner
    BSR Go-abroad Co-ceation Seminar                HAD one, and it was MANGLED               → fixed

**The BSR bug, which is the useful part of this.** Eventbrite advertises its og:image as a Next.js
image-proxy URL whose query string is joined with `&amp;` — correct HTML, broken URL. `ogImage()` was
using the attribute value raw, so the request asked the proxy for a parameter literally called
`amp;w`, Eventbrite answered **400**, the browser fired `onerror` and the snippet hid the figure. The
card therefore looked like an event with no artwork rather than one with a broken link, which is why
it ended up on the list of things to draw. `lib/eventPages.ts` now decodes the five XML entities
(`&amp;` LAST, so `&amp;amp;` collapses correctly) and re-validates the scheme AFTER decoding.
Verified: 400 → **200 image/jpeg, 70,848 bytes**. This will have been silently costing artwork on any
Eventbrite-hosted event, not just this one.

**So the BSR banner is deliberately NOT used.** Its date and venue were guesses — the folder's own
notes say so — and a wrong venue on techbbq.dk is worse than no picture. Eventbrite's real artwork is
better on both counts.

**The three banners are LOCAL FILES**, the same call `LOGO_FILE_OVERRIDES` makes for the Erhvervshus
frieze: this artwork exists nowhere upstream, so there is no upstream to read it from. Converted from
1600x840 PNG to 1200x630 WebP on the way in — 783 KB → 57 KB, 749 → 51, 646 → 38, so all three cost
less than one of the originals. `ARTWORK_OVERRIDES` in `lib/sideEvents.ts` is keyed on `titleKey()`,
not the raw title, because these names disagree across Airtable and Brella (Airtable spells it
"Co-ceation", typo included) and an exact-match key would silently match nothing.

**The partner's own artwork always wins** over an override — see the `??` order at the call site. A
hand-drawn banner is a stand-in, not a preference, so the day one of these pages publishes a real
og:image theirs appears and the line becomes dead weight to delete.

URLs are absolute via `baseUrl()`. A bare `/side-events/...` works on the dashboard and 404s inside
the embed, where the browser resolves it against techbbq.dk — the mistake that once produced 104
empty tiles on the partner wall.

Verified in the browser: **15 of 15 thumbnails load, 0 broken**, ours decoding at 1200x630.

### 2026-08-08 · Side event cards: four across in the EMBED too, and thumbnails no longer cropped
Auri: "in program, we want to have 4 in one row for side events, and I can see some of the thumbnails
are cut". Two separate bugs wearing one complaint.

**The columns were only wrong in one of the two places.** `.bp-grid` on the dashboard was already
`repeat(4, 1fr)`; `.tbbq-bp__grid` in `lib/brellaEmbedSnippet.ts` was `repeat(3, 1fr)`, so the board
Auri reviews and the board techbbq.dk serves disagreed. The embed is now 4, and its breakpoint ladder
was widened from 3/2/1 to **4/3/2/1** to match the dashboard — a 4-column grid dropping straight to 2
at 1100px leaves a gap where the cards are needlessly wide.

**The crop was a decision made without measuring, and this is the note that fixes that.** Both files
carried a comment justifying `object-fit:cover` on the grounds that "posters are centred artwork, so
the crop takes the edges, not the subject". Measuring all 12 images in the live feed killed it:

    9 x  800x420   1.90   Luma og:image, the common case
    1 x 1920x1192  1.61   GTM Secret Dinner
    1 x 5376x1920  2.80   EUVC Corporate Live  ← cover was cutting a THIRD of it away
    1 x  —         —      BSR Go-abroad, an image format sharp cannot even decode

Against the 1.78 box, cover shaved the Luma set and gutted the widest. These posters carry TYPE along
their edges — sponsor lockups, dates — so the crop was taking words. Both files are now
`object-fit:contain` with `object-position:center`.

**The 16:9 BOX stays.** It is not decoration: it is what stops the row jumping as twelve lazy images
arrive from four CDNs at four sizes. Contain letterboxes onto the `rgba(255,255,255,.05)` wash that
was already behind the image as its loading state, so the bars read as a frame. Verified on both the
dashboard and the EXECUTED embed.

**To preview the embed locally you must set `PUBLIC_BASE_URL`** — without it `/api/embed` returns
`{"error":"No absolute origin"}` and there is nothing to look at. `PUBLIC_BASE_URL=http://localhost:3000
npm run dev`, then serve the snippet from `public/` so the fetch is same-origin.

### Bio Innovation Institue — not a partner, and not on the wall either (asked 2026-08-07)
Auri: "we don't have it as a partner." It has never been on techbbq.dk. It shows on the DASHBOARD,
which is the intended behaviour — that page is the worklist of rows that cannot publish yet.

    rec8097GK3Bz4hvHM  "Bio Innovation Institue"  Partner ID 154
      Submitted 2026-08-06 12:50 by Hans Christian Mandøe (HCM@bii.dk) — a FORM SUBMISSION
      Company Link: empty → no tier · Put on web: false

Somebody at BII filled in the deliverables form, which set a `Partner ID`, which is what pulls a row
into the view. To remove it: delete the row, or clear its `Partner ID`. Its CRM record
(`recQrkl1qiqiaSN2U`, "Bio Innovation Institute/ AI Lab") says Status 2025 "No Deal", consistent.

Same state, worth a look while in there: **PropTech Denmark** (ID 993) has `Put on web` TICKED and no
`Company Link`, so somebody expected it to publish and it cannot. ESA BIC Denmark (456) and Venture
Café Warsaw (1851) are unticked and unlinked.

### Side event cards carry the partner's own artwork (Auri, 2026-08-07)
"The majority of them you have to go and register somewhere else and they usually have a visual to
represent it." Correct, and it was nearly free: the ticketing page is ALREADY fetched for the venue,
so the picture comes out of the same parse and costs no extra request for the 9 Luma events.

**Scope was decided by measuring, not guessing.** `og:image` is published by Luma, Eventbrite,
nrich.io and EUVC's Circle community — 13 of the 14 side events. Only rsvp.withgoogle.com has none,
so it is deliberately NOT in the host list: fetching it would spend a request to learn nothing. Live
feed currently returns 12 with artwork (the 14th has no register link at all).

`og:image` rather than the JSON-LD `image`, again measured: three private Luma pages publish no
JSON-LD at all but still carry og:image, and Luma serves og:image at 800x420 against JSON-LD's
1920x1920 — the former is already a thumbnail.

**lib/lumaEvents.ts is now lib/eventPages.ts**, with `LumaDetail`/`fetchLumaDetails`/`isLumaEventUrl`
renamed to match. It stopped being Luma-only, and a file whose name lies is worse than a rename.

**THE HOST LIST IS AN ALLOWLIST, AND THAT IS THE WHOLE SSRF STORY.** These URLs come from partners
through an Airtable form. A hostname not in `EVENT_HOSTS` is never fetched, so there is no
169.254.169.254, no localhost, no internal address reachable. HTTPS is required, and each entry pins
the path shape so only public event pages are read. Adding a host is a deliberate act.

Rendered full-bleed at the top of the card on BOTH surfaces, 16:9 with `object-fit:cover` — the four
hosts serve four different ratios and letting each keep its own made a row look ragged. `alt=""`
because the title is right underneath, and `onerror` hides the figure rather than leaving a broken
glyph, since a partner can unpublish at any time.

**Two traps in the embed snippet, both invisible to the compiler**, because it is a template literal
that emits JavaScript as a string:
1. `onerror="...display='none'"` — the raw apostrophe closed the surrounding single-quoted JS string
   and the snippet died with "Unexpected identifier 'none'". Written as `&#39;`; the browser decodes
   it when parsing the attribute.
2. A regex written as `/^https:\/\//i` in the source emitted `/^https:///i`, where `//` began a LINE
   COMMENT and swallowed the closing brace. Needs `\/` in the template. The fix was to derive the
   line from `safeUrl`, which was already escaped correctly.

Neither showed up in `tsc` or `npm run build`. **Generate the embed and parse it** — 
`node:vm`'s `new vm.Script(src)` on the extracted `<script>` body catches both in a second. Baseline
first, so you know whether a break is yours.

Local gotcha: `/api/embed` 409s without `PUBLIC_BASE_URL`. Run
`PUBLIC_BASE_URL=http://localhost:3000 npm run dev` when working on the snippet.

### Policy Stage on the Brella board now comes from Airtable (Auri, 2026-08-07)
"It doesn't have properly made sessions: who is speaking and when. Can you overwrite it just for
policy stage until I tell otherwise?"

**Brella held the entire stage as ONE all-day row** — "Policy Stage: Shaping the Future of European
Startups", with 28 speakers heaped onto it. On a timeline that is the worst possible shape: the column
claims the whole day and tells a visitor nothing about 11:00.

The real programme already existed and nothing was missing from it. `tblSlpTzDi2oVYwqv`, view "The
Policy Stage": 15 sessions, times, types, descriptions, speakers and moderators named per session,
already served at `/api/program?event=policy`. Only the Brella board could not see it.

`lib/policyOverride.ts` substitutes the column: every Brella session in `ROOM_567` is dropped and the
Airtable sessions replace them, merged in `app/api/program/route.ts` beside the side events so every
variant of the endpoint agrees. **It is meant to be deleted** — remove the `mergePolicyStage()` call
and the file when Brella's own entry is filled in.

**THE DAY HAD TO BE ASKED, and the embed is the thing that is wrong.** The Sessions table has NO date
column, only `Time Slot`, because it was typed from a single-day PDF. The agenda embed pasted on
techbbq.dk says "August 26th"; Brella files the all-day block on 27 August. Auri settled it: **27
August**. So Brella's placement was right and **the embed's `HEADING = "August 26th"` still needs
fixing** — it was not touched here.

Verified on the live feed: 15 sessions in the column, all on Day 3, all in the `rooms` section, the
all-day blob gone, moderators listed before speakers, photos present, and `parseSlot()` places the en
dash slots correctly (it already accepted `[-–—]`, so no rewriting was needed).

**The whole-day band came back by EARNING it, not by faking it** (Auri, 2026-08-07: "it misses still
to indicate that it's a whole day event and it's like the policy stage"). Brella's all-day row had
been doing two jobs nobody noticed until it was gone: it drew the dotted whole-day band and it named
the column "Policy Stage". Dropping it took both.

The tempting fix — put a synthetic all-day session back — would have been wrong. The board ALREADY
derives that band for this exact case: a room whose named programme spans morning to evening gets one
without an umbrella row, which is how NISS holds Event Room 2 through eleven sessions. The trigger is
`programme` being set on the sessions. So the sessions now carry it, read from `programmeOf()` in
ROOM_ALIASES rather than typed again, and the same value feeds the column's sub-label.

Verified all three of the band's conditions on the live feed rather than assuming: programme set
(["Policy Stage"]), no real all-day session in the column, and span 570→1020 minutes against the
`spansMorningToEvening` thresholds of ≤660 and ≥960.

Data quirk, not a bug: `Speaker Details` is hand-typed "Name, Title, Company", split on the FIRST
comma. Two rows carry commas mid-title, so one reads "Founder · and former AI & Privacy Policy Manager
at Meta" and another has an empty company. Fix those cells in Airtable, not in code.

### "Founder Stage" → "Founders Stage" on the program board (Auri, 2026-08-07)
The signage, and Brella's own track name, both say **Founders Stage** — the feed returns exactly that
string on 28 sessions. The board printed "Founder Stage" purely because `BRELLA_STAGES` in
lib/brellaSections.ts hardcoded that label. Renamed.

**It was a two-file edit, and the second file is easy to miss.** `STAGE_ICON_PATHS` in
lib/brellaTheme.ts is keyed on the label STRING, so renaming the label alone would have silently
dropped the stage's rocket icon. The COLOUR is safe either way, because `TRACK_STYLES` matches on its
own regex (`^founders? stage`) rather than the label — which is exactly what makes the icon the one
that slips through. A note now sits in both files.

The `match` regex keeps its optional "s", so whichever spelling Brella uses still lands in the column.
Verified by executing both modules directly (`node --experimental-strip-types`): label "Founders
Stage", regex matches, icon resolves to 4 paths, colour still `#37C978`.

Side note for whoever tests the embed locally: `/api/embed` returns **409 "No absolute origin"**
without `PUBLIC_BASE_URL` set. That is a local env gap, not a broken embed.

### Where it ended: all three Prime partners live, pushed as `009d570`
Merged to `main` and pushed, so Vercel redeployed production. `tsc --noEmit` and `npm run build` both
clean before the push. The wall's Prime band now holds:

    Danish Business Authority   https://danishbusinessauthority.dk/
    Industriens Fond            https://industriensfond.dk/
    Novo Nordisk Foundation     https://www.novonordisk.com/

**Novo needed no code in the end.** Auri repointed `Company Link` to `rec8pk7xHskWFvKO2` (Deal
3,125,000), renamed the row back to "Novo Nordisk Foundation" and ticked the box; the formula produced
Prime by itself. Only Industriens Fond and Danish Business Authority are in `TIER_EXCEPTIONS`.

**The DBA row was edited over the API, and NOTHING WAS DELETED.** Rather than removing the two
Virksomhedsguiden files to stop them winning the tie, the new mark was uploaded as
**`white-Danish Business Authority.svg`** — the `white-` prefix is worth +4 in `logoPick`, so it scores
9 against their 5 and wins outright. Non-destructive, and it matches the prefix convention
`scripts/upload-white-logos.mjs` already uses. Prefer this trick over deletion next time. Also set:
`Company` → "Danish Business Authority" (the exception key depends on it), website → the DBA domain.

**No `LOGO_SCALE` for any of the three.** All measure 100% ink and already sit at the `contain` cap:
Novo 5.22:1, DBA 4.25:1, Industriens Fond 12.31:1 (that last one reads short and no nudge can fix it,
the artwork is simply that wide).

### I walked into the build/dev `.next` gotcha, so it is real — reread it
Ran `npm run build` for pre-push evidence and then `npm run dev` on the SAME `.next`. The photo proxy
began returning 500 for every logo, which looked exactly like a bug in the change just made. It was not.
Recovery: stop dev, `rm -rf .next`, restart. Note `TaskStop` on the dev task **left the node process
holding port 3000**, so the "restarted" server came up on 3002 while the broken one still answered
:3000 — kill the PID (`Get-NetTCPConnection -LocalPort 3000`) before concluding anything.

### Nordic Ninja / PropTech / Venture Café (Auri, 2026-08-07)
Asked for `Company Link` on three CRM records. Only ONE needed anything:
- **Nordic Ninja** — already linked (`recrsL54g3Pg8Kq5M`), live in Challenger. No action.
- **Venture Café Warsaw** — already linked and live in Community via `rec4JrqByXKF4BuNI`. It has a
  SECOND marketing row, `rectRGYTjKrZHxKYv`, same Partner ID 1851, unlinked — a duplicate form
  submission. Linking it would have produced a second entry. Delete it instead.
- **PropTech Denmark** — `rec5YdSIgXVVTqCQC` genuinely had no link. Set to `recn3UUCH97aefeT7`
  (Deal 0, Confirmed) → tier now Community. **Still `Put on web: false`**, so still off the wall.

PropTech's logo cell needs a decision before it publishes. Three files, and the tie goes to a
TWO-COLOUR one:

    score 1   PropTech Denmark, colored (dark).svg    #1d2d2e + #26e4b5   near-black, unusable
    score 9   PropTech Denmark, colored (white).svg   #fff + #26e4b5      <-- wins on upload order
    score 9   PropTech Denmark White.svg              #fff                pure white

Both white ones are legible on #0d0d0d, but the rest of the wall is the pure-white set. To switch,
delete the `colored (white)` file rather than adding another name rule to `logoPick.ts`.

### Next steps
Everything below is ANOTHER PERSON'S to do — no code is outstanding. Verified against Airtable at the
end of the session, so these are real as of 2026-08-07.

**Airtable**
1. **PropTech Denmark** `rec5YdSIgXVVTqCQC` — `Company Link` is set and the tier resolves to
   Community, but `Put on web` is still false so it is off the wall. Tick it. Then decide its logo:
   three files, and the tie goes to a TWO-COLOUR one (`#fff` + teal `#26e4b5`) over the pure-white
   `PropTech Denmark White.svg`. To switch, delete the `colored (white)` file rather than adding a
   name rule to logoPick.ts.
2. **Delete `rectRGYTjKrZHxKYv`** — a duplicate Venture Café Warsaw row, same Partner ID 1851 as the
   live one (`rec4JrqByXKF4BuNI`). Unlinked and unpublishable; it is what shows as unresolved on the
   dashboard.
3. **Delete `rec8097GK3Bz4hvHM`** (Bio Innovation Institue) or clear its `Partner ID` — a form
   submission from a company Auri says is not a partner. The ID is what pulls it into the view.
4. **Novo Nordisk Foundation** `reciUJWZD4lX6usnD` — live and correct, but its website field points at
   `novonordisk.com`, the pharma company. The Foundation is `novonordiskfonden.dk`.
5. **Fix two `Speaker Details` cells** in the Policy Stage Sessions table. The format is
   "Name, Title, Company" split on the FIRST comma, and two rows carry commas mid-title, so one renders
   "Founder · and former AI & Privacy Policy Manager at Meta" and another has an empty company.

**Airtable schema, and this one is worth doing**
6. **`Company Link` cannot reach a Confirmed partner.** The field is limited to the "Partner ID Search"
   view (`viw570nYi8Fyzodme`), which holds open pipeline records only — of its 1,934 rows, not ONE is
   `Status 2026 = Confirmed`, and all 169 Confirmed records sit outside it. So the field used to attach
   a partner to its CRM record cannot offer any partner who has signed, which is why Auri "just cannot
   tag them". Fix: uncheck "Limit record selection to a view" on the field, or add Confirmed to that
   view's filter. The API ignores the restriction, which is why the writes this session went through.

**WordPress / techbbq.dk**
7. **The agenda embed's `HEADING` says "August 26th".** The Policy Stage runs the **27th** (Auri
   confirmed). The heading is in the pasted snippet, not in this repo.
8. **Check the side event thumbnails actually render on techbbq.dk.** They point at four third-party
   CDNs (lumacdn, circle.so, eventbrite, nrich). If WordPress sets a CSP `img-src`, they fail silently
   there while working perfectly on the dashboard. Untestable from here.

**Whenever Brella catches up**
9. Delete `lib/policyOverride.ts` and its `mergePolicyStage()` call once Brella's own Policy Stage
   entry has real sessions instead of one all-day row.

### Gotchas
- **The artwork is already correct.** `C:\Users\User\Desktop\TBBQ\techbbq-brand-kit\partners\industriens-fond.svg`
  is pure white (`.cls-1 { fill: #fff }`) and `image/svg+xml`, so it passes publish rule 2 as-is. No
  white-variant export needed, no `AIRTABLE_LOGO_REJECT` entry.
- **`Partner ID` is what puts a row in the view, not `Company Link`.** Airtable exposes no API for a
  view's filter, so this was derived by diffing the 162 in-view rows against the other 3,436 and
  testing predicates. Only one is exact in both directions:

  | predicate | false + | false − |
  |---|---|---|
  | `Company Link` not empty | 0 | **5** |
  | `Partner ID` not empty | **194** | 0 |
  | **`Partner ID` not empty AND `Created` in 2026** | **0** | **0** |

  `Company Link` merely LOOKS perfect: it is filled on 157 of the 162 and on nothing outside the view.
  Five in-view rows have no link at all (Crescita Partners, Bio Innovation Institue, ESA BIC Denmark,
  PropTech Denmark, Venture Café Warsaw), and 72 rows created this month sit OUTSIDE the view with an
  empty `Partner ID`. So the two fields do different jobs and you need both:
  **`Partner ID` gets the row into the view · `Company Link` gets it a tier.** A row with the link and
  no ID is invisible to this codebase, which reads the view and nothing else.
- **`Partner ID` mirrors the linked CRM record's** — 24/24 on the rows checked. It is a plain `number`
  field on Marketing Project Overview (not a lookup, not a formula), so it must be TYPED IN. It is not
  unique either; 7 values are duplicated across the view.
- **`Company Name` is not the field to fill.** It is empty on all 162 view rows; the code reads
  `Company`. Filling the wrong one produces a row that is in the view and still invisible.
- The Airtable token can write (`scripts/upload-white-logos.mjs` appends attachments with it), so the
  API route is available if the manual one is ever too slow.

### Files touched this session
- `lib/partners.ts` — `TIER_EXCEPTIONS` gained Industriens Fond and Danish Business Authority.
- `lib/brellaSections.ts` — "Founder Stage" → "Founders Stage", plus the note that the label is a
  two-file rename.
- `lib/brellaTheme.ts` — `STAGE_ICON_PATHS` key renamed in lockstep.
- `lib/policyOverride.ts` — NEW, and meant to be deleted. See step 9.
- `lib/eventPages.ts` — WAS `lib/lumaEvents.ts`. Host allowlist + `og:image`.
- `lib/sideEvents.ts`, `lib/program.ts` — carry `image` through to the feed.
- `lib/brellaEmbedSnippet.ts` — `thumb()` / `imgSrc()` and their CSS.
- `app/api/program/route.ts` — the Policy Stage merge, and `program:policy` added to `?fresh=`.
- `app/brella-program/page.tsx`, `app/globals.css` — the card thumbnail.

Commits: `009d570` `e415303` `38c65d5` `22a3cea` `2613d7e` `a211a69`, all on `main`.

## Session 2026-08-06 · Brella Event Rooms rebuilt, partner backfill, Skytek, cadence

State: DONE, all pushed to `main` (`0916ccf` → `19cb94c`). `tsc --noEmit` + `npm run build`
clean. Everything verified over CDP on **both** the dashboard and the executed embed.

### The one that cost the most time — three caches, and the wrong one answering
A rename (NISS → "Nordic India Startup Summit") shipped, the server returned the new name, and
the board kept printing the old one **across reloads**. Cause: the feeds send
`stale-while-revalidate=3600` for techbbq.dk, and **a browser honours that as readily as a CDN
does**, so `useCachedList`'s own revalidation was answered from Chrome's disk cache with a copy
up to an hour old — and then wrote that stale copy into localStorage as if it were fresh.

Caught it in the network log: **two requests per load, the first `fromCache: true`**. Fixed with
`cache: "no-store"` on the revalidation (dashboard only; techbbq.dk keeps SWR).

**The reason it took so long to see:** every CDP test used a fresh `--user-data-dir`, so the
stale-cache path was never exercised. **If a dashboard change "doesn't appear", test with a
persistent browser profile before touching the code.**

### Brella program — Event Rooms are now a timeline
Was a card list. A room is a PLACE: at 14:00 exactly one thing is on in it, and the shape of the
day is the information. Columns are explicit (`BRELLA_ROOMS`), so an empty room shows rather
than vanishing: **Event Room 1–6 + "Event Room 5,6,7"**.

- **Event Room 6** is real and has **no Brella track** — Deep Tech Event Day is going in it.
  Declared anyway, and pre-matched in `ROOM_ALIASES`, so it lands correctly the day the track
  appears. Empty rooms read **"Information coming soon"**, not "Nothing scheduled".
- **Rooms 5,6,7 is one space.** The column was named "Policy Stage" (the programme, not the
  place). Watch the regex: `/^event room 5\b/` also matches "Event Room 5,6,7" and `columnOf` is
  first-match-wins, so Room 5 needs the `(?!\s*,)` lookahead or the combined space lands in it.
- **Future of Fintech was filed in Event Room 1. It is Room 3** — 8 sessions were in the wrong
  room. Root cause: the room and its label lived in different places and only one was
  maintained. `ROOM_ALIASES` now carries both, so a programme cannot move without its label.
- **All-day sessions span the whole column**, dotted, drawn BEHIND the timed cards (z-index 0).
  They are nested, not competing — Room 1 runs nine sessions inside its all-day Board Summit.
- **A programme that fills the day gets the band even with no all-day row.** NISS occupies Room 2
  09:30–17:30 with eleven sessions and no umbrella row, so the band is derived from the
  programme + its own sessions' span.
- **Morning-to-evening counts as all day** (start ≤ 11:00 AND end ≥ 16:00). Auri chose the strict
  both-ends rule over lowering the 6h cap: Nordic IPO (12:30–17:30) runs to the close but starts
  after lunch. **Matches nothing in the 2026 data yet** — deliberate.
- **Label what is RUNNING, not what is registered.** Room 2 is registered to NISS and NASS; NASS
  has no track, so the board named a summit that was not on. `ProgramSession.programme` now
  survives the `roomAlias()` fold. NASS has no track at all, so it is identified by **room +
  date** (`ROOM_DAY_PROGRAMMES`): Room 2 = Nordic India on the 26th, **Nordic Africa on the
  27th**. A real track always wins over that rule.
- Board opens at **09:00** for rooms only, so the band's label clears the first card (90px).

### Brella program — everything else
- **Speaker search.** Dims, never filters — removing cards collapses the columns and the clock
  stops lining up. Predicts PEOPLE with their day and stage, jumps day on pick, badges the day
  tab and stage headings.
- **Cards are faces-only.** Names moved to the dialog; a `+N` chip carries the overflow. The
  `data-tight` tier is gone with the row it hid.
- **Moderators ringed.** Needed a second change to mean anything: `orderedSpeakers` puts them
  last, which hid the chair on **45 of the 73** sessions that have one. A panel now shows one
  speaker plus the chair. 43 rings where there were 0.
- **Tag filter (Event Rooms).** The feed kept ONE tag and discarded the rest; `tags` now carries
  up to three. Chips are built from tags actually present, ANY not ALL, max three.
  **Only `Nordic-India` exists on the whole rooms board** — the filter needs tagging in Brella.
- **Stage openings** highlighted in each stage's own colour; **breathwork now takes its stage's
  colour too** (told apart by icon + badge, not hue).
- Dialog shows **"Day 1 (26 August)"** next to the time.

### Partners
- **`?kind=partners-bare`** — unstyled embed for an outside agency (4KB vs 48KB), and
  **`/api/partners` in `API_SNIPPETS`** for one that builds in its own framework. Prod CORS is a
  real allowlist (`techbbq.dk`, `staging.techbbq.dk`) — a foreign origin gets the canonical
  domain echoed back and is blocked. Server-side fetches are unaffected.
- **45 partners backfilled** into the Marketing view from the Brella sponsor list (`external-id`
  IS the Partner ID). All `Put on web = false`; tier comes from `Company Link` → deal size, so it
  stays correct on its own. **28→30 logos** attached from `tbbqvisualgen/public/logos`.
  **15 still need one, incl. NVIDIA.**
- **Mistake to learn from:** 14 of the first 45 duplicated rows that already existed in the
  TABLE but sat outside the VIEW. Compared against the view and treated "not in the view" as
  "not in Airtable". Deleted them (backup in scratchpad). **Check the table, not just the view.**
- **`TIER_EXCEPTIONS` — Skytek is Core.** Its Deal 2026 is 0, so the formula can only say
  Community. Distinct from the deleted corrections table and from `NO_CONTRACT_TIERS`: that one
  FILLS a missing tier, this one REPLACES a resolved one. Bar for adding: the deal cannot express
  the tier, not someone disagrees with it.

### Team, cadence, menu
- **`/api/team?email=0`** + a "Copy embed (no emails)" button. The embed's `email` flag only
  stopped it DRAWING addresses; the JSON still carried all 27. Two changes, because "do not
  show" and "do not send" are different promises.
- **`HOURLY_FEEDS`** in `lib/cachePolicy.ts` — `/api/fintech-speakers` held at 1h regardless of
  the event window, by request. Standing until told otherwise; delete the string to revert.
  Warranted: that table is form-filled at ~1 entry per 2 days.
- **Front page** gained a "How often this updates" box that READS from `cachePolicy` (a typed-out
  "30 minutes" becomes a lie on 28 Aug), and an **Event Rooms** menu group so the hub sorts by
  place rather than topic.

### Traps hit, worth not re-learning
- **`lib/brellaEmbedSnippet.ts` is ONE template literal.** A backtick in a comment is a syntax
  error. Hit three times.
- **`var` inside a callback is not visible to its caller.** `INSET` (declared in the per-card
  loop) and `colKey` (a local of `renderTimeline`) both threw ReferenceErrors that silently
  killed a column's markup / aborted a click handler. **Read the browser console, not the DOM.**
- **Do not `npm run build` while `next dev` is running** — the build rewrites `.next` under it
  and the dev server 500s. Stop dev, build, then restart. Cost two "Internal Server Error"
  reports.
- **Brella JSON:API types are SINGULAR** (`tag`, `track`), and `included` only populates with
  `Accept: application/vnd.brella.v4+json`.

### Open
- 15 partner logos outstanding (NVIDIA the notable one); Sustainary + Novo Nordisk have JPEGs,
  which the wall rejects (needs white SVG/PNG).
- 7 Brella sponsors unmatchable: 5 with a blank Partner ID, 2 with six-digit typos
  (`137801` → `1378`). **Fix in Brella, not Airtable.**
- 6 duplicate Partner IDs pre-existing in the Marketing view — not ours, would double a logo.
- Event Rooms are barely tagged; the tag filter is thin until that is done in Brella.

## Session 2026-08-01 (Team embed "Could not load right now." — diagnosed + hardened)

State: DONE, committed, NOT pushed. `tsc --noEmit` + `npm run build` clean. **The symptom
self-resolved before a fix shipped**, so the diagnosis below is inference from evidence, not
a reproduction of the live failure — treat the retry as prevention, not a proven cure.

### What was ruled OUT (with evidence, not assumption)
- **The API.** `/api/team` answered **12/12 200s at ~0.2s**, valid JSON, 27 people, correct
  `access-control-allow-origin: https://techbbq.dk`, and a clean 204 OPTIONS preflight. Every
  other feed was 200 at the same moment.
- **The snippet builder.** The team snippet was generated exactly as the dashboard's Copy
  button emits it, pointed at the PRODUCTION feed and EXECUTED: 27 cards, 27 mailto links,
  10 department pills. It bakes the right endpoint.
- **Rate limiting** (Auri's guess, and a reasonable one). **75 rapid requests from one IP
  produced zero 429s.** Reason worth remembering: `/api/team` carries `s-maxage=86400`, so
  Vercel's CDN answers almost everything and `rateLimit()` never runs. The per-IP limiter is
  effectively unreachable for a cached GET.
- **Origin mismatch.** The console dump showed `https://techbbq.dk/wp-json/...`, i.e. the
  apex domain, which matches `ALLOWED_ORIGIN` exactly.

### The likely cause: cold-cache timeout on the one feed with no retry
`lib/team.ts` used the **default 8s** `fetchWithTimeout` and, alone among the slow feeds
(`hierarchy`, `summitextras`, `investors`, `mainpage`), had **no retry**. Session 30e had
already written the prediction: *"if the team page fails intermittently in prod, give it the
same 10s + one retry treatment."*

`#TechBBCuties` is a wide table — normally ~1s, but it spikes past 8s on a cold Airtable.
This bites `/api/team` harder than anywhere else because it is cached for a **full day**
(`DAY_MS` + `s-maxage=86400`): cold misses are rare, but each one is a deploy or a 24h
rollover, and there is **no stale value to fall back on**, so one blip surfaces on techbbq.dk.
The timing fits — the message appeared shortly after the `4ffb1d2` merge deploy, which resets
the in-memory cache, and it recovered on its own once a request succeeded and re-cached.

**Fix:** `TEAM_TIMEOUT_MS = 10_000`, `TEAM_ATTEMPTS = 2`, matching `lib/hierarchy.ts`. A
`TeamError` (503 missing env / 502 Airtable rejection) is deliberately **not** retried — only
a timeout or network abort is. Verified: a bogus token yields 502 with **0 retry attempts**.

### Separate real bug found while diagnosing: the embeds swallowed their errors
Both `lib/embedSnippet.ts` and `lib/agendaSnippet.ts` ended with
`.catch(function(){ ..."Could not load right now."... })` — **discarding the error**. That is
why Auri's console showed nothing from the embed: a CORS rejection, a 429, a 502 and a
snippet still pointing at localhost were all indistinguishable. Both now
`console.error("[tbbq-embed] failed to load", ENDPOINT, err)` — the endpoint included,
because a stale paste looks exactly like a server fault without it.
**Reaches techbbq.dk only on a re-copy.**

### Reusable finding
Reproducing the exact symptom is easy: serve the generated snippet from any origin that is not
`https://techbbq.dk` and CORS alone yields **0 cards + "Could not load right now."** With
`--disable-web-security` the same page renders all 27. That is a fast way to tell a CORS
problem from a data problem without touching the live site.

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
