// Push the Grill Session presenters into BRELLA.
//
// WHAT THIS DOES:
//   phase 1  creates the 2 grill timeslots that exist in the planning sheet but not in Brella
//   phase 2  creates a Brella speaker record for every grill presenter who is not there yet,
//            with job title, company and a PERMANENT photo URL
//
// WHAT THIS DELIBERATELY DOES NOT DO: link speakers to sessions. The integration API exposes no
// speaker-assignment route (no collection, nothing nested under a speaker or a timeslot), and the
// only candidate left is a PATCH on the live timeslot.
// Auri links them by hand in the Brella UI. `--plan` prints the checklist for that.
//
// PATCH ON A TIMESLOT MERGES — measured 2026-08-11, so this line no longer says "unknown".
// `PATCH /timeslots/978531` with `{timeslot:{title}}` changed the title and NOTHING else: every
// other attribute, and the tags/locations/speaker-assignments relationships, came back identical
// on a re-read. So a narrow field edit is safe to send. That is NOT yet a licence to assign
// speakers this way — a merge on a scalar says nothing about how a relationship array would be
// treated, and that is the case still worth probing on a throwaway timeslot before trusting it.
//
// Photos come from the connector's own proxy, not from Airtable directly: Airtable attachment
// URLs are signed and die after ~2 hours, so a raw one would be dead before anyone imported it.
// /api/photo/marketing/<recordId> re-resolves server-side and never expires.
//
//   node brella-push.mjs                 dry run, shows every create
//   node brella-push.mjs --plan          just the manual-linking checklist
//   node brella-push.mjs --commit        actually writes
//   node brella-push.mjs --commit --only-timeslots
//   node brella-push.mjs --commit --only-speakers

const AIR = process.env.AIRTABLE_TOKEN, BRELLA = process.env.BRELLA_API_KEY || process.env.BRELLA;
const BASE = "appgXNjXJqpk9Ebxd", GRILL_T = "tblTecOBecLQCNIeD", GRILL_V = "viwfIcQFDNQ9ggSqx";
const EV = "https://api.brella.io/api/integration/organizations/109/events/10356";
const PHOTO_BASE = process.env.FEED_BASE_URL || "https://airtable-woad.vercel.app";
const R = { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" };
// Brella READS JSON:API but WRITES Rails: a `{speaker: {...}}` wrapper with snake_case keys and
// a plain application/json content type. A JSON:API body is rejected 400 with an empty response,
// which is why this took probing to find. Established 2026-08-10, see progress.md.
const W = { ...R, "Content-Type": "application/json" };

const COMMIT = process.argv.includes("--commit");
const PLAN_ONLY = process.argv.includes("--plan");
const ONLY_TS = process.argv.includes("--only-timeslots");
const ONLY_SPK = process.argv.includes("--only-speakers");
// Stop after N creates. Used to prove the shape on one real record before doing all of them.
const LIMIT = Number((process.argv.find(a => a.startsWith("--limit=")) || "--limit=0").slice(8)) || Infinity;

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const TRACK = { GREEN: "43273", ORANGE: "43274", BLUE: "43275" };

// Held back on purpose. Everything created here is published to attendees, and these two rows
// would publish something plainly wrong. Fix the Airtable cell, then re-run: the script is
// idempotent and will pick them up. Remove a name from this list once its row is corrected.
// Empty now. Both entries were cleared on 2026-08-10 once Auri corrected the Airtable rows:
//   Fabio Cavaliere    Company had his email address appended; now "Ideon Science Park", and the
//                      job title is filled in properly as "Junior Project Manager & Business Developer".
//   Gertrude Chilufya  Job Title and Company were swapped; now "Founder" / "Reframe Tech", with
//                      Moderator left where it belongs, in the Role field.
// Keep the mechanism: it is the right place to park anyone whose row would publish something
// wrong to attendees, since every record created here is public in the app.
const HOLD = {};

// The two sessions in the planning sheet that Brella has never had. Times are Copenhagen local
// from the sheet; August 2026 is CEST (UTC+2), so 12:40 local is 10:40Z. Cross-checked against
// four grill slots whose partner and Brella time already agree, so the offset is not a guess.
const MISSING_TIMESLOTS = [
  {
    title: "Scaling Deep Tech in Europe: Lessons from EIC Founders and Investors",
    track: "GREEN", start: "2026-08-26T10:40:00.000Z", duration: 40, location: "Hall E",
    note: "sheet: European Innovation Council, day 1, 12:40-13:20, Green Grill",
  },
  {
    title: "From AI Hype to Real Deal Execution",
    track: "GREEN", start: "2026-08-27T10:40:00.000Z", duration: 40, location: "Hall E",
    // The sheet puts GetAccept in TWO consecutive Green cells on day 2, 12:40-13:20 and
    // 13:30-14:10, with no note saying it is one long booking. Every other grill session is 40
    // minutes, so that is what gets created. If it is really 80, widen the duration in Brella.
    note: "sheet: GetAccept, day 2, 12:40-13:20 Green Grill. CHECK: sheet also shows 13:30-14:10",
  },
];

async function airtableGrill() {
  let recs = [], offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/${GRILL_T}`);
    u.searchParams.set("view", GRILL_V); u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const j = await (await fetch(u, { headers: { Authorization: `Bearer ${AIR}` } })).json();
    if (j.error) throw new Error("airtable: " + JSON.stringify(j.error));
    recs = recs.concat(j.records || []); offset = j.offset;
  } while (offset);
  return recs.filter(r => /Grill Session$/i.test(r.fields["Project Name"] || "")).map(r => ({
    id: r.id,
    name: (r.fields["Full Name"] || "").replace(/\s+/g, " ").trim(),
    title: (r.fields["Job Title"] || "").trim(),
    company: (r.fields["Company"] || "").trim(),
    session: (r.fields["Session Name"] || "").trim(),
    role: /moderator/i.test(r.fields["Role"] || "") ? "Moderator" : "Speaker",
    colour: (r.fields["Project Name"] || "").split(" ")[0].toUpperCase(),
    photo: Array.isArray(r.fields["Profile Picture"]) && r.fields["Profile Picture"].length
      ? `${PHOTO_BASE}/api/photo/marketing/${r.id}` : null,
  }));
}

const brella = async () => await (await fetch(`${EV}/timeslots?page[size]=500`, { headers: R })).json();

const wordsOf = s => new Set(norm(s).split(" ").filter(w => w && !/^(dr|prof|mr|ms|mrs)$/.test(w)));
// Brella already holds "Jussi Petteri Pyysalo" for Airtable's "Jussi Pyysalo". An exact compare
// misses that and would create a duplicate person in the live app, so a record counts as the same
// human when every word of the Airtable name is present in the Brella one.
// Airtable spelling -> the spelling Brella holds. Only for genuine typos in the Airtable row,
// where word matching cannot bridge the gap and the script would otherwise create a second
// record for someone who is already there.
//
// Empty now: the one entry ("Jennifer Monatgue" -> "Jennifer Montague") was retired on
// 2026-08-10 once the Airtable cell was corrected and the two spellings matched on their own.
// Keep the mechanism — a transposed letter in a name is invisible to word matching and the
// failure mode is a duplicate human in the live attendee app.
const ALIAS = {};

const sameHuman = (airName, brellaName) => {
  const a = wordsOf(ALIAS[airName] || airName), b = wordsOf(brellaName);
  if (!a.size || !b.size) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
};

const people = await airtableGrill();
let snap = await brella();
// Exact title first. The fallback exists for one real row: Brella stores The Bridge Effect as
// "...Øresund Region Discover Dutch Tech at the Orange Stage", two session names run together, so
// an exact compare would report a session that plainly exists as missing.
const slotByTitle = (t, fuzzy = false) => {
  const k = norm(t);
  const exact = (snap.data || []).find(d => norm(d.attributes?.title) === k);
  if (exact || !fuzzy) return exact;
  return (snap.data || []).find(d => {
    const b = norm(d.attributes?.title);
    return b.length > 15 && (b.startsWith(k) || k.startsWith(b));
  });
};
// MUST page the /speakers collection, NOT the `included` of /timeslots. `included` only carries
// speakers that are already attached to a session, so a speaker this script created but has not
// linked yet is invisible there — which is exactly how a duplicate Andreas Schwarz got created on
// the first run. Every re-run of this script depends on this being the full list.
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

// Things that would be published to attendees exactly as they are typed in Airtable. Printed
// rather than silently corrected: they are somebody else's data and a guess could be wrong.
function dataWarnings(list) {
  const out = [];
  for (const p of list) {
    if (/@/.test(p.company)) out.push(`${p.name}: company field contains an email address — "${p.company}"`);
    if (/^moderator$/i.test(p.title)) out.push(`${p.name}: job title is literally "Moderator" and company is "${p.company}" — the two fields look swapped`);
    if (/\|/.test(p.company)) out.push(`${p.name}: company contains a pipe — "${p.company}"`);
    if (p.title && p.title === p.title.toUpperCase() && p.title.length > 4) out.push(`${p.name}: job title is ALL CAPS — "${p.title}"`);
    if (p.name === p.name.toUpperCase() && p.name.length > 4) out.push(`${p.name}: name is ALL CAPS`);
    if (!p.photo) out.push(`${p.name}: no photo — will be created without one`);
    if (p.title.length > 60) out.push(`${p.name}: job title is ${p.title.length} chars, likely to be truncated in the app`);
  }
  return out;
}

if (PLAN_ONLY) {
  console.log("MANUAL LINKING CHECKLIST — in Brella, open each session and add these people.");
  console.log("Ordered by day and start time, so it can be worked straight down.\n");
  const bySession = {};
  for (const p of people) (bySession[p.session] ||= []).push(p);

  // Copenhagen local, which is what the Brella UI and the planning sheet both show. Brella
  // stores UTC and August 2026 is CEST, so a raw start-time reads two hours early.
  const local = iso => new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Copenhagen", weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const rows = Object.entries(bySession).map(([session, list]) => {
    const slot = slotByTitle(session, true);
    return { session, list, slot, when: slot?.attributes?.["start-time"] || "9999" };
  }).sort((a, b) => String(a.when).localeCompare(String(b.when)));

  let n = 0;
  for (const { session, list, slot } of rows) {
    n++;
    console.log(`\n${String(n).padStart(2)}. ${list[0].colour} GRILL · ${session}`);
    console.log(`    ${slot ? local(slot.attributes["start-time"]) + `  ·  timeslot #${slot.id}` : "*** NO TIMESLOT — create it first ***"}`);
    // Moderator first: that is the order the session should read in.
    list.sort((a, b) => (a.role === "Moderator" ? 0 : 1) - (b.role === "Moderator" ? 0 : 1));
    for (const p of list) console.log(`    [ ] ${p.role.padEnd(9)} ${p.name.padEnd(23)} ${p.company.slice(0, 30)}`);
  }
  console.log(`\n${rows.length} sessions, ${people.length} people to link.`);
  process.exit(0);
}

// ── phase 1: the missing timeslots ────────────────────────────────────────────────────────────
if (!ONLY_SPK) {
  console.log("=== PHASE 1 · timeslots ===");
  for (const t of MISSING_TIMESLOTS) {
    if (slotByTitle(t.title)) { console.log(`   exists already, skipping: ${t.title.slice(0, 60)}`); continue; }
    // Same Rails shape as speakers: `{timeslot: {...}}`, snake_case, track by plain `track_id`
    // rather than a JSON:API relationship. A JSON:API body 500s here with an empty response.
    const body = {
      timeslot: {
        title: t.title, start_time: t.start, duration: t.duration,
        location: t.location, track_id: TRACK[t.track],
      },
    };
    console.log(`   CREATE  ${t.track.padEnd(6)} ${t.start}  ${t.duration}min  ${t.location}  ${t.title.slice(0, 52)}`);
    console.log(`           (${t.note})`);
    if (!COMMIT) continue;
    const res = await fetch(`${EV}/timeslots`, { method: "POST", headers: W, body: JSON.stringify(body) });
    const txt = await res.text();
    console.log(`           -> ${res.status} ${res.ok ? "created id " + (JSON.parse(txt).data?.id) : txt.slice(0, 200)}`);
  }
  if (COMMIT) snap = await brella();
}

// ── phase 2: the speaker records ──────────────────────────────────────────────────────────────
if (!ONLY_TS) {
  console.log("\n=== PHASE 2 · speakers ===");
  const warnings = dataWarnings(people);
  if (warnings.length) {
    console.log(`   !! ${warnings.length} data issues that would go live as-is:`);
    for (const w of warnings) console.log(`      - ${w}`);
    console.log("");
  }

  const have = await existingSpeakers();
  let toCreate = 0, skipped = 0;
  for (const p of people) {
    if (HOLD[p.name]) { console.log(`   HELD BACK  ${p.name} — ${HOLD[p.name]}`); continue; }
    const hit = have.find(s => sameHuman(p.name, s.full));
    if (hit) { skipped++; console.log(`   in brella already (#${hit.id} "${hit.full}"), skipping: ${p.name}`); continue; }
    if (toCreate >= LIMIT) { console.log(`   (--limit=${LIMIT} reached, stopping)`); break; }
    toCreate++;
    // Brella stores the whole name in first-name on almost every existing record, so match that
    // rather than guessing where a two-word surname splits ("Vincent van der Holst").
    // `photo` takes a URL and Brella downloads and re-hosts it on brella-assets.brella.io, so the
    // photo survives independently of our proxy. `photo_url` and `remote_photo_url` are both
    // rejected 400 — only `photo` works.
    const body = {
      speaker: {
        first_name: p.name, job_title: p.title, company_name: p.company,
        ...(p.photo ? { photo: p.photo } : {}),
      },
    };
    console.log(`   CREATE  ${p.name.padEnd(24)} ${p.title.slice(0, 30).padEnd(30)} ${p.company.slice(0, 22).padEnd(22)} ${p.photo ? "photo" : "NO PHOTO"}`);
    if (!COMMIT) continue;
    const res = await fetch(`${EV}/speakers`, { method: "POST", headers: W, body: JSON.stringify(body) });
    const txt = await res.text();
    console.log(`           -> ${res.status} ${res.ok ? "id " + (JSON.parse(txt).data?.id) : txt.slice(0, 200)}`);
  }
  console.log(`\n${toCreate} to create, ${skipped} already in Brella.`);
}

if (!COMMIT) console.log("\nDRY RUN. nothing was written. add --commit");
else console.log("\nDone. Now run with --plan and link the speakers to their sessions in Brella.");
