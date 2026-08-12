// Push the Creative Business Cup agenda into BRELLA.
//
// WHY: Brella holds CBC as ONE block per day, so the board draws a 2.5-hour rectangle that says
// nothing about what happens inside it. The published programme exists (CBC_2026_Program.pdf from
// Creative Business Network) and Auri settled on 2026-08-12 that the PDF is the correct source.
//
// WHAT THIS DOES:
//   phase 1  creates the 13 agenda sessions as plain timeslots on the CBC track
//   phase 2  moves the Day 1 parent block from 15:00-17:30 to 14:00-17:00, per the PDF
//
// WHAT IT DELIBERATELY DOES NOT DO: attach speakers. The integration API exposes no
// speaker-assignment route (see brella-push.mjs, same finding). The five CBC speakers are already
// on the two parent blocks; Auri links them to the sub-sessions by hand in the Brella UI.
//
// PLAIN SIBLINGS, NOT NATIVE CHILDREN. Brella has a `parent_timeslot_id`, and NOTHING in this
// event uses it — 0 of 285 timeslots. Every other partner programme (Nordic India, Deep Tech,
// Future of Fintech) is a flat set of timeslots in one track, and our board derives the shell from
// the times alone. Following the established pattern rather than introducing nesting nobody has
// tested in the attendee app.
//
// THE 14:00 START OVERLAPS GOOGLE. `Scaling Europe` holds Event Room 5 until 14:45 on the 26th,
// so the first 45 minutes of Day 1 collide with it. Raised with Auri twice, who chose the PDF
// times anyway (2026-08-12). Recorded here because the board will draw two lanes for that span and
// the next person will think it is a bug.
//
//   node brella-push-cbc.mjs                dry run, prints every create
//   node brella-push-cbc.mjs --commit       creates the sessions
//   node brella-push-cbc.mjs --commit --only=1   just the first session, to verify the shape
//   node brella-push-cbc.mjs --commit --parent    only the Day 1 parent time fix
//
// Times below are LOCAL Copenhagen, converted to the UTC that Brella stores (August = UTC+2).

const BRELLA = process.env.BRELLA_API_KEY || process.env.BRELLA;
if (!BRELLA) { console.error("BRELLA_API_KEY is not set."); process.exit(1); }

const EV = "https://api.brella.io/api/integration/organizations/109/events/10356";
const R = { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" };
// Brella READS JSON:API but WRITES Rails: `{timeslot: {...}}`, snake_case, plain application/json.
// Established in brella-push.mjs on 2026-08-10; a JSON:API body is rejected outright.
const W = { ...R, "Content-Type": "application/json" };

// Copied from the two existing CBC blocks rather than guessed (GET /timeslots, 2026-08-12).
const TRACK_ID = 43681; // Event Room 5
const LOCATION = "Hall C";
const SUBTITLE = "Session by Creative Business Network";
const PARENT_DAY1 = 978024; // Creative Business Cup 2026 - CBC Initial Pitching
// Renamed 2026-08-12 from "Creative Business Cup 2026 - CBC Global Finals & Creativity & AI"
// (Auri): the shell only has to say what is running, and the old title said CBC twice. Day 1 still
// carries the long form — nobody asked for it to change.
const PARENT_DAY2 = 978025; // CBC Global Finals & Creativity & AI

const COMMIT = process.argv.includes("--commit");
const PARENT_ONLY = process.argv.includes("--parent");
const ONLY = Number((process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || 0);

// THE DESCRIPTION GOES IN AS A PLAIN STRING, measured 2026-08-12 and counter-intuitive: GET
// returns `content` as a Draft.js document ({blocks:[{text,type,…}],entityMap}), so the obvious move
// is to send that shape back. It does not work — a POST carrying the Draft.js object 500s with an
// empty body, and PATCHing it stores the serialised JSON as the visible text. Send the string and
// Brella builds the document itself.
//
// Two more traps found the same afternoon, both worth knowing before probing anything here:
//   - An unknown key is accepted with 200 and silently ignored. `description`, `content_html` and
//     `body` all "succeeded" and changed nothing, so a 200 is NOT evidence that a field landed.
//   - GET /timeslots/<id> 404s. There is no single-timeslot read; verify through the collection.
const content = (text) => text;

// "2026-08-26", "14:00" local -> the UTC instant Brella wants. Explicit -02:00 rather than a Date
// arithmetic trick: this runs on a laptop in whatever timezone, and a silent local-time assumption
// is how a whole agenda lands an hour off.
const at = (date, hhmm) => new Date(`${date}T${hhmm}:00+02:00`).toISOString();

const mins = (from, to) => {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  return th * 60 + tm - (fh * 60 + fm);
};

// Verbatim from CBC_2026_Program.pdf. The emoji the PDF puts on three of these (coffee, trophy,
// camera) are dropped: this text is attendee-facing UI in the app.
const DAY1 = "2026-08-26";
const DAY2 = "2026-08-27";

const SESSIONS = [
  // ── Day 1 · Tuesday 26 August · Initial Pitching Round · 14:00-17:00 ────────────────────
  { day: DAY1, from: "14:00", to: "14:15", title: "Welcome & opening",
    desc: "Host + Rasmus Wiinstedt Tscherning. Welcome to CBC 2026, how the day works, and the judging criteria: Creativity · Market Potential · Business Execution." },
  { day: DAY1, from: "14:15", to: "14:20", title: "How pitching works",
    desc: "Format briefing (3-min pitch + 5-min Q&A) and meet the jury." },
  { day: DAY1, from: "14:20", to: "15:20", title: "Pitching — Block 1",
    desc: "Startups pitch: 3 minutes + 5 minutes Q&A / feedback each." },
  { day: DAY1, from: "15:20", to: "15:35", title: "Break & networking",
    desc: "Catering available." },
  { day: DAY1, from: "15:35", to: "16:45", title: "Pitching — Block 2",
    desc: "Continued pitches." },
  { day: DAY1, from: "16:45", to: "17:00", title: "Wrap-up & what's next",
    desc: "Thank-yous, finalists to be announced, and information for Day 2." },

  // ── Day 2 · Wednesday 27 August · Global Finals & "Creativity & AI" · 09:30-13:00 ───────
  { day: DAY2, from: "09:30", to: "09:45", title: "Welcome & recap",
    desc: "Host recaps Day 1 and introduces the Finals and the jury." },
  { day: DAY2, from: "09:45", to: "11:00", title: "CBC Global Finals",
    desc: "The finalists pitch: 3 minutes + 5 minutes Q&A each." },
  { day: DAY2, from: "11:00", to: "11:15", title: "Break & networking",
    desc: "Catering available; jury begins deliberation." },
  { day: DAY2, from: "11:15", to: "12:15", title: "“Creativity & AI” session",
    desc: "Panel / keynote — joint session with TechBBQ — while the jury deliberates." },
  { day: DAY2, from: "12:15", to: "12:35", title: "Partner remarks & thank-yous",
    desc: "Creative Business Network, TechBBQ and national partners." },
  { day: DAY2, from: "12:35", to: "12:50", title: "Awards & winner announcement",
    desc: "The 2026 Global Winner is revealed." },
  { day: DAY2, from: "12:50", to: "13:00", title: "Closing remarks & group photo",
    desc: "Celebrating all our creative founders." },
];

// The Day 1 parent, per the PDF: 14:00-17:00 instead of 15:00-17:30. Day 2 already matches.
//
// A PATCH ON A TIMESLOT MERGES — measured 2026-08-11 (see brella-push.mjs): sending one scalar
// changed that scalar and nothing else, relationships included. Two scalars is the same case.
const PARENT_FIX = { id: PARENT_DAY1, start_time: at(DAY1, "14:00"), duration: 180 };

// ── what is already there, so a second run cannot duplicate ──────────────────────────────────
const existing = async () => {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${EV}/timeslots?page[size]=200&page[number]=${page}`, { headers: R });
    if (!res.ok) { console.error("read failed", res.status); process.exit(1); }
    const j = await res.json();
    out.push(...(j.data || []));
    if ((j.data || []).length < 200) break;
  }
  return out;
};

const all = await existing();
// Matched on title AND start time: "Break & networking" appears on both days, and there are two
// "Pitching" blocks, so a title-only check would skip the second one as a duplicate.
const already = (s) =>
  all.find((t) => t.attributes.title === s.title && t.attributes["start-time"] === at(s.day, s.from));

console.log(`Brella has ${all.length} timeslots. Track ${TRACK_ID} (Event Room 5), location ${LOCATION}.`);
console.log(COMMIT ? "COMMIT MODE — this writes to the live attendee app.\n" : "DRY RUN — nothing is written.\n");

if (!PARENT_ONLY) {
  console.log("=== PHASE 1 · the 13 agenda sessions ===");
  let n = 0, created = 0, skipped = 0;
  for (const s of SESSIONS) {
    n++;
    if (ONLY && n !== ONLY) continue;
    const hit = already(s);
    if (hit) { skipped++; console.log(`${String(n).padStart(2)}. exists already (#${hit.id}), skipping: ${s.title}`); continue; }
    // TWO STEPS, AND NOT BY PREFERENCE. A single POST carrying subtitle + content 500s with an
    // empty body (measured 2026-08-12). The minimal shape below is the one brella-push.mjs has
    // actually created rows with, so it goes first and the extras are PATCHed on afterwards — a
    // PATCH merges, which is the other thing already measured. Splitting it also means a rejected
    // description costs a description, not the session.
    const body = {
      timeslot: {
        title: s.title,
        start_time: at(s.day, s.from),
        duration: mins(s.from, s.to),
        location: LOCATION,
        track_id: TRACK_ID,
      },
    };
    console.log(`${String(n).padStart(2)}. CREATE  ${s.day}  ${s.from}-${s.to}  ${String(mins(s.from, s.to)).padStart(3)}min  ${s.title}`);
    console.log(`    ${s.desc.slice(0, 100)}${s.desc.length > 100 ? "…" : ""}`);
    if (!COMMIT) continue;
    const res = await fetch(`${EV}/timeslots`, { method: "POST", headers: W, body: JSON.stringify(body) });
    const txt = await res.text();
    if (!res.ok) { console.log(`    -> ${res.status} ${txt.slice(0, 300)}`); continue; }
    created++;
    const id = JSON.parse(txt).data?.id;
    // Logged so a rollback is a list of ids rather than a hunt through the dashboard.
    console.log(`    -> ${res.status} created id ${id}`);

    // Step 2: the subtitle and the description, one PATCH each so a failure names its own field
    // instead of leaving both unexplained.
    for (const [field, value] of [["subtitle", SUBTITLE], ["content", content(s.desc)]]) {
      const r2 = await fetch(`${EV}/timeslots/${id}`, {
        method: "PATCH", headers: W, body: JSON.stringify({ timeslot: { [field]: value } }),
      });
      const t2 = await r2.text();
      console.log(`       ${field.padEnd(8)} -> ${r2.status}${r2.ok ? "" : " " + t2.slice(0, 200)}`);
    }
  }
  console.log(`\n${created} created, ${skipped} already there.`);
}

if (PARENT_ONLY || !ONLY) {
  console.log("\n=== PHASE 2 · the Day 1 parent block ===");
  const p = all.find((t) => t.id === String(PARENT_DAY1));
  console.log(`   now:    ${p?.attributes["start-time"]}  ${p?.attributes.duration}min  (${p?.attributes.title})`);
  console.log(`   should: ${PARENT_FIX.start_time}  ${PARENT_FIX.duration}min`);
  if (COMMIT && PARENT_ONLY) {
    const res = await fetch(`${EV}/timeslots/${PARENT_DAY1}`, {
      method: "PATCH", headers: W,
      body: JSON.stringify({ timeslot: { start_time: PARENT_FIX.start_time, duration: PARENT_FIX.duration } }),
    });
    console.log(`   -> ${res.status} ${res.ok ? "patched" : (await res.text()).slice(0, 300)}`);
  } else if (COMMIT) {
    console.log("   NOT PATCHED. This edits an existing live row, so it needs its own run: --commit --parent");
  }
}
