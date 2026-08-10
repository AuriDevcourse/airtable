// Read-only. Are the Grill Session presenters already in BRELLA as speaker records?
//
// Matched three ways, because Brella is not consistent: most records put the WHOLE name in
// `first-name` and leave `last-name` null, spellings drift, and some people are listed under a
// different company. Anything short of an exact hit is printed as a near-miss for a human to
// judge rather than silently counted either way.
//
// GET only. The same key can create and delete sessions in the live attendee app.
const AIR = process.env.AIRTABLE_TOKEN, BRELLA = process.env.BRELLA_API_KEY || process.env.BRELLA;
const BASE = "appgXNjXJqpk9Ebxd", GRILL_T = "tblTecOBecLQCNIeD", GRILL_V = "viwfIcQFDNQ9ggSqx";

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = s => norm(s).split(" ").filter(w => w && !/^(dr|prof|mr|ms|mrs|van|der|de|den|von|el|al)$/.test(w));

let recs = [], offset;
do {
  const u = new URL(`https://api.airtable.com/v0/${BASE}/${GRILL_T}`);
  u.searchParams.set("view", GRILL_V); u.searchParams.set("pageSize", "100");
  if (offset) u.searchParams.set("offset", offset);
  const j = await (await fetch(u, { headers: { Authorization: `Bearer ${AIR}` } })).json();
  recs = recs.concat(j.records || []); offset = j.offset;
} while (offset);
const grill = recs.filter(r => /Grill Session$/i.test(r.fields["Project Name"] || ""))
  .map(r => ({
    name: (r.fields["Full Name"] || "").replace(/\s+/g, " ").trim(),
    company: r.fields["Company"] || "",
    session: r.fields["Session Name"] || "",
    pic: !!(Array.isArray(r.fields["Profile Picture"]) && r.fields["Profile Picture"].length),
  }));

const j = await (await fetch("https://api.brella.io/api/integration/organizations/109/events/10356/timeslots?page[size]=500", {
  headers: { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" },
})).json();
const inc = j.included || [], slots = j.data || [];
const speakers = inc.filter(x => x.type === "speaker").map(s => {
  const a = s.attributes || {};
  const full = [a.honorific, a["first-name"], a["middle-name"], a["last-name"]].filter(Boolean).join(" ");
  return { id: s.id, full, company: a["company-name"] || "", title: a["job-title"] || "", photo: !!a["photo-url"], w: new Set(words(full)) };
});

console.log(`airtable grill presenters: ${grill.length}`);
console.log(`brella speaker records on this event: ${speakers.length} (all with a photo: ${speakers.every(s => s.photo)})\n`);

const overlap = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };
const exactHits = [], nearHits = [], absent = [];

for (const p of grill) {
  const pw = new Set(words(p.name));
  const exact = speakers.find(s => norm(s.full) === norm(p.name));
  if (exact) { exactHits.push({ p, s: exact }); continue; }
  // Near miss: every word of the shorter name appears in the other, or both name words match.
  const scored = speakers
    .map(s => ({ s, n: overlap(pw, s.w) }))
    .filter(x => x.n >= Math.min(2, pw.size))
    .sort((a, b) => b.n - a.n);
  if (scored.length) nearHits.push({ p, cands: scored.slice(0, 3).map(x => x.s) });
  else absent.push(p);
}

console.log(`=== ALREADY IN BRELLA, exact name match: ${exactHits.length} ===`);
for (const { p, s } of exactHits) console.log(`   ${p.name.padEnd(26)} brella#${s.id}  ${s.company} | photo:${s.photo ? "yes" : "NO"}`);

console.log(`\n=== NEAR MISSES, look at these by hand: ${nearHits.length} ===`);
for (const { p, cands } of nearHits) {
  console.log(`   airtable: ${p.name}  (${p.company})`);
  for (const c of cands) console.log(`      brella#${c.id}  "${c.full}"  ${c.company} | ${c.title}`);
}

console.log(`\n=== NOT IN BRELLA AT ALL: ${absent.length} ===`);
for (const p of absent) console.log(`   ${p.name.padEnd(26)} ${p.pic ? "photo ready" : "NO PHOTO   "}  ${p.company.slice(0, 30)}`);

// And the sessions they would be linked to.
const nSpk = slot => (Array.isArray(slot.relationships?.["speaker-assignments"]?.data) ? slot.relationships["speaker-assignments"].data.length : 0);
const sessions = [...new Set(grill.map(p => p.session).filter(Boolean))];
console.log(`\n=== the ${sessions.length} grill sessions in Brella ===`);
for (const s of sessions) {
  const k = norm(s);
  const exact = slots.find(d => norm(d.attributes?.title) === k);
  const fuzzy = exact || slots.find(d => { const t = norm(d.attributes?.title); return t.length > 15 && (t.includes(k) || k.includes(t)); });
  const people = grill.filter(p => p.session === s).length;
  console.log(`   ${(exact ? "timeslot ok " : fuzzy ? "title differs" : "NOT IN BRELLA")}  ${String(people).padStart(2)} ppl in airtable, ${fuzzy ? nSpk(fuzzy) : "-"} speakers in brella   ${s.slice(0, 60)}`);
  if (!exact && fuzzy) console.log(`        brella calls it: ${fuzzy.attributes?.title}`);
}
