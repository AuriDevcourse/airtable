// Does the Speaker Hub hold a photo for any Grill Session presenter whose Airtable
// `Profile Picture` is still empty?
//
// The Hub is the live 2026 roster (Supabase, built in Lovable) and speakers upload their own
// headshot there, so it is a better source than anything scraped off the open web: it is the
// person's own picture, given for this event.
//
// Read-only unless --commit. Dry run prints what it would write.
//   node grill-hub-photos.mjs
//   node grill-hub-photos.mjs --commit

const AIR = process.env.AIRTABLE_TOKEN;
const HUB = process.env.SPEAKERHUB_SUPABASE_URL, HUB_KEY = process.env.SPEAKERHUB_SUPABASE_ANON_KEY;
const BASE = "appgXNjXJqpk9Ebxd", GRILL_T = "tblTecOBecLQCNIeD", GRILL_V = "viwfIcQFDNQ9ggSqx";
const COMMIT = process.argv.includes("--commit");

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const wordsOf = s => new Set(norm(s).split(" ").filter(w => w && !/^(dr|prof|mr|ms|mrs)$/.test(w)));
// Same rule the Brella push uses: every word of one name must appear in the other, so
// "Jussi Pyysalo" matches "Jussi Petteri Pyysalo" but two different Storms never collide.
const sameHuman = (a, b) => {
  const x = wordsOf(a), y = wordsOf(b);
  if (!x.size || !y.size) return false;
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  for (const w of small) if (!big.has(w)) return false;
  return small.size >= 2;
};

if (!HUB || !HUB_KEY) { console.error("SPEAKERHUB_SUPABASE_URL / _ANON_KEY not set"); process.exit(1); }

// ── the Hub roster ────────────────────────────────────────────────────────────────────────────
const u = new URL(`${HUB}/rest/v1/speaker_public_profiles`);
u.searchParams.set("select", "id,full_name,job_title,company,photo_url");
u.searchParams.set("limit", "2000");
const hubRes = await fetch(u, { headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}` } });
if (!hubRes.ok) { console.error("hub:", hubRes.status, (await hubRes.text()).slice(0, 300)); process.exit(1); }
const hub = await hubRes.json();
const withPhoto = hub.filter(h => h.photo_url);
console.log(`SPEAKER HUB: ${hub.length} public speakers, ${withPhoto.length} with a photo (${hub.length - withPhoto.length} without)`);

// ── the grill rows ────────────────────────────────────────────────────────────────────────────
let recs = [], offset;
do {
  const g = new URL(`https://api.airtable.com/v0/${BASE}/${GRILL_T}`);
  g.searchParams.set("view", GRILL_V); g.searchParams.set("pageSize", "100");
  if (offset) g.searchParams.set("offset", offset);
  const j = await (await fetch(g, { headers: { Authorization: `Bearer ${AIR}` } })).json();
  if (j.error) { console.error("airtable:", JSON.stringify(j.error)); process.exit(1); }
  recs = recs.concat(j.records || []); offset = j.offset;
} while (offset);
const grill = recs.filter(r => /Grill Session$/i.test(r.fields["Project Name"] || ""));
const missing = grill.filter(r => !(Array.isArray(r.fields["Profile Picture"]) && r.fields["Profile Picture"].length));
console.log(`GRILL ROWS: ${grill.length}, of which ${missing.length} have no Profile Picture\n`);

// ── who overlaps ──────────────────────────────────────────────────────────────────────────────
const inHub = [];
for (const r of grill) {
  const name = (r.fields["Full Name"] || "").replace(/\s+/g, " ").trim();
  const h = hub.find(x => sameHuman(name, x.full_name || ""));
  if (h) inHub.push({ name, rec: r.id, hub: h, hasPic: Array.isArray(r.fields["Profile Picture"]) && r.fields["Profile Picture"].length });
}
console.log(`grill presenters who are ALSO in the Speaker Hub: ${inHub.length}`);
for (const x of inHub) {
  console.log(`   ${x.name.padEnd(24)} hub="${x.hub.full_name}"  hubPhoto:${x.hub.photo_url ? "yes" : "no "}  airtablePhoto:${x.hasPic ? "yes" : "NO"}`);
}

const fillable = inHub.filter(x => !x.hasPic && x.hub.photo_url);
console.log(`\ncan be filled from the Hub: ${fillable.length}`);
if (!fillable.length) {
  console.log("nothing to write.");
  const stillEmpty = missing.map(r => (r.fields["Full Name"] || "").trim());
  if (stillEmpty.length) console.log("still without a photo anywhere:", stillEmpty.join(", "));
  process.exit(0);
}

const updates = [];
for (const x of fillable) {
  // Confirm the URL is live and really an image before handing it to Airtable, same check the
  // grill-photos script does. Airtable fetches server-side and re-hosts.
  let head;
  try { head = await fetch(x.hub.photo_url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(25000) }); }
  catch (e) { console.log(`   SOURCE UNREACHABLE ${x.name}: ${e.message}`); continue; }
  const ct = head.headers.get("content-type") || "";
  if (!head.ok || !ct.startsWith("image/")) { console.log(`   NOT AN IMAGE ${x.name}: ${head.status} ${ct}`); continue; }
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  updates.push({ id: x.rec, fields: { "Profile Picture": [{ url: x.hub.photo_url, filename: `${x.name}.${ext}` }] } });
  console.log(`   will set: ${x.name.padEnd(24)} <- ${x.hub.photo_url.slice(0, 88)}`);
}

console.log(`\n${updates.length} row(s) to update.`);
if (!COMMIT) { console.log("DRY RUN. add --commit"); process.exit(0); }

let done = 0;
for (let i = 0; i < updates.length; i += 10) {
  const chunk = updates.slice(i, i + 10);
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${GRILL_T}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIR}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: chunk }),
  });
  if (!r.ok) { console.error("PATCH failed", r.status, (await r.text()).slice(0, 400)); process.exit(1); }
  done += chunk.length;
}
console.log("updated:", done);
