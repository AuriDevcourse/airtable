// Diffs the "Partner Deliverables 2026" view against Auri's authoritative Community
// partner list, and reports which rows disagree.
//
//   node scripts/community-tier-audit.mjs
//
// READ-ONLY by default — it never writes. Pass --write to apply the safe half of the
// diff (rows that should BE Community but aren't). It will never clear a tier: emptying
// a single-select drops the row out of grouped views, which is worse than a wrong value,
// so "Community but not on the list" rows are only ever REPORTED for a human to rule on.
//
// Background, root cause, and the standing decisions live in progress.md, session
// 2026-07-17. Read that before changing the rules here.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- config -----------------------------------------------------------------
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const VIEW = "viw7FVbsTb9IRaWF0"; // Partner Deliverables 2026
const CRM = "tbl9V6ZtxEbR4uELC"; // Partners 2026
const TIER_FIELD = "Partnership Type 2026"; // the marketing-local single-select
const LIST_FILE = join(ROOT, "scripts", "community-partners-2026.txt");

const WRITE = process.argv.includes("--write");

// Deliverables-view spelling -> CRM spelling. The two tables disagree on names; see
// progress.md "Gotchas". `null` = deliberately NOT on the Community list.
const ALIAS = {
  "clean": null,                          // CRM "CLEAN" — Community Main, keeps deal-size tier
  "di": null,                             // CRM "Dansk Industri" — Community Core Plus
  "embassy of india": null,               // CRM "Indian Embassy" — ruled not-Community by Auri
  "kveikja": "KVEIKJA_NO_CRM_RECORD",     // Community + live on site, but absent from CRM + list
  "copenhagen school of entrepreneurship": "CSE (Copenhagen School of Entrepreneurship)",
  "medicon valleyh alliance": "Medicon Valley Alliance", // typo in the deliverables view
  "indian venture & alternate capital association": "IVC Association",
  "incuba x kitchen": "INCUBA",           // one row, two CRM records (INCUBA + The Kitchen)
  "business turku": "Business Turku Oy Ab",
  "femtech studios": "FemTech Studios",
  "nova talent": "Nova talent",
  "lithuaniabio": "LithuaniaBIO",
  "terkko health hub": "Terkko Health Hub -Do Company Oy",
  "voice ai space": "Voice AI Space",
  "made": "Future Manufacturers (MADE)",
  "klak - icelandic startups": "KLAK",
};

// Rows that are Community by fiat, not via the list (see progress.md — the list isn't exhaustive).
const ALWAYS_COMMUNITY = new Set(["kveikja"]);

// --- env --------------------------------------------------------------------
function loadEnv() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const TOKEN = env.AIRTABLE_TOKEN;
const BASE = env.AIRTABLE_BASE_ID;
if (!TOKEN || !BASE) {
  console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID in .env.local");
  process.exit(1);
}

// --- helpers ----------------------------------------------------------------
const norm = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();

async function fetchAll(table, fields, view) {
  const out = [];
  let offset;
  do {
    const p = new URLSearchParams({ pageSize: "100" });
    if (view) p.set("view", view);
    for (const f of fields) p.append("fields[]", f);
    if (offset) p.set("offset", offset);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}?${p}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      console.error("Airtable error", res.status, await res.text());
      process.exit(1);
    }
    const d = await res.json();
    out.push(...d.records);
    offset = d.offset;
  } while (offset);
  return out;
}

// --- run --------------------------------------------------------------------
const list = readFileSync(LIST_FILE, "utf8")
  .split(/\r?\n/).map((s) => s.trim())
  .filter((s) => s && !s.startsWith("#"));
const listNorm = new Set(list.map(norm));

const rows = await fetchAll(TABLE, ["Company", TIER_FIELD], VIEW);

const shouldBeCommunity = (company) => {
  const n = norm(company);
  if (ALWAYS_COMMUNITY.has(n)) return true;
  if (listNorm.has(n)) return true;
  if (n in ALIAS) {
    const a = ALIAS[n];
    return a !== null && listNorm.has(norm(a));
  }
  return false;
};

const toSet = []; // on the list, not tagged Community -> safe to fix
const toReview = []; // tagged Community, not on the list -> needs a human
const unmapped = []; // no list entry, no alias -> name may have drifted

for (const r of rows) {
  const company = String(r.fields["Company"] ?? "").replace(/\s+/g, " ").trim();
  const cur = r.fields[TIER_FIELD] ?? null;
  const want = shouldBeCommunity(company);
  const isComm = cur === "Community";

  if (want && !isComm) toSet.push({ id: r.id, company, cur });
  else if (!want && isComm) toReview.push({ id: r.id, company, cur });
  if (!want && !isComm && !(norm(company) in ALIAS) && !listNorm.has(norm(company))) {
    unmapped.push(company);
  }
}

const communityNow = rows.filter((r) => r.fields[TIER_FIELD] === "Community").length;
console.log(`Rows in view: ${rows.length}   Community today: ${communityNow}   List: ${list.length} names\n`);

console.log(`=== SHOULD BE COMMUNITY (${toSet.length}) ===`);
if (!toSet.length) console.log("  (none — view matches the list)");
toSet.forEach((r) => console.log(`  ${r.id}  ${r.company.padEnd(42)} ${r.cur ?? "(blank)"} -> Community`));

console.log(`\n=== COMMUNITY BUT NOT ON THE LIST (${toReview.length}) — needs a human ===`);
if (!toReview.length) console.log("  (none)");
toReview.forEach((r) => console.log(`  ${r.id}  ${r.company}`));
if (toReview.length) {
  console.log("  ^ NOT auto-cleared. The list is not exhaustive (see progress.md), and blanking");
  console.log("    a single-select drops the row out of grouped views. Ask Partnerships.");
}

if (unmapped.length) {
  console.log(`\n=== NOT ON THE LIST, NOT COMMUNITY (${unmapped.length}) — informational ===`);
  console.log("  " + unmapped.join(", "));
}

if (!WRITE) {
  console.log(`\nRead-only. Re-run with --write to apply the ${toSet.length} safe change(s).`);
  process.exit(0);
}
if (!toSet.length) {
  console.log("\nNothing to write.");
  process.exit(0);
}

// verify identity before patching — never write blind
for (const r of toSet) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${r.id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d = await res.json();
  const actual = String(d.fields["Company"] ?? "").replace(/\s+/g, " ").trim();
  if (norm(actual) !== norm(r.company)) {
    console.error(`\nABORT — ${r.id} is "${actual}", expected "${r.company}". Nothing written.`);
    process.exit(1);
  }
}

for (let i = 0; i < toSet.length; i += 10) {
  const batch = toSet.slice(i, i + 10);
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      records: batch.map((r) => ({ id: r.id, fields: { [TIER_FIELD]: "Community" } })),
    }),
  });
  if (!res.ok) {
    console.error("WRITE FAILED", res.status, await res.text());
    process.exit(1);
  }
  const out = await res.json();
  out.records.forEach((rec) =>
    console.log(`  WROTE ${rec.id}  ${String(rec.fields["Company"]).replace(/\s+/g, " ").trim()} -> ${rec.fields[TIER_FIELD]}`)
  );
}
console.log(`\nDone. ${toSet.length} row(s) set to Community.`);
