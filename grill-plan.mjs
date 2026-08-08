// DRY RUN by default. Writes ONLY when run with --commit.
//
// Reads the 21 Grill Session submissions (Partnership Success, view viwmxcuIN0SFe2tkF), pulls the
// 1st-5th presenter blocks, and prepares one Speakers row per person in Marketing Project Overview
// tagged Project Name = "Grill Session".
const token = process.env.AIRTABLE_TOKEN;
const BASE = "appgXNjXJqpk9Ebxd";
const SRC_TABLE = "tbllvkwLhB4Omdphd";     // Partnership Success
const SRC_VIEW = "viwmxcuIN0SFe2tkF";      // the Grill Sessions view Auri linked
const DEST_TABLE = "tblTecOBecLQCNIeD";    // Marketing Project Overview
const DEST_VIEW = "viwfIcQFDNQ9ggSqx";     // its "Speakers" view
const PROJECT = "Grill Session";
const COMMIT = process.argv.includes("--commit");

const h = { Authorization: `Bearer ${token}` };
const jget = async (url) => {
  const r = await fetch(url, { headers: h });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};
const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

// ---- source rows ----
const meta = await jget(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`);
const src = meta.tables.find((t) => t.id === SRC_TABLE);
const idOf = (n) => src.fields.find((f) => f.name === n)?.id;
const SLOTS = ["1st Presenters details", "2nd Presenter Details", "3rd Presenter details",
  "4th Presenter details", "5th Presenters details"].map(idOf);
const F_TITLE = idOf("Session Title");

async function page(table, params) {
  let out = [], offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/${table}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const j = await jget(u);
    out = out.concat(j.records ?? []);
    offset = j.offset;
  } while (offset);
  return out;
}

const sessions = await page(SRC_TABLE, { view: SRC_VIEW, returnFieldsByFieldId: "true" });

const people = [];
for (const rec of sessions) {
  const session = (rec.fields[F_TITLE] || "").trim();
  for (const slot of SLOTS) {
    const raw = rec.fields[slot];
    if (!raw || !String(raw).trim()) continue;
    const name = (/name\s*:\s*(.+)/i.exec(raw)?.[1] || "").trim();
    const position = (/position\s*:\s*(.+)/i.exec(raw)?.[1] || "").trim();
    const company = (/company\s*:\s*(.+)/i.exec(raw)?.[1] || "").trim();
    if (!name || /^tbc$/i.test(name)) continue;
    // Role: the source has no role column, so it is read off the job title when it says so.
    // Everything else is a Speaker — that is the honest default, not a guess at seniority.
    const role = /moderat/i.test(position) ? "Moderator" : "Speaker";
    people.push({ session, name, position, company, role });
  }
}

// ---- dedupe against what is already in the Speakers view ----
const existing = await page(DEST_TABLE, { view: DEST_VIEW });
const byName = new Map();
for (const r of existing) {
  const n = norm(r.fields["Full Name"]);
  if (n) byName.set(n, r.fields["Project Name"] || "(no project)");
}
const already = [], toAdd = [];
for (const p of people) {
  const hit = byName.get(norm(p.name));
  if (hit) already.push({ ...p, existingProject: hit });
  else toAdd.push(p);
}

console.log("Grill Session submissions read :", sessions.length);
console.log("presenters extracted           :", people.length);
console.log("  moderators (by job title)    :", people.filter((p) => p.role === "Moderator").length);
console.log("already in the Speakers view   :", already.length);
console.log("WOULD CREATE                   :", toAdd.length);
if (already.length) {
  console.log("\nalready present (not touched):");
  for (const a of already) console.log(`  ${a.name} — currently Project Name = ${a.existingProject}`);
}
console.log("\nfirst 8 rows to create:");
for (const p of toAdd.slice(0, 8)) {
  console.log(`  ${p.name} | ${p.role} | ${p.position.slice(0, 40)} | ${p.company.slice(0, 28)} | ${p.session.slice(0, 34)}`);
}

if (!COMMIT) {
  console.log("\nDRY RUN — nothing written. Re-run with --commit to create these records.");
  process.exit(0);
}

// ---- write, 10 at a time (Airtable's cap) ----
// --limit N stops after N records. Used for the one-record canary: write one, confirm no live
// feed's count moved, then run the rest. The dedupe makes the second run skip what already landed.
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const queue = toAdd.slice(0, limit);
console.log(`\nwriting ${queue.length} of ${toAdd.length}…`);

let created = 0;
for (let i = 0; i < queue.length; i += 10) {
  const batch = queue.slice(i, i + 10).map((p) => ({
    fields: {
      "Full Name": p.name,
      "Job Title": p.position,
      Company: p.company,
      "Session Name": p.session,
      Role: p.role,
      "Project Name": PROJECT,
    },
  }));
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${DEST_TABLE}`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ records: batch, typecast: false }),
  });
  if (!r.ok) {
    console.error("WRITE FAILED at batch", i / 10, r.status, (await r.text()).slice(0, 400));
    console.error(`created ${created} before failing — re-running is safe, the dedupe skips them.`);
    process.exit(1);
  }
  created += batch.length;
  console.log(`  created ${created}/${queue.length}`);
}
console.log("\ndone. created:", created);
