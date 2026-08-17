# Progress archive · TechBBQ Airtable Connector

Sessions from **2026-08-13 and earlier**, moved out of `progress.md` on 2026-08-17 so the live
handoff stays readable. Nothing was edited or deleted — this is the tail of that file, verbatim.

`progress.md` keeps the recent sessions. Look here for anything older, and note the heading styles
drift over time (`## SESSION`, `## Session`, `## SUPERSEDED`, `## STATE`).

---

## STATE, as of 2026-08-13 evening · READ THIS FIRST

**Session (o) is COMMITTED, PUSHED and DEPLOYED. Working tree clean.**

- `ff3d924` — the whole programme/agenda body of work below (NASS on the board, NISS moved + locked,
  face matching, moderator ordering, the gaps panels, the duplicate-key crash).
- `8287a16` — a PARALLEL session's `/ls-startups` logo wall (final-size rows with "More soon" slots,
  the 5 + 5 + 6 grid). Committed separately so history stays honest; not reviewed line by line here.

Verified on production after the deploy:

| | |
|---|---|
| Investor Day | 9 sessions · **15/15 faces** · reconciled against its planning sheet |
| Board · Event Room 2 · 27 Aug (NASS) | 21 sessions · 17 with people · **46/51 faces** · starts 09:25 |
| Board · Event Room 2 · 26 Aug (NISS) | 12 sessions · 11 with people · **36/36 faces** (Brella's own) |
| `/api/program?event=niss` | 13 sessions · **2 publishing names, 9 withheld by the lock** |

**WRITTEN TO LIVE SYSTEMS TODAY, none of it undoable by a git revert:**
- **Brella**: 38 speaker records created (#423709–#423746). 34 carry a photo.
- **Airtable**: the `Session Status`, `Session Lineup` and `Session Moderators` fields; 13 NISS rows
  in the Sessions table; Christina Egelund's CRM row; and ~10 cell edits across NASS and Investor Day.

**STILL MANUAL, nothing can script it**: the ~50 Brella speaker→session links. Brella's integration
API has no speaker-assignment route. `node brella-push-nass.mjs --event=nass --plan` prints the
checklist with each timeslot id.

### WHAT WAS JUST DONE (session o)

Brella had 21 rows for Event Room 2 on 27 August and **not one named a speaker**. The summit's real
programme is the Airtable one (Sessions table, `Name of the Event = "Nordic Africa Startup Summit"`),
already served at `/api/program?event=nass`: 22 sessions, 17 with people, 52 seats, 44 faces. Only
the board could not see it.

- `lib/nassOverride.ts` · `mergeNassStage()` SUBSTITUTES that column, exactly as the Policy Stage is
  substituted. Not a merge: the two sources disagree on titles ("Africa's Diplomatic Corps &
  Innovation Diplomacy" vs "Diplomacy as a Catalyst for Collaboration in Innovation"), Brella is
  missing the 15:35 Investor Reverse Pitch and carries the 16:35 reception twice, so pairing them
  would print the day twice under two names.
- **SCOPED TO 27 AUGUST ONLY.** Event Room 2 runs NISS on the 26th and NASS on the 27th. NISS is
  still being finalised, so the filter is `room === "Event Room 2" && day === NASS_DAY` and Brella's
  Day 2 column is untouched (Auri, 2026-08-13).
- `lib/stagePeople.ts` · `toSpeaker()` moved out of `policyOverride.ts` now that two stages need it.
  Pure extraction, no behaviour change.
- `app/api/program/route.ts` · third merge after side events and the Policy Stage, with its OWN
  try/catch so a failing NASS read cannot take the other two down, plus `invalidate("program:nass")`
  on a live-read or the refresh button would report no change on the column just edited.

Verified on the local feed: Event Room 2 is 34 sessions — Day 2 twelve (1 with people, unchanged),
Day 3 twenty-two (17 with people, 52 seats, 44 faces), labelled "Nordic Africa Startup Summit". The
board's own "which rooms still look incomplete" panel now lists Event Room 2 for 26 August only.

### PART 2 (session o) · faces 44 → 48 of 53, and the Brella push script

**Airtable edits made (all approved by Auri in the moment):**
- `recSWT4PB14SaggIu` 09:25 · both MCs are now two people in one session:
  `Charles Kinga, Head of Africa at TechBBQ · Natalie Becker, Partner, Producer at Thought Leader
  Global and Africa`. The row had NO photo attachments, so nothing could be mispaired by splitting.
- `recNDdg8EQ6Cl5FYE` 09:45 · "Amb. Diane Gachumba" → **"Dr. Diane Gashumba"** (roster spelling).
- `recnD5KWO7Jz2Z70L` 12:45 · "Ismael Eleburuike" → **"Ismail Eleburuike"**.

**Matcher fixes in `lib/programFaces.ts`, all three real bug classes:**
- `pairKey()` · first + SECOND-to-last word, for a double-barrelled surname. "Natalie Becker" on the
  agenda now finds "Natalie Bridgette Becker-Aakervik"; shortKey folded that to "natalie aakervik".
- `lookupKeys()` · also tries the agenda name with leading given names dropped, so "Charity Wanjiru
  Kiarie" finds "Wanjiru Kiarie". The mirror image of the middle-name case.
- `rosterKey()` · strips a role in SQUARE brackets, not just round ones. `Sherif Kesseba
  [Moderator]` folded to "sherif kesseba moderator" and could never have matched anything.
Both new keys are clash-guarded like the existing loose ones: if two people share a loose key,
neither gets it. Verified the two new matches point at the right records (`recoy5z4fEseLyqpX`
Natalie, `recfksWStq15MWzk1` Wanjiru Kiarie) rather than at a lookalike.

**WHERE THE REMAINING NASS GAPS ACTUALLY ARE** — the question Auri asked, answered by scanning both
sources in full (3,765 CRM rows, 2,185 Ticketing Forms rows), not just the curated slices:
- **Sherief Kesseba is the UMBRELLA case.** `rec4493pvo5qcg6h1` in Ticketing Forms, headshot
  uploaded, but created **27 June 2025** via the *Investor Dinner Application 2025* form — his
  company sits in the field `Company Name Investor Dinner`. He is NOT in "Nordic-Africa Summit
  Presenters" (45 rows) nor "NASS Presenters 2026" (45 rows), which is why nobody could find him:
  he only shows in the unfiltered 2,185-row views. Tick him into the presenters view and align
  Sherief/Sherif, and his face appears.
- **Lamiaa El Rashidy and Gabriella Mukamugema are genuinely absent** from both tables.
- **Impact Fund Denmark** and **LOUNGE VIBE (DJ MUSIC)** are not people and never get a face.

**`brella-push-nass.mjs` · NEW, NEVER RUN WITH `--commit`.** Third sibling of `brella-push.mjs`
(grills) and `brella-push-niss.mjs`. Reads the connector's own `/api/program?event=nass` rather than
Airtable, so the name/title/company/photo parsing is not reimplemented and cannot drift from the
board. Dry run and `--plan` both exercised:
- 50 people · **42 would be created**, 8 already in Brella (matched by word-subset, so no
  duplicates: "Natalie Becker" correctly found Brella's #416871 "Natalie Becker Aakervik")
- 3 held back: the two non-people plus **"Kurt Gammelgaard Nielsen?"**, whose name ends in a literal
  question mark and would publish that way (cell `recj5DlhzmN1gPQu0`, the 16:05 panel)
- `--plan` matched **16 of 17** sessions to a Brella timeslot id BY START TIME, not title, because
  the two systems disagree on 8 titles; Brella's title is printed whenever it differs
- **50 links to make BY HAND.** The integration API has no speaker-assignment route (established in
  `brella-push.mjs`), so this is the one part no script can do.

### PART 3 (session o) · the registration row, and the all-day band question

- `lib/nassOverride.ts` · `SKIP_ON_BOARD` drops **"Registration, Coffee & Small Talk" (09:00–09:20)**
  from the Brella board. It exists in Airtable and NOT in Brella, whose Event Room 2 day starts at
  09:25, and because this column is substituted wholesale it showed a session the attendee app does
  not have. BOARD ONLY: the Airtable row stays, so the agenda embed still tells visitors when to turn
  up for coffee. Delete the row instead if it should go everywhere. Board is now 21 sessions,
  starting 09:25 (Auri, 2026-08-13).
- **The "ALL DAY · Nordic Africa Startup Summit" band could NOT be reproduced as missing.** Measured
  every precondition (`components/ProgramTimeline.tsx` ~742) against the real feed on BOTH localhost
  and production: `programme` set on all sessions, zero all-day rows in the column, zero shells,
  span 09:25→18:05 which clears `spansMorningToEvening` (start ≤ 11:00, end ≥ 16:00). All four hold,
  on both. The embed renderer (`lib/brellaEmbedSnippet.ts` ~1031) carries the same rule and passes
  too. Confirmed in the browser: the page text reads
  `Event Room 2 / Nordic Africa Startup Summit` then `ALL DAY / Nordic Africa Startup Summit`.
- **Most likely what Auri saw: the board opens on DAY 1 (26 August)**, where Event Room 2 correctly
  bands as *Nordic India*. The NASS band only exists on the 27th. Worth knowing: the day tab took
  three attempts to switch under browser automation, so if it is also flaky by hand that is the thing
  to chase, not the band. Ask for a screenshot before touching the band logic.

### PART 4 (session o) · the two "not a person" entries, looked at properly

Both were seats that no headshot could ever fill, but for DIFFERENT reasons, and one was my misread:

- **16:35 reception, `recT1bcwCc7hlj9c0`** · the cell read
  `Gabriella Mukamugema, Mof!yah Entertainment · LOUNGE VIBE (DJ MUSIC)`. The ` · ` is the PEOPLE
  separator, so the note about the music was parsed as a second person and I reported it as one.
  Auri read it correctly: one human, from Mof!yah Entertainment, playing the lounge set. Cell is now
  `Gabriella Mukamugema, DJ, Mof!yah Entertainment` — "DJ" moved into the job-title position so the
  card reads "DJ · Mof!yah Entertainment" instead of putting the company where a title belongs. The
  reception is one seat now, not two, and NASS is **48/52**.
- **10:45 panel, `recqA4kx39atWeDlj`** · `Impact Fund Denmark, Danish Company Representative` is a
  TBA PLACEHOLDER, not an organisation typed into the wrong cell: a seat held for a representative
  nobody has named. Stays held back in `brella-push-nass.mjs` until it has a human's name. The
  session's moderator, Charlotte Holst Frahm, is from the same organisation, so it is a second seat
  rather than a duplicate of her.

### PART 5 (session o) · the gaps note on /program

`app/program/page.tsx` · new `ProgrammeGaps` panel, drawn above the agenda on the NASS tab in the
same amber `ev-gaps` style /partner-events and /investors already use. Auri asked for the missing
details to be written on the page rather than left in a chat message.

HALF COMPUTED, HALF WRITTEN DOWN, on purpose. WHO is missing a face is read from the feed on every
load, so a line removes itself the moment a headshot lands in Airtable. WHY each one is missing
cannot be computed — it took a scan of 3,765 CRM rows and 2,185 form rows — so those sentences live
in `GAP_NOTES` keyed by name, with a plain fallback for anyone who shows up later. `GAP_FOOTNOTES`
carries the two facts no session row can hold: the missing 15:35 Brella timeslot and the eight
diverging titles. Only events with an entry render anything; every other agenda shows nothing rather
than a panel announcing zero problems.

**Also found: `/program` ignores `?event=` in the URL.** The event tabs are local state only, so
`/program?event=nass` opens on NISS 2026 and the tab has to be clicked. `/investors` reads its param
properly (that was fixed there earlier). Not fixed here — nobody has asked, and it is a one-line
`useSearchParams` change if it ever annoys anyone. Worth knowing when sharing a link to an agenda.

### PART 6 (session o) · NISS publishes a line-up only when the session is LOCKED

Auri's rule (2026-08-13): the NISS times and titles are settled, the people on several panels are
not. A session shows its speakers once it is locked; until then it shows time + title + description
with nobody named, so an outreach target cannot read their own name on techbbq.dk before saying yes.
The planning sheet tracks this in a free-text Notes column ("Status: Locked. session brief shared"
against "Adele and Sara are under outreach"), and the sheet is PRIVATE — the API gets a 401 and
publishing it is not an option, it carries outreach notes about ministers. So the status moved into
Airtable, which is what the site can actually read. Auri chose this over hardcoding.

- **NEW AIRTABLE FIELD** `Session Status` (`fldH8fD3f3w1IbLa3`) on the NISS table
  `tblfIPjV4t1c1628h`: single-select, `Locked` / `Not locked`, with the rule in its field
  description. Seeded across all 13 programme rows from the sheet: **Locked on the two the sheet
  marks verbatim** (10:05 Nordic Founders, 10:30 Indian-Origin Founders), Not locked on the rest.
- `lib/program.ts` · a source can now carry a LINKED line-up rather than typed text cells:
  `fields.lineup` (the link), `fields.status` + `lockedValues` (the gate), `fields.lineupName` /
  `lineupTitle` / `lineupCompany` / `lineupRole` / `lineupPhoto`, and `lineupPhotoFeed`. The linked
  people are resolved in ONE extra paged read after the sessions (they live in the same table), not
  one request per session, and a failure is swallowed — an agenda without names is the state half
  the programme is in anyway. Role decides moderator vs speaker; `meta` is built as "Title, Company"
  so every renderer treats a linked person exactly like a typed one.
- `app/program/page.tsx` · the gaps panel now also covers NISS, explaining the rule and that ticking
  Locked is the whole action.

Verified: 13 sessions, **2 publish a full line-up (8 people, 8 faces)**, 11 show time + title with no
names. No other agenda moved (policy 34/34, techbbq and fintech carry no people).

**BLOCKER for the "small description" half of the ask: `Session Description` is EMPTY on all 13
rows.** The descriptions exist only in the planning sheet, so an unlocked session currently shows a
title and nothing to read behind it. Copying them into Airtable is a person's job, not a script's:
the sheet cannot be read programmatically.

**⚠️ SOMEBODY IS EDITING NASS LIVE.** The 12:45 "Digitization, Data & Cross-Border Execution In
Africa" speaker cell (`recnD5KWO7Jz2Z70L`) changed mid-session from
`George Gachui, Co-Founder & Director, MOOKH Africa · Ismail Eleburuike, Founder & CEO, SchoolTry`
to just `Sherief Kesseb` — one name, no title, misspelled, and he is already a speaker on the 15:35
session. Two faces lost, NASS went 48/52 to 46/51. Looks like a paste into the wrong row. The old
value is recorded here so it can be restored; not restored unilaterally, it is somebody's live edit.

### PART 7 (session o) · NISS moved into the Sessions table

NISS was the ONLY hand-typed agenda outside `tblSlpTzDi2oVYwqv` — NASS (22), the Policy Stage (15),
the Board Summit (14) and the six Side Events (45) were all already there. Auri asked for it to join
them in the "Event Rooms" view (`viwrTVxvTBucbJW7S`), which now reads 64 rows including 13 NISS.

**THE PEOPLE DID NOT MOVE, and that was the condition for doing it.** The Sessions table stores a
line-up as TEXT in `Speaker Details`, which is what cost NASS five faces in one day (a middle name,
a double-barrelled surname, two misspellings, a role in square brackets) plus one accidental
overwrite. NISS keeps its people as a LINK, so there is no name to match at all.

- **Two new fields on Sessions**: `Session Lineup` (`fldTz7TOCuKQqjEsF`, link → the NISS table) and
  `Session Status` (`fldDpfNFim6HzFB9y`, Locked / Not locked).
- **13 rows created**, `Name of the Event = "Nordic India Startup Summit"`, `When Is it = Day 1`,
  `Event Room = Event Room 2`, links and status carried across from the NISS table.
- `lib/program.ts` · the `niss` source now reads Sessions with a filter, and `lineupTable` points the
  people lookup at the NISS table. Those people are fetched BY RECORD ID (`OR(RECORD_ID()=…)`,
  chunked 50) rather than by paging the NISS table, which holds every sign-up — a full scan to find
  eight people would read thousands of rows on every cache fill.

Verified from the new source: 13 sessions, 2 locked and publishing 8 people with 8 faces, 11 showing
time + title only.

**TWO THINGS LEFT UNDONE, both deliberate:**
1. `India Shark Tank` and `Nordic Founder Pitch` have **no Session Type**. They are pitch sessions
   and the shared select has no such choice; the API CANNOT add one (`PATCH` a select's options →
   422 "Changing a field's type or number precision is not currently supported"). Adding "Pitch
   Session" is a UI action. Left blank rather than mislabelled as "Panel".
2. **The old rows in the NISS table's "NISS Program 2026" view are no longer read.** They were left
   in place, not deleted — they are the NISS team's originals. If that team keeps editing there, it
   will silently drift from what publishes. Tell them the Sessions table is the live copy now, or
   clear the old view.

### PART 8 (session o) · WRITTEN TO BRELLA · 38 speaker records created in the LIVE app

`brella-push-nass.mjs` is now parameterised (`--event=niss|nass`, default nass) since both summits
read their programme from the connector's own feed. Run 2026-08-13 with Auri's go-ahead.

- **NISS: nothing to do.** All 8 people from its two locked sessions were already in Brella. Kunal
  Singla and Zenia W. Francker were NOT pushed — their sessions are Not locked, which is the gate
  working as designed.
- **NASS: 38 created** (#423709–#423746), 9 already there, 2 held back (the TBA placeholder and
  "Kurt Gammelgaard Nielsen?"). The event now holds 538 speakers.
- **34 of 38 carry a photo.** The 4 without are exactly the 4 known faceless people.

**A REAL TRAP, caught on the first record and worth remembering: BRELLA FETCHES THE PHOTO ITSELF.**
The first commit ran with `FEED_BASE_URL=http://localhost:3000`, so the photo URL handed to Brella
was a loopback address. Brella resolved it against its OWN machine, found nothing, and created
Charles Kinga (#423709) with `photo-url: null` — silently, with a 201. Nothing in the response says
the image failed. Fixed by splitting `PHOTO_BASE_URL` from `FEED_BASE_URL` in the script, with a
loopback rewrite so it cannot happen again, and #423709 was patched with the correct URL.

**A DUPLICATE HUMAN NOW EXISTS IN THE LIVE APP, as a direct result of the 12:45 overwrite:**
`#423722 "Sherief Kesseb"` and `#423741 "Sherief Kesseba"` are the same man. The first came from the
damaged cell. Deleting #423722 needs Auri's word — it is a destructive write to the public app.

**STILL MANUAL: the 50 session links.** Brella's integration API has no speaker-assignment route.
Run `node brella-push-nass.mjs --event=nass --plan` for the checklist with timeslot ids.

### PART 9 (session o) · moderators are listed FIRST everywhere

The Brella board was the odd one out: `/program`'s OnStage groups and the agenda embed have always
led with the chair, while the board sorted moderators LAST — a deliberate old choice ("a card with
room for two names should spend them on who is talking"). Auri reversed it on 2026-08-13: the chair
is what you look for first when reading an agenda.

- `components/ProgramTimeline.tsx` · `orderedSpeakers()` comparator flipped, and the DETAIL DIALOG
  now runs through it too — it was rendering `s.speakers` in raw source order, so a Brella session
  could show its moderator anywhere in the list.
- `lib/brellaEmbedSnippet.ts` · the same flip in its own copy, `ordered()`. That renderer is a string
  of JavaScript sent to WordPress and cannot import from the app, so the two must be changed together
  or the pasted embed drifts from the dashboard.
- Both face-stack rules were inverted with the sort: the stack used to guarantee the chair a slot,
  and now guarantees a SPEAKER one, so a session chaired by two people cannot show two chairs and
  nobody talking.

Verified by running both comparators, lifted verbatim, over the real feed shape: identical output,
moderators first, stable within a role.

### PART 10 (session o) · the NISS tab names every session still to be locked

`lib/program.ts` · new `ProgramSession.lineupPending`, set when a session HAS linked people that the
lock is withholding. It says "more is coming here", which a break will never have — and it exposes
nothing about WHO those people are, so the public feed gives away no unconfirmed name.

`app/program/page.tsx` · the gaps panel leads with that list, read from the feed on every load:

> **9 sessions not locked yet** · the people are already linked, they just do not publish until
> `Session Status` reads Locked. Tick one and its speakers appear on the next refresh:
> 09:30 Opening · 10:55 Nordic VC Outlook · 11:25 Denmark–India Venture Corridor · 12:00 Inside
> India's VC Ecosystem · 13:20 India Shark Tank · 14:55 Nordic Founder Pitch · 16:00 From Research
> to Market · 16:30 Foundations for Cross-Border Innovation · 17:00 What the Corridor Needs Next

The two breaks (Arrival, Lunch) are correctly absent: they are unlocked too, but nobody is waiting on
them, and listing them would bury the nine that need chasing.

### PART 11 (session o) · duplicate React key on the Brella board

`components/RoomGapsPanel.tsx` keyed each finding on `kind + day`, which is NOT unique:
`lib/roomGaps.ts` finds "no-speakers" down TWO independent paths — once per speakerless SHELL
(`u.name — N sessions and not one names a speaker`) and once for the speakerless STANDALONE sessions
around it (`… — no speakers listed`). Event Room 2 on 26 August hit both and React threw
`Encountered two children with the same key, "no-speakersDay 2 · 26 August"`.

Both lines are worth keeping: they name different sessions. So the key became
`kind|day|detail|index` — `detail` is what actually distinguishes them, the index is a last resort —
and a fingerprint on `room|day|kind|detail` drops only a finding identical in all four, which would
be a genuine repeat.

Latent since the shell rule was added; nothing today caused it, the Event Room 2 data just started
satisfying both paths at once.

### PART 12 (session o) · Investor Day reconciled against its planning sheet

Source: "Investor Day 2026 Program", Main Stage tab
(`1f_FZwuDh1tHnKiRhwrUvvWTGCs-zLeSsPe-TWyfVn5U`, gid 718177690). Read through the browser —
`/export?format=csv` 401s on these sheets, `htmlview` renders the grid and screenshots read cleanly.
Its Status column is per PERSON (Confirmed / In process / Not Started), not per session.

**Applied (everything the sheet marks Confirmed):**
- `recgqJmaK9HHl2x0N` 13:23 · Stine Mølgaard was listed as moderator AND as a speaker on her own
  panel, so she rendered twice on one card. Removed from Speaker Details.
- `rec8Q4bYMjgrW3Ijt` 13:56 · same defect, Alexis Horowitz-Burdick. Removed.
- `recpf9B5ZbEyfPL7Z` 14:29 Private LP Panel · moderator was **Lars Frølund**, the sheet says
  **Frederik Hasling**. Swapped; Lars moves to session 7, which is where the sheet puts him.
- `rec5WhCce942RR9jO` European Tech Sovereignty · moved **15:25–15:50 → 15:43–16:13**, moderator
  Alexis → **Lars Frølund**, and **Mads Krogsgaard Thomsen (CEO, Novo Nordisk Foundation) added**.
- `recSWE6SJUOIjhz8a` Close · 16:22 → **16:16**.

Verified after: 9 sessions, **15/15 faces**. Christina Egelund's headshot has landed since this
morning, so the row created for her earlier is complete.

**HELD BACK — everything the sheet does NOT mark Confirmed. Not published, awaiting Auri:**
1. **A whole session is missing from Airtable**: 15:25–15:40 Keynote, Christina Egelund, *In
   process*, and its Topic cell is EMPTY in the sheet. That is why the day now jumps 15:22 → 15:43.
2. 13:10 "Welcome to Innovation District Copenhagen" · the sheet names **David Dreyer Lassen**
   (Rektor / Vice-Chancellor, University of Copenhagen), *In process*. Airtable still says
   "To be announced", so the keynote publishes with nobody on it.
3. "Built in Europe" S4 = **EQT**, *In process* — an organisation, not a person.
4. Private LP Panel S1–S3 · **Not Started**, nobody named. Three "To be announced" placeholders.

Note the sheet's Format column calls sessions 2 and 3 "Keynote" while listing M + S1..S4 on each;
Airtable calls them Panels, which matches the shape. Left as Airtable has it.

### PART 13 (session o) · one wording for every person line: "Title at Company"

Auri, 2026-08-13: no "@", the word "at", everywhere. Applied across the WHOLE Sessions table — every
event, not just the two summits: **63 rows, 149 person entries**. Only 4 actually used "@"; the other
145 used a bare comma where the word belongs.

THE CONVERSION PUT " at " AT THE FIRST COMMA AFTER THE NAME, which is exactly where every renderer
already split title from company — so it changed the words and not the meaning. **15 entries had that
first comma INSIDE the title** and were corrected by hand afterwards, because the rule produced
nonsense on them:

    Darlington Akogo, Founder at CEO & Director of AI, minoHealth AI Labs
       → Founder, CEO & Director of AI at minoHealth AI Labs
    Natalie Becker, Partner at Producer at Thought Leader Global and Africa
       → Partner & Producer at Thought Leader Global and Africa
    Adina Schildt Gillion, Founder at and former AI & Privacy Policy Manager at Meta
       → Founder and former AI & Privacy Policy Manager at Meta

Three people legitimately hold two jobs and correctly keep two "at"s: Dalia Ibrahim, Lene Skole,
Gilbert Happy Lwetutte. Two signatures find the mistakes if this is ever re-run: a comma AFTER the
" at ", and more than one " at " in one entry.

`lib/stagePeople.ts` · `toSpeaker()` now splits on **" at "**, falling back to the first comma for
anything not yet converted. The comma split had started halving real titles — Bosun Tijani became a
man whose job was "Minister of Communications" at a company called "Innovation and Digital Economy
at Federal Republic of Nigeria". Spaces on both sides of the word, so **Attorney-at-Law** survives.

`lib/program.ts` · linked NISS people build `meta` as "Title at Company" too, so a linked person and
a typed one read identically.

**KEEP THE CONVENTION when adding anyone**: `Name, Title at Company`, people separated by " · ".
A comma inside a title is fine now (the split is on the word), but " · " still means "next person"
and must never appear inside one entry.

### NEXT STEPS (session o)

**1. STILL UNRESOLVED FROM A LIVE EDIT · the NASS 12:45 row lost two speakers.**
`recnD5KWO7Jz2Z70L` ("Digitization, Data & Cross-Border Execution In Africa") reads
`Speaker Details: "Sherief Kesseb"` — one name, no title, misspelled, and he is already a speaker on
the 15:35 session. Before that edit it read:

    George Gachui, Co-Founder & Director, MOOKH Africa · Ismail Eleburuike, Founder & CEO, SchoolTry

Both had faces. This is live on the board and in the embed. Restore it, or confirm the change was
deliberate. It also spawned a DUPLICATE in Brella: `#423722 "Sherief Kesseb"` beside
`#423741 "Sherief Kesseba"` — deleting one is a destructive write to the public app, so it waits.

**2. Four items held back from the Investor Day sheet**, all non-Confirmed there:
   - the **15:25–15:40 Christina Egelund keynote is missing from Airtable entirely** (topic cell
     empty in the sheet), which is why the day jumps 15:22 → 15:43
   - **David Dreyer Lassen** (Rektor, University of Copenhagen) on the 13:10 keynote — *In process*,
     so that session publishes with nobody on it
   - **EQT** as S4 on "Built in Europe" — *In process*, and an organisation
   - Private LP Panel **S1–S3** — *Not Started*

**3. The ~50 Brella speaker→session links, by hand.** Nothing can script them: the integration API
has no speaker-assignment route. `node brella-push-nass.mjs --event=nass --plan`.

**4. Create the 15:35–16:05 "Investor Reverse Pitch" timeslot in Brella** (Event Room 2, 27 Aug).
The one NASS session Brella has no row for, so its five people have nowhere to link. Deliberately
not scripted: a timeslot is the public shape of the day.

**5. Airtable jobs that finish the last NASS faces:**
   - tick **Sherif Kesseba** into "Nordic-Africa Summit Presenters" (his headshot is already there,
     he came in via a 2025 form) and align Sherief / Sherif
   - create rows for **Lamiaa El Rashidy** and **Gabriella Mukamugema**, or drop them
   - take **Impact Fund Denmark** out of the 10:45 speaker cell — it is a TBA placeholder, not a
     person, and it holds a seat on the public board
   - drop the "?" from **"Kurt Gammelgaard Nielsen?"** once he is confirmed
   - NOTE: a photo added now does NOT reach Brella. Brella COPIES the image when the record is
     created, so those four need a re-push or a manual upload.

**6. NISS, to finish it:**
   - tick the remaining **9 sessions** to `Locked` as their line-ups confirm (the /program tab names
     them; the people are already linked, portraits included)
   - **Session Description is empty on all 13 rows** — the text lives only in the planning sheet
   - add a **"Pitch Session"** option to `Session Type` in the UI (the API cannot), then label
     India Shark Tank and Nordic Founder Pitch
   - tell the NISS team the **Sessions table is the live copy now**; their old "NISS Program 2026"
     view is no longer read and will drift silently
   - merge the duplicate people rows: **Kunal Singla ×5**, **Zenia W. Francker ×4** (one spelled
     "Zenia Worm Francke")

**7. Smaller, still open:**
   - tick `Role: Host` on **Zenia W. Francker**'s CRM row — her Nordic Family Office intro is
     labelled Host only via the session-title fallback
   - delete the nameless LP Forum row in Marketing Project Overview
   - give the other speaker feeds the same `pending: "no-photo"` flag the investor feed has
     (`lib/niss.ts`, `lib/nass.ts`, `lib/fintechspeakers.ts`, `lib/policystage.ts`,
     `lib/summitextras.ts`, `lib/hub.ts`)
   - `/program` ignores `?event=` in the URL — the tabs are local state, so a shared link opens on
     NISS. One `useSearchParams` change if it ever annoys anyone.

### GOTCHAS (session o)

- **`programmeOf()` finds nothing for these summits.** Neither NISS nor NASS has its own Brella
  track; both sit on the plain "Event Room 2" track, so the label comes from `ROOM_DAY_PROGRAMMES`
  in `lib/brellaSections.ts`, matched on room + DATE. `NASS_PROGRAMME` in `nassOverride.ts` repeats
  that literal on purpose so a grep for either finds both — keep them in step.
- A substitution scoped by `day` depends on the board's day STRING ("Day 3 · 27 August"). If the day
  labels are ever renumbered, `NASS_DAY` moves with them, and a stale value silently means "replace
  nothing" — the column would quietly fall back to Brella's speakerless rows rather than erroring.

## SUPERSEDED · session (n), 2026-08-13

**Session (n): the Event Guide was corrected against the internal walkthrough deck.** Uncommitted,
on branch **`main`** (one file: `lib/eventGuide.ts`). This breaks the branch-off-main rule and
should be moved to its own branch before anything else lands; it was a copy-only edit and nothing
else in the tree was touched. Session (m) below is unaffected. Nothing was written to Airtable.

### WHAT WAS JUST DONE (session n)

`C:\Users\User\Downloads\TECHBBQ 2026 - WALKTHROUGH.pdf` (35 pages, mostly images: floor plans,
Brella screenshots, photo collages) is now the AUTHORITY for the guide's schedule and venue facts,
and it contradicted this file in four places. All four are fixed in `lib/eventGuide.ts`:

- **Opening Hours** · day 1 stage program ends **17:30**, not 17:00. The 10:00 stage program start
  was missing on both days. Thursday now ends with **17:15–19:00 pre-after party in Hall E**; the
  invented "17:00 After hours begins" and "21:00 End of day 2" rows are deleted.
- **Badge Claim** · there is a SECOND pre-badge day, **Monday 24 August at Bella**, on top of the
  20th at Matrikel 1. No time is published for the 24th because the deck doesn't give one.
- **Platform copy is present tense** · the deck's Brella screenshots are dated 10 Aug 2026 with a
  fully populated program, speakers, partners and side events. "The program is released closer to
  the event", "the platform opens two weeks before" and "a download QR code appears here" (there is
  no QR on the page) are all gone from Stage Program, Event Platform and Brella App.
- **Venue Map** · dropped the claim that the full map lives in the Brella app. Brella's sidebar has
  no map section in ANY of the deck's screenshots. Replaced with the real hall layout from the
  floor plans (Entrance 1 → check-in → wardrobe; Event Rooms + Investor Lounge in hall C; Grill
  Sessions + pre-after party in hall E; BBQ Stage, Founders Lounge, Matchmaking in C3/C4).

Three understated facts also corrected: food is "a large food court, several cafés and coffee
points" instead of a wrong count of two (the plan shows Bella Food, Bella Cafe, 3× Bella Coffee,
2× Café, The Gastro, Foodgrab, Kiosk); Charging names the dedicated charging area in hall C4;
Table Reservation states 200 tables plus the post-meeting lounge.

Item count is unchanged at **30** — no tabs added or removed. Verified with `npx tsc --noEmit`
(clean) and by grepping the rendered `/event-guide` HTML for every new string and every deleted one.

### NEXT STEPS (session n)

1. Move this diff off `main` onto a branch, then review and merge.
2. **Decide on a parties tab.** The deck has Matrikel1 pre-party Tue 25 from 19:00 and the official
   after-party at ARCH Thu 27 from 21:00, but Wednesday's Proud Mary drinks are still **TBD**.
   Blocked on that: don't publish a party program with a hole in it.
3. **Get approved copy for the missing on-site areas**, all on the 2026 floor plan and absent from
   the guide: **Kids Area** (powered by Family, hall C4 — the real gap, a parent reading the page
   cannot tell it exists), Grill Sessions (hall E, 50 chairs), merchandise shop, photo wall (2× 4m
   at B4), podcast studio, the Novo Life Science and Deep Tech area (27×20 m). New tabs need copy
   from TechBBQ, not copy composed off a floor plan — same rule that killed the F.A.Q.
4. **Verify "Garden Hall"** in the Water Stations panel. The 2026 plan shows no Garden Hall and the
   deck only promises "more water stations". Ask production.
5. Redeploy so the pasted Elementor embed picks the corrected copy up (the embed renders this same
   file, and it must be copied from the DEPLOYED dashboard, never localhost).

### GOTCHAS (session n)

- **The deck is 35 pages and only ~3.8 KB of it is real text.** Everything that matters is inside
  images. `pdftoppm` is not installed on this machine, so `Read` cannot render the PDF: use PyMuPDF
  (`import fitz`, `page.get_pixmap(dpi=110).save(...)`) to write PNGs and read those instead.
- Dates were already correct here (26–27 Aug) from the earlier fix, and the deck confirms them.
  Don't let a 27th/28th "correction" creep back in; those are 2025's dates.

**Session (m): the Nordic Family Office Summit is now the FOURTH investor event.** Uncommitted, on
branch **`investors-family-office`** (branched off `main`, working tree was clean). Sessions (j), (k)
and the older uncommitted work are untouched by it. Nothing was written to Airtable this session.

### WHAT WAS JUST DONE

**Part 2 · "NO PHOTO IN AIRTABLE" tiles, investors only so far.**

A speaker whose row has no Profile Picture used to be dropped by the feed and appear NOWHERE — the
dashboard could not name who was missing, so nobody knew there was anything to chase. Same failure
the partner wall fixed with its name tiles, so it is fixed the same way:

- `lib/investors.ts` · rows with a name but no photo are kept and marked `pending: "no-photo"`.
  `fetchInvestors(event, includePending)` gates them. Two ordering rules came with it: a row WITH a
  photo always wins the dedupe (or a person entered twice could be won by their empty row), and
  anyone pending sorts last whatever their Hierarchy.
- `app/api/investor-speakers/route.ts` · caches the FULL list, then serves the public a filtered
  copy. `?pending=1` + the dashboard password is the only way to get the photoless rows, and such a
  response is never CDN-stored and never CORS-tagged.
- `app/api/all-speakers/route.ts` · shares the `investors:all` cache key, so it now fills it the
  same way (`fetchInvestors(undefined, true)`) and filters `pending` out unconditionally. This is
  the feed the "All Speakers 2026" embed fetches; it has no `?pending=` of its own.
- `app/investors/page.tsx` · fetches `?pending=1`, draws the tile, leads the count with what the
  embed ships ("N person(s) live on techbbq.dk · M more waiting on a photo, below"), and names them
  in a worklist panel underneath the grid.
- `components/MissingPhoto.tsx` + `.s-card__missing` in `globals.css` · the tile itself, a dashed
  hollow box reading "NO PHOTO / IN AIRTABLE" with the person's name and title still below it.
  Wired into all 12 speaker/team pages, so the other feeds only need their own `pending` flag.

Proven end to end by temporarily forcing one person pending (Aileen Lee): dashboard 61 with 1
pending tile + worklist line, public feed 60, combined embed feed 60. The hack was then reverted —
`grep Aileen` over the repo is empty.

**Right now zero investors are pending**: Anne Marie Kindberg and Anja Bach Eriksson both got
photos uploaded in Airtable mid-session, so the live count went 59 → 61 and the tile has nothing to
draw. It is not dead code, it is an empty worklist.

**Part 3 · agenda avatars on the four investor programmes: 64/67 → 66/67.**

`lib/programFaces.ts` · `applyFaces` looks up the exact name key and THEN `shortKey` (first and last
word only), but `fetchOneProject` — the CRM source every investor agenda uses — only ever STORED
exact keys. The second lookup could never hit. `fetchViewFaces` has had the loose layer since NASS;
this copies it over, merged last so an exact match still wins.

Fixed two people whose headshot was already in the table: "Micha Breakstone" on the LP Forum agenda
now finds "Micha Y. Breakstone", and "Frederik von Bennigsen" finds "Frederik Runge von Bennigsen".
Coverage after: pension-summit 22/22, family-office 10/10, lp-forum 20/20, investor-day 14/15.
Nothing else moved (policy 34/34, nass 44/52, board 3/31, all unchanged).

**Part 4 · one person, two roles: the host's intro slot says HOST, not SPEAKER.**

The investor events each have a host who also moderates. Marianne Dahl opens the Pension Summit
alone and then chairs the opening panel; her CRM row reads `Role: Host + Moderator`. The agenda
called her a "Speaker" for the intro, because the label was read only from which CELL she came out
of and the session row puts her in `Speaker Details`.

- `lib/programFaces.ts` · `Role` added to SAFE_FIELDS (multi-select: Speaker | Moderator | Keynote |
  Managing Partner | Host), collected in the same CRM read as the faces, so no extra Airtable call.
  `fetchProjectFaces` now returns `{ faces, hosts }`. New `applyHostRole()` sets `role: "Host"` on
  the person when ALL of: alone on stage (one speaker, no moderators), session type is Opening or
  Closing Remarks, and either the CRM flags them Host or the session NAME says host.
- `lib/program.ts` · `ProgramPerson.role?`, and `applyHostRole(applyFaces(...), hosts)`.
- `app/program/page.tsx` + `lib/agendaSnippet.ts` · a lone person carrying a role names it; the group
  label falls back to Speaker/Speakers for everyone else. Both renderers, so the pasted embed and
  the dashboard agree.

Result, verified locally: Host on the intro of all four (Marianne Dahl, Joe Schorge, Trine
Hoffensetz Winther, Zenia W. Francker) and Moderator unchanged where they chair. Zero role overrides
on policy, board, nass, techbbq, niss and fintech — nothing else moved.

### PART 1 · WHAT WAS DONE BEFORE THAT

- `lib/investors.ts` · added `"family-office": "Nordic Family Office Summit"` to `INVESTOR_EVENTS`.
  That one line is what makes the feed, the `?event=` param, the tabs and the dedupe all cover it.
- `app/investors/page.tsx` · fourth tab + label + its own copy-embed button; eyebrow/lede now say four
  events, not three.
- `app/api/all-speakers/route.ts` · `INVESTOR_TAGS` entry, so a family-office person in the combined
  feed is tagged "Nordic Family Office Summit" rather than the raw key.
- `app/all-speakers-2026/page.tsx` · same label in `INVESTOR_EVENT_LABELS` + lede text.
- `lib/pages.ts` · nav shortcut `/investors?event=family-office`, updated note + search keywords.
- `lib/program.ts` · **BUG FIX, unrelated to the tab.** The `family-office` agenda joined faces on the
  project name `"Nordic Family Office"`. No such option exists; the real one is
  `"Nordic Family Office Summit"`. The join had been matching nothing since it was written, and every
  face on that agenda was coming from the `Event Room 2` / `Event Room 1` fallbacks.

Verified on localhost:3000 with `?fresh=1`: family-office **8**, investor-day **15**, lp-forum **20**,
pension-summit **18**, all **59** (61 rows, 2 people dedupe across events). `/investors`,
`/investors?event=family-office`, `/all-speakers-2026` and `/program?event=family-office` all 200.
`/api/program?event=family-office` → 7 sessions, 10 faces, zero nulls. `tsc --noEmit` passes.
`npm run build` NOT run: the dev server holds `.next`.

### NEXT STEPS

1. **Tick `Role: Host` on Zenia W. Francker's CRM row** (Nordic Family Office Summit). Her intro slot
   is labelled Host today only because the SESSION is called "Intro by the Host" — the title
   fallback. The CRM flag is the durable signal and survives the title being reworded. Nobody in that
   project has it ticked; the other three events do.
2. **Fix the Christina Egelund row on the Investor Day agenda**, the last face missing across the
   four investor programmes. Her `Speaker Details` cell reads
   `Christina Egelund␣␣Minister of Education` — name and job title glued together with a double
   space, so the whole string is treated as a name and matches nobody. The CRM has her filed as
   "Christina Egelund" WITH a headshot. Split it the way parsePeople expects (name, then the title)
   and the face appears by itself. Deliberately NOT patched in code: guessing that the first two
   words of a long string are the name would eventually put the wrong face on somebody.
3. **Give the other feeds the same `pending: "no-photo"` flag.** Auri asked for it everywhere; the
   investor feed is the pattern to copy, and `MissingPhoto` is already wired into every page. The
   ones that still drop photoless people silently: `lib/niss.ts:120`, `lib/nass.ts:108`,
   `lib/fintechspeakers.ts:109`, `lib/policystage.ts:122`, `lib/summitextras.ts:77`, and the hub
   (`lib/hub.ts`). Each needs its route to gate `?pending=1` the same way, and any route sharing a
   cache key with another has to fill it the same way — see the `investors:all` note above.
4. **Delete the nameless LP Forum row** in the Marketing Project Overview view. It has a photo and
   no Full Name, so it is dropped for the name, not the picture, and no tile will ever show it.
5. **Re-copy the Elementor snippet** for any investor widget already pasted on techbbq.dk if it
   should include the new event; the family-office button copies its own snippet.
6. Once all ten family-office speakers are filed under their own project in the CRM, drop the
   `Event Room 2` / `Event Room 1` fallbacks from `facesFrom` in `lib/program.ts`.

### GOTCHAS

- The CRM option is spelled **"Nordic Family Office Summit"** in full. Anything shorter matches nothing
  and fails SILENTLY: `filterByFormula` returns zero rows, the join finds no faces, no error is raised.
  Read the option list from the meta API (`/v0/meta/bases/<base>/tables`) before hardcoding a name.
- `/investors` validates `?event=` against its own `EVENTS` array. Adding a key to `INVESTOR_EVENTS`
  in `lib/investors.ts` without adding it to that array leaves the API serving the event while the page
  quietly falls back to "all".
- **`?pending=1` is a PUBLIC-SAFETY gate, not a display option.** It needs the dashboard password
  AND the param, and a response carrying it is treated as a live-read: `no-store`, no CORS header.
  Anything less and a CDN copy could answer a techbbq.dk visitor with a faceless card.
- **A shared cache key must be FILLED the same way by every route that reads it.** `investors:all`
  is written by whichever of `/api/investor-speakers` and `/api/all-speakers` runs first, so both
  now store the list WITH the pending rows and each filters on the way out. Storing the narrow list
  from one route would have silently hidden pending people from the dashboard, or the reverse.
- The card grid renders `MissingPhoto` whenever `photo` is null — it does not check `pending`. Any
  feed that returns a photoless person now gets the tile automatically, which is the point, but it
  also means a broken photo URL and a missing upload look the same. A grey card that fills in after
  a few seconds is the `/api/photo` proxy being slow, NOT a missing picture.
- Everything below this block is session (l) and earlier. Its next steps and gotchas still stand.

## SUPERSEDED · WORKING TREE, as of 2026-08-12 18:30

Session (l) is COMMITTED AND PUSHED to `main` as **`8507100`**, and Vercel has deployed it: NASS 2026
on `/program` (`lib/program.ts`, `lib/programFaces.ts`, `lib/agendaSnippet.ts`,
`app/program/page.tsx`, this file). `tsc --noEmit` passes. `npm run build` still has NOT been run —
the dev server holds `.next`.

Checked against PRODUCTION after the deploy: `/api/program?event=nass` serves 22 sessions,
answers `Access-Control-Allow-Origin: https://techbbq.dk`, and all 42 distinct face images return
200. 44 faces on 52 people.

Sessions (j) and (k) are still uncommitted and were deliberately left out of that commit.

**Session (l) also wrote to AIRTABLE**, 22 session rows that no commit can undo. See its entry.

### NEXT STEPS

1. **Delete the select option "Natalie Becker" from the `When Is it` field** on Sessions
   (`tblSlpTzDi2oVYwqv`). A UI paste created it; the API cannot remove a choice, so it has to be done
   in Airtable, and until it is, it sits in the dropdown beside Day 1 and Day 2 for every programme in
   that table. The row it damaged (`recYtq2KnSopmiRgU`, 09:30) was already restored to Day 2 /
   Event Room 2.
2. **Put " · " between the two hosts on the 09:25 row.** Both are currently in `Speaker Details` as
   one comma-joined string, so the agenda draws them as a single person with a two-line title.
   parsePeople splits on " · " only.
3. **Reconcile four names** so their headshots reach the agenda (43 → 47 faces). Agenda spelling on
   the left, roster spelling on the right: Amb. Diane Gachumba / Dr. Diane **Gashumba** (also
   Ambassador vs Dr. — confirm it is one person before changing either), Charity Wanjiru Kiarie /
   Wanjiru Kiarie, Ism**ae**l Eleburuike / Ism**ai**l Eleburuike, Natalie Becker / Natalie Bridgette
   Becker-Aakervik.
4. **Paste the embed on techbbq.dk when the agenda is final.** Nothing is installed yet: the copy
   button on the NASS 2026 tab produces the snippet, and the deploy above is what makes its
   `/api/program?event=nass` fetch work from techbbq.dk.
5. Optional, Auri's call: the dashboard preview still draws placeholder INITIALS in the generic
   orange, because that circle is shared by all nine tabs. The embed itself is fully #FF0028.
6. Chase the three people with no headshot in either table: Lamiaa El Rashidy, Sherief Kesseba,
   Gabriella Mukamugema. And decide what to do about the three non-people the sheet lists as
   speakers — "TechBBQ", "Impact Fund Denmark, Danish Company Representative" and
   "LOUNGE VIBE (DJ MUSIC)" — which currently render as circles with an initial.

### GOTCHAS

- **An unknown `?event=` silently falls back to `techbbq`**, which is 3 sample rows. Before the deploy,
  `?event=nass` in production answered 200 with `"event":"techbbq"` and a Sample Panel in it. A
  snippet pointing at an event the deploy does not have does not fail loudly; it shows placeholder
  data. Check the `event` field in the JSON, not just the status code.
- The copy button on localhost bakes in the DEPLOYED origin, never `localhost` (`lib/embedOrigin.ts`),
  so a snippet copied locally cannot be tested locally without rewriting its origin by hand — and the
  browser reports the resulting CORS refusal as a bare "Failed to fetch".
- Faces come from TWO tables now. If a NASS speaker has no face, check the CRM (`Event Room 2`) AND
  the Nordic-Africa Summit Presenters view before assuming the join is broken.

## SUPERSEDED · WORKING TREE, as of 2026-08-12 11:00

Session (i)'s embed work is committed and pushed as `5510231`. Uncommitted now: session (j), the
per-tab source line (**`components/FeedSource.tsx`** and **`lib/airtableSources.ts`** new, plus
`app/partner-events/page.tsx`, `app/globals.css`, `lib/useCachedList.ts`, `lib/cachePolicy.ts`,
`lib/partnerevents.ts`), and session (k), the CBC push (**`brella-push-cbc.mjs`** new, plus a
comment fix in `lib/brellaprogram.ts`). `tsc --noEmit` passes; `npm run build` has NOT been run (the
dev server holds `.next`). Both tabs verified in a browser.

**Session (k) already changed the LIVE Brella event** — that part is not waiting on a commit and
cannot be undone by one. See its entry for the ids.

Reminder from session (i), still outstanding: **the Elementor widget has not been repasted.** The
day headings are live in the builder but the pasted snippet is a static copy, so techbbq.dk still
shows the flat grid until someone copies from the deployed dashboard and pastes again.

## SUPERSEDED · WORKING TREE, as of 2026-08-11 16:30

The Deep Tech note below is resolved — the tree was clean when session (h) started. What was
uncommitted then was session (h), the four Day 0 programmes: `lib/program.ts`, `lib/programFaces.ts`,
`lib/agendaSnippet.ts`, `app/program/page.tsx`, `scripts/seed-day0-programs.mjs`, this file.
Verified in a browser: all eight tabs, and both new themes rendered from the real snippet.

## SUPERSEDED · WORKING TREE, as of 2026-08-11 12:00

`main` is pushed and deployed through `2838660` (Tito Investor Day, Brella paging, the Event Guide,
Elementor hardening). Verified in production.

**THREE FILES ARE MODIFIED AND NOT COMMITTED**, from a parallel session, and they are the Deep Tech
Event Day work in entry (e) below:

- `lib/brellaSections.ts` · `ROOM_DAY_PROGRAMMES` += Event Room 6 / 26 August / Deep Tech Event Day
- `lib/brellaEmbedSnippet.ts`
- `app/brella-program/page.tsx`

They compile and the last `npm run build` passed with them present, but nothing about them has been
verified in a browser by the session that wrote entry (f), and they are deliberately NOT pushed —
`main` auto-deploys to the connector that techbbq.dk reads, and that is not somebody else's call to
make. **Either review and commit them, or `git checkout --` them, before starting anything new.**
Do not assume a clean tree.

Two entries below are both labelled 2026-08-11: (e) is the Deep Tech work, (f) is the Elementor
hardening. They were written by different sessions on the same day and (f) was renamed from (e) to
break the collision.

## Session 2026-08-12 (l) · NASS 2026 on /program, with faces from two tables

**22 rows were written to Airtable** — the Nordic Africa Startup Summit run-of-show, typed in from a
Google Sheet Auri linked (`1zdxyPAvjh5DhuZRLe2y3NUnmJgc8OHd2`, tab `Ark1`). Sessions table
`tblSlpTzDi2oVYwqv`, all of them `Name of the Event` = "Nordic Africa Startup Summit", Day 2,
Event Room 2, 09:00 to 18:05. The one pre-existing NASS row (`rec8UceSsQnkx71Ul`, which held only an
Event Room) became the 09:00 registration row instead of being left as an orphan; the other 21 are new.
Read back after writing: 22 rows, no field mismatches.

Mapping decisions, because the sheet does not fit the table:
- `Session Format` in the sheet has 11 values the `Session Type` select does not (High-Level Keynote,
  Conversation, Lightning Talk, Interactive Policy Session, Case Based Panel Discussion…). Auri's call
  was to MAP onto the existing seven rather than grow the select: solo talks to Keynote, two-person
  Conversation to Fireside Chat, three or more to Panel, breaks and lunch to Break, registration and
  the closing reception to Networking & Drinks.
- `Description` = the Theme line, then the talking points with the brackets stripped. The sheet's
  `Signal` and `Q & A` columns have nowhere to go and were dropped.
- Speaker cells read "NAME [Job Title, Company]" with co-speakers separated by runs of spaces, and
  the sheet ALSO has runs of spaces inside the brackets. Splitting on whitespace alone tore four
  people in half; the importer splits at bracket depth 0 and never right before a `[`.

`/program` has a NASS 2026 tab (`?event=nass`), fixed heading "August 27th", `sub` "Event Room 2",
`people: true`. Verified in a browser: 22 sessions, 54 people, 43 faces, every photo URL 200.

**THE COLOUR IS ONE FLAT #FF0028** (Auri, 2026-08-12), not the three-stop fire gradient — the new
`crimson` theme in `lib/agendaSnippet.ts`. `grad` is a single-stop gradient, the same trick `blue`
uses, so the shared `background-clip:text` CSS needs no branch. Ground stays TRANSPARENT like
`orange`, because this snippet is pasted into a section that is already dark; giving it its own black
would draw a panel edge where there is none. The greys beside it are neutral rather than the fire
theme's warm ones. Contrast note: white on #FF0028 is 3.98:1, under AA for small text — the tag pills
inherit that from every other theme here (#ff2600 is 4.0:1), so it was left consistent rather than
fixed in one theme only.

THE EMBED WAS TESTED AS A PASTE, not just as a tab. The copy button's clipboard call was stubbed in a
browser, the real 11.5KB string captured, its origin rewritten to localhost, and the result loaded as
a standalone page: 22 sessions painted, faces and all, no `__ORIGIN__` left in the output, no
`fa7000`/`ce0f2e` anywhere, three uses of #FF0028. The snippet fetches
`https://airtable-woad.vercel.app/api/program?event=nass`, which is why this had to be PUSHED before
the snippet can work on techbbq.dk — on localhost the copy button deliberately bakes in the deployed
origin (`lib/embedOrigin.ts`), and until this deploy that URL 404'd the event.

**FACES NEEDED A SECOND SOURCE, and that is the one real code change.** The 52 people on this agenda
are split across two tables: 21 sit in Marketing Project Overview under `Event Room 2`, and the full
roster of 45 lives behind the "Nordic-Africa Summit Presenters" view that `/nass` already publishes
(`tbl3dTaHrIFrHF6Mo` / `viw9pkLpUOThgHfGB`). Pointed at the CRM alone, more than half the room
rendered initials. So `lib/programFaces.ts` gained `fetchViewFaces()` + a `facesFromView` config, and
membership in the view is the publish gate exactly as in `lib/nass.ts`. Two matching rules came with
it, both needed by real rows in this roster:
- `rosterKey()` strips an appended role and credentials, because a self-filled form writes
  "Alvaro Perezcano (Moderator)" and "Adama Ibrahim, EMBA".
- `shortKey()` is a first-and-last-word fallback, tried only after the exact key, because the roster
  carries "Jamie Thurston Wyngaard" where the agenda announces "Jamie Wyngaard". A loose key two
  people share is dropped rather than guessed at.
`amb`/`ambassador` joined the honorific strip while there.

**Eleven people still show an initial, and four of those are a NAME MISMATCH to reconcile** — the
same person spelled two ways across the two tables, which is Airtable data, not code:
- "Amb. Diane Gachumba" (agenda) vs "Dr. Diane Gashumba" (roster) — Gachumba/Gashumba, and one says
  Ambassador where the other says Dr. **Confirm these are the same person before touching either.**
- "Charity Wanjiru Kiarie" vs "Wanjiru Kiarie"
- "Ismael Eleburuike" vs "Ismail Eleburuike"
- "Natalie Becker" vs "Natalie Bridgette Becker-Aakervik"
Three more are in neither table and have no photo anywhere: Lamiaa El Rashidy, Sherief Kesseba,
Gabriella Mukamugema. The last four are not people at all and render as circles with an initial:
"TechBBQ" (opening), "Impact Fund Denmark, Danish Company Representative" (a placeholder speaker),
"LOUNGE VIBE (DJ MUSIC)" (a music cue in the Speaker column). Left as the sheet has them.

Also from the sheet, unresolved: **Prof. Jackson Kiilu Maalu** sits on a row of his own with no
session, so he was not imported. The 10:45 speaker is still the placeholder "Danish Company
Representative" and the 15:05 fireside has no moderator (the sheet says TBA).

One cell WAS corrected after the import: the 09:30 moderator read "Natalie Becker introduces the
Minister", a stage direction that the agenda renderer would have drawn as a person's name. It now
reads "Natalie Becker".

**SOMEBODY WAS EDITING THESE ROWS IN THE AIRTABLE UI WHILE THIS SESSION RAN**, and a paste landed in
the wrong cells on the 09:30 row (`recYtq2KnSopmiRgU`): `Event Room` was cleared and `When Is it` was
set to "Natalie Becker", which Airtable accepted by CREATING THAT AS A NEW SELECT OPTION. Both cells
were restored to Day 2 / Event Room 2. **The stray "Natalie Becker" option is still on the `When Is it`
field** — the API cannot delete a select choice, so it has to go in the UI, and until it does it sits
in the dropdown beside Day 1 and Day 2 for every programme in this table.

The same editing pass changed the 09:25 row on purpose: both hosts moved from `Moderator Details` into
`Speaker Details` as ONE comma-joined string, "Charles Kinga, Head of Africa at TechBBQ,  Natalie
Becker Partner, Producer at Thought Leader Global and Africa". parsePeople splits on " · ", not on
commas, so the agenda now draws that as a SINGLE person whose title runs on for two lines. Two people
need " · " between them. Left as the editor wrote it — the fix is theirs to confirm, not a guess to
make.

Not done, and deliberately: nothing about NASS is published. `/api/program?event=nass` serves it and
the dashboard tab renders it, but no Elementor snippet has been pasted anywhere, so techbbq.dk is
unchanged.

Observation while regression-checking the other programmes, NOT touched: the Board Summit resolves
3 faces out of 31 people and Investor Day 4 out of 15, both from before this session. Their people are
filed somewhere other than the `facesFrom` projects those two configs name.

## Session 2026-08-12 (k) · The Creative Business Cup agenda went INTO Brella

**13 sessions were created in the live attendee app, and one existing block was moved.** Not a dry
run. Ids 986768-986780, listed below, so a rollback is a list and not a hunt.

CBC sat in Brella as one block per day, so the board drew a rectangle that said nothing about what
happens inside it. Creative Business Network's published programme (`CBC_2026_Program.pdf`, on
Auri's Desktop under `Side Events/`) has the full agenda; Auri settled that the PDF is correct.
`brella-push-cbc.mjs` sends it. Verified on the board: Event Room 5 draws the dashed
`14:00 - 17:00 · CBC Initial Pitching` shell with its six items nested inside, Day 1 went 30 -> 36
sessions.

| ids | what |
|---|---|
| 986768-986773 | Day 1, 26 Aug, 14:00-17:00, six items from Welcome & opening to Wrap-up |
| 986774-986780 | Day 2, 27 Aug, 09:30-13:00, seven items from Welcome & recap to Closing remarks |
| 978024 (PATCHed) | Day 1 parent moved from 15:00-17:30 to **14:00-17:00** |

**THE 14:00 START OVERLAPS GOOGLE, AND THAT IS DELIBERATE.** `Scaling Europe` holds Event Room 5
until 14:45 on the 26th, so CBC's first 45 minutes collide with it, and the tracker doc records the
CBC slot as 15:00-17:30 DONE — i.e. 15:00 is what BRIGHT submitted on their Event Room form. Raised
twice, Auri chose the PDF times both times. Do not "fix" this without asking him.

**THE AGENDA BROKE THE SHELL RULE, and the fix is in both renderers.** Auri, looking at Event Room 5:
"how are there 3 sessions in the same room?" The DOM had TWO dashed bands in that column. Google's
`Scaling Europe` (12:00-14:45) had been promoted to a shell, because it now contains the first two
CBC items (14:00-14:15 and 14:15-14:20) — they only land inside it because of the 14:00 start.

The old rule was "contains at least two strictly shorter sessions". It now also requires the
contained sessions to FILL at least half the candidate's span, measured as the UNION of their spans
so overlapping children cannot count shared minutes twice. CBC's six items fill 100% of 14:00-17:00
and Future of Fintech's eight fill 95% of 09:30-13:00; Scaling Europe's two accidental guests filled
20 minutes of 165, which is 12%. Changed in `components/ProgramTimeline.tsx` AND
`lib/brellaEmbedSnippet.ts` — same rule, two renderers, and a comment in each pointing at the other.

What Room 5 draws now: one CBC shell, and `Scaling Europe` back to a card sharing two lanes with the
three CBC items it overlaps. That is honest about a genuine double-booking, and it is also ugly —
Scaling Europe is squeezed to half width and its title truncates. **Moving CBC to 14:45 or 15:00
would make the column clean and is one PATCH.** Auri's call, twice made for 14:00; flagged again with
the render in front of him.

**THE SHELL IS NO LONGER PRESSABLE, and the sessions inside it now open.** Auri, seeing it: "the one
that I can press is a shell, that shouldn't be pressed. Instead add speakers and info to individual
sessions." Three changes:

1. The half-day shell was a `<button>` that opened its own detail, on the reasoning that a real
   Brella row sits behind it. It is now a `div`, `aria-hidden`, `pointer-events:none`, exactly like
   the derived all-day band, so a press lands on the card underneath. Both renderers.
   **Consequence:** whatever sits on the shell's own row is unreachable from the board, which is the
   other half of why the speakers belong on the individual sessions.
2. `hasDetail()` no longer asks whether the description is over 150 characters. That length was
   standing in for "is there anything here" and measured the wrong string: five of the six CBC items
   carry a real sentence from the programme, the longest 65 characters, so none of them could be
   opened. It now strips Brella's subtitle line (`Session by …`, branding not detail) and asks
   whether more than 24 characters remain. `Break & networking` ("Catering available.") and
   `Pitching — Block 2` ("Continued pitches.") still do not open, correctly: those add nothing the
   title has not already said.
3. Cleared the `subtitle` on all 13 CBC rows in Brella (PATCH, ids only). I had set it at creation
   and it printed "Session by Creative Business Network" on every card inside a shell already named
   Creative Business Cup — thirteen copies of one fact.

**SPEAKERS PER SESSION ARE OFF THE TABLE, descriptions carry the detail instead** (Auri, 2026-08-12:
"we dont need to contact them... instead, let's just have description to each session"). Which of
CBC's five speakers runs which item is recorded in no source we have: the PDF names only Rasmus on
the Day 1 welcome and Gleb on the pitch training, Brella has all five heaped on the block, Airtable's
Event Room form takes five flat presenter slots per ROOM with no session field, and cbnet.com's own
CBC 2026 page prints "No items found" under Jury & speakers with the FAQ saying details are still
being updated. All 13 sessions already carry their description from the PDF, which is the detail.

Day 2's block was renamed from "Creative Business Cup 2026 - CBC Global Finals & Creativity & AI" to
**"CBC Global Finals & Creativity & AI"** — it said CBC twice. Day 1 keeps the long form; nobody
asked for it.

Two sessions still do not open on the board, correctly: `Break & networking` ("Catering available.")
and `Pitching — Block 2` ("Continued pitches.") fall under the 24-character floor in hasDetail(),
because a dialog there would only repeat the title.

**Four Brella API facts learned the hard way. Read these before writing to Brella again:**

1. **A description is sent as a PLAIN STRING in `content`.** GET returns `content` as a Draft.js
   document, so sending that shape back is the obvious move and it is wrong: the POST 500s with an
   empty body, and PATCHing the object stores the serialised JSON as the visible text (that happened
   to 986768 and was repaired).
2. **An unknown key returns 200 and is silently ignored.** `description`, `content_html` and `body`
   all "succeeded" and changed nothing. A 200 is not evidence that a field landed — re-read it.
3. **`GET /timeslots/<id>` 404s.** There is no single-timeslot read; verify through the collection.
   A verification loop built on the single read reports every field as missing.
4. **A POST carrying title + start_time + duration + location + track_id works; adding subtitle and
   content to that same POST 500s.** So the script creates with the minimal proven body and PATCHes
   the extras on. Splitting it also means a rejected description costs a description, not a session.

Also corrected a comment in `lib/brellaprogram.ts` that had been wrong in both directions in one
afternoon. Writes ARE possible (brella-push.mjs has created timeslots and speakers since 10 August);
what has no route is ASSIGNING a speaker to a session. Brella's public help page describes the read
API only, and OPTIONS 404s on a path whose GET returns 200 — both of those misled this session into
telling Auri the API was read-only, which he correctly pushed back on.

**Auri's remaining step:** link the five CBC speakers (Safa Sharif, Jenni Ahtiainen, Gleb Maltsev,
Anna Sofia Abrahamsson, Mikkel Holme) to the new sub-sessions by hand in the Brella dashboard. They
are already on the two parent blocks. The PDF names no one per agenda item, so nothing here guessed.

Next steps:
1. Speakers, by hand, as above.
2. **Nordic IPO & Stock Market Day 2026** (Event Room 3, 26 Aug, 12:30-17:30) is the same shape:
   one block, no agenda. Per the tracker doc, FBV has not sent the programme yet ("Missing speakers
   & program", waiting on 3-4 panellists). When it arrives, `brella-push-cbc.mjs` is the template.
3. Two PDF items were deliberately NOT created: the Mon 25 evening welcome reception, and
   `Pitch training with Gleb Maltsev` Tue 09:00-12:30. Neither can be an Event Room 5 booking (that
   morning is already taken twice over). Ask CBC where they belong.

## Session 2026-08-12 (l) · "Which rooms still look incomplete", computed not written

Auri: "which sessions feel incomplete still? For example this CBC, I think it's still incomplete."
New panel at the top of the Event Rooms tab, above the board, from **`lib/roomGaps.ts`**. Derived
from the sessions every load, so a room leaves the list by being finished and a room nobody has
thought about appears on the same terms. It found CBC on its own: "5 sessions and not one names a
speaker" on the 26th, 6 on the 27th.

Six findings, ordered by what to chase first: `empty`, `no-agenda`, `double-booked`, `no-speakers`,
`thin-speakers`, `no-descriptions`. Grouped by room, tagged, each line naming the actual sessions.
Dashboard only — a to-do list naming paying partners' rooms has no business in an embed.

**It caught a real duplicate nobody had noticed:** Event Room 2 on the 27th has both "After Event
Reception with Light Entertainment" and "After-Event Networking: Reception with Light Entertainment"
booked over each other. Two rows for one reception.

**Three false positives, all fixed, all worth knowing if you extend the rules:**

1. **All-day rows were dropped**, because `parseSlot` returns null for "All day" — so Event Room 1
   read as EMPTY on the 27th while Board Summit had the room all day. All-day now counts as present
   and as covering the day.
2. **A long session is not the same as an unfilled booking.** "What VCs won't tell you about raising
   in this market" is a two-hour workshop with a speaker and a full blurb, and it was reported as
   "one block, no programme inside it". A block is only flagged now when it ALSO has no speakers and
   no real description.
3. **Breaks are not sessions.** The panel asked the Policy Stage for speakers on "Networking Lunch,
   Networking & Refreshments, Networking & Drinks". A name rule (`NOT_A_SESSION`) drops breaks,
   lunches, receptions and transitions from the speaker and description checks, and from the
   denominator too — an agenda of six talks and four breaks is not "speakers on 6 of 10".

**ON PROGRAM 2026 TOO, per section** (Auri: "have the same box in the program 2026 as well just to
understand it"). Extracted the panel to **`components/RoomGapsPanel.tsx`** first rather than pasting
it into a second page — this repo's own history is what settled that argument: the venue line, the
artwork override, the title key and the shell rule had all already drifted between these two pages.
It follows the open section, so Stages reports stages, Event Rooms reports rooms, Grill reports grill
tracks, and the heading changes with it (`GAP_SUBJECT`). Computed over the CANONICAL column list, so
narrowing to one stage does not hide that another is empty, and across both days either way.

On Stages it immediately named the `TBA` placeholder slots on BBQ, Tech and Campfire, plus a clash on
Campfire where "Moving Beyond Unicorn" overlaps a TBA slot.

**And the shell rule now lives in ONE place: `lib/shellRule.ts`.** The timeline and the gaps panel
each had their own copy and they had already diverged — the timeline had the fill requirement, the
panel did not, so the panel still reported "Scaling Europe — 2 sessions and not one names a speaker"
about Google's session from exactly the false shell the timeline had stopped drawing. Both import it
now. The embed's copy stays inline (it is a JavaScript string sent to WordPress and cannot import),
with comments in all three pointing at each other.

## Session 2026-08-12 (j) · Every tab says where its data comes from, and how stale it can be

Auri: "show where the information is gotten from just above, as well as how often it updates. I want
to just understand if we are always up to date." New `components/FeedSource.tsx`, three muted rows
directly under the tab that selects the data:

- **Source** · the system, plus the table/view/board inside it, and that name is a LINK straight to
  the rows in Airtable (asked for in the follow-up: "add the link where it takes the information
  from"). No link on the Brella tab: its admin URLs are not stable enough to hardcode and a link
  that lands on the wrong screen is worse than the sentence.
- **Reads** · the exact columns the feed pulls. The question behind it is "why does the card show
  something I cannot find in the table", so anything absent from this list comes from somewhere
  else, which the Source row's trailing clause then names.
- **Updates** · the cadence in words, plus when this page last checked.

**Why /partner-events needed it most: its two tabs do not share a source.** Side Events is Airtable
(Partnership Success, view "2026 Side event and event room info", plus posters and venues scraped
from each host's registration page on a 6 hour cache); Event Rooms is Brella. The hero eyebrow names
Airtable only, so it was wrong for whichever tab was not open.

**New `lib/airtableSources.ts`, and it is CLIENT-SAFE ON PURPOSE.** The link needs the base id, the
table id and the view id in a `"use client"` page, so they live in a module that holds nothing but
ids and column names: no token, no `process.env`, no fetching. **Never add a credential to it.** The
base id is pinned there rather than read from env because every table id in `lib/*` is already
hardcoded, so a base pointing elsewhere breaks all of them anyway; an Airtable id is in the URL of
every share link and opens nothing without a token. `lib/partnerevents.ts` now IMPORTS its table and
view ids from that module instead of declaring its own copies, so the link cannot outlive the view
it names. Verified the feed still returns all 20 rows after that swap.

**The cadence is READ FROM `lib/cachePolicy.ts`, never typed into the component.** That file owns the
TTLs and flips to the calm cadence by clock on 28 August, so a hardcoded "within 30 minutes" would
become a lie that morning with nothing to catch it.

**Two honesty fixes came out of writing it, both live before this and both wrong:**

1. `cadenceLabel()` had no branch for `NEAR_LIVE_FEEDS`, so `partnerevents` (60 second CDN, 1 minute
   memory) was described as "within 30 minutes" — thirty times the truth. The refresh button has
   been printing that on this page since the near-live override went in. Fixed at the source, so
   both the button and the new line say "within a minute".
2. `/partner-events` never passed `feedKey` to `<RefreshButton>`, which is what selects that branch.
   It does now.

`useCachedList` gained `fetchedAt`, stamped on any answer including a byte-identical one, and reset
on tab switch. It is when the BROWSER was answered, not when Airtable was read — the CDN can answer
from a copy up to its own s-maxage old — so it prints as "checked 10:46" and the cadence clause next
to it is what describes the possible lag. Do not reword it into "live as of".

**NOT in any embed.** Auri was explicit: this is an indication next to the embed, not part of it. An
Airtable view name means nothing to a techbbq.dk visitor. Nothing went into `lib/*EmbedSnippet.ts`.

**The count line was counting the wrong source, found while tracing where the board's data comes
from.** On the Event Rooms tab it printed the 11 Airtable event-room rows above a board drawing
Brella sessions — two sources disagreeing inside one sentence. It now counts the selected day's
Brella sessions there (30 on Day 1, 48 on Day 2, both verified) and keeps counting Airtable cards on
Side Events. The `revalidating` and `updated` flags moved to the same rule: they follow whichever
feed the open tab is actually showing.

**For the record, since it came up twice: what the Event Rooms board does and does not read.** The
board is Brella only. `/api/program?event=brella` DOES merge Airtable in, but only into other
sections — the Side Events, and the Policy Stage (Brella holds that stage as one all-day row with 28
speakers on it, so the real 15 sessions are substituted from Airtable). The rooms section is
untouched. The summit names on the all-day bands (Deep Tech Event Day, Nordic India Startup Summit,
Nordic Africa Startup Summit) come from NEITHER source: they are pinned in `ROOM_DAY_PROGRAMMES` in
`lib/brellaSections.ts`, because those summits have no Brella track of their own. Changing one is a
code edit. That is now a clause on the Brella source line so it is not invisible.

Two small things settled while looking at it: the row is TWO lines always, because as one wrapping
line the divider stranded itself at the end of line one; and the clock is forced to 24 hours
(`en-GB`, `h23`) so it matches the Airtable time ranges everywhere else on the page.

Next steps:
1. Commit and push. Nothing here touches a feed's behaviour, only what the dashboard says about it.
2. **Decide whether this rolls out to the other tabbed pages.** `/program` has eight tabs across
   several sources and is the obvious next one; `FeedSource` was written generic for exactly that.
   Not done here because each tab needs its source named accurately, which is research per tab.
3. Consider printing the CDN's `age` header, which is the true answer to "how old is this copy".
   Deliberately skipped: localhost has no CDN, so it would be blank on the very page Auri is
   looking at while developing.

Gotcha: `fetchedAt` is now returned by `useCachedList` and every page destructures that hook. Adding
a field is safe, removing one is not — a dozen pages read this hook.

## Session 2026-08-12 (i) · The events embed groups by day, like the dashboard does

**One file: `lib/eventEmbedSnippet.ts`.** Auri, comparing localhost:3000/partner-events against the
Elementor paste: the dashboard prints a small muted `25 AUG` on the left above each day's cards, and
the embed did not. The embed rendered one flat pile in feed order, so the only date on the page was
the badge on every card — a visitor had to read all 17 of them to work out what happens when.

`render()` now buckets the list on `e.date`, sorts the days ascending, sorts each day's cards by
start time, and prints an `<h2 class="tbbq-ev-day">` above each group. Same three rules the dashboard
uses (`app/partner-events/page.tsx`, the `.bp-day` blocks), so the two cannot drift on this again:

- `zzz-no-date` is a real bucket key, not null, so an event whose partner never filled in a date
  heads a "Date TBC" group like any other day and a plain string sort puts it last.
- `startMinutes()` mirrors the dashboard's, including its "unparseable sorts last" rule.
- `dayLabel()` is `Intl` in a **try/catch**. This string runs in whatever browser opens techbbq.dk,
  and an unavailable time zone must not take the whole grid down with it.

**The heading is a full-width GRID ITEM (`grid-column:1/-1`), not a wrapper.** Wrapping each day in
its own container would have meant moving the grid CSS off `.tbbq-ev-grid` and re-pointing both
media queries and the fixed-column override at the new inner element. Spanning `1/-1` breaks the row
inside the existing auto-fill grid instead, and nothing else in that stylesheet had to move.

Per-card date badges are KEPT. It repeats the day inside a group, and Auri's ask was to retain as
much detail as the dashboard, not to trade one for the other.

Verified: `tsc --noEmit` clean, plus the built snippet rendered in a browser against the local feed
— three groups (25, 26, 27 AUG), each label left-aligned above its own row, cards in clock order.
The escaping trap in this file bit nothing this time: the regex is written `\\d` because the whole
snippet is one template literal, and it was checked as the emitted single-backslash form.

Next steps:
1. Commit and push `lib/eventEmbedSnippet.ts` (branch off `main` — it auto-deploys to the connector
   techbbq.dk reads).
2. Re-copy the embed from the **deployed** dashboard and repaste it into the Elementor HTML widget.
   Copying from localhost bakes in a localhost endpoint.
3. Check it on techbbq.dk at phone width: the heading spans the single column there too, which was
   verified in a resized browser and not on a real device.

Gotcha for whoever is next: `app/partner-events/page.tsx` still carries the note that the embed
"draws the old card wall". Still true of the CARD itself (badges, poster, Register button); the day
grouping is now shared. The two designs remain deliberately different.

## Session 2026-08-11 (h) · The four Day 0 programmes, and faces that cross a project line

`/program` had four tabs; it now has eight. LP Forum, TechBBQ Investor Day, the European Growth
Pension & Insurance Summit and the Nordic Family Office Summit — the 25 August programmes, the day
before TechBBQ opens — each with its own copy-embed button.

**The agendas came from four designed HTML pages, and now live in Airtable.** Auri handed over
`lp-forum.html`, `investor-day.html`, `pension-summit.html` and `family-office.html` (plus their
shared `program.css`). Those were transcribed into 39 rows in the Sessions table — the same table
the Policy Stage and the Board Summit already use, under four new `Name of the Event` values — by
`scripts/seed-day0-programs.mjs`, which keeps the transcription and refuses to run twice. Nothing
existing was touched, and no field's options were changed.

Two decisions inside that transcription, both Auri's call:

- **The designed pages carry a START time per slot; the `Time Slot` cell wants a range.** Each row's
  end is the next row's start, which is the shape the Board Summit rows already have.
- **Two rows fit none of the seven `Session Type` options** — the LP Forum's 09:00 bridge line and
  the Pension Summit's "Building Tomorrow's Europe Award". They are left blank, which renders as a
  row with no pill. The alternative was widening a shared single-select for two rows.

**Two new themes, because a Day 0 embed cannot borrow a dark section.** The four pages are one look
in `program.css`: the brand fire gradient on `--garage` #0a0a0a. `orange` already paints that
gradient but is transparent — it is pasted into a section that is already dark. These four are their
own panel and must bring the black with them, so `gold` is the orange accents on a solid #0a0a0a.
Investor Day gets `beam`: the same accents on the cooler #04060e its `bg-beam.jpg` backdrop scrims
to. Only the ground and the rules move; the accent does not change per venue.

Also: `"Networking & Drinks"` had no icon. The `ICONS` map keys on the exact lowercased type and
only held a bare `"networking"`, which the Sessions table's actual option never matched.

### FACES NOW CROSS A PROJECT LINE, first-match-wins

`facesFrom` took one `Project Name`. That is wrong for these four, because a speaker's CRM row is
filed under one project and it is not always the one whose agenda they are on:

- Yoram Wijngaarde is filed under the LP Forum and keynotes at all three investor events
- Erik Balck Sørensen moderates at the LP Forum, filed under the main programme
- **"Nordic Family Office" has no rows at all** — the only two of its ten speakers in the CRM are
  filed under Event Rooms 1 and 2

So `facesFrom` now takes an ordered list. The event's own project is first, which is what makes it
safe: a fallback can only fill a gap, never override, and a name under two projects resolves to the
first rather than being dropped as ambiguous. Ambiguity is still detected PER PROJECT — two rows for
one person inside one project is a duplicate to fix in Airtable, and an arbitrary pick would hide it.
The family-office fallbacks are a stopgap and say so in the config; delete them once the ten are
filed under their own project.

`key()` also strips a leading honorific. "Prof. Philippe Tibi" on the agenda and "Philippe Tibi" in
the CRM never met before this.

Coverage after: pension-summit 17/22, lp-forum 17/20, investor-day 4/8, family-office 3/10. The
remainder are **not in Marketing Project Overview at all** and cannot be found by any join:

> Marianne Dahl · Anne Marie Kindberg · Anja Bach Eriksson · Hrönn Greipsdóttir ·
> Frederik von Bennigsen · Margrethe Vestager · Lars Frølund · Alexis Horowitz-Burdick ·
> Rene Rechtman · Robert Westerdahl · Marek Kiisa · Linnéa Kornehed Falck · Victor Pancic ·
> Jesper Søgaard

Two more are near-misses that only Airtable can settle, not code:

- **Torben M. Andersen has TWO rows under the Pension Summit** ("Professor, University of Aarhus"
  and "Chairman, ATP"). Same person, two jobs, so the ambiguity guard drops him. Merge the rows.
- **"Micha Breakstone"** on the LP Forum agenda vs **"Micha Y. Breakstone"** in the CRM. Either
  spelling can move; they just have to agree.

Unrelated and pre-existing, noted because it looks like this work: **the Board Summit is 3/31 faces**
on production too, unchanged by any of the above. The 27 people its config says were written under
"Event Room 1" mostly do not match by name.

## Session 2026-08-11 (g) · Grill Sessions: 58/60 both, merged with the parallel photo pass

This session ran in parallel with the 2026-08-10 photo pass and rebased onto it. **Their photo
sourcing was better than mine and is the one that survived** - where we both had a source for the
same person, theirs won:
- **Mårten Skogh** - chalmers.se (alt reads "Profile photo of Mårten Skogh") supersedes my
  chalmersnextlabs.se screenshot-named PNG. Their own note already says so.
- **Maarten Everts** - their GOTO speaker page corroborates "CTO & co-founder Linksight", which
  also confirms the title correction. Mine was only his utwente staff page.
- **Kim Rants** - left rejected. The YC avatar IS provably him (alt='Kim Rants'), but the 200x200
  bar is a fair call and it is a 1-hour presigned S3 URL. If it is ever wanted, resolve it live the
  way `resolveFromSpeakers` does. Do not hardcode a signed URL.

Two of their "nothing fetchable that is provably them" calls were wrong and are now filled:
- **Sara Storm** - funnelemea.com, filename AND alt independently both read "Sara Storm".
- **Anders Rosenqvist** - whitepress.com SEO Vibes Copenhagen agenda.
Both sit on multi-person pages. Nearest-image-by-character-distance is NOT safe there; it hands you
the neighbour's face. Both were confirmed by **DOM adjacency in a real browser** - the image inside
the same card as the person's own name - and Anders's card states his title and company word for
word. Use that technique, not proximity.

### Auri edited the table underneath both sessions - read the dry run
Rows were renamed by hand, and exact-name matching turns a rename into a SILENT
"NOT FOUND in grill rows". Keys resynced:

    MONIKA KANDA      -> Monika Kanda
    Jennifer Monatgue -> Jennifer Montague
    Ulla Sommerfeldt  -> Ulla Sommerfelt      (she now has a handle: /in/ullasommerfelt/)

### The OVERWRITE guard paid for itself
The dry run flagged `will OVERWRITE: Fabio Cavaliere`. The handle was identical - the only
difference was that **Auri had deliberately cleared his Bio by hand**, and re-running would have
silently re-added my caveat over that decision. The caveat is gone from the script; the concern
still stands here (Job Title "POINT OF CONTACT", an email address in the Company field, so the row
is probably the session's submitting contact and not a speaker at all).
Also: **Maarten Kas's handle had vanished** from the row since it was written. Re-applied.

### Correction to my own earlier note
Mårten Skogh's title was never wrong. chalmersnextlabs.se says "Head of Quantum Lab", the row says
"Head of Quantum Technology". My earlier "sources say Development Engineer" flag was stale search
data - disregard it.

### The two stuck rows, chased properly this time via the SOURCE submission
Went back to the Grill submission form (`Partnership Success` / `viwmxcuIN0SFe2tkF`) instead of
searching the web again, which settled both:

- **Yuval Temam** - the submission says Lighthouse Lab "helps business validate and audit AI
  systems". That is AI assurance, so the one public "Yuval Temam" profile in the Netherlands -
  headline **SES**, the satellite operator - is almost certainly a DIFFERENT PERSON. Positive
  evidence against the match, not just absent evidence for it. Do not write it. "Lighthouse Lab"
  in that sense has no findable public web presence at all.
- **Maarten Kas** - Remotik "assists companies in securely managing and protecting their systems
  from one dashboard". Confirms the role, but Remotik has no reachable public site (remotik.nl does
  not resolve) and no team page anywhere. His only public presence is LinkedIn.

**Both are the same phone call.** That session was submitted by **atle.sommer@minbuza.nl** - the
Dutch Ministry of Foreign Affairs - who is the single contact for all five Dutch presenters
(Yuval Temam, Raymond Alves, Rogier Brakshoofden, Maarten Kas, Laurie Lancee). One email covers
both remaining gaps.

### A MISSING PERSON, which matters more than the two photos
**Rune Theill (CEO & Co-founder, Rockstart) moderates TWO Grill Sessions and has no row anywhere.**
He is named only in the Session Description prose - "moderated by CEO of Rockstart, Rune Theill" -
and the 2026-08-08 import only parsed the `1st..5th Presenter details` fields. That session's own
note predicted exactly this ("moderators named only in description prose are not caught").

Sessions: "Discover Dutch Tech - Science, Circularity and Security" and "Discover Dutch Tech -
Navigating Security, Infrastructure and Capital".

He is fully researched - handle `/in/runetheill` (the only Rune/Theill LinkedIn URL on
rockstart.com/team, with Crunchbase and The Org both naming him Co-founder & CEO) and a confirmed
portrait on Rockstart's own team page. `grill-add-moderator.mjs` will create him and **refuses to
run without `--mode=`**, because there is a real decision to make: every existing row carries ONE
Session Name and he moderates two, so it is either two rows or one. Not guessed on purpose.
Also verify the `Project Name` stage colour in that file before committing.

Worth re-running that prose scan against the OTHER event tables - if the Grill import missed a
moderator this way, the Event Room and side-event imports probably did too.

### What is actually left: two rows, both blocked
- **Maarten Kas** - photo only. No public portrait outside LinkedIn; remotik.nl does not resolve,
  and the EDIH / Enterprise Europe Network pieces that confirm "Maarten Kas, CEO van Remotik" carry
  no photo of him.
- **Yuval Temam** - handle AND photo. His identity is still unconfirmed, so there is nothing to
  attach a face to. The one NL profile with that name has a headline reading SES, not Lighthouse
  Lab; lighthouselab.io does not mention him; the ru.nl "Y. Temam" the other pass found is a
  different unconfirmed person. Guessing here puts a stranger's face on a speaker.
- **Ramona Ocak** - handle only, and this one is settled: she has no public LinkedIn. Verified as a
  real EU official via an InvestEU PDF, which puts her at DG ECFIN, not DG GROW as the row says.

None of the three is worth more search time. All three need one question to the submitting partner.

## Session 2026-08-11 (e) · One Event Room on its own: Deep Tech Event Day

**State:** working locally, not deployed. Copying a single Event Room as its own embed now names
the programme and draws it as one day.

Auri needed Deep Tech Event Room copied on its own and pasted onto a page. The single-column
embed already existed (`?stage=`), so this was three gaps around it rather than a new feature.

### What changed

1. `lib/brellaSections.ts` · `ROOM_DAY_PROGRAMMES` += `{ Event Room 6, 26 August, Deep Tech Event
   Day }`. Brella files all 13 sessions on the plain "Event Room 6" track, so `programmeOf()`
   found nothing and the column was an unlabelled room number. Same fix NISS and NASS already
   have. It also restores the derived "All day · Deep Tech Event Day" band, which is built from
   the programme name. The `ROOM_ALIASES` entry stays for the day a real track appears.
2. `lib/brellaEmbedSnippet.ts` · A single-column snippet splits Day 1 / Day 2 side by side. Deep
   Tech runs 26 August only, so half the embed read "Nothing on this day". New `ONE_DAY`, set
   from the DATA after load (never hardcoded), plus one `splitting()` helper every day-aware
   branch now asks. In one-day mode: no split, no day pills, and the date moves into the column
   heading, which is otherwise the only place it could appear.
3. `app/brella-program/page.tsx` · Copy button reads `Copy embed (Event Room 6 · Deep Tech Event
   Day)` instead of the room number alone.

### Verified

Built the real snippet, served it from `public/`, loaded it in Chrome: one column, heading
"Event Room 6 · DAY 1 · 26 August" with "Deep Tech Event Day" under it, all-day band, 13 sessions
in sequence, topic filter and speaker search intact, no empty second day. `tsc --noEmit` clean.
Dashboard preview shows the same. Temp files removed.

### Gotchas

- Testing an embed from localhost does NOT hit localhost. `lib/embedOrigin.ts` rewrites a
  loopback origin to `https://airtable-woad.vercel.app` on purpose, and the snippet repeats the
  check at runtime. To test locally, patch that constant in the GENERATED file, not in the lib.
- Playwright MCP was locked by another session all session ("Browser is already in use"). Chrome
  MCP worked instead.

### Then: strip it back to the room and the day (Auri, same session)

Two follow-ups, both scoped to SINGLE-COLUMN mode so the whole-board views are untouched.

4. `app/brella-program/page.tsx` · New `columnDays` memo: once a column is picked, only the days
   that column actually runs on get a tab. Event Room 6 shows DAY 1 alone. An effect follows the
   column onto a live day, or picking Room 6 on the 27th would leave `dayIdx` on a tab that no
   longer exists and blank the board. A column with nothing at all keeps both tabs on purpose.
5. Topic filter hidden whenever one column is chosen, on the page (`showTags`) and in the embed
   (`renderTags` early-returns on `SPLIT_DAYS`). New `changeStage()` clears chosen tags with the
   switch — the filter is gone from the screen, so a tag left on would dim cards with no way to
   turn it off.

Re-verified: single room = one DAY 1 tab, no tag box, 13 sessions. All rooms / Stages keep both
days and their tags; Campfire (no tags in the data) is unchanged. Embed: no day pills, no track
pills, tags hidden, 13 sessions, all-day band. `tsc --noEmit` clean.

### Next steps

1. Deploy, then copy the snippet from the deployed dashboard (not localhost) and paste it on the
   Deep Tech page.
2. Open question for Auri: heading is "Event Room 6" with "Deep Tech Event Day" underneath. If
   the target page is purely about Deep Tech, flip them so the programme leads.
3. Same one-day path now applies to any room that gains a single-day programme — check Event
   Room 4 (one session, 27 Aug) if it is ever copied on its own.

## Session 2026-08-11 (f) · ELEMENTOR HARDENING · the embed defends itself

Pasted onto techbbq.dk and it did not look like the dashboard. Four separate causes, all now fixed
IN THE SNIPPET rather than by asking someone to configure Elementor correctly.

### What the host page did to it

1. **The section was WHITE.** Every colour here is built for a dark page, so the section headings
   (#f2f2f2) and the un-selected pills went invisible — white on white. **Fix: the widget paints
   its own `--ground` (#0d0d0d) and no longer depends on the section's background at all.** Same
   reasoning as the `navy` theme in lib/agendaSnippet.ts: a panel on techbbq.dk cannot borrow a
   dark ground it might not get.
2. **The Elementor column was ~370px wide on a 1440px screen.** So `@media (max-width:720px)`
   never fired and the two-column panel stayed two columns inside 370px — a 170px text column
   beside a 150px photo. **Fix: the collapse is a CONTAINER query** (`container-type:inline-size`
   on the widget, `@container (max-width:720px)`), which asks how wide THIS WIDGET is. The viewport
   media query is kept underneath as the no-support fallback.
3. **Heading sizes were viewport-based**, so `clamp(26px,4vw,38px)` printed a 38px heading inside a
   370px column. **Fix: a second `font-size` using `cqi`** (1% of the widget's own width), declared
   after the vw version so old browsers keep the fallback and new ones override it.
4. **The theme restyled everything.** Uppercase right-aligned Georgia headings, 2em margins, disc
   bullets with 40px indent, button chrome, bordered rounded images, `p{font-size:19px}`,
   `section,div{background:#fff}`. **Fix: a reset block scoped to the widget's id**, before the real
   rules.

### !important, deliberately

The techbbq.dk theme declares `h2,h3{font-family:...!important}`, and **nothing but !important
outranks !important**. So the properties a theme realistically forces carry it here: font-family,
font-size on the root, text-transform, letter-spacing, text-align, margin/padding on text elements,
list-style, background, and border/radius/shadow on images. All of it is scoped to `#<uid>`, so it
cannot leak into the host page.

Two traps this created, both found by looking at a screenshot rather than at computed styles:
- `li{padding:0!important}` in the reset killed `.eg-list li{padding-left:13px}`, so every bullet
  sat on top of its text. The list indent needs !important too.
- `text-align:left` without !important lost to the theme, so panel titles were right-aligned.

### THE LESSON: computed styles said 25/26 PASS while the page looked broken

An assertion pass is not a working page. The check suite was green on the root and the panel while
a theme rule `section,div{background:#fff}` painted a white block behind the copy inside a dark
panel, and `p{font-size:19px}` inflated the body text. Neither element was in the suite.
**Screenshot the hostile case, then write the assertion for what the picture shows.**

### How it was verified

A deliberately hostile host page: white background, a 370px column, and a stylesheet that forces
`!important` on h2, h3, p, ul, li, button, img, figure, a, section and div. Against that:
- **30 of 30 property checks pass** (own ground, Onest headings, un-uppercased, centred section
  headings, pill shape/colour/width, image with no border/radius/shadow, no disc bullets, no list
  indent, eyebrow still uppercase, single column, no horizontal overflow).
- Behaviour intact in the narrow column: 8 distinct panel heights, slot hugs its panel exactly,
  inline height always cleared, section heading and tab row move **0**, 18 photos still deferred.
- Generated embed script passed `node --check` at every step.

### Elementor settings that still help (but are no longer required)

The snippet now survives the defaults. These just make it nicer: put it in a **full-width**
container, set the container's own padding to 0 (the widget brings its own), and there is no need
to set a background colour any more.

### Still open

Unchanged: review the look, and decide whether Brella and Online Event Platform stay two tabs.
`app/globals.css` got the same container query so the dashboard preview and the embed behave alike;
the dashboard does NOT carry the theme reset, because nothing there is fighting it.

## Session 2026-08-11 (d) · The box hugs its content AND the page still holds still

Correction to (c). Fixing the layout shift by stacking every panel in one grid cell made each
section as tall as its TALLEST panel, which left dead space under the short ones. Auri rejected
that: the box should grow to fit, not pad to the maximum.

### How both are true at once

Only the ACTIVE panel is in normal flow; the others are `position:absolute` in the same slot. So
the slot is exactly as tall as the panel being read — no reserved space. The height is then
ANIMATED between panels (260ms) rather than snapped.

The reason this satisfies "don't move the whole page": the section heading and the tab row sit
ABOVE the slot and never move, whatever the panel does. What you are looking at when you click a
tab stays exactly where it is. Content below the panel does shift by the height difference, which
is unavoidable if the box is to hug its content, and it now slides over a quarter second instead
of teleporting.

Height cannot transition to `auto`, so both renderers do the same dance: measure the outgoing
height BEFORE the swap, swap, clear the inline height to measure the incoming one, then transition
between the two pixel values and hand the height back to `auto` on `transitionend`. Leaving it
pinned would break reflow on a window resize. The React side does this in `useLayoutEffect` (not
`useEffect` — the new panel would flash at full height for a frame first). `prefers-reduced-motion`
skips straight to the new height.

The snippet keeps ONE `transitionend` listener per slot, replaced each time. Clicking faster than
the transition interrupts it, and a fresh listener per click would pile up on an element that can
be clicked all day.

### Measured, on both renderers

- Every section's slot height now **equals its active panel exactly**, and varies per tab:
  Event Essentials 305/369/382/392, On-Site 305/344/485/557, Work & Lounges 305/331/374,
  Safety 305/331/338/372. Food is 305 throughout. No dead space anywhere.
- The inline height is always cleared once it lands, so nothing is left pinned.
- Across all 8 tabs of the worst section: section heading delta **0**, tab row delta **0**,
  `scrollY` delta **0**.

### GOTCHA · `scroll-behavior: smooth` faked a bug THREE times

`html` has `scroll-behavior: smooth`, so a `window.scrollTo` is still animating when you read
`scrollY` or any `getBoundingClientRect().top`. It produced a phantom 200px "jump", then a phantom
800px one, and separately a run where every slot looked stuck at 344px because the measurement
landed mid-transition. **Settle first**: poll `scrollY` until it is unchanged for ~500ms before
taking a baseline, and poll the element height until it stops changing before reading it. Three
false alarms in one session came from measuring an animation instead of a layout.

## Session 2026-08-11 (c) · Onest, a page that holds still, no F.A.Q.

Three corrections from Auri after seeing (b). Typecheck clean, `npm run build` passes.

### 1. ONEST, not Archivo

The staging design is set in expanded Archivo and (b) matched it. Auri's call: the guide uses
**Onest**, the TechBBQ heading font, same as every other page and embed here. `--font-heading` on
the page, `family=Onest:wght@400;500;600;700&family=Inter:...` in the snippet — the exact link the
other embeds already use. The Archivo import is gone from the page, `font-stretch` is gone from the
CSS. **Do not reintroduce Archivo.**

The finding from (b) still stands and is now only a comment: the live guide asks Google Fonts for
`Archivo+Expanded`, which is not a family, gets a 400 and silently falls back to a system sans.

### 2. THE SECTION HEIGHT IS FIXED, so a tab switch moves nothing

Measured first, because the fix depends on where the movement actually was. The photo column's
`aspect-ratio` already floors every panel at 305px, so four of five sections only varied 67–87px.
**On-Site Experience was the problem: 305px (Venue Map) to 557px (Badge Claim)**, and the document
height swung 278px as you clicked through.

Fix: all of a section's panels are rendered and stacked in ONE grid cell (`.eg-slot` +
`grid-area:1/1`), so the section is always as tall as its tallest panel. Hidden panels keep their
space with `visibility:hidden` — not `display:none`, which would defeat the whole thing.

- Hidden panels get `aria-hidden` **and `inert`**. aria-hidden alone leaves their links focusable;
  verified that the Keypitt link inside a hidden panel now refuses focus.
- **Photos are deferred, not the text.** All 30 panels' copy is in the DOM from the start (cheap);
  each photo rides on `data-src` and is promoted the first time its panel is shown. Fresh load =
  5 images, 25 deferred. The figure holds its space through `aspect-ratio`, so promoting an image
  later shifts nothing. Without this a section of eight pulled eight photos for the one being read.
- The React side tracks a `visited` set for the same reason, so going back to a tab is instant.
- `select()` in the snippet no longer calls `sendHeight()` — the height cannot change on a switch.

Measured after, on BOTH renderers: per-section height spread **0**, document height spread **0**,
and with the scroll at rest, clicking all 30 tabs leaves `scrollY` **exactly where it was**.

Trade-off, accepted: dead space under the short panels in On-Site Experience, which is now a
constant 717px tall. That is the price of a page that holds still.

### 3. F.A.Q. REMOVED

Gone from the data file, the API response, the React component, the page, the CSS and the snippet
builder (`?faq=` on /api/embed too). The four answers were only ever drafts written from the rest of
the guide, because the design had them collapsed — better absent than invented. If it comes back,
the answers come from TechBBQ.

### GOTCHA · `scroll-behavior: smooth` fakes a layout shift

Measuring scroll stability looked like a 200px jump until it turned out `html` has
`scroll-behavior: smooth` globally, so a `scrollTo` is still animating when you read `scrollY`.
Poll until the position is stable for ~500ms BEFORE clicking anything, or you will chase a bug that
is your own instrumentation.

### Still open

Same as (b) minus the F.A.Q.: review the look, and decide whether Brella and Online Event Platform
stay two tabs or merge. Deliberate deviation from the design is unchanged (copy top-aligned in every
panel; the design bottom-aligns the Venue one).

## Session 2026-08-11 (b) · The Event Guide, rebuilt in the new design

Same branch `fix/tito-investor-day-brella-paging`, still NOT committed. Typecheck clean,
`npm run build` passes with `/event-guide` and `/api/event-guide` both in the route table.

New files: `lib/eventGuide.ts` (content), `lib/eventGuideSnippet.ts` (embed builder),
`components/EventGuide.tsx` (preview renderer), `components/CopyEventGuideEmbed.tsx`,
`app/event-guide/page.tsx`, `app/api/event-guide/route.ts`.
Edited: `app/globals.css` (+267 lines of `.eg-*`), `middleware.ts` (PUBLIC_PATHS),
`lib/pages.ts` (catalog row under Program), `app/api/embed/route.ts` (`kind=event-guide`).

### What changed about the guide

The old guide is a grid of icon cards that each open a popup. The staging techbbq.dk design
(Humandone, supplied as a PDF screencapture) has **no popups**: per section, a row of pill tabs over
ONE split panel, copy left and photo right, then an F.A.Q. with a left title and a right accordion.
That is what this now renders, in both places.

**Content lives in git, not Airtable** (Auri's call). 30 items in 5 sections. The design showed only
27 — Brella, Venue Map and Keypitt had no tab — and all three are back, because dropping a partner
and the official app off a live page silently is not a thing to do. Brella sits under Work & Lounges
next to Online Event Platform; the two overlap and could be merged if Auri wants.

### FOUR BUGS IN THE EXISTING GUIDE, found while porting it

1. **The font never loaded.** The live embed asks Google Fonts for `family=Archivo+Expanded`. There
   is no such family — that URL answers **HTTP 400** — so the guide has been rendering in a fallback
   sans this whole time. Archivo IS variable with a wdth axis (62–125), so Expanded is
   `family=Archivo:wdth,wght@125,400;...` plus `font-stretch:125%`. Do not "simplify" that back to a
   family name. next/font has no Archivo Expanded either, hence `axes:["wdth"]` on the page.
2. **12 of 28 photos were 404.** Every `/2025/01/*.jpg` in the old markup is gone: the site converted
   that batch to WebP and deleted the JPEGs. Same filenames, `.webp` extension. Fixed here; **the
   live guide is still showing 12 broken images today** until its markup is replaced.
3. **The dates were last year's.** Opening Hours said 26th/27th while Badge Claim, Info Desk and
   Keypitt said "Wednesday 27th / Thursday 28th", and the staging design carried 27/28 through.
   27–28 August was **TechBBQ 2025**, and it was also a Wed/Thu, which is why it reads as plausible.
   2026 is 26–27 August (Tito `2026` starts 2026-08-26; Brella confirms the 27th as closing). All
   dates in `lib/eventGuide.ts` are 26th/27th.
4. **"TechBBQ 2025" was still in the body copy** of Online Event Platform. Now 2026. The design also
   spells it "Firts Aid"; corrected to First Aid.

### Verified, not assumed

- `/api/event-guide` serves **30 items across 5 sections**, no item missing image/alt/blocks.
- The generated embed was fetched from `/api/embed?kind=event-guide`, its `<script>` extracted and
  passed to `node --check`: **valid JS**. Worth keeping up — a snippet builder is a template literal
  and tsc cannot see inside it. One backtick in a comment (around the word draft) silently closed
  the template and was only caught this way.
- Ran the snippet in a real browser from a same-origin test page: 5 sections, 30 tabs, clicking the
  last tab in all five at once switched all five **independently**, exactly one `aria-selected` per
  tablist, `aria-controls`/`aria-labelledby` correct after every swap, one tabbable pill per list.
  Identical result on the React preview page.
- **All 30 photos clicked through and loaded in-browser**, zero broken.
- Phone at 390px: single column, photo above the copy, tabs scroll sideways, no horizontal page
  overflow.

### GOTCHA that cost time here

A blank photo in a screenshot is usually a lie. Twice: once `loading="lazy"` had simply not fired
under a fullPage screenshot, and once the browser was rendering a **stale cached feed** whose items
still carried `.jpg` while the server was already serving `.webp`. Check
`img.naturalWidth` and re-fetch with `cache:"reload"` before believing an image is broken.

### NEXT STEPS

1. **The four F.A.Q. answers are DRAFTS and need Auri's approval.** The design had them collapsed,
   so there was nothing to copy and they were written from the rest of the guide. "Are sessions
   recorded" in particular is a policy question this repo has no source for. They are badged on the
   dashboard and the embed builder **refuses to emit a draft at all**, so the F.A.Q. is empty in the
   copied snippet until the `draft` flag is cleared per row in `lib/eventGuide.ts`.
2. Review the look against the PDF and say what to change. Deliberate deviation: the design
   bottom-aligns the copy in the Venue panel and top-aligns it everywhere else; everything here is
   top-aligned, which is predictable across 30 panels of very different length.
3. Decide whether Brella and Online Event Platform stay as two tabs or merge into one.
4. Then paste it: Copy embed code on `/event-guide`, from the DEPLOYED dashboard. No hero in the
   snippet, because the WordPress page has its own title.
5. Tell whoever owns the current guide markup about the dead font link and the 12 broken images —
   those are live right now, independent of this rebuild.

## Session 2026-08-11 · What the three connections can and cannot do, and two silent failures

Branch `fix/tito-investor-day-brella-paging`, NOT merged, NOT committed. Typecheck clean,
`npm run build` passed, `.next` removed afterwards. Files: `lib/tito.ts`,
`lib/brellaprogram.ts`, `app/api/tito-lookup/route.ts`.

Started as "what data do we actually have, and where does each source stop". Probing the three
APIs live turned up two bugs that fail silently, which is why nobody had noticed either.

### Tito was blind to 227 ticket holders

`TITO_EVENTS` listed four events. The Tito account has **five**: `investor-day-2026` was missing
and holds **227 tickets**. A support lookup searched the other four, matched nothing, and answered
"no ticket" to a real attendee. No error, no log, just a wrong answer somebody then acts on.

Fixed by adding the slug. Verified: "Jensen" now returns 3 Investor Day people who were
structurally unreachable before. Safe because all three uses of the array are length-agnostic
(`.map`, index-by-`i`, `=== TITO_EVENTS.length`), and the searches run in parallel so
`maxDuration = 20` still covers five.

**Slug and title differ in Tito.** `investor-dinner-2026` is titled "TechBBQ Investor x Founder
Dinner". Labels here were taken from `GET /v3/techbbq/events` rather than invented. Check that
endpoint against this list whenever a new event opens.

### Brella fetched one page and stopped

`fetchBrellaProgram` fired a single `page[size]=500` with no loop. Fine at 281 timeslots, but the
501st would have vanished with no error anywhere: the programme would just be short, and nobody
would spot it until a session was missing from techbbq.dk.

Brella's paging, all verified before writing the loop:
- `page[number]` works. Pages of 100 gave 100 + 100 + 81 = 281.
- A page past the end returns **HTTP 200 with empty `data`**, so the loop has a real terminator.
- **`included` DIFFERS PER PAGE** (344, 360, 252 records). This was the trap. Indexing only the
  last page would have stripped tracks, tags and speakers off most sessions.
- The paged union equals the single big call: same 281 timeslot ids, same 838 `included` keys.

Proof nothing broke: ran the new code locally and diffed `/api/program?event=brella` against
production (still old code). Same 247 sessions, same ids, and with the origin prefix normalised the
payloads are **byte-identical, 405,851 bytes both sides**. The 14 apparent diffs were all
absolute-vs-relative URLs, which is pre-existing origin resolution on localhost.

At 281 rows it still finishes in ONE request, so today's behaviour is unchanged.

### The limits of each source, measured not assumed

- **Airtable**: the token reads the whole base, **52 tables**, including `Speakers` (260 fields,
  passports/DOB/emails) and `Tech Talent`. `SAFE_FIELDS` allow-lists are the ONLY thing between
  that and techbbq.dk. A per-table scoped token would be the real fix. `/meta/whoami` does not
  return the scope list, so exact permissions need airtable.com/create/tokens. Rate limit is 5
  req/s per base, shared by every route here; 6 concurrent reads did not 429.
- **Brella**: 281 timeslots, 421 speakers, 911 attendees readable. `meetings` returns **404** with
  this key, so matchmaking data needs a different permission. The key can WRITE: `lib/*` is GET-only
  by discipline, `brella-push*.mjs` is not.
- **Tito**: 5 events, 3,121 tickets in the main one. **Hides tickets by default** and a lot of them:
  170 of 3,121 in 2026, 52 of 171 in LP Forum. `ALL_STATES` handles this, so any NEW Tito read
  must pass it too. Lookup caps at 25 hits per event, deliberate, fine for support and useless for
  a full list.

Stale numbers corrected while here: code comments said "80 timeslots, 30 published sessions" and
progress.md said 356 Brella speakers. Reality is 281 and 421. The event grew.

### NEXT STEPS

1. **Review the diff and merge** `fix/tito-investor-day-brella-paging`. Nothing is committed yet.
   The Tito fix matters before the summit: support is answering Investor Day people wrongly today.
2. Still open from yesterday and unchanged: **24 Board Summit headshots**. Verified live, still
   3 photos and 0 LinkedIn across the 27 rows.
3. Verify the **Policy Stage dates** against Brella. Airtable's day numbering and Brella's do not
   agree, Board Summit's 27 Aug is confirmed, Policy's 26 Aug is not.
4. Consider a scoped Airtable token per table instead of one base-wide read token.

### GOTCHA

The **production dashboard password differs from local `.env.local`**: `INTERNAL_USER`/`INTERNAL_PASS`
from the local file gets a **401** against `airtable-woad.vercel.app`. That blocked the prod
before/after on `/api/tito-lookup`. If you need to hit a gated endpoint in production, that
password lives somewhere other than your local env file.

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
2. **`Email` is not in `SAFE_FIELDS`**, so it never reaches the process, let alone the JSON.
   Recruiters go through LinkedIn, a channel the intern can close. An address on an indexed page is
   a spam magnet and the intern is the one who pays for it.
3. **It expires by itself.** See below.

### The manager, added 2026-08-17, and why it is not a hole in rule 2
Auri asked the worklist to say who each intern reports to, and for the name to open that manager's
LinkedIn. `Manager (internal) Reference` is a LINK to `#TechBBCuties`, so Airtable returns record
ids and `fetchManagers()` resolves them against that table — `Name` and `LinkedIn` only, nothing
else off that wide table — in one extra request per cache miss. Chunked at 50 ids, and it never
throws: a failed lookup drops the manager line rather than the page.

The field is `managers: InternManager[]`, a LIST, because the Airtable column is a link field and
permits several. Each entry is `{id, name, linkedin}`, the URL run through `normalizeLinkedInUrl`
like every other feed. A manager with no LinkedIn renders as plain text, not a dead link. All 12
managers currently have one.

Two things keep it internal, not one:

- `lib/interns.ts` appends the column to `fields[]` **only when `includePending` is set**, which the
  route honours only behind the dashboard password. On a public read the column is not in the
  Airtable query at all, exactly like `Email`, and there is no second request either.
- `stripInternal()` in the route removes `managers` alongside `pitchFull` from the public shape, so
  the key cannot reappear through the shared cache. Verified against the running dev server:
  `?pending=1` returned all 12 names with their profile URLs, the public read had no `managers` key
  at all.

The manager's LinkedIn is not a new exposure: `#TechBBCuties` LinkedIn is already published by
`/api/team` and rendered by the team embed on techbbq.dk. It is read here only to make the name
pressable, and it is stripped from the public intern feed with the rest of the field.

It IS kept on a no-consent row, which otherwise carries nothing but a name. That row exists so
somebody chases the consent tick, and the manager is who does it. A manager is TechBBQ's own staff
record, not the intern's personal data, and it is never published — the public card says nothing
about who they report to, because that is our org chart and not their pitch.

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
