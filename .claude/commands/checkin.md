---
description: Check the Airtable inbox tables for rows still waiting on Auri, then offer to do them
allowed-tools: Bash(node scripts/checkin.mjs*), Read, Grep, Glob
---

Run the Airtable check-in and report what is waiting on Auri.

1. Run `node scripts/checkin.mjs` (read-only, never writes to Airtable).
2. Summarise the result the way Auri wants it: shortest useful form, overdue items first,
   and for each one say what the actual next action is, not just the row name. If a row is
   missing cells, the action is "chase whoever filed it" or "fill it in", so say which.
3. If nothing is outstanding, say exactly that in one line and stop. Do not pad it.
4. Offer to help with the work you can actually do from here (drafting a chase message,
   pulling artwork specs, checking a related table). Do not start any of it unprompted, and
   never write to Airtable without Auri saying yes.

Watched tables live in the `WATCHES` array in `scripts/checkin.mjs`. Adding one is a single
config block: table id, view id, the fields to read, a `needsAction` rule, and a `missing`
rule for the cells Auri has to fill. If Auri names a new table to watch, add it there rather
than querying it ad hoc, so the next check-in includes it automatically.
