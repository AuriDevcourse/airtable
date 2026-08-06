// Uploads the white logo set into the `Logo` attachment field on Marketing Project Overview,
// alongside the colour originals already there.
//
//   node scripts/upload-white-logos.mjs          # report only, writes nothing
//   node scripts/upload-white-logos.mjs --write  # upload
//
// Source of truth is lib/partnerLogoManifest.json + public/partner-logos/, produced by
// scripts/sync-partner-logos.mjs. Run that first.
//
// ─── WHY THIS IS SAFE TO RE-RUN ─────────────────────────────────────────────────────
// It uses Airtable's uploadAttachment endpoint, which APPENDS one file to a cell. It never
// PATCHes the field, and that distinction matters: PATCHing an attachment field replaces the
// whole array, so a single mistake there would wipe the 203 colour originals. Appending
// cannot delete anything.
//
// Every uploaded file is renamed `white-<original>` so the white version is identifiable in a
// cell that also holds colour files — Auri chose to mix them in one field rather than use the
// empty `Partner logo` column, so the filename is the only thing telling them apart.
//
// Re-running skips any cell that already has a `white-` file, so it is idempotent.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_DIR = join(ROOT, "public/partner-logos");
const MANIFEST = join(ROOT, "lib/partnerLogoManifest.json");

const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const VIEW = "viw7FVbsTb9IRaWF0"; // Partner Deliverables 2026
const FIELD = "Logo"; // Auri's choice: append next to the colour originals
const PREFIX = "white-";

// Airtable allows 5 requests/second per base. 220ms keeps a comfortable margin, and these are
// large-ish uploads so the wall clock is dominated by transfer anyway.
const DELAY_MS = 220;
const MAX_BYTES = 5 * 1024 * 1024; // hard API limit per attachment

const WRITE = process.argv.includes("--write");

const MIME = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function loadEnv() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const TOKEN = env.AIRTABLE_TOKEN;
const BASE = env.AIRTABLE_BASE_ID;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRows() {
  const out = [];
  let offset;
  do {
    const p = new URLSearchParams({ view: VIEW, pageSize: "100" });
    for (const f of ["Company", FIELD]) p.append("fields[]", f);
    if (offset) p.set("offset", offset);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?${p}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`list ${res.status}: ${await res.text()}`);
    const d = await res.json();
    out.push(...d.records);
    offset = d.offset;
  } while (offset);
  return out;
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const rows = await fetchRows();
const byId = new Map(rows.map((r) => [r.id, r]));

const plan = [];
const skipped = [];

for (const [recordId, entry] of Object.entries(manifest)) {
  const row = byId.get(recordId);
  if (!row) {
    skipped.push({ recordId, why: "record not in the view any more" });
    continue;
  }
  const company = String(row.fields["Company"] || "(unnamed)").trim();
  const path = join(LOGO_DIR, entry.file);
  if (!existsSync(path)) {
    skipped.push({ company, why: `${entry.file} missing from public/partner-logos` });
    continue;
  }

  const existing = Array.isArray(row.fields[FIELD]) ? row.fields[FIELD] : [];
  const filename = PREFIX + entry.file;
  if (existing.some((a) => a.filename === filename)) {
    skipped.push({ company, why: "already uploaded" });
    continue;
  }

  const bytes = readFileSync(path);
  if (bytes.length > MAX_BYTES) {
    skipped.push({ company, why: `${entry.file} is ${Math.round(bytes.length / 1024)}kB, over the 5MB API limit` });
    continue;
  }

  const ext = entry.file.split(".").pop().toLowerCase();
  plan.push({
    recordId,
    company,
    filename,
    contentType: MIME[ext] || "application/octet-stream",
    base64: bytes.toString("base64"),
    kb: Math.round(bytes.length / 1024),
    had: existing.length,
  });
}

console.log(`manifest entries      : ${Object.keys(manifest).length}`);
console.log(`to upload             : ${plan.length}`);
console.log(`skipped               : ${skipped.length}`);
for (const s of skipped) console.log(`   ${(s.company || s.recordId).padEnd(34)}${s.why}`);
console.log(
  `\nfield "${FIELD}" currently holds ${rows.reduce(
    (n, r) => n + (Array.isArray(r.fields[FIELD]) ? r.fields[FIELD].length : 0),
    0
  )} attachment(s) across the view — none are removed by this script.`
);

if (!WRITE) {
  console.log("\nDRY RUN. Nothing uploaded. Pass --write to do it.");
  console.log("Sample of what would be added:");
  for (const p of plan.slice(0, 5)) {
    console.log(`   ${p.company.padEnd(34)}+ ${p.filename}  (${p.kb}kB, cell had ${p.had})`);
  }
  process.exit(0);
}

let ok = 0;
const failed = [];
for (const [i, p] of plan.entries()) {
  const url = `https://content.airtable.com/v0/${BASE}/${p.recordId}/${encodeURIComponent(FIELD)}/uploadAttachment`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: p.contentType, file: p.base64, filename: p.filename }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    ok++;
    if ((i + 1) % 10 === 0 || i === plan.length - 1) {
      console.log(`   ${i + 1}/${plan.length} uploaded`);
    }
  } catch (err) {
    failed.push({ company: p.company, error: String(err.message || err) });
  }
  await sleep(DELAY_MS);
}

console.log(`\nUploaded ${ok}/${plan.length}`);
if (failed.length) {
  console.log(`FAILED ${failed.length}:`);
  for (const f of failed) console.log(`   ${f.company.padEnd(34)}${f.error}`);
}
