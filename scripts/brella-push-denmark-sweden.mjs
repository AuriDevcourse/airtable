// Creates the Denmark-Sweden Summit timeslots in BRELLA — Event Room 6, 27 August 2026.
//
// WHY (2026-08-18). Brella's Event Room 6 track holds thirteen timeslots and every one is on the
// 26th (Deep Tech Event Day). The 27th is empty, so the room shows no second day anywhere Brella
// feeds: not the app, and not /brella-program in this connector. This writes the eight sessions.
//
// SOURCE OF TRUTH is the connector's own feed, /api/program?event=denmark-sweden, which reads the
// Sessions table rows created by scripts/seed-denmark-sweden-summit.mjs. Titles and times are taken
// from there rather than retyped, so Brella and techbbq.dk cannot drift apart.
//
// TIMES ARE UTC IN BRELLA. Copenhagen is UTC+2 in August (CEST), and the existing Event Room 6 rows
// prove the convention: Deep Tech Event Day opens at 10:00 local and is stored as 08:00Z. So the
// 12:00 local welcome is 10:00Z. Getting this wrong shifts a public schedule by two hours.
//
// WHAT THIS DOES NOT DO: attach speakers. The integration API exposes no speaker-assignment route —
// probed at length in brella-push.mjs — so the twelve people have to be linked by hand in the Brella
// UI. `--plan` prints that checklist with each new timeslot id once they exist.
//
//   sops exec-env secrets.enc.env "node scripts/brella-push-denmark-sweden.mjs"          dry run
//   sops exec-env secrets.enc.env "node scripts/brella-push-denmark-sweden.mjs --commit" writes
//   sops exec-env secrets.enc.env "node scripts/brella-push-denmark-sweden.mjs --plan"   linking list
//
// IDEMPOTENT BY TITLE+DAY. A session already on the track that day is skipped, so a re-run after a
// partial failure finishes the job instead of doubling it.

const BRELLA = process.env.BRELLA_API_KEY;
const EV = "https://api.brella.io/api/integration/organizations/109/events/10356";
const FEED = process.env.FEED_BASE_URL || "http://localhost:3000";

const TRACK_ID = 43423;          // "🔹 Event Room 6"
const LOCATION = "Event Room 6"; // matches the 26 August rows on this track exactly
const DATE = "2026-08-27";
const UTC_OFFSET = 2;            // CEST

const R = { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" };
// Brella READS JSON:API but WRITES Rails: a `{timeslot: {...}}` wrapper, snake_case, and `track_id`
// as a plain number rather than a JSON:API relationship. A JSON:API body 500s. See brella-push.mjs.
const W = { ...R, "Content-Type": "application/json" };

const COMMIT = process.argv.includes("--commit");
const PLAN_ONLY = process.argv.includes("--plan");

if (!BRELLA) {
  console.error("BRELLA_API_KEY is not set. Run via `sops exec-env secrets.enc.env \"node scripts/brella-push-denmark-sweden.mjs\"`.");
  process.exit(2);
}

// "12:00 – 12:05" -> { start: "2026-08-27T10:00:00.000Z", duration: 5 }
// A row with a single time ("14:30") gets CLOSING_MIN, because Brella has no zero-length session and
// the Deep Tech day's own closing is a 3-minute slot.
const CLOSING_MIN = 5;
function slotTimes(timeSlot) {
  const times = String(timeSlot).match(/\d{1,2}[:.]\d{2}/g) || [];
  if (!times.length) return null;
  const mins = times.map((t) => {
    const [h, m] = t.replace(".", ":").split(":").map(Number);
    return h * 60 + m;
  });
  const startLocal = mins[0];
  const duration = mins.length > 1 ? mins[1] - startLocal : CLOSING_MIN;
  const utc = startLocal - UTC_OFFSET * 60;
  const hh = String(Math.floor(utc / 60)).padStart(2, "0");
  const mm = String(utc % 60).padStart(2, "0");
  return { start: `${DATE}T${hh}:${mm}:00.000Z`, duration };
}

const local = (iso) => {
  const d = new Date(iso);
  const h = String((d.getUTCHours() + UTC_OFFSET) % 24).padStart(2, "0");
  return `${h}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

(async () => {
  const feed = await (await fetch(`${FEED}/api/program?event=denmark-sweden`)).json();
  const sessions = feed.sessions || [];
  if (!sessions.length) {
    console.error(`No sessions at ${FEED}/api/program?event=denmark-sweden — is the dev server up?`);
    process.exit(1);
  }

  const snap = await (await fetch(`${EV}/timeslots?page[size]=500`, { headers: R })).json();
  const onTrackThatDay = (snap.data || []).filter(
    (d) =>
      String(d.relationships?.track?.data?.id) === String(TRACK_ID) &&
      String(d.attributes["start-time"]).startsWith(DATE)
  );
  const existing = new Map(onTrackThatDay.map((d) => [norm(d.attributes.title), d]));

  console.log(`${COMMIT ? "COMMIT" : "DRY RUN"} — Denmark-Sweden Summit -> Brella`);
  console.log(`  track ${TRACK_ID} · ${LOCATION} · ${DATE} (times shown local, stored UTC+0)`);
  console.log(`  already on this track that day: ${onTrackThatDay.length}\n`);

  const planned = [];
  for (const s of sessions) {
    const t = slotTimes(s.timeSlot);
    if (!t) {
      console.log(`  SKIP (no parsable time) ${s.timeSlot} ${s.name}`);
      continue;
    }
    const hit = existing.get(norm(s.name));
    planned.push({ s, t, hit });
    const people = [...(s.onStage?.moderators || []), ...(s.onStage?.speakers || [])];
    console.log(
      `  ${hit ? "EXISTS #" + hit.id : "CREATE  "}  ${s.timeSlot.padEnd(15)} ${String(t.duration).padStart(3)}min  ${t.start}  ${String(s.name).slice(0, 52)}`
    );
    if (people.length) console.log(`             people to link by hand: ${people.map((p) => p.name).join(", ")}`);
  }

  const toCreate = planned.filter((p) => !p.hit);
  console.log(`\n${planned.length} sessions · ${toCreate.length} to create · ${planned.length - toCreate.length} already there`);

  if (PLAN_ONLY) return;
  if (!COMMIT) {
    console.log("\nNothing written. Re-run with --commit.");
    return;
  }

  for (const p of toCreate) {
    const body = {
      timeslot: {
        title: p.s.name,
        start_time: p.t.start,
        duration: p.t.duration,
        location: LOCATION,
        track_id: TRACK_ID,
      },
    };
    const res = await fetch(`${EV}/timeslots`, { method: "POST", headers: W, body: JSON.stringify(body) });
    const txt = await res.text();
    let id = null;
    try { id = JSON.parse(txt).data?.id; } catch {}
    console.log(`  ${res.status} ${res.ok ? "created #" + id : txt.slice(0, 200)}  ${p.s.timeSlot}  ${String(p.s.name).slice(0, 48)}`);
    if (!res.ok) {
      console.error("Stopping: a failed create means the rest would land in an unknown state.");
      process.exit(1);
    }
  }

  // Read back rather than trusting the POST responses.
  const after = await (await fetch(`${EV}/timeslots?page[size]=500`, { headers: R })).json();
  const now = (after.data || [])
    .filter(
      (d) =>
        String(d.relationships?.track?.data?.id) === String(TRACK_ID) &&
        String(d.attributes["start-time"]).startsWith(DATE)
    )
    .sort((a, b) => a.attributes["start-time"].localeCompare(b.attributes["start-time"]));
  console.log(`\nEvent Room 6 on ${DATE} now has ${now.length} sessions:`);
  for (const d of now) {
    console.log(`  #${d.id}  ${local(d.attributes["start-time"])}  ${String(d.attributes.duration).padStart(3)}min  ${d.attributes.title}`);
  }
  console.log("\nSpeakers still need linking by hand in the Brella UI — no API route exists for it.");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
