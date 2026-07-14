// Reads the "Partners on Brella" view of the Partners 2026 table, keeps only
// Status 2026 = Confirmed, and writes a Brella-ready sponsor-import CSV.
//
// Marketing-safe by construction: only the fields below are ever requested from
// Airtable, so deal values / VAT / contacts in that CRM table can never leak.
//
//   node scripts/partners-to-brella-csv.mjs
//   -> writes scripts/out/partners-brella.csv  (+ prints a summary)
//
// Then in Brella admin: Import/Export Sponsor Profiles & Booths -> import this
// CSV and map the columns (Company Name -> Name, Category -> tier/category, etc).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- config -----------------------------------------------------------------
const TABLE = "Partners 2026";
const VIEW = "Partners on Brella";
const KEEP_STATUS = new Set(["Confirmed"]); // gate: only these go to Brella
const LOGO_FIELD = "Partner logo (from Partner logo (from Partner logo))";

// Airtable is asked for ONLY these fields (allow-list).
const FIELDS = [
  "Company Name",
  "Partnership Tier",
  "Status 2026",
  "Website",
  "Company's LinkedIn Profile",
  LOGO_FIELD,
];

// --- env --------------------------------------------------------------------
function loadEnv() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
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
const str = (v) => (typeof v === "string" ? v.trim() : "");

function firstUrl(v) {
  const val = Array.isArray(v) ? v[0] : v;
  const s = typeof val === "string" ? val.trim() : "";
  return /^https?:\/\//i.test(s) ? s : "";
}

function csvCell(v) {
  return '"' + String(v ?? "").replace(/"/g, '""') + '"';
}

async function fetchAll() {
  const out = [];
  let offset;
  do {
    const p = new URLSearchParams();
    p.set("view", VIEW);
    p.set("pageSize", "100");
    for (const f of FIELDS) p.append("fields[]", f);
    if (offset) p.set("offset", offset);
    const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}?${p}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) {
      console.error("Airtable error", res.status, await res.text());
      process.exit(1);
    }
    const data = await res.json();
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

// --- run --------------------------------------------------------------------
const records = await fetchAll();

const rows = [];
const missingLogo = [];
for (const rec of records) {
  const f = rec.fields;
  const status = str(f["Status 2026"]);
  if (!KEEP_STATUS.has(status)) continue;
  const name = str(f["Company Name"]);
  if (!name) continue;
  const logo = firstUrl(f[LOGO_FIELD]);
  if (!logo) missingLogo.push(name);
  rows.push({
    name,
    category: str(f["Partnership Tier"]),
    website: str(f["Website"]),
    linkedin: str(f["Company's LinkedIn Profile"]),
    logo,
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name));

// Airtable only reliably holds Name + Tier for confirmed partners. Website/logo
// columns are kept (empty) so marketing can fill them before the Brella import.
const header = ["Company Name", "Category", "Website", "Logo URL"];
const lines = [header.map(csvCell).join(",")];
for (const r of rows) {
  lines.push([r.name, r.category, r.website, r.logo].map(csvCell).join(","));
}

mkdirSync(join(ROOT, "scripts", "out"), { recursive: true });
const outPath = join(ROOT, "scripts", "out", "partners-brella.csv");
writeFileSync(outPath, "﻿" + lines.join("\r\n"), "utf8"); // BOM + CRLF for Brella/Excel

console.log(`Confirmed partners written: ${rows.length}`);
console.log(`  with logo:    ${rows.length - missingLogo.length}`);
console.log(`  MISSING logo: ${missingLogo.length}`);
if (missingLogo.length) console.log("   -> " + missingLogo.join(", "));
console.log(`\nCSV: ${outPath}`);
