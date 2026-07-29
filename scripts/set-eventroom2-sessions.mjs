// One-off: set Session Name on the Event Room 2 marketing rows — NISS speakers get
// "Nordic India Startup Summit", NASS speakers "Nordic Africa Startup Summit".
// Matched by normalized Full Name against the live feeds. Idempotent: only touches
// rows whose Session Name is missing or different.
// Usage: node scripts/set-eventroom2-sessions.mjs [--write]   (dry-run without --write)

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const TOKEN = env.AIRTABLE_TOKEN;
const BASE = env.AIRTABLE_BASE_ID;
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const FEED = "https://airtable-woad.vercel.app";
const WRITE = process.argv.includes("--write");

const NISS_SESSION = "Nordic India Startup Summit";
const NASS_SESSION = "Nordic Africa Startup Summit";

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

async function feed(path) {
  const res = await fetch(`${FEED}${path}`);
  if (!res.ok) throw new Error(`feed ${path} failed ${res.status}`);
  return (await res.json()).people;
}

async function eventRoom2Rows() {
  const rows = [];
  let offset;
  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `{Project Name}='Event Room 2'`);
    params.append("fields[]", "Full Name");
    params.append("fields[]", "Session Name");
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`read failed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    rows.push(...data.records);
    offset = data.offset;
  } while (offset);
  return rows;
}

const [niss, nass, rows] = await Promise.all([
  feed("/api/niss-speakers?role=Speaker"),
  feed("/api/nass-speakers?role=Speaker"),
  eventRoom2Rows(),
]);

const sessionByName = new Map();
for (const p of niss) sessionByName.set(norm(p.name), NISS_SESSION);
for (const p of nass) sessionByName.set(norm(p.name), NASS_SESSION);

const updates = [];
const unmatched = [];
for (const r of rows) {
  const name = r.fields["Full Name"];
  const want = sessionByName.get(norm(name));
  if (!want) {
    unmatched.push(name || "(blank)");
    continue;
  }
  if (r.fields["Session Name"] === want) continue;
  updates.push({ id: r.id, fields: { "Session Name": want } });
  console.log("  ~", name, "->", want);
}

console.log(`\nEvent Room 2 rows: ${rows.length} | to update: ${updates.length} | not in feeds (left alone): ${unmatched.join(", ") || "none"}`);

if (!WRITE) {
  console.log("DRY RUN — re-run with --write to apply.");
  process.exit(0);
}

for (let i = 0; i < updates.length; i += 10) {
  const batch = updates.slice(i, i + 10);
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: batch, typecast: true }),
  });
  if (!res.ok) throw new Error(`write failed ${res.status}: ${await res.text()}`);
  console.log(`updated ${i + batch.length}/${updates.length}`);
  await new Promise((r) => setTimeout(r, 300));
}
console.log("DONE");
