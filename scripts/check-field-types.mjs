// Cross-checks every Airtable field this repo READS against the field's REAL type in the base.
//
// WHY THIS EXISTS (2026-08-17). /policy-stage served 0 people for an unknown number of days. The
// `Role` column had been changed to a MULTI-select, so the cell arrived as ["Speaker"], and
// lib/policystage.ts read it with str() — which returns "" for an array by design. All 31 people
// failed the role allow-list and were dropped. Nothing threw. The log said "no role yet" 31 times,
// which reads like an Airtable gap and sent the search in the wrong direction.
//
// The class of bug: a reader whose return shape silently disagrees with the field's type. Airtable
// lets anyone flip single-select to multi-select from the UI, and no deploy, test or type-check on
// our side notices. This script notices.
//
// Run it: npm run audit:fields    (needs the sops env for AIRTABLE_TOKEN / AIRTABLE_BASE_ID)
// Exit code 1 if anything is BROKEN, so CI can gate on it.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!TOKEN || !BASE_ID) {
  console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID are not set. Run via `npm run audit:fields`.");
  process.exit(2);
}

// ---------------------------------------------------------------- Airtable types

// Types whose cell value arrives as an ARRAY. str() returns "" for every one of these, which is the
// exact trap that hid the Policy Stage.
const ARRAY_TYPES = new Set([
  "multipleSelects",
  "multipleAttachments",
  "multipleRecordLinks",
  "multipleLookupValues",
  "multipleCollaborators",
]);

const NUMBER_TYPES = new Set(["number", "currency", "percent", "duration", "rating", "autoNumber", "count"]);

const STRING_TYPES = new Set([
  "singleLineText",
  "multilineText",
  "richText",
  "singleSelect",
  "url",
  "email",
  "phoneNumber",
  "date",
  "dateTime",
  "createdTime",
  "lastModifiedTime",
  "externalSyncSource",
  "aiText",
]);

/** Formulas and rollups report their real shape under options.result. Unwrap to that. */
function effectiveType(field) {
  if ((field.type === "formula" || field.type === "rollup") && field.options?.result?.type) {
    const inner = field.options.result.type;
    // A rollup over a linked field is still an array unless it aggregates to a scalar.
    return ARRAY_TYPES.has(inner) ? inner : inner;
  }
  return field.type;
}

/** What each helper in lib/fields.ts can actually cope with. */
const READERS = {
  str: { wants: "scalar string", ok: (t) => STRING_TYPES.has(t) },
  num: { wants: "number", ok: (t) => NUMBER_TYPES.has(t) },
  numOrNull: { wants: "number", ok: (t) => NUMBER_TYPES.has(t) },
  firstTag: { wants: "single- or multi-select", ok: (t) => t === "singleSelect" || t === "multipleSelects" || STRING_TYPES.has(t) },
  firstPhoto: { wants: "attachment", ok: (t) => t === "multipleAttachments" },
  firstAttachmentId: { wants: "attachment", ok: (t) => t === "multipleAttachments" },
  // linkedinUrl/bool are tolerant of whatever they get, so they only get the existence check.
  linkedinUrl: { wants: "any text", ok: () => true },
};

// ---------------------------------------------------------------- schema

const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
if (!res.ok) {
  console.error("Could not read the base schema:", res.status, await res.text());
  process.exit(2);
}
const { tables } = await res.json();

/** tableId -> Map(fieldName -> effective type) */
const schema = new Map();
const tableName = new Map();
for (const t of tables) {
  tableName.set(t.id, t.name);
  schema.set(t.id, new Map(t.fields.map((f) => [f.name, effectiveType(f)])));
}

// ---------------------------------------------------------------- scan the source

const LIB = join(process.cwd(), "lib");
const files = readdirSync(LIB).filter((f) => f.endsWith(".ts"));

const READER_RE = new RegExp(
  String.raw`\b(${Object.keys(READERS).join("|")})\(\s*(?:f|fields|rec\.fields|r\.fields)\[\s*"([^"]+)"\s*\]`,
  "g"
);
// Any field touched at all, for the allow-list coverage check.
const ANY_FIELD_RE = /(?:f|fields|rec\.fields|r\.fields)\[\s*"([^"]+)"\s*\]/g;
const TABLE_RE = /"(tbl[A-Za-z0-9]{14})"/g;
// The requested-fields allow-list, however each lib spells it.
const SAFE_RE = /(?:SAFE_FIELDS|FIELDS|SPEAKER_FIELDS|SAFE)\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/g;

const broken = [];
const warnings = [];

for (const file of files) {
  const src = readFileSync(join(LIB, file), "utf8");

  const tableIds = [...new Set([...src.matchAll(TABLE_RE)].map((m) => m[1]))].filter((id) => schema.has(id));
  if (tableIds.length === 0) continue;

  const known = new Map();
  for (const id of tableIds) for (const [name, type] of schema.get(id)) if (!known.has(name)) known.set(name, { type, id });

  // --- 1. reader vs real field type
  for (const m of src.matchAll(READER_RE)) {
    const [, reader, field] = m;
    const line = src.slice(0, m.index).split("\n").length;
    const hit = known.get(field);

    if (!hit) {
      broken.push({
        file, line, field, reader,
        why: `no such field in ${tableIds.map((t) => tableName.get(t)).join(" / ")} — renamed or mistyped, reads as empty forever`,
      });
      continue;
    }
    const spec = READERS[reader];
    if (!spec.ok(hit.type)) {
      const fatal = ARRAY_TYPES.has(hit.type) && reader === "str";
      const entry = {
        file, line, field, reader,
        why: `field is ${hit.type} (${tableName.get(hit.id)}), ${reader}() wants ${spec.wants}` +
          (fatal ? " — str() returns \"\" for arrays, so this value is ALWAYS empty. Use firstTag()." : ""),
      };
      (fatal ? broken : warnings).push(entry);
    }
  }

  // --- 2. fields read but never requested from the API
  // Airtable only returns what `fields[]` asks for, so reading a field that is absent from the
  // allow-list yields undefined every time. This is how `Link to LinkedIn` quietly did nothing.
  const requested = new Set();
  for (const m of src.matchAll(SAFE_RE)) {
    for (const s of m[1].matchAll(/"([^"]+)"/g)) requested.add(s[1]);
  }
  // Some libs (eventrooms.ts) append the allow-list one field at a time instead of looping an
  // array. Both spellings count as "requested", or this check reports them as broken when they work.
  for (const m of src.matchAll(/append\(\s*"fields\[\]"\s*,\s*"([^"]+)"/g)) requested.add(m[1]);
  if (requested.size > 0) {
    for (const m of src.matchAll(ANY_FIELD_RE)) {
      const field = m[1];
      if (requested.has(field) || !known.has(field)) continue;
      warnings.push({
        file,
        line: src.slice(0, m.index).split("\n").length,
        field,
        reader: "—",
        why: "read in code but NOT in the requested fields[] allow-list, so it is always undefined",
      });
    }
  }
}

// ---------------------------------------------------------------- report

const fmt = (e) => `  ${e.file}:${e.line}  ${e.reader}("${e.field}")\n      ${e.why}`;

if (broken.length) {
  console.log(`\nBROKEN · ${broken.length} field read(s) that silently return nothing\n`);
  console.log(broken.map(fmt).join("\n"));
}
if (warnings.length) {
  console.log(`\nWARNING · ${warnings.length} shape mismatch(es) worth a look\n`);
  console.log(warnings.map(fmt).join("\n"));
}
if (!broken.length && !warnings.length) {
  console.log("\nEvery field read matches its Airtable type. Nothing silently empty.\n");
}
console.log(`\nChecked ${files.length} lib files against ${tables.length} tables in ${BASE_ID}.\n`);

process.exit(broken.length ? 1 : 0);
