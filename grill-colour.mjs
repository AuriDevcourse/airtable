// DRY RUN unless --commit.
// Renaming "Grill Session" to "Green Grill Session" left all 60 rows tagged Green. This sets each
// row to the room its session actually runs in, read from the live Brella schedule where the room
// is literally "Blue/Green/Orange Grill Session".
const token = process.env.AIRTABLE_TOKEN;
const BASE = "appgXNjXJqpk9Ebxd";
const T = "tblTecOBecLQCNIeD";
const V = "viwfIcQFDNQ9ggSqx";
const COMMIT = process.argv.includes("--commit");
const h = { Authorization: `Bearer ${token}` };

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// ---- where each grill session actually runs, from Brella (via the local connector) ----
const prog = await (await fetch("http://localhost:3002/api/program?event=brella")).json();
const roomBySession = new Map();
for (const s of prog.sessions) {
  const room = s.room || "";
  if (!/Grill Session/i.test(room)) continue;
  roomBySession.set(norm(s.name), room.trim());
}
console.log("grill sessions in Brella:", roomBySession.size);
const byRoom = {};
for (const r of roomBySession.values()) byRoom[r] = (byRoom[r] || 0) + 1;
console.log("Brella sessions per room:", JSON.stringify(byRoom));

// ---- the rows we created ----
let recs = [], offset;
do {
  const u = new URL(`https://api.airtable.com/v0/${BASE}/${T}`);
  u.searchParams.set("view", V);
  u.searchParams.set("pageSize", "100");
  if (offset) u.searchParams.set("offset", offset);
  const j = await (await fetch(u, { headers: h })).json();
  recs = recs.concat(j.records || []);
  offset = j.offset;
} while (offset);

const grill = recs.filter((r) => /Grill Session$/i.test(r.fields["Project Name"] || ""));
console.log("grill rows in Airtable:", grill.length);

// Exact title match first, then a containment fallback — Brella titles are sometimes topped and
// tailed differently from the submission ("Opening: X" vs "X").
function roomFor(sessionName) {
  const n = norm(sessionName);
  if (!n) return null;
  if (roomBySession.has(n)) return roomBySession.get(n);
  for (const [k, v] of roomBySession) {
    if (k.length > 14 && (k.includes(n) || n.includes(k))) return v;
  }
  return null;
}

const updates = [], unmatched = [];
for (const r of grill) {
  const want = roomFor(r.fields["Session Name"]);
  const have = r.fields["Project Name"];
  if (!want) { unmatched.push(`${r.fields["Full Name"]} — ${r.fields["Session Name"]}`); continue; }
  if (want !== have) updates.push({ id: r.id, fields: { "Project Name": want } , _n: r.fields["Full Name"], _s: r.fields["Session Name"], _from: have, _to: want });
}

const per = {};
for (const u of updates) per[u._to] = (per[u._to] || 0) + 1;
console.log("\nrows to change:", updates.length, JSON.stringify(per));
console.log("rows already correct:", grill.length - updates.length - unmatched.length);
console.log("rows whose session is not in Brella:", unmatched.length);
if (unmatched.length) {
  console.log("  " + [...new Set(unmatched.map((u) => u.split(" — ")[1]))].join("\n  "));
}
console.log("\nsample changes:");
for (const u of updates.slice(0, 8)) console.log(`  ${u._n}: ${u._from} -> ${u._to}   (${(u._s||"").slice(0,40)})`);

if (!COMMIT) { console.log("\nDRY RUN — nothing written. Re-run with --commit."); process.exit(0); }

let done = 0;
for (let i = 0; i < updates.length; i += 10) {
  const batch = updates.slice(i, i + 10).map(({ id, fields }) => ({ id, fields }));
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${T}`, {
    method: "PATCH",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ records: batch }),
  });
  if (!r.ok) { console.error("PATCH failed", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  done += batch.length;
  console.log(`  updated ${done}/${updates.length}`);
}
console.log("\ndone.");
