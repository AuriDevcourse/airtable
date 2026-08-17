// Push the ONE genuinely-missing 2026 Grill Session into Brella: FailForward.
//
// WHY A SEPARATE SCRIPT. brella-push.mjs is the record of the 2026-08-11 push. Its
// MISSING_TIMESLOTS list is hardcoded to two sessions that are now both live in Brella, and it
// reads presenters from the Marketing table (tblTecOBecLQCNIeD), not from the submission form
// table. Re-running it would be a no-op at best and confusing at worst, so it is left alone.
//
// WHAT THIS DOES (2026-08-17). Of the 22 rows in the "2026 Grill session submissions" view
// (tbllvkwLhB4Omdphd / viwmxcuIN0SFe2tkF), three are not ticked "Added to BRELLA". TWO OF THOSE
// THREE ARE ALREADY IN BRELLA and only the checkbox is stale:
//   EIFO   "Five Fuck-ups in Early Stage Finance"      Orange, 26 Aug 11:00-11:40, 2 speakers
//   EIC    "Scaling Deep Tech in Europe..."            Green,  26 Aug 12:40-13:20, 4 speakers
// Creating those again would duplicate a live session in the attendee app, so this script targets
// FailForward ONLY and still checks Brella by title before creating anything.
//
// THE TRACK IS INFERRED, NOT SUBMITTED. The submission table has 132 fields and none of them says
// which grill colour. FailForward booked 26 Aug 11:00; at that slot Green holds "The Unexpected
// Side of Innovation" and Orange holds "Five Fuck-ups", so BLUE is the only free track. Confirmed
// with Auri 2026-08-17. Change TRACK_NAME below if the signage plan says otherwise.
//
// WHAT IT CANNOT DO: link the speakers to the session. Brella's integration API exposes no
// speaker-assignment route (see brella-push.mjs). That stays a manual step in the Brella UI, which
// is what the checklist at the end is for.
//
//   node brella-push-failforward.mjs            dry run, writes nothing
//   node brella-push-failforward.mjs --commit   actually creates

const AIR = process.env.AIRTABLE_TOKEN;
const BRELLA = process.env.BRELLA_API_KEY || process.env.BRELLA;
const BASE = process.env.AIRTABLE_BASE_ID || "appgXNjXJqpk9Ebxd";
const TABLE = "tbllvkwLhB4Omdphd"; // Partnership Success
const VIEW = "viwmxcuIN0SFe2tkF"; // 2026 Grill session submissions
const EV = "https://api.brella.io/api/integration/organizations/109/events/10356";
const PHOTO_BASE = process.env.FEED_BASE_URL || "https://airtable-woad.vercel.app";

// Same headers as brella-push.mjs: Brella READS JSON:API but WRITES Rails-shaped bodies.
const R = { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" };
const W = { ...R, "Content-Type": "application/json" };

const TRACK = { GREEN: "43273", ORANGE: "43274", BLUE: "43275" };

const COMMIT = process.argv.includes("--commit");

const COMPANY = "FailForward";
const TRACK_NAME = "BLUE";
// 26 Aug 2026 is CEST (UTC+2), so 11:00 Copenhagen is 09:00Z. Same conversion the earlier push
// used and cross-checked against grill slots whose partner time and Brella time already agree.
const START_UTC = "2026-08-26T09:00:00.000Z";
const DURATION = 40;
const LOCATION = "Hall E";

if (!AIR || !BRELLA) {
  console.error("AIRTABLE_TOKEN and BRELLA_API_KEY must be set. Run under `sops exec-env secrets.enc.env`.");
  process.exit(2);
}

const norm = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// ── the Airtable row ───────────────────────────────────────────────────────────────────────────
const u = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
u.searchParams.set("view", VIEW);
u.searchParams.set("pageSize", "100");
const air = await (await fetch(u, { headers: { Authorization: `Bearer ${AIR}` } })).json();
if (air.error) throw new Error("airtable: " + JSON.stringify(air.error));

const row = (air.records || []).find((r) => norm(r.fields["Company"]) === norm(COMPANY));
if (!row) throw new Error(`No "${COMPANY}" row in that view.`);
const f = row.fields;

// The form writes one multiline cell per presenter: "Name: ...\nPosition: ...\nCompany: ...".
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];
// Two spellings of the presenter-detail field exist in this 132-field table, and the form has used
// both. Each slot tries its variants in order rather than assuming one.
const DETAIL_FIELDS = [
  ["1st Presenters details", "1st Presenter details"],
  ["2nd Presenter Details", "2nd Presenters Details"],
  ["3rd Presenter details", "3rd Presenters details"],
  ["4th Presenter details", "4th Presenters details"],
  ["5th Presenters details", "5th Presenter details"],
];
// Likewise for the photo cells. FailForward's first headshot sits in "1st Presenter photo"
// (singular, lowercase p), NOT the "1st Presenters Photo" that lib/photo.ts indexes, so the proxy's
// f=0 slot is empty for this row. Both names are tried here.
const PHOTO_FIELDS = [
  ["1st Presenters Photo", "1st Presenter photo"],
  ["2nd Presenters Photo", "2nd Presenter Photo"],
  ["3rd Presenters Photo", "3rd Presenter Photo"],
  ["4th Presenters Photo", "4th Presenter Photo"],
  ["5th Presenters Photo", "5th Presenter Photo"],
];

const pick = (names) => names.find((n) => f[n] != null && String(f[n]).length) ?? null;

const parseDetail = (txt) => {
  const get = (k) => (new RegExp(`${k}\\s*:\\s*(.+)`, "i").exec(txt || "")?.[1] || "").trim();
  return { name: get("Name"), title: get("Position"), company: get("Company") };
};

// "4th and 5th presenters are moderators" is written in Other remarks, not in a field, so the roles
// are read from that note. Printed below so a wrong reading is visible rather than silent.
const remarks = String(f["Other remarks"] || "");
const modSlots = new Set();
for (let i = 0; i < 5; i++) {
  const ord = ORDINALS[i];
  if (new RegExp(`${ord}[^.]{0,40}moderator`, "i").test(remarks)) modSlots.add(i);
}
if (/4th and 5th[^.]{0,30}moderator/i.test(remarks)) { modSlots.add(3); modSlots.add(4); }

const people = [];
for (let i = 0; i < 5; i++) {
  const dField = pick(DETAIL_FIELDS[i]);
  if (!dField) continue;
  const p = parseDetail(f[dField]);
  if (!p.name) continue;
  const pField = pick(PHOTO_FIELDS[i]);
  people.push({
    ...p,
    slot: ORDINALS[i],
    role: modSlots.has(i) ? "Moderator" : "Speaker",
    // The proxy re-resolves server-side; a raw Airtable attachment URL is signed and dies in ~2h,
    // and Brella downloads the image at create time, so a dead URL means a speaker with no face.
    photo: pField ? `${PHOTO_BASE}/api/photo/event-rooms/${row.id}?f=${i}` : null,
    photoField: pField,
  });
}

// ── what Brella already has ────────────────────────────────────────────────────────────────────
const slots = await (await fetch(`${EV}/timeslots?page[size]=500`, { headers: R })).json();
const title = String(f["Session Title"] || "").trim();
const existing = (slots.data || []).find((t) => norm(t.attributes?.title) === norm(title));

let speakers = [];
for (let page = 1; page <= 20; page++) {
  const j = await (await fetch(`${EV}/speakers?page[size]=500&page[number]=${page}`, { headers: R })).json();
  const d = j.data || [];
  if (!d.length) break;
  speakers = speakers.concat(
    d.map((s) => ({
      id: s.id,
      full: [s.attributes["first-name"], s.attributes["middle-name"], s.attributes["last-name"]]
        .filter(Boolean).join(" "),
    }))
  );
}
// Same rule as brella-push.mjs: a record is the same human when every word of the Airtable name
// appears in the Brella one, so "Jussi Pyysalo" matches "Jussi Petteri Pyysalo" instead of
// creating a duplicate person in the live app.
const sameHuman = (a, b) => {
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  return [...A].every((w) => B.has(w)) || [...B].every((w) => A.has(w));
};

// ── report ─────────────────────────────────────────────────────────────────────────────────────
console.log(`\n${COMMIT ? "COMMIT" : "DRY RUN"} · ${COMPANY} · Airtable ${row.id}\n`);
console.log(`  Title       ${title}`);
console.log(`  Track       ${TRACK_NAME} Grill Session (track_id ${TRACK[TRACK_NAME]})  [INFERRED, see header]`);
console.log(`  Start       ${START_UTC}   = 26 Aug 11:00 Copenhagen`);
console.log(`  Duration    ${DURATION} min`);
console.log(`  Location    ${LOCATION}`);
console.log(`  Submitted   ${f["Date of Event"]}  ${f["Time slot"]}   format ${JSON.stringify(f["Session Format"])}`);
console.log(`  Remarks     ${remarks.replace(/\n/g, " / ") || "-"}`);

console.log(`\n=== PHASE 1 · timeslot ===`);
const tsBody = {
  timeslot: {
    title,
    start_time: START_UTC,
    duration: DURATION,
    location: LOCATION,
    track_id: TRACK[TRACK_NAME],
  },
};
if (existing) {
  console.log(`   ALREADY IN BRELLA (#${existing.id}) — would skip. Nothing to create.`);
} else {
  console.log(`   CREATE  POST ${EV}/timeslots`);
  console.log(`   ${JSON.stringify(tsBody)}`);
}

console.log(`\n=== PHASE 2 · speakers (${people.length}) ===`);
let toCreate = 0;
for (const p of people) {
  const hit = speakers.find((s) => sameHuman(p.name, s.full));
  const flag = p.photo ? `photo f=${ORDINALS.indexOf(p.slot)}` : "NO PHOTO";
  if (hit) {
    console.log(`   exists (#${hit.id} "${hit.full}"), skip   ${p.name}`);
    continue;
  }
  toCreate++;
  console.log(`   CREATE  ${p.slot} ${p.role.padEnd(9)} ${p.name.padEnd(26)} ${String(p.title).slice(0, 30).padEnd(30)} ${String(p.company).slice(0, 24).padEnd(24)} ${flag}`);
  if (!p.photoField) console.log(`           !! no photo cell found for slot ${p.slot}`);
}
console.log(`\n   ${toCreate} speaker(s) to create, ${people.length - toCreate} already in Brella.`);

if (COMMIT) {
  console.log(`\n--- writing ---`);
  let slotId = existing?.id;
  if (!existing) {
    const res = await fetch(`${EV}/timeslots`, { method: "POST", headers: W, body: JSON.stringify(tsBody) });
    const txt = await res.text();
    slotId = res.ok ? JSON.parse(txt).data?.id : undefined;
    console.log(`   timeslot -> ${res.status} ${res.ok ? "created id " + slotId : txt.slice(0, 300)}`);
  }
  for (const p of people) {
    if (speakers.find((s) => sameHuman(p.name, s.full))) continue;
    const body = {
      speaker: {
        first_name: p.name,
        job_title: p.title,
        company_name: p.company,
        ...(p.photo ? { photo: p.photo } : {}),
      },
    };
    const res = await fetch(`${EV}/speakers`, { method: "POST", headers: W, body: JSON.stringify(body) });
    const txt = await res.text();
    console.log(`   ${p.name.padEnd(26)} -> ${res.status} ${res.ok ? "id " + JSON.parse(txt).data?.id : txt.slice(0, 200)}`);
  }
  console.log(`\n=== MANUAL STEP · link in the Brella UI ===`);
  console.log(`   Session: "${title}"  (${TRACK_NAME} Grill, 26 Aug 11:00, ${LOCATION})`);
  for (const p of people) console.log(`     [ ] ${p.role.padEnd(9)} ${p.name}`);
  console.log(`\n   Then tick "Added to BRELLA" on Airtable row ${row.id}.`);
} else {
  console.log(`\nDRY RUN. Nothing was written. Add --commit to create.`);
}
