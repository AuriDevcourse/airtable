// Adds the Denmark-Sweden Summit line-up to the CRM — Marketing Project Overview, one row per person
// under Project Name "Event Room 6".
//
// WHY (2026-08-19, Auri): the twelve are Øresundsinstituttet's and Greater Copenhagen's guests. They
// were typed onto the session rows by scripts/seed-denmark-sweden-summit.mjs and exist NOWHERE in the
// 3,843-row CRM, which is also why the "Event Room Speakers grid" view had no Event Room 6 rows at
// all while every other room had between 4 and 67. This script closes that gap.
//
// THE PEOPLE ARE READ FROM THE SESSIONS TABLE, not hardcoded here: the agenda is the source of truth
// for who is on stage (see lib/programPeople.ts), so re-running after the organisers change a line-up
// picks the change up instead of re-seeding a stale copy.
//
// Dry run by default. Prints every row it would create and writes nothing.
//   sops exec-env secrets.enc.env "node scripts/seed-denmark-sweden-crm.mjs"
//   sops exec-env secrets.enc.env "node scripts/seed-denmark-sweden-crm.mjs --apply"
//
// RE-RUNNING IS SAFE. Anyone already in the CRM under Event Room 6 is skipped by folded name, so a
// second --apply adds only people who are genuinely new.
//
// FIELD MAPPING (Auri's call, 2026-08-19): `Job Title` carries the agenda's line VERBATIM — "CEO at
// Øresundsinstituttet" — and `Company` is left empty. The other 181 rows in that view split the two,
// but splitting this source means inferring where a title ends, and two of these lines do not answer
// that cleanly ("former Operations and Machine Director at the European Spallation Source (ESS)",
// "Partner and Co-Founder at SDG Invest & Vår Ventures, Board Member at Minc"). Nothing is inferred.

const TOKEN = process.env.AIRTABLE_TOKEN;

const BASE = "appgXNjXJqpk9Ebxd";
const SESSIONS = "tblSlpTzDi2oVYwqv"; // Sessions — the agenda
const CRM = "tblTecOBecLQCNIeD"; // Marketing Project Overview — the roster
const API = "https://api.airtable.com/v0";

const EVENT = "Denmark-Sweden Summit";
const PROJECT = "Event Room 6"; // Project Name is a SINGLE select: one row per project assignment
const APPLY = process.argv.includes("--apply");

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN is not set. Run under sops exec-env.");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The same fold lib/programFaces.ts uses, so "Dr. X" and "X" are one person. */
function fold(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(prof|professor|dr|doctor|mr|mrs|ms|sir|hon|amb|ambassador)\s+/, "");
}

async function airtable(path, init) {
  const res = await fetch(`${API}/${path}`, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Every record of a table, following pagination.
 *
 * `fields` is passed one `fields[]=` per name rather than through the params object: URLSearchParams
 * joins an array with commas, and Airtable then reads the whole comma string as ONE field name and
 * 422s the request (UNKNOWN_FIELD_NAME). Only an allow-list of fields is ever requested — this table
 * carries 114 of them, most of them none of this script's business.
 */
async function readAll(table, { fields, ...params }) {
  const out = [];
  let offset;
  do {
    const q = new URLSearchParams(params);
    for (const f of fields ?? []) q.append("fields[]", f);
    q.set("pageSize", "100");
    if (offset) q.set("offset", offset);
    const data = await airtable(`${BASE}/${table}?${q}`, { headers });
    out.push(...data.records);
    offset = data.offset;
    await sleep(220);
  } while (offset);
  return out;
}

/**
 * Split a "Speaker Details" cell into people and pair each with the photo at the same index.
 *
 * Same two rules as parsePeople in lib/program.ts, and the same refusal: when the counts disagree the
 * photos are dropped rather than guessed, because the wrong face on the wrong person is worse than no
 * face. People split on " · ", and the first comma or dash divides the name from the job line.
 */
function parsePeople(cell, photos) {
  const entries = String(cell ?? "")
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  const paired = entries.length === (photos ?? []).length;
  return entries.map((entry, i) => {
    const cut = entry.search(/,|\s[–—]\s|\s-\s/);
    const name = (cut === -1 ? entry : entry.slice(0, cut)).trim();
    const line = cut === -1 ? "" : entry.slice(cut).replace(/^[,–—-]\s*/, "").trim();
    return { name, line, photo: paired ? photos[i]?.url ?? null : null };
  });
}

const sessions = await readAll(SESSIONS, {
  filterByFormula: `{Name of the Event}="${EVENT}"`,
  fields: [
    "Session Name",
    "Time Slot",
    "Speaker Details",
    "Speaker Photo",
    "Moderator Details",
    "Moderator Photo",
  ],
});
console.log(`${sessions.length} ${EVENT} sessions in the agenda.`);

// One entry per person per role, first face and fullest job line winning — the same rules the
// dashboard's roster applies (lib/programPeople.ts), so the CRM matches what /project-speakers shows.
const people = new Map();
for (const rec of sessions) {
  const f = rec.fields;
  const groups = [
    ["Moderator", parsePeople(f["Moderator Details"], f["Moderator Photo"])],
    ["Speaker", parsePeople(f["Speaker Details"], f["Speaker Photo"])],
  ];
  for (const [role, list] of groups) {
    for (const p of list) {
      if (!p.name) continue;
      const key = `${role}:${fold(p.name)}`;
      const seen = people.get(key);
      if (!seen) {
        people.set(key, { name: p.name, role, line: p.line, photo: p.photo });
        continue;
      }
      if (p.line.length > seen.line.length) seen.line = p.line;
      if (!seen.photo && p.photo) seen.photo = p.photo;
    }
  }
}

// Moderators first, the order the roster and the grid both use.
const roster = [...people.values()].sort((a, b) =>
  a.role === b.role ? 0 : a.role === "Moderator" ? -1 : 1
);

// Who is already filed under Event Room 6, so a re-run adds only what is missing.
const existing = await readAll(CRM, {
  filterByFormula: `{Project Name}="${PROJECT}"`,
  fields: ["Full Name"],
});
const have = new Set(existing.map((r) => fold(r.fields["Full Name"] ?? "")).filter(Boolean));
console.log(`${existing.length} rows already under ${PROJECT}.`);

const todo = roster.filter((p) => !have.has(fold(p.name)));

console.log(`\n${todo.length} to create, ${roster.length - todo.length} already there:\n`);
for (const p of roster) {
  const mark = have.has(fold(p.name)) ? "skip  " : "create";
  console.log(
    `  ${mark} ${p.role.padEnd(9)} ${p.name.padEnd(24)} ${p.photo ? "photo" : "NO PHOTO"}  ${p.line || "(no job line)"}`
  );
}

if (!todo.length) {
  console.log("\nNothing to do.");
  process.exit(0);
}

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

// Airtable caps creates at 10 per request; 250ms between calls stays well under 5 req/s.
for (let i = 0; i < todo.length; i += 10) {
  const batch = todo.slice(i, i + 10);
  const records = batch.map((p) => {
    const fields = {
      "Full Name": p.name,
      "Project Name": PROJECT,
      // The programme name, which is how every other row in this view labels what someone is on.
      "Session Name": EVENT,
      Role: [p.role],
    };
    // Verbatim, Company left empty — see the header.
    if (p.line) fields["Job Title"] = p.line;
    // Airtable fetches the file itself at create time. The URL is an attachment on the session row in
    // this same base, so no public proxy is involved.
    if (p.photo) fields["Profile Picture"] = [{ url: p.photo }];
    return { fields };
  });
  await airtable(`${BASE}/${CRM}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ records, typecast: true }),
  });
  console.log(`created ${batch.length} (${batch.map((b) => b.name).join(", ")})`);
  await sleep(250);
}

console.log("\nDone.");
