// Push the Nordic India Startup Summit (Event Room 2) speakers and moderators into BRELLA.
//
// Sibling of brella-push.mjs, same event, same write shape, different source rows. That script
// covers the grill sessions; this one covers Event Room 2 / NISS.
//
// WHAT THIS DOES: creates a Brella speaker record for every NISS presenter who is not there yet,
// with job title, company and a PERMANENT photo URL.
//
// WHAT THIS DELIBERATELY DOES NOT DO: link speakers to sessions. The integration API exposes no
// speaker-assignment route, so Auri links them by hand in the Brella UI. `--plan` prints the
// checklist for that, ordered by start time and with the Brella timeslot id for each session.
//
// All 11 NISS timeslots already exist in Brella (Hall C, 26 Aug) with zero speakers attached,
// so there is no timeslot-creation phase here. Verified 2026-08-10.
//
// Photos come from the connector's own proxy, not from Airtable directly: Airtable attachment
// URLs are signed and die after ~2 hours, so a raw one would be dead before Brella fetched it.
//
//   node brella-push-niss.mjs             dry run, shows every create
//   node brella-push-niss.mjs --plan      just the manual-linking checklist
//   node brella-push-niss.mjs --commit    actually writes
//   node brella-push-niss.mjs --commit --limit=1

const AIR = process.env.AIRTABLE_TOKEN, BRELLA = process.env.BRELLA_API_KEY || process.env.BRELLA;
const BASE = "appgXNjXJqpk9Ebxd", T = "tblTecOBecLQCNIeD", V = "viwfIcQFDNQ9ggSqx";
const EV = "https://api.brella.io/api/integration/organizations/109/events/10356";
const PHOTO_BASE = process.env.FEED_BASE_URL || "https://airtable-woad.vercel.app";
const R = { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" };
// Brella READS JSON:API but WRITES Rails: a `{speaker: {...}}` wrapper with snake_case keys and
// a plain application/json content type. See brella-push.mjs for how this was established.
const W = { ...R, "Content-Type": "application/json" };

const COMMIT = process.argv.includes("--commit");
const PLAN_ONLY = process.argv.includes("--plan");
const LIMIT = Number((process.argv.find(a => a.startsWith("--limit=")) || "--limit=0").slice(8)) || Infinity;

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Rows whose data would publish something plainly wrong to attendees. Printed and skipped rather
// than silently corrected: it is somebody else's data and a guess could be wrong. Fix the Airtable
// cell, then re-run — this script is idempotent and will pick the row up.
// Empty now. The one entry was retired on 2026-08-10 once the Airtable cell was corrected:
//   PhD Karin Beukel  The academic title sat inside Full Name, and Brella stores the whole name in
//                     first_name, so she would have published to attendees as the literal name
//                     "PhD Karin Beukel". Full Name is now "Karin Beukel" in both tables; the
//                     credential was never lost, Job Title already read "Chief Innovation Officer".
// Keep the mechanism: it is the right place to park anyone whose row would publish something wrong,
// since every record created here is public in the attendee app.
const HOLD = {};

// Airtable spelling -> the spelling Brella holds. Only for genuine typos, where word matching
// cannot bridge the gap and the script would otherwise create a second record for someone who is
// already there.
const ALIAS = {};

async function airtableNiss() {
  let recs = [], offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/${T}`);
    u.searchParams.set("view", V); u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const j = await (await fetch(u, { headers: { Authorization: `Bearer ${AIR}` } })).json();
    if (j.error) throw new Error("airtable: " + JSON.stringify(j.error));
    recs = recs.concat(j.records || []); offset = j.offset;
  } while (offset);
  return recs
    .filter(r => /Nordic India Startup Summit/i.test(r.fields["Session Name"] || ""))
    .map(r => ({
      id: r.id,
      name: (r.fields["Full Name"] || "").replace(/\s+/g, " ").trim(),
      title: (r.fields["Job Title"] || "").trim(),
      company: (r.fields["Company"] || "").trim(),
      role: /moderator/i.test(r.fields["Role"] || "") ? "Moderator" : "Speaker",
      photo: Array.isArray(r.fields["Profile Picture"]) && r.fields["Profile Picture"].length
        ? `${PHOTO_BASE}/api/photo/marketing/${r.id}` : null,
    }));
}

const wordsOf = s => new Set(norm(s).split(" ").filter(w => w && !/^(dr|prof|mr|ms|mrs|phd|retd)$/.test(w)));
// A record counts as the same human when every word of the Airtable name appears in the Brella
// one. Brella holds "Jussi Petteri Pyysalo" for Airtable's "Jussi Pyysalo"; an exact compare would
// miss that and create a duplicate person in the live app.
const sameHuman = (airName, brellaName) => {
  const a = wordsOf(ALIAS[airName] || airName), b = wordsOf(brellaName);
  if (!a.size || !b.size) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
};

// MUST page the /speakers collection, NOT the `included` of /timeslots. `included` only carries
// speakers already attached to a session, so anyone created here but not yet linked is invisible
// there — which is how a duplicate got created on brella-push.mjs's first run.
async function existingSpeakers() {
  let all = [], page = 1;
  for (;;) {
    const j = await (await fetch(`${EV}/speakers?page[size]=200&page[number]=${page}`, { headers: R })).json();
    const d = j.data || [];
    all = all.concat(d);
    if (d.length < 200 || page++ > 20) break;
  }
  return all.map(s => {
    const a = s.attributes || {};
    return { id: s.id, full: [a.honorific, a["first-name"], a["middle-name"], a["last-name"]].filter(Boolean).join(" ") };
  });
}

// Things that would be published to attendees exactly as they are typed in Airtable.
function dataWarnings(list) {
  const out = [];
  for (const p of list) {
    if (/@/.test(p.company)) out.push(`${p.name}: company field contains an email address — "${p.company}"`);
    if (!p.company) out.push(`${p.name}: no company — will be created without one`);
    if (/^moderator$/i.test(p.title)) out.push(`${p.name}: job title is literally "Moderator" — the fields look swapped`);
    if (p.title && p.title === p.title.toUpperCase() && p.title.length > 4) out.push(`${p.name}: job title is ALL CAPS — "${p.title}"`);
    if (p.name === p.name.toUpperCase() && p.name.length > 4) out.push(`${p.name}: name is ALL CAPS`);
    if (!p.photo) out.push(`${p.name}: no photo — will be created without one`);
    if (p.title.length > 60) out.push(`${p.name}: job title is ${p.title.length} chars, likely to be truncated in the app`);
  }
  return out;
}

const people = await airtableNiss();
if (!people.length) throw new Error("no NISS rows found in " + V + " — check the Session Name filter");

// ── the linking checklist ─────────────────────────────────────────────────────────────────────
if (PLAN_ONLY) {
  const slots = (await (await fetch(`${EV}/timeslots?page[size]=500`, { headers: R })).json()).data || [];
  // The session assignment lives on the NISS table, not on the marketing rows this script pushes:
  // program rows carry `Session Lineup 2026`, the reverse of the people-side `Sessions 2026`.
  // So read the program from there and match back to the pushed people by name.
  let niss = [], offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/tblfIPjV4t1c1628h`);
    u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const j = await (await fetch(u, { headers: { Authorization: `Bearer ${AIR}` } })).json();
    if (j.error) throw new Error("airtable niss: " + JSON.stringify(j.error));
    niss = niss.concat(j.records || []); offset = j.offset;
  } while (offset);
  const nissById = new Map(niss.map(r => [r.id, r.fields]));

  const local = iso => new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Copenhagen", weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  console.log("MANUAL LINKING CHECKLIST — in Brella, open each session and add these people.");
  console.log("Ordered by start time, so it can be worked straight down.\n");

  const rows = niss
    .filter(r => (r.fields["Session Lineup 2026"] || []).length)
    .map(r => {
      const title = (r.fields["Session Name"] || "").trim();
      const slot = slots.find(d => norm(d.attributes?.title) === norm(title));
      const list = (r.fields["Session Lineup 2026"] || [])
        .map(id => (nissById.get(id) || {})["Full Name"])
        .filter(Boolean)
        .map(n => people.find(p => sameHuman(p.name, n)) || { name: n.trim(), role: "?", company: "(not in the pushed set)" });
      return { title, time: r.fields["Time Slot"] || "", slot, list, when: slot?.attributes?.["start-time"] || "9999" };
    })
    .sort((a, b) => String(a.when).localeCompare(String(b.when)));

  let n = 0, links = 0;
  for (const r of rows) {
    n++; links += r.list.length;
    console.log(`\n${String(n).padStart(2)}. NISS · ${r.title}`);
    console.log(`    ${r.slot ? local(r.slot.attributes["start-time"]) + `  ·  timeslot #${r.slot.id}` : `*** NO MATCHING BRELLA TIMESLOT (sheet says ${r.time}) ***`}`);
    r.list.sort((a, b) => (a.role === "Moderator" ? 0 : 1) - (b.role === "Moderator" ? 0 : 1));
    for (const p of r.list) console.log(`    [ ] ${p.role.padEnd(9)} ${p.name.padEnd(26)} ${(p.company || "").slice(0, 34)}`);
  }
  console.log(`\n${rows.length} sessions, ${people.length} people, ${links} links to make.`);
  process.exit(0);
}

// ── the speaker records ───────────────────────────────────────────────────────────────────────
console.log(`=== NISS speakers · ${people.length} rows from Airtable ===`);
const warnings = dataWarnings(people);
if (warnings.length) {
  console.log(`\n   !! ${warnings.length} data issues that would go live as-is:`);
  for (const w of warnings) console.log(`      - ${w}`);
}
console.log("");

const have = await existingSpeakers();
let toCreate = 0, skipped = 0, held = 0, failed = 0;
for (const p of people) {
  if (HOLD[p.name]) { held++; console.log(`   HELD BACK  ${p.name} — ${HOLD[p.name]}`); continue; }
  const hit = have.find(s => sameHuman(p.name, s.full));
  if (hit) { skipped++; console.log(`   in brella already (#${hit.id} "${hit.full}"), skipping: ${p.name}`); continue; }
  if (toCreate >= LIMIT) { console.log(`   (--limit=${LIMIT} reached, stopping)`); break; }
  toCreate++;
  // Brella stores the whole name in first-name on almost every existing record, so match that
  // rather than guessing where a two-word surname splits. `photo` takes a URL and Brella
  // downloads and re-hosts it, so the image survives independently of our proxy. `photo_url`
  // and `remote_photo_url` are both rejected 400 — only `photo` works.
  const body = {
    speaker: {
      first_name: p.name, job_title: p.title, company_name: p.company,
      ...(p.photo ? { photo: p.photo } : {}),
    },
  };
  console.log(`   CREATE  ${p.role.padEnd(9)} ${p.name.padEnd(26)} ${p.title.slice(0, 28).padEnd(28)} ${p.company.slice(0, 24).padEnd(24)} ${p.photo ? "photo" : "NO PHOTO"}`);
  if (!COMMIT) continue;
  const res = await fetch(`${EV}/speakers`, { method: "POST", headers: W, body: JSON.stringify(body) });
  const txt = await res.text();
  if (!res.ok) failed++;
  console.log(`           -> ${res.status} ${res.ok ? "id " + (JSON.parse(txt).data?.id) : txt.slice(0, 200)}`);
}

console.log(`\n${toCreate} to create, ${skipped} already in Brella, ${held} held back${failed ? `, ${failed} FAILED` : ""}.`);
if (!COMMIT) console.log("\nDRY RUN. nothing was written. add --commit");
else console.log("\nDone. Now run with --plan and link the speakers to their sessions in Brella.");
