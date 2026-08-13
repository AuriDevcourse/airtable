// Push the Nordic Africa Startup Summit (Event Room 2, 27 August) speakers into BRELLA.
//
// Third sibling of brella-push.mjs (grill sessions) and brella-push-niss.mjs (Event Room 2 on the
// 26th). Same event, same write shape, different source.
//
// WHAT THIS DOES: creates a Brella speaker record for every NASS presenter who is not there yet,
// with job title, company and a PERMANENT photo URL.
//
// WHAT THIS DELIBERATELY DOES NOT DO: link speakers to sessions. The integration API exposes no
// speaker-assignment route — see brella-push.mjs for how far that was probed — so the linking is
// done by hand in the Brella UI and `--plan` prints the checklist for it, ordered by start time
// with the Brella timeslot id for each session.
//
// ALL 22 SESSIONS ALREADY EXIST IN BRELLA except one, so there is no timeslot-creation phase: the
// script REPORTS what is missing or mistitled rather than writing it, because a timeslot is the
// public shape of the day and renaming one is Auri's call, not a script's. Checked 2026-08-13:
//   · Brella has 21 rows in Event Room 2 on the 27th, Airtable has 22
//   · the 15:35 Investor Reverse Pitch is missing from Brella entirely
//   · Brella carries the 16:35 reception TWICE
//   · several titles differ from Airtable's ("Africa's Diplomatic Corps & Innovation Diplomacy"
//     against "Diplomacy as a Catalyst for Collaboration in Innovation")
//
// THE SOURCE IS THE CONNECTOR'S OWN FEED, /api/program?event=${EVENT}, not Airtable directly. That
// feed has already done the hard parts: split each "Name, Title, Company" cell into people, paired
// them with a permanent photo URL, and joined the two face rosters by name. Reading Airtable again
// here would mean reimplementing all of it and drifting from what the board shows.
//
// Photos are the connector's proxy, never a raw Airtable URL: those are signed and die after ~2
// hours, so a raw one would be dead before Brella fetched it. Brella downloads and re-hosts.
//
//   node brella-push-nass.mjs             dry run, shows every create
//   node brella-push-nass.mjs --plan      just the manual-linking checklist
//   node brella-push-nass.mjs --commit    actually writes
//   node brella-push-nass.mjs --commit --limit=1
//
// FEED_BASE_URL overrides where the programme is read from (default: the deployed connector).

const BRELLA = process.env.BRELLA_API_KEY || process.env.BRELLA;
const EV = "https://api.brella.io/api/integration/organizations/109/events/10356";
const FEED = process.env.FEED_BASE_URL || "https://airtable-woad.vercel.app";
/**
 * WHERE THE PHOTO URLS POINT, which is NOT necessarily where the programme is read from.
 *
 * BRELLA FETCHES THE PHOTO ITSELF, from its own servers. Point it at localhost and it resolves to
 * Brella's own machine, finds nothing, and creates the speaker with photo-url: null — silently, with
 * a 201. That is exactly what happened to the first record of this run (#423709, Charles Kinga)
 * while FEED_BASE_URL was set to localhost for a dry run (2026-08-13).
 *
 * So the data can come from a local dev server while the images always come from the deployed
 * connector, whose /api/photo path is identical and publicly reachable.
 */
const PHOTO_BASE = process.env.PHOTO_BASE_URL || "https://airtable-woad.vercel.app";
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i;
const R = { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" };
// Brella READS JSON:API but WRITES Rails: a `{speaker: {...}}` wrapper with snake_case keys and a
// plain application/json content type. See brella-push.mjs for how this was established.
const W = { ...R, "Content-Type": "application/json" };

const COMMIT = process.argv.includes("--commit");
const PLAN_ONLY = process.argv.includes("--plan");
const LIMIT = Number((process.argv.find(a => a.startsWith("--limit=")) || "--limit=0").slice(8)) || Infinity;

// The room and day this summit occupies. Event Room 2 runs Nordic INDIA on the 26th, so the date is
// half of the identity here, not decoration.
const ROOM = "Event Room 2";
// WHICH SUMMIT. Both take Event Room 2, on different days, and both now read their programme from
// the connector's own feed — so one script covers them and cannot drift into two.
const EVENT = (process.argv.find((a) => a.startsWith("--event=")) || "--event=nass").slice(8);
const DATE = EVENT === "niss" ? "26 Aug" : "27 Aug";

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Rows that would publish something plainly wrong to attendees. Printed and skipped rather than
 * silently corrected: a guess about somebody else's data can be wrong, and everything created here
 * is public in the app. Fix the Airtable cell, then re-run — this script is idempotent.
 *
 * These two are not people and never will be, so they are permanent entries rather than a to-do:
 * an organisation and a DJ slot, both typed into a Speaker Details cell.
 */
const HOLD = {
  // A PLACEHOLDER, not a person: the 10:45 cell reads "Impact Fund Denmark, Danish Company
  // Representative" — a seat reserved for a representative nobody has named yet. It cannot become a
  // Brella speaker record until it has a human's name. The session's moderator, Charlotte Holst
  // Frahm, is from the same organisation, so this is a second seat rather than a duplicate of her.
  "Impact Fund Denmark": "a TBA placeholder — nobody has been named yet; give it a person's name",
  // A QUESTION MARK IS SOMEBODY'S NOTE TO THEMSELVES, not part of a name. Brella stores the whole
  // name in first_name, so this would publish to attendees as the literal "Kurt Gammelgaard
  // Nielsen?". The mark most likely means "is he confirmed?", which is exactly the state in which
  // nothing should be published. Cell: recj5DlhzmN1gPQu0, the 16:05 university-spinouts panel.
  // Delete the "?" in Airtable and re-run; this script will pick him up.
  "Kurt Gammelgaard Nielsen?": 'the name ends in "?" — confirm him, drop the mark in Airtable, re-run',
};

// Airtable spelling -> the spelling Brella holds. Only for genuine typos, where word matching
// cannot bridge the gap and the script would otherwise create a second record for someone who is
// already in the live app.
const ALIAS = {};

/** Every person on the NASS agenda, from the connector's own feed. */
async function nassPeople() {
  const res = await fetch(`${FEED}/api/program?event=${EVENT}`);
  if (!res.ok) throw new Error(`feed ${res.status} from ${FEED}/api/program?event=${EVENT}`);
  const { sessions = [] } = await res.json();
  const seen = new Map();
  for (const s of sessions) {
    const st = s.onStage;
    if (!st) continue;
    for (const [role, list] of [["Moderator", st.moderators || []], ["Speaker", st.speakers || []]]) {
      for (const p of list) {
        const name = (p.name || "").replace(/\s+/g, " ").trim();
        if (!name) continue;
        // `meta` is "Title, Company" — the same first-comma split the board's PersonRow does.
        const comma = (p.meta || "").indexOf(",");
        const title = (comma === -1 ? p.meta || "" : p.meta.slice(0, comma)).trim();
        const company = comma === -1 ? "" : p.meta.slice(comma + 1).trim();
        // Absolute already on the deployed feed, relative on localhost — and a loopback origin is
        // rewritten to PHOTO_BASE, because Brella is the one that fetches it. See PHOTO_BASE.
        const photo = p.photo
          ? (p.photo.startsWith("http") ? p.photo : PHOTO_BASE + p.photo).replace(
              LOOPBACK,
              PHOTO_BASE
            )
          : null;
        const prev = seen.get(norm(name));
        // ONE RECORD PER HUMAN, however many sessions they are on. Moderator wins the label when
        // somebody both chairs and speaks — it is the more specific of the two.
        if (prev) {
          if (role === "Moderator") prev.role = "Moderator";
          prev.sessions.push(s.name);
          if (!prev.photo && photo) prev.photo = photo;
          continue;
        }
        seen.set(norm(name), { name, title, company, role, photo, sessions: [s.name] });
      }
    }
  }
  return [...seen.values()];
}

const wordsOf = s => new Set(norm(s).split(" ").filter(w => w && !/^(dr|prof|mr|ms|mrs|phd|retd|amb|hon)$/.test(w)));
// A record counts as the same human when every word of the feed's name appears in the Brella one.
// Brella holds "Jussi Petteri Pyysalo" for Airtable's "Jussi Pyysalo"; an exact compare would miss
// that and create a duplicate person in the live app.
const sameHuman = (a1, b1) => {
  const a = wordsOf(ALIAS[a1] || a1), b = wordsOf(b1);
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

const local = iso => new Date(iso).toLocaleString("en-GB", {
  timeZone: "Europe/Copenhagen", weekday: "short", day: "numeric", month: "short",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
const hhmm = iso => new Date(iso).toLocaleString("en-GB", {
  timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit", hour12: false,
});

/** The Brella timeslots for this room on this date. */
async function roomSlots() {
  const j = await (await fetch(`${EV}/timeslots?page[size]=500`, { headers: R })).json();
  return (j.data || [])
    .filter(x => {
      const a = x.attributes || {};
      return norm(a.location) === norm(ROOM) && local(a["start-time"]).includes(DATE);
    })
    .sort((a, b) => String(a.attributes["start-time"]).localeCompare(String(b.attributes["start-time"])));
}

// Things that would be published to attendees exactly as they arrive.
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

const people = await nassPeople();
if (!people.length) throw new Error("no NASS people came back from the feed — check FEED_BASE_URL");

// ── the linking checklist ─────────────────────────────────────────────────────────────────────
if (PLAN_ONLY) {
  const slots = await roomSlots();
  const feed = await (await fetch(`${FEED}/api/program?event=${EVENT}`)).json();
  const sessions = (feed.sessions || []).filter(s => s.onStage);

  // MATCHED ON START TIME, not on title. The two systems disagree about several titles, and a
  // title match would silently drop those sessions from the checklist; the clock is the one thing
  // both sides agree on. Brella's own title is printed so a mismatch is visible rather than hidden.
  const startOf = slot => (slot.match(/(\d{1,2}[:.]\d{2})/) || [])[1]?.replace(".", ":") || "";
  const pad = t => (t.length === 4 ? "0" + t : t);

  console.log(`MANUAL LINKING CHECKLIST · Nordic Africa Startup Summit · ${ROOM}, ${DATE}`);
  console.log("In Brella, open each session and add these people. Ordered by start time.\n");

  let n = 0, links = 0, unmatched = 0;
  for (const s of sessions) {
    const want = pad(startOf(s.timeSlot || ""));
    const slot = slots.find(x => hhmm(x.attributes["start-time"]) === want);
    const st = s.onStage;
    const list = [
      ...(st.moderators || []).map(p => ({ ...p, role: "Moderator" })),
      ...(st.speakers || []).map(p => ({ ...p, role: "Speaker" })),
    ].filter(p => !HOLD[p.name]);
    if (!list.length) continue;
    n++; links += list.length;
    console.log(`\n${String(n).padStart(2)}. NASS · ${s.name}`);
    if (slot) {
      console.log(`    ${local(slot.attributes["start-time"])}  ·  timeslot #${slot.id}`);
      if (norm(slot.attributes.title) !== norm(s.name)) {
        console.log(`    !! Brella calls it: "${slot.attributes.title}"`);
      }
    } else {
      unmatched++;
      console.log(`    *** NO BRELLA TIMESLOT AT ${want} — create it first (Airtable says ${s.timeSlot}) ***`);
    }
    for (const p of list) {
      const meta = (p.meta || "").slice(0, 40);
      console.log(`    [ ] ${p.role.padEnd(9)} ${p.name.padEnd(26)} ${meta}`);
    }
  }
  console.log(`\n${n} sessions, ${people.length} people, ${links} links to make.`);
  if (unmatched) console.log(`${unmatched} session(s) have no Brella timeslot at that time — see above.`);
  const held = people.filter(p => HOLD[p.name]);
  if (held.length) console.log(`${held.length} entry/entries held back and NOT listed: ${held.map(p => p.name).join(", ")}`);
  process.exit(0);
}

// ── the speaker records ───────────────────────────────────────────────────────────────────────
console.log(`=== NASS speakers · ${people.length} people on the agenda ===`);
console.log(COMMIT ? "MODE: COMMIT — this writes to the live attendee app\n" : "MODE: dry run — nothing is written. Add --commit to write.\n");

const warnings = dataWarnings(people.filter(p => !HOLD[p.name]));
if (warnings.length) {
  console.log(`   !! ${warnings.length} data issues that would go live as-is:`);
  for (const w of warnings) console.log(`      - ${w}`);
  console.log("");
}

const have = await existingSpeakers();
let toCreate = 0, skipped = 0, held = 0, failed = 0;
for (const p of people) {
  if (HOLD[p.name]) { held++; console.log(`   HELD BACK  ${p.name} — ${HOLD[p.name]}`); continue; }
  const hit = have.find(s => sameHuman(p.name, s.full));
  if (hit) { skipped++; console.log(`   in brella already (#${hit.id} "${hit.full}"), skipping: ${p.name}`); continue; }
  if (toCreate >= LIMIT) { console.log(`   (--limit=${LIMIT} reached, stopping)`); break; }
  toCreate++;
  // Brella stores the whole name in first-name on almost every existing record, so match that
  // rather than guessing where a two-word surname splits. `photo` takes a URL and Brella downloads
  // and re-hosts it, so the image survives independently of our proxy. `photo_url` and
  // `remote_photo_url` are both rejected 400 — only `photo` works.
  const body = {
    speaker: {
      first_name: p.name, job_title: p.title, company_name: p.company,
      ...(p.photo ? { photo: p.photo } : {}),
    },
  };
  if (!COMMIT) {
    console.log(`   would create  ${p.name.padEnd(26)} ${p.title.slice(0, 30).padEnd(31)} ${p.company.slice(0, 26)}${p.photo ? "" : "   (no photo)"}`);
    continue;
  }
  const res = await fetch(`${EV}/speakers`, { method: "POST", headers: W, body: JSON.stringify(body) });
  if (res.ok) {
    const j = await res.json();
    console.log(`   created #${j.data?.id ?? "?"}  ${p.name}`);
  } else {
    failed++;
    console.log(`   FAILED ${res.status}  ${p.name}  ${(await res.text()).slice(0, 200)}`);
  }
}

console.log(
  `\n${COMMIT ? "created" : "would create"} ${toCreate} · already in brella ${skipped} · held back ${held}` +
    (failed ? ` · FAILED ${failed}` : "")
);
console.log("Then run --plan and link them to their sessions in the Brella UI.");
