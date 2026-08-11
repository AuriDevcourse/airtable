// PENDING A DECISION FROM AURI - does nothing until you pass --commit, and read the note first.
//
// Rune Theill (CEO & Co-founder, Rockstart) MODERATES TWO Grill Sessions and has NO row anywhere
// in the Speakers view. He was missed because he is named only in the Session Description PROSE
// ("moderated by CEO of Rockstart, Rune Theill"), and the 2026-08-08 import only parsed the
// "1st..5th Presenter details" fields. That session's note already predicted this:
// "moderators named only in description prose are not caught - fix by hand".
//
// THE DECISION: every existing Grill row carries ONE Session Name, and he moderates two sessions:
//   - "Discover Dutch Tech - Science, Circularity and Security"
//   - "Discover Dutch Tech - Navigating Security, Infrastructure and Capital"
// So this is either TWO rows (consistent with the one-row-per-person-per-session shape) or ONE row
// naming a single session. Pick with `--mode=two` or `--mode=one`. There is no default on purpose.
//
// His data is fully researched and verified:
//   LinkedIn  linkedin.com/in/runetheill - the only Rune/Theill LinkedIn URL on rockstart.com/team,
//             and Crunchbase + The Org both name him Co-founder & CEO of Rockstart
//   Photo     rockstart.com own team page, rune-1.jpg, opened and confirmed a single-person portrait
//
// SAFETY: "Grill Session" matches none of the Project Name filters on the seven live feeds, so a
// row created here cannot reach techbbq.dk. Hash the feeds before and after anyway.

const token = process.env.AIRTABLE_TOKEN;
const BASE = "appgXNjXJqpk9Ebxd", T = "tblTecOBecLQCNIeD";
const h = { Authorization: `Bearer ${token}` };
const COMMIT = process.argv.includes("--commit");
const MODE = (process.argv.find(a => a.startsWith("--mode=")) || "").slice(7);

const SESSIONS = [
  "Discover Dutch Tech - Science, Circularity and Security",
  "Discover Dutch Tech - Navigating Security, Infrastructure and Capital",
];
const BASE_FIELDS = {
  "Full Name": "Rune Theill",
  "Job Title": "CEO & Co-founder",
  "Company": "Rockstart",
  "Role": "Moderator",
  "Project Name": "Orange Grill Session",   // both sessions are on the Orange stage - VERIFY before commit
  "LinkedIn Handle": "https://www.linkedin.com/in/runetheill",
  "Profile Picture": [{ url: "https://rockstart.com/wp-content/uploads/2022/01/rune-1.jpg", filename: "Rune Theill.jpg" }],
};

if (!MODE) {
  console.log("Refusing to guess the row shape. Pass --mode=two (one row per session) or --mode=one.");
  console.log("Read the header of this file first - the choice is a real one.");
  process.exit(1);
}

// never create a duplicate: check he is not already there under any spelling
let recs = [], offset;
do {
  const u = new URL(`https://api.airtable.com/v0/${BASE}/${T}`);
  u.searchParams.set("pageSize", "100");
  if (offset) u.searchParams.set("offset", offset);
  const j = await (await fetch(u, { headers: h })).json();
  if (j.error) { console.error(JSON.stringify(j.error)); process.exit(1); }
  recs = recs.concat(j.records || []); offset = j.offset;
} while (offset);
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, "");
if (recs.some(r => norm(r.fields["Full Name"]) === norm("Rune Theill"))) {
  console.log("Rune Theill already exists in this table. Nothing to do."); process.exit(0);
}

const rows = (MODE === "two" ? SESSIONS : SESSIONS.slice(0, 1))
  .map(s => ({ fields: { ...BASE_FIELDS, "Session Name": s } }));

rows.forEach(r => console.log(`will CREATE: ${r.fields["Full Name"]} · ${r.fields["Role"]} · ${r.fields["Session Name"]}`));
console.log(`\n${rows.length} row(s) to create.`);
if (!COMMIT) { console.log("DRY RUN. add --commit"); process.exit(0); }

const r = await fetch(`https://api.airtable.com/v0/${BASE}/${T}`, {
  method: "POST", headers: { ...h, "Content-Type": "application/json" },
  body: JSON.stringify({ records: rows }),
});
if (!r.ok) { console.error("POST failed", r.status, (await r.text()).slice(0, 400)); process.exit(1); }
console.log("created:", rows.length);
