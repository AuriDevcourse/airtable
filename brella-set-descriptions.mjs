// Write the two missing SESSION DESCRIPTIONS into BRELLA. Copy supplied by Auri, 2026-08-17.
//
// WHY IN BRELLA AND NOT IN AIRTABLE: both of these are Brella's own rows — Event Room 3 on the 26th
// and Event Room 1 on the 27th — and Brella is what the attendee app reads. techbbq.dk reads it too,
// through lib/brellaprogram.ts, so one write lands in both. Mostly. See the note on the Board Summit
// below, which is the exception.
//
//   node brella-set-descriptions.mjs            dry run, prints the before and after
//   node brella-set-descriptions.mjs --commit   writes it
//
// HOW THE WRITE WORKS, all of it measured in brella-push-cbc.mjs on 2026-08-12 and none of it
// guessable: Brella READS `content` as a Draft.js document ({blocks:[{text,…}],entityMap}) and WRITES
// it as a PLAIN STRING under a Rails-style `{timeslot: {...}}` envelope. Sending the Draft.js shape
// back 500s; sending the string makes Brella build the document itself. `description`, `content_html`
// and `body` are all accepted with 200 and silently ignored, so a 200 is NOT proof a field landed —
// which is why this script reads every row back afterwards.
//
// ONE \n PER PARAGRAPH, not two. Each line becomes its own Draft.js block, which the app renders as
// a paragraph with its own spacing; a blank line would add an empty block between them.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("./.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const BRELLA = env.BRELLA_API_KEY || env.BRELLA || process.env.BRELLA_API_KEY;
if (!BRELLA) {
  console.error("BRELLA_API_KEY is not set.");
  process.exit(1);
}

const EV = "https://api.brella.io/api/integration/organizations/109/events/10356";
const R = { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" };
const W = { ...R, "Content-Type": "application/json" };
const COMMIT = process.argv.includes("--commit");

// ── BOARD SUMMIT, Event Room 1, 27 August ─────────────────────────────────────────────────────
//
// THE LAST LINE IS NOT AURI'S COPY, IT IS A REPLACEMENT FOR SOMETHING THIS WRITE DESTROYS.
//
// The row's only content today is the single line "Boardway_TechBBQ_Program_2026", and that text is
// a HYPERLINK to the programme on Google Drive (entityMap LINK →
// drive.google.com/file/d/1VDre9Bcf7tsKNrWr8XL9OdrjSy8bCGtz). The write API cannot carry a
// hyperlink: a string produces a document with an empty entityMap, and the Draft.js shape is
// rejected. So overwriting `content` deletes the only route from the attendee app to the programme.
//
// The URL is therefore restated in plain text, pointing at OUR copy on techbbq.dk rather than at
// Drive — same document, on a domain we control, and the one already linked from the board and the
// embed. If Brella's app does not auto-link a bare URL it is still readable, and it takes one action
// in Brella's admin to select the line and make it a link again. Delete this line if Auri wants his
// copy verbatim and will re-link the Drive file himself.
const BOARD = {
  id: 975697,
  expect: "Board Summit by Boardway",
  text: [
    "Board Summit 2026 is Denmark's largest board event. An official side event at TechBBQ 2026, gathering 1,000+ chairs, board professionals, top executives, owners, founders, and investors for a full day dedicated to modern board work and governance.",
    "Full program: https://techbbq.dk/wp-content/uploads/2026/08/Board-Summit-Program-2026.pdf",
  ].join("\n"),
};

// ── NORDIC IPO & STOCK MARKET DAY, Event Room 3, 26 August ────────────────────────────────────
//
// Nothing is lost here: `content` is EMPTY on this row (no blocks, no entityMap), which is why the
// block has read as five hours with a title and nothing else all summer. Auri's copy verbatim.
const IPO = {
  id: 975699,
  expect: "Nordic IPO & Stock Market Day 2026",
  text: [
    "The Association of Listed Danish Companies (FBV) invites companies, investors and the stock market eco-system to join this event at TechBBQ, which includes both networking and great speakers on stage.",
    "We have limited seats, so please don't wait to register for your ticket.",
    "TechBBQ has become the heartbeat of the startup and innovation ecosystem in Scandinavia. Last year, more than 10,000 people attended the two-day conference in Copenhagen, including 1,200 investors and 400 speakers.",
    "The Nordic IPO + Stock Market Day at TechBBQ will bring together key people from across the growth and capital markets ecosystem to explore how public markets can support the next generation of Nordic and European companies.",
    "Venture capital is a vital source of funding for scaleups and growth companies. But as companies mature, their capital needs evolve, and a stock market listing can become an attractive and strategic next step.",
  ].join("\n"),
};

const TARGETS = [BOARD, IPO];

// ── read ──────────────────────────────────────────────────────────────────────────────────────
// GET /timeslots/<id> 404s — there is no single-timeslot read (brella-push-cbc.mjs, same finding),
// so the collection is paged and filtered here.
async function all() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${EV}/timeslots?page[size]=200&page[number]=${page}`, { headers: R });
    if (!res.ok) {
      console.error("read failed", res.status, await res.text());
      process.exit(1);
    }
    const j = await res.json();
    out.push(...(j.data || []));
    if ((j.data || []).length < 200) break;
  }
  return out;
}

const flat = (c) =>
  c && Array.isArray(c.blocks) ? c.blocks.map((b) => b.text).join("\n") : "";
const links = (c) =>
  c && c.entityMap
    ? Object.values(c.entityMap)
        .filter((e) => e && /LINK/i.test(e.type || ""))
        .map((e) => e.data && e.data.url)
    : [];

let rows = await all();
for (const t of TARGETS) {
  const row = rows.find((x) => Number(x.id) === t.id);
  if (!row) {
    // A pinned id is the one thing that can rot here: the 15:35 Investor Reverse Pitch was deleted
    // and recreated during NASS, which changed its id. Writing a description onto whatever row
    // happens to hold this id now would be worse than writing none.
    console.error(`ABORT: timeslot ${t.id} (${t.expect}) is gone. Re-read the ids.`);
    process.exit(1);
  }
  if (row.attributes.title !== t.expect) {
    console.error(
      `ABORT: ${t.id} is titled "${row.attributes.title}", expected "${t.expect}".`
    );
    process.exit(1);
  }
  const was = flat(row.attributes.content);
  const lost = links(row.attributes.content);
  console.log(`\n=== ${t.id} · ${t.expect}`);
  console.log(`  was: ${JSON.stringify(was) || '""'}`);
  if (lost.length) {
    console.log(`  !! this write DESTROYS ${lost.length} hyperlink(s) the API cannot rewrite:`);
    lost.forEach((u) => console.log(`     ${u}`));
  }
  console.log(`  now: ${t.text.split("\n").length} paragraph(s), ${t.text.length} chars`);
  t.text.split("\n").forEach((p) => console.log(`     · ${p.slice(0, 110)}${p.length > 110 ? "…" : ""}`));
}

if (!COMMIT) {
  console.log("\nDRY RUN — re-run with --commit to write.");
  process.exit(0);
}

console.log("");
for (const t of TARGETS) {
  const res = await fetch(`${EV}/timeslots/${t.id}`, {
    method: "PATCH",
    headers: W,
    body: JSON.stringify({ timeslot: { content: t.text } }),
  });
  if (!res.ok) {
    console.error(`write ${t.id} failed ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log(`PATCHed ${t.id}`);
  await new Promise((r) => setTimeout(r, 400));
}

// READ BACK, because a 200 from this API is not evidence. Compared against what was sent rather than
// merely printed, so a silently-ignored field fails the run instead of looking like a success.
rows = await all();
let bad = 0;
for (const t of TARGETS) {
  const got = flat(rows.find((x) => Number(x.id) === t.id)?.attributes.content);
  const ok = got.replace(/\s+/g, " ").trim() === t.text.replace(/\s+/g, " ").trim();
  console.log(`${ok ? "OK  " : "FAIL"} ${t.id} · ${t.expect}${ok ? "" : `\n  got: ${JSON.stringify(got)}`}`);
  if (!ok) bad++;
}
console.log(
  bad
    ? `\n${bad} row(s) did not take. Nothing to roll back automatically — the old text is in the dry-run output above.`
    : "\nDONE. techbbq.dk caches the Brella feed for an hour; use Refresh from Brella."
);
