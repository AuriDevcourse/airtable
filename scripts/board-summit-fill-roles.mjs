// Put the FOUR MISSING PEOPLE on the Board Summit, from Boardway's own run of show
// (Board-Summit-Program-2026.pdf, sent to TechBBQ 11/8, uploaded to techbbq.dk 17/8).
//
// WHAT WAS MISSING. The 14 Board Summit sessions already name their line-up, and 27 of the 31
// people in the CRM are on them. Four are not, and it is the same four in both places:
//
//   Barbara Myhre Isaksen   moderates "Human Judgment in AI"        (the cell was empty)
//   Henrik Horn Andersen    moderates "Technology, Trust & Society"  (the cell said "TBC")
//   Line Kloster Pedersen   pitches on "Boardroom Dilemmas"          (missing from Speaker Details)
//   Frederikke Schmidt      pitches on "Boardroom Dilemmas"          (missing from Speaker Details)
//
// They are also the four rows in Marketing Project Overview with NO `Role`, which is not a
// coincidence: /board-summit publishes a person only once somebody has typed Speaker or Moderator
// (lib/boardsummit.ts, BOARD_ROLES), so all four are off the roster wall as well as off the agenda.
// One cause, two symptoms, and this script fixes both.
//
// ROLES FROM THE PDF'S OWN LABELS, per Auri (2026-08-17: "the interviewer is the moderator and the
// interviewee is a speaker technically"):
//   Interviewer / Moderator  -> Moderator
//   Interviewee / Speaker / Panel / Keynote speaker / Founders -> Speaker
// The two founders pitching Boardroom Dilemmas are Speakers by that rule. The PDF files them under
// a third heading, "Founders (3 x)", which is a fact about the session and not a role the roster has.
//
// TWO THINGS THE PDF SAYS THAT THIS SCRIPT DELIBERATELY DOES NOT WRITE — see progress.md:
//   - "Can Europe Compete?" lists Bjarne Corydon as its MODERATOR and names no panel at all. Moving
//     him would leave a card with a moderator and nobody speaking, which is worse than the mild
//     mislabel it fixes. He stays a Speaker until Boardway names the guest.
//   - The PDF's "Live Interview" puts Henriette Divert under "Interviewee" and Viktor Axelsen under
//     "Speakers". That is the PDF's own typo — she is the Interviewer on the two sessions either
//     side of it — and the data already has it the right way round.
//
// The name text is written as "Name, Title at Company", the format the other 11 rows already use
// (parsePeople in lib/program.ts splits on "·" then on the first comma). The FACE is not written
// here at all: it comes from the CRM join on the name (lib/programFaces.ts), and all four already
// have a photo there.
//
//   node scripts/board-summit-fill-roles.mjs           dry run, prints every change
//   node scripts/board-summit-fill-roles.mjs --write   applies it

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const TOKEN = env.AIRTABLE_TOKEN;
const BASE = env.AIRTABLE_BASE_ID;
if (!TOKEN || !BASE) {
  console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID missing from .env.local");
  process.exit(1);
}

const CRM = "tblTecOBecLQCNIeD"; // Marketing Project Overview — the faces and the Role gate
const SESSIONS = "tblSlpTzDi2oVYwqv"; // Sessions — the agenda itself
const WRITE = process.argv.includes("--write");

// ── the four people ───────────────────────────────────────────────────────────────────────────
// `crm` is the record id in Marketing Project Overview, read on 2026-08-17. Pinned rather than
// matched by name, because the CRM spells three of these with DOUBLE SPACES ("Line  Kloster
// Pedersen") and an id cannot be defeated by whitespace. `text` is what goes into the session cell,
// with the spacing normalised — the join folds whitespace either way (key() in programFaces.ts), so
// the agenda can be written the way a human reads it.
const PEOPLE = [
  {
    crm: "recZUCV7BAAlnE73n",
    name: "Barbara Myhre Isaksen",
    role: "Moderator",
    text: "Barbara Myhre Isaksen, Senior Lead - Cloud & AI at Microsoft",
  },
  {
    crm: "recV5Ct841kPDWojS",
    name: "Henrik Horn Andersen",
    role: "Moderator",
    text: "Henrik Horn Andersen, Partner at Implement Consulting Group",
  },
  {
    crm: "rec6qATOz5fkrNUwK",
    name: "Line Kloster Pedersen",
    role: "Speaker",
    // "Visibuilt" is the CRM's spelling; the PDF writes "Visibuild". The CRM is what every other
    // page on techbbq.dk already shows for her, so it wins here.
    text: "Line Kloster Pedersen, Founder & CEO at Visibuilt",
  },
  {
    crm: "reckgNSitd6OyFYbF",
    name: "Frederikke Schmidt",
    role: "Speaker",
    text: "Frederikke Schmidt, Founder & Creative Director at Roccamore",
  },
];

// ── where each one goes on the agenda ─────────────────────────────────────────────────────────
// Session record ids, read on 2026-08-17. `field` is which cell; `mode` is how it lands:
//   set     the cell holds nothing usable ("" or the "TBC" placeholder parsePeople drops)
//   append  the cell already names people and these join the end, in the PDF's order
const PLACEMENTS = [
  {
    session: "recizLMkwHw2yKGoE",
    title: "Fireside Chat: Human Judgment in AI",
    field: "Moderator Details",
    mode: "set",
    people: ["Barbara Myhre Isaksen"],
  },
  {
    session: "recgu7YO4TW8wG0it",
    title: "Panel: Technology, Trust & Society",
    field: "Moderator Details",
    mode: "set",
    people: ["Henrik Horn Andersen"],
  },
  {
    session: "recGTmiPYwWKqh3fW",
    title: "Pitch & Panel: Boardroom Dilemmas",
    field: "Speaker Details",
    mode: "append",
    people: ["Line Kloster Pedersen", "Frederikke Schmidt"],
  },
];

const byName = new Map(PEOPLE.map((p) => [p.name, p]));
const H = { Authorization: `Bearer ${TOKEN}` };

async function read(table, ids, fields) {
  // THE LIST ENDPOINT WITH A RECORD_ID() FILTER, not GET /<table>/<recordId>. The single-record
  // route takes no `fields[]` parameter and 422s on one ("parameter validation failed", measured
  // 2026-08-17), and these tables are 113 fields wide — asking for everything to read three cells
  // is how unrelated internal data ends up in a log. The list route honours the allow-list.
  const params = new URLSearchParams();
  params.set("filterByFormula", `OR(${ids.map((id) => `RECORD_ID()='${id}'`).join(",")})`);
  for (const f of fields) params.append("fields[]", f);
  params.set("pageSize", "100");
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}?${params}`, { headers: H });
  if (!res.ok) throw new Error(`read ${table} failed ${res.status}: ${await res.text()}`);
  const { records } = await res.json();
  const missing = ids.filter((id) => !records.some((r) => r.id === id));
  if (missing.length) throw new Error(`${table}: record(s) gone — ${missing.join(", ")}`);
  return records;
}

// ── phase 1: the Role gate in the CRM ─────────────────────────────────────────────────────────
const crmRows = await read(CRM, PEOPLE.map((p) => p.crm), ["Full Name", "Role", "Session Name"]);
const crmUpdates = [];
for (const row of crmRows) {
  const want = PEOPLE.find((p) => p.crm === row.id);
  const fields = {};
  // `Role` IS A MULTI-SELECT, not a single select — measured against the base schema on 2026-08-17,
  // after a bare string 422'd with "Cannot parse value for field Role". Its options are Speaker,
  // Moderator, Keynote, Managing Partner and Host, and a row may legitimately carry two. So the
  // value is an ARRAY, and an existing role is kept rather than replaced: lib/boardsummit.ts reads
  // the first tag, and overwriting somebody's "Keynote" to say "Speaker" would be this script
  // deciding something nobody asked it to.
  const roles = Array.isArray(row.fields.Role) ? row.fields.Role : [];
  if (!roles.length) fields.Role = [want.role];
  // Collapse the double spaces while we are on the row. The roster wall prints `Full Name`
  // verbatim, so "Barbara  Myhre   Isaksen" is visible on a public page today.
  const clean = String(row.fields["Full Name"] || "").replace(/\s+/g, " ").trim();
  if (clean && clean !== row.fields["Full Name"]) fields["Full Name"] = clean;
  if (row.fields["Session Name"] !== "Board Summit") {
    // Not touched, only reported: this is the field lib/boardsummit.ts filters on, and a row that
    // does not carry it would silently stay off the wall no matter what Role says.
    console.log(`  ! ${clean}: Session Name is ${JSON.stringify(row.fields["Session Name"])}, not "Board Summit"`);
  }
  if (!Object.keys(fields).length) {
    console.log(`  = ${clean}: already ${roles.join(", ")}`);
    continue;
  }
  console.log(`  ~ ${clean}: ${JSON.stringify(fields)}`);
  crmUpdates.push({ id: row.id, fields });
}

// ── phase 2: the agenda cells ─────────────────────────────────────────────────────────────────
const PLACEHOLDER = /^(tbc|tba|tbd|to be (confirmed|announced))\.?$/i;
const sessionRows = await read(
  SESSIONS,
  PLACEMENTS.map((p) => p.session),
  ["Session Name", "Speaker Details", "Moderator Details"]
);
const sessionUpdates = [];
for (const place of PLACEMENTS) {
  const row = sessionRows.find((r) => r.id === place.session);
  if (row.fields["Session Name"] !== place.title) {
    // A renamed or recreated row is the one way these pinned ids go wrong, and writing a line-up
    // onto the wrong session is worse than writing none. Same reasoning as the title check in
    // brella-push-cbc.mjs.
    console.error(`  ABORT ${place.session}: expected "${place.title}", found "${row.fields["Session Name"]}"`);
    process.exit(1);
  }
  const current = String(row.fields[place.field] || "").trim();
  const additions = place.people.map((n) => byName.get(n).text);
  const keep = current
    .split("·")
    .map((x) => x.trim())
    .filter((x) => x && !PLACEHOLDER.test(x));
  // Idempotent: a name already in the cell is not added twice.
  const fresh = additions.filter((a) => !keep.some((k) => k.split(",")[0].trim() === a.split(",")[0].trim()));
  if (!fresh.length) {
    console.log(`  = ${place.title} · ${place.field}: already there`);
    continue;
  }
  const next = (place.mode === "append" ? [...keep, ...fresh] : fresh).join(" · ");
  console.log(`  ~ ${place.title} · ${place.field}`);
  console.log(`      was: ${JSON.stringify(current)}`);
  console.log(`      now: ${JSON.stringify(next)}`);
  sessionUpdates.push({ id: row.id, fields: { [place.field]: next } });
}

console.log(`\nCRM role/name rows: ${crmUpdates.length} · session cells: ${sessionUpdates.length}`);
if (!WRITE) {
  console.log("DRY RUN — re-run with --write to apply.");
  process.exit(0);
}

// NO `typecast`. Speaker and Moderator are already options on the `Role` multi-select, and typecast
// would turn a typo into a brand-new option instead of the 422 that stops the run. A 422 rejects the
// WHOLE batch, so a stopped run has written nothing — which is why this is the safe direction.
async function patch(table, records) {
  if (!records.length) return;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}`, {
      method: "PATCH",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch }),
    });
    if (!res.ok) throw new Error(`write ${table} failed ${res.status}: ${await res.text()}`);
    console.log(`  ${table}: ${i + batch.length}/${records.length}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

await patch(CRM, crmUpdates);
await patch(SESSIONS, sessionUpdates);
console.log("DONE — /program?event=board and /board-summit are behind a 1h cache; use the refresh button.");
