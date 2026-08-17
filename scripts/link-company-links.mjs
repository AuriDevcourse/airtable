// Fill the empty `Company Link` cells in Partner Deliverables 2026 by matching Partner ID.
//
// WHY (2026-08-17). Eight rows on the wall had no link back to their Partners 2026 record, so
// finding the CRM row meant guessing at a name. Two of them could never be found by name at all:
// "Professional Women of Colour Network (ProWoc)" is filed as "ProWoc - Professional Women of
// Colour", and "rebriQ" as "rebriQ by Improve Business". The Partner ID finds both instantly, which
// is the whole argument for matching on the id rather than the label.
//
// THE GUARD, and it is the reason this is a script and not a one-liner. A shared Partner ID does NOT
// prove two rows are the same company: deliverables "AWS Startups" carries id 2222, and 2222 belongs
// to NVIDIA in the CRM. Linking on the id alone would have filed AWS under NVIDIA. So a match also
// has to agree on a NAME TOKEN before it is written. AWS/NVIDIA share none and are skipped.
//
//   node scripts/link-company-links.mjs           dry run, writes nothing
//   node scripts/link-company-links.mjs --commit  write the links

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE_ID || "appgXNjXJqpk9Ebxd";
const CRM = "tbl9V6ZtxEbR4uELC";
const DELIV = "tblTecOBecLQCNIeD";
const VIEW = "viw7FVbsTb9IRaWF0";

const H = { Authorization: `Bearer ${TOKEN}` };
const W = { ...H, "Content-Type": "application/json" };
const COMMIT = process.argv.includes("--commit");

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN is not set. Run under `sops exec-env secrets.enc.env`.");
  process.exit(2);
}

const page = async (table, params) => {
  let all = [], offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/${table}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const j = await (await fetch(u, { headers: H })).json();
    if (j.error) throw new Error(`${table}: ${JSON.stringify(j.error)}`);
    all = all.concat(j.records || []);
    offset = j.offset;
  } while (offset);
  return all;
};

const norm = (s) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(a\/s|aps|ab|as|oy|ltd|limited|inc|llc|gmbh|bv|nv|plc|the|by|and|of)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
// Words too generic to prove identity on their own. Without this, "Professional Women of Colour
// Network" would match any other row containing "network".
const STOP = new Set(["network", "group", "partners", "partner", "company", "startups", "startup",
  "ventures", "capital", "denmark", "danmark", "copenhagen", "nordic", "international", "global"]);
const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));

const deliv = await page(DELIV, { view: VIEW });
const crm = await page(CRM, {});

const byId = new Map();
for (const r of crm) {
  const i = r.fields["Partner ID"];
  if (i == null || i === 0) continue;
  if (!byId.has(i)) byId.set(i, []);
  byId.get(i).push(r);
}

const unlinked = deliv.filter((r) => !(r.fields["Company Link"] || []).length);
console.log(`deliverables ${deliv.length} · without a Company Link ${unlinked.length}\n`);

const willLink = [], skipped = [];
for (const r of unlinked) {
  const name = String(r.fields["Company"] || "");
  const id = r.fields["Partner ID"];
  if (id == null || id === 0) {
    skipped.push([name, `Partner ID is ${id === 0 ? "0 (placeholder)" : "empty"} — nothing to match on`]);
    continue;
  }
  const cand = byId.get(id) || [];
  if (cand.length === 0) { skipped.push([name, `no CRM row carries Partner ID ${id}`]); continue; }
  if (cand.length > 1) { skipped.push([name, `Partner ID ${id} is on ${cand.length} CRM rows — ambiguous`]); continue; }

  const c = cand[0];
  const a = tokens(name), bb = tokens(c.fields["Company Name"]);
  const shared = [...a].filter((w) => bb.has(w));
  if (!shared.length) {
    // THE AWS/NVIDIA CASE. Same id, unrelated names — the id is wrong on one of them.
    skipped.push([name, `id ${id} points at "${c.fields["Company Name"]}" — no shared name token, NOT linked`]);
    continue;
  }
  willLink.push({ r, c, name, id, shared, status: c.fields["Status 2026"] });
}

console.log(`=== ${COMMIT ? "LINKING" : "WOULD LINK"} ${willLink.length} ===`);
for (const x of willLink) {
  console.log(`  ${x.name.slice(0, 44).padEnd(46)}id:${String(x.id).padEnd(6)}→ ${x.c.id}  ` +
    `"${x.c.fields["Company Name"]}"  [${x.status ?? "no status"}]`);
}
console.log(`\n=== SKIPPED ${skipped.length} (need a human decision) ===`);
for (const [n, why] of skipped) console.log(`  ${n.slice(0, 44).padEnd(46)}${why}`);

if (!COMMIT) {
  console.log("\nDRY RUN. Nothing was written. Add --commit to link.");
  process.exit(0);
}

let done = 0;
for (let i = 0; i < willLink.length; i += 10) {
  const chunk = willLink.slice(i, i + 10).map((x) => ({ id: x.r.id, fields: { "Company Link": [x.c.id] } }));
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${DELIV}`, {
    method: "PATCH", headers: W, body: JSON.stringify({ records: chunk }),
  });
  const txt = await res.text();
  if (!res.ok) {
    console.error(`\n  batch failed ${res.status}: ${txt.slice(0, 300)}`);
    console.error("  Re-run to retry — rows that already have a link are skipped.");
    process.exit(1);
  }
  done += (JSON.parse(txt).records || []).length;
}
console.log(`\n${done} link(s) written.`);
