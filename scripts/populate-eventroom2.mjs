// One-off: copy the NISS 2026 + NASS 2026 speakers (role = Speaker, the same people
// the website shows) into Marketing Project Overview as "Event Room 2" rows, so the
// Event Room view holds the full lineup. Idempotent: matched by normalized Full Name
// against every existing "Event Room N" row, so re-running only adds missing people.
// Usage: node scripts/populate-eventroom2.mjs [--write]   (dry-run without --write)

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

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

async function existingEventRoomNames() {
  const names = new Set();
  let offset;
  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `FIND('Event Room ',{Project Name})=1`);
    params.append("fields[]", "Full Name");
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`read failed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    for (const r of data.records) if (r.fields["Full Name"]) names.add(norm(r.fields["Full Name"]));
    offset = data.offset;
  } while (offset);
  return names;
}

async function feed(path) {
  const res = await fetch(`${FEED}${path}`);
  if (!res.ok) throw new Error(`feed ${path} failed ${res.status}`);
  return (await res.json()).people;
}

const [niss, nass, existing] = await Promise.all([
  feed("/api/niss-speakers?role=Speaker"),
  feed("/api/nass-speakers?role=Speaker"),
  existingEventRoomNames(),
]);

const seen = new Set();
const toAdd = [];
for (const p of [...niss, ...nass]) {
  const n = norm(p.name);
  if (!n || existing.has(n) || seen.has(n)) continue;
  seen.add(n);
  const fields = {
    "Full Name": p.name,
    "Project Name": "Event Room 2",
  };
  if (p.title) fields["Job Title"] = p.title;
  if (p.company) fields["Company"] = p.company;
  if (p.linkedin) fields["LinkedIn Handle"] = p.linkedin;
  if (p.photo) fields["Profile Picture"] = [{ url: p.photo }];
  toAdd.push({ fields });
}

console.log(`niss ${niss.length} + nass ${nass.length} | already in Event Room rows: skipped ${niss.length + nass.length - toAdd.length} | to create: ${toAdd.length}`);
toAdd.forEach((r) => console.log("  +", r.fields["Full Name"], "·", r.fields["Company"] || "", "· photo:", r.fields["Profile Picture"] ? "Y" : "N", "· li:", r.fields["LinkedIn Handle"] ? "Y" : "N"));

if (!WRITE) {
  console.log("\nDRY RUN — re-run with --write to create the rows.");
  process.exit(0);
}

for (let i = 0; i < toAdd.length; i += 10) {
  const batch = toAdd.slice(i, i + 10);
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: batch, typecast: true }),
  });
  if (!res.ok) throw new Error(`write failed ${res.status}: ${await res.text()}`);
  console.log(`created ${i + batch.length}/${toAdd.length}`);
  await new Promise((r) => setTimeout(r, 300));
}
console.log("DONE");
