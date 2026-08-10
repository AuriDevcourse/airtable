// Read-only: do the 45 photo-less Grill Session people already exist WITH a photo somewhere
// else in the base? Same person, another table (main Speakers, Event Room Speakers, past years).
// Cheaper and far more trustworthy than hunting the open web: the photo was uploaded by them.
const token = process.env.AIRTABLE_TOKEN;
const BASE = "appgXNjXJqpk9Ebxd";
const h = { Authorization: `Bearer ${token}` };
const GRILL_T = "tblTecOBecLQCNIeD", GRILL_V = "viwfIcQFDNQ9ggSqx";

// Lookup/rollup fields come back as arrays, so flatten before normalising.
const norm = v => (Array.isArray(v) ? v.join(" ") : typeof v === "string" ? v : "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function all(table, view) {
  let out = [], offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`);
    u.searchParams.set("pageSize", "100");
    if (view) u.searchParams.set("view", view);
    if (offset) u.searchParams.set("offset", offset);
    const r = await fetch(u, { headers: h });
    const j = await r.json();
    if (j.error) return { error: j.error };
    out = out.concat(j.records || []); offset = j.offset;
  } while (offset);
  return { records: out };
}

// Which tables exist?
const meta = await (await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`, { headers: h })).json();
if (meta.error) { console.error("meta:", JSON.stringify(meta.error)); process.exit(1); }
console.log("tables in base:");
for (const t of meta.tables) console.log(`  ${t.id}  ${t.name}`);

const grill = (await all(GRILL_T, GRILL_V)).records
  .filter(r => /Grill Session$/i.test(r.fields["Project Name"] || ""));
const missing = grill.filter(r => !(Array.isArray(r.fields["Profile Picture"]) && r.fields["Profile Picture"].length));
const want = new Map(missing.map(r => [norm(r.fields["Full Name"]), r.fields["Full Name"]]));
console.log(`\nlooking for ${want.size} people with no photo\n`);

const found = new Map();
for (const t of meta.tables) {
  if (t.id === GRILL_T) continue;
  const nameFields = t.fields.filter(f => /name/i.test(f.name) && /text|formula|lookup/i.test(f.type)).map(f => f.name);
  const attFields = t.fields.filter(f => f.type === "multipleAttachments").map(f => f.name);
  if (!nameFields.length || !attFields.length) continue;
  const res = await all(t.name);
  if (res.error) { console.log(`  (skip ${t.name}: ${res.error.type})`); continue; }
  for (const r of res.records) {
    for (const nf of nameFields) {
      const key = norm(r.fields[nf]);
      if (!key || !want.has(key)) continue;
      for (const af of attFields) {
        const att = r.fields[af];
        if (Array.isArray(att) && att.length && /image\//.test(att[0].type || "")) {
          const list = found.get(key) || [];
          list.push({ table: t.name, field: af, url: att[0].url, filename: att[0].filename, w: att[0].width, h: att[0].height });
          found.set(key, list);
        }
      }
    }
  }
}

console.log(`\n=== ALREADY IN THE BASE: ${found.size} of ${want.size} ===`);
for (const [key, list] of found) {
  console.log(`\n${want.get(key)}`);
  for (const f of list) console.log(`   ${f.table} :: ${f.field}  ${f.filename} ${f.w}x${f.h}\n      ${f.url}`);
}
console.log(`\nstill nowhere in the base: ${[...want.keys()].filter(k => !found.has(k)).map(k => want.get(k)).join(", ")}`);
