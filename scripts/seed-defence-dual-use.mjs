// Fills in the DEFENCE & DUAL USE programme in the Sessions table, Event Room 4, both days.
//
// ─── WHY THIS SCRIPT EXISTS ─────────────────────────────────────────────────────────────
// The seven rows under `Name of the Event = "Defence & Dual Use"` were a SKELETON: "Summit
// Sessions (TBA)" standing in for the whole of Day 1, and four generic slots on Day 2 ("Expert
// Panel", described as "3-4 industry leaders tackling the sector's most central themes").
// Meanwhile the finished programme had been sitting in Brella all along: six numbered Future of
// Defence sessions in Event Room 4 on the 26th with 21 named people, and a Defence Tech & Cyber
// Arena on the 27th whose description carries its own run of show. So nothing here is invented.
// It is Brella's programme, written into the table the website reads.
//
// SOURCE, per row: /api/program?event=brella&section=all, group `rooms`, room "Event Room 4".
// Titles, times, moderators and speakers are Brella's. DESCRIPTIONS ARE WRITTEN HERE (Auri,
// 2026-08-25), because Brella's are run-of-show dumps that repeat every name the speaker fields
// already carry, placeholders included ("TBC - Hammerglass"). One or two sentences on what the
// session is about, plus the timings inside it, which is the one fact the dump has that the
// structured fields do not.
//
// Dry run by default. Prints every write and touches nothing.
//   sops exec-env secrets.enc.env "node scripts/seed-defence-dual-use.mjs"
//   sops exec-env secrets.enc.env "node scripts/seed-defence-dual-use.mjs --apply"
//
// ─── IT IS AN UPDATE, NOT A SEED, AND THAT IS THE WHOLE DESIGN ──────────────────────────
// seed-denmark-sweden-summit.mjs refuses to run twice because it only ever creates. This one
// matches on `Session Name` and PATCHes, so re-running is safe and converges: each row is keyed
// either by its own title or by the skeleton title it replaces. A row that is already correct is
// reported as unchanged rather than rewritten.
//
// THREE DECISIONS AURI MADE (2026-08-25), all load-bearing:
//   1. Descriptions are written, not copied. See above.
//   2. The "Fireside Interview" row is DELETED. Brella's Day 2 run of show has no fireside, and
//      every other Day 2 time shifted to match it, so the row would sit at 10:00-10:15 between two
//      retimed sessions and read as a session nobody is running.
//   3. The ROYAL RECEPTION STAYS OFF THE WEBSITE. Its row is left exactly as it is (this script
//      never touches it) and lib/program.ts excludes it from the `defence` programme by name. It is
//      registration-only with a royal guest, so it stays an internal row.
//
// ─── HOW `Speaker Details` HAS TO BE WRITTEN ────────────────────────────────────────────
// One line, people joined with " · ". The FIRST comma in an entry splits the name from the job
// title; later commas ride along inside the title, which is why Samant Khajuria's four-part title
// is cut to two. NO SEMICOLONS: some programmes split people on ";" (parsePeople in
// lib/program.ts) and one inside a job title invents a nameless person there.
//
// A PERSON WITH NO TITLE IS WRITTEN AS A BARE NAME. Tobias Billström and Blythe Crawford have no
// title in Brella and none is invented here; Brella's own records are the place to fix that.
//
// TWO CORRECTIONS TO BRELLA'S DATA, both taken from Brella's own session description, which
// spells them right where the speaker record does not:
//   "Rheinnmetal"             -> "Rheinmetall"
//   "Project A Ventures (VC)" -> "Project A Ventures"   (the "(VC)" is a note, not the company)

const TOKEN = process.env.AIRTABLE_TOKEN;

const BASE = "appgXNjXJqpk9Ebxd";
const SESSIONS = "tblSlpTzDi2oVYwqv";
const EVENT = "Defence & Dual Use";
const ROOM = "Event Room 4";

const APPLY = process.argv.includes("--apply");

// `match` is the EXISTING `Session Name` a row updates, when it is not the new title itself.
// `del` marks a row to remove. Everything else is written as given.
const ROWS = [
  // ─── DAY 1 · 26 AUGUST · the six numbered sessions ───────────────────────────────────
  {
    match: "Summit Sessions (TBA)", // the whole-day placeholder becomes session #1
    day: "Day 1",
    time: "09:30 – 10:45",
    name: "Future of Defence #1: B2B – From Single to Dual Use",
    type: "Panel",
    description:
      "How a single-use product becomes a dual-use business, and what changes in the sale. Panel at 09:45, cases at 10:15. Curated in collaboration with ODIN and TYR.vc.",
    moderators: "Nicholas Hawtin, Founder, ODIN",
    speakers:
      "Kenneth Richard Geisel, CCO/Co-founder, Robotto · Nicholas MacGowan von Holstein, Managing Director, BiFrost Defence · Frederik Søndergaard, Founder/CEO, STORMBORN · Viktoria Yaremchuk, Co-Founder/CEO, Farsight Vision",
  },
  {
    day: "Day 1",
    time: "10:45 – 11:30",
    name: "Future of Defence #2: Investment – Who Invests in Defence?",
    type: "Panel",
    // Brella names the moderator as "CIO - EIFO" and no person, so no moderator is published.
    description:
      "Who actually writes cheques into defence, and what they want to see before they do. Panel at 10:45, case at 11:15.",
    speakers:
      "Jack Wang, Managing Director, Project A Ventures · Frederik Oliver Busch, Co-founder Partner, ETNA",
  },
  {
    day: "Day 1",
    time: "11:45 – 12:25",
    name: "Future of Defence #3: B2B – Can We Trust Our Defence Supply Chain?",
    type: "Panel",
    description:
      "Whether a European defence supply chain can be trusted end to end, and where the weak links actually are.",
    moderators: "Nicholas Hawtin, Founder, ODIN",
    speakers:
      "Charlotte Wetche, Direktør, VERÁ/Netcompany · Søren Elmer Kristensen, CEO, Odense Robotics · Morten Hald, COO, Okapi",
  },
  {
    day: "Day 1",
    time: "13:15 – 14:15",
    name: "Future of Defence #4: Investment – Valuation of Rapidly Iterating Products",
    type: "Panel",
    description:
      "How an investor values a product that changes every few weeks, and what that does to diligence.",
    moderators: "Johan Bitsch Nielsen, Investment Manager, EIFO",
    speakers: "Elya Chiechienieva, Partner, D3 · Claudius Laskawy, Investor, DTCP",
  },
  {
    day: "Day 1",
    time: "14:15 – 15:15",
    name: "Future of Defence #5: B2B – Working with Corporates in Defence",
    type: "Panel",
    description:
      "What a startup has to get right to sell into a defence prime, told by the primes. Ends with a case conversation.",
    moderators: "Linda Krondahl, CEO and Co-founder, THINGS",
    speakers:
      "Samant Khajuria, Vice President, Cyber and Quantum Technology, Terma · Jens Holzapfel, Business Development, Nordic Air Defence · Manuel Kliese, Vice President, Business Development, Rheinmetall",
  },
  {
    day: "Day 1",
    time: "15:15 – 17:00",
    name: "Future of Defence #6: Investment – Can the Nordics Build the Defence We Need?",
    type: "Panel",
    description:
      "Whether Nordic capital and industry can build the defence capability the region needs. Drinks and networking from 16:00.",
    moderators: "Esben Gadsbøll, Chairman, Danish Tech Startups",
    speakers: "Tobias Billström, Nordic Air Defence · Blythe Crawford",
  },

  // ─── DAY 2 · 27 AUGUST · the Defence Tech & Cyber Arena, slot by slot ────────────────
  // Times come from the run of show INSIDE Brella's Arena description, which is finer-grained
  // than the single 09:30-11:30 row Brella publishes, and finer than the skeleton it replaces.
  {
    match: "Opening Keynote: Setting the Scene for Rapid Defence Innovation",
    day: "Day 2",
    time: "09:30 – 10:00",
    name: "Opening Keynote: Setting the Scene for Rapid Defence Innovation",
    type: "Keynote",
    description:
      "The Danish Industry Foundation opens the Defence Tech & Cyber Arena to founders, investors, researchers and procurement.",
    speakers: "Lindsay Heil, Director, International Cooperation, DARPA",
  },
  {
    match: "Expert Panel",
    day: "Day 2",
    time: "10:00 – 10:25",
    name: "Panel Discussion",
    type: "Panel",
    description:
      "Where defence and cyber innovation is happening right now, and what still stands between a lab and a deployment.",
    // Brella's structured record has Esben as Moderator; its description also lists him among the
    // panelists. The structured role wins, because that is the one that renders a moderator line.
    moderators: "Esben Gadsbøll, Chairman, Danish Tech Startups",
    speakers: "Mykyta Rozhkov · Erlend Prestgard, Investor",
  },
  {
    match: "Fireside Interview",
    del: true,
  },
  {
    match: "Closing Keynote",
    day: "Day 2",
    time: "10:25 – 10:55",
    name: "Closing Keynote Conversation",
    type: "Keynote",
    description:
      "A closing conversation tying the strategic threads together. Line-up to be announced.",
  },
  {
    match: "Roundtables & Networking",
    day: "Day 2",
    time: "10:55 – 11:30",
    name: "Roundtable Discussions",
    type: "Round Table",
    description: "Facilitated, action-oriented conversations in small groups.",
    speakers:
      "Jesper Møller Johansen, Director, Transformative Investments & Platform, EIFO · Oisin Zimmermann, Managing Director, Di5 · Lindsay Heil, Director, International Cooperation, DARPA · Jens Holzapfel, Business Development, Nordic Air Defence · Mykyta Rozhkov · Samant Khajuria, Vice President, Cyber and Quantum Technology, Terma",
  },
];

// The row this script must never touch, named here so a later reader does not "tidy" it in.
const LEAVE_ALONE = "Royal Reception (By Registration Only)";

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function air(path, init) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, { ...init, headers: H });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body.error ?? body)}`);
  return body;
}

function fieldsFor(row) {
  const f = {
    "Name of the Event": EVENT,
    "Session Name": row.name,
    "Time Slot": row.time,
    "When Is it": row.day,
    "Event Room": ROOM,
  };
  if (row.type) f["Session Type"] = row.type;
  if (row.description) f["Description"] = row.description;
  if (row.speakers) f["Speaker Details"] = row.speakers;
  if (row.moderators) f["Moderator Details"] = row.moderators;
  return f;
}

// Only the values this script sets are compared. A cell it never writes cannot count as drift.
function same(existing, wanted) {
  return Object.entries(wanted).every(([k, v]) => (existing[k] ?? "") === v);
}

async function main() {
  if (!TOKEN) throw new Error("AIRTABLE_TOKEN is not set.");

  const p = new URLSearchParams({
    pageSize: "100",
    filterByFormula: `{Name of the Event}="${EVENT}"`,
  });
  for (const f of [
    // EVERY field fieldsFor() writes has to be requested here, or same() compares a value it was
    // never given and reports drift on a row that is already correct. "Name of the Event" was the
    // one missing, which made the second dry run want to rewrite all eleven rows.
    "Name of the Event",
    "Session Name",
    "Time Slot",
    "Session Type",
    "Description",
    "Speaker Details",
    "Moderator Details",
    "When Is it",
    "Event Room",
  ])
    p.append("fields[]", f);

  const current = (await air(`${SESSIONS}?${p}`)).records;
  console.log(`${current.length} existing "${EVENT}" rows\n`);

  const byName = new Map(current.map((r) => [r.fields["Session Name"], r]));
  const plan = { patch: [], create: [], del: [], skip: [] };

  for (const row of ROWS) {
    // THE NEW TITLE IS TRIED FIRST, and that is what makes a second run safe. `match` names the
    // skeleton row this replaces, and once it has been renamed that name is gone from the table —
    // so looking it up first found nothing and the row was created a second time. Caught by
    // re-running the dry run straight after --apply, which is worth doing to any script like this.
    const hit = (row.name && byName.get(row.name)) || (row.match && byName.get(row.match)) || null;
    if (row.del) {
      if (hit) plan.del.push({ id: hit.id, name: row.match });
      else plan.skip.push({ why: `${row.match} — already gone` });
      continue;
    }
    const fields = fieldsFor(row);
    if (!hit) plan.create.push({ fields, label: row.name });
    else if (same(hit.fields, fields)) plan.skip.push({ id: hit.id, why: `${row.name} — unchanged` });
    else plan.patch.push({ id: hit.id, fields, label: row.name, was: hit.fields["Session Name"] });
  }

  // "LEFT" must mean a row this script does not manage. A row it checked and found correct is
  // managed, so it counts as touched here even though nothing was written to it.
  const touched = new Set([...plan.patch, ...plan.del, ...plan.skip].map((x) => x.id).filter(Boolean));
  const untouched = current.filter((r) => !touched.has(r.id));

  for (const x of plan.patch)
    console.log(
      `UPDATE  ${x.was}\n     -> ${x.label}\n        ${x.fields["When Is it"]} · ${x.fields["Time Slot"]}`
    );
  for (const x of plan.create)
    console.log(`CREATE  ${x.label}\n        ${x.fields["When Is it"]} · ${x.fields["Time Slot"]}`);
  for (const x of plan.del) console.log(`DELETE  ${x.name}`);
  for (const s of plan.skip) console.log(`SKIP    ${s.why}`);
  for (const r of untouched)
    console.log(
      `LEFT    ${r.fields["Session Name"]}${
        r.fields["Session Name"] === LEAVE_ALONE ? "  (deliberately: off the website)" : ""
      }`
    );

  if (!APPLY) {
    console.log("\nDry run. Nothing written. Re-run with --apply.");
    return;
  }

  // Airtable caps a batch at 10 records, and both batches here are inside it.
  if (plan.patch.length)
    await air(SESSIONS, {
      method: "PATCH",
      body: JSON.stringify({ records: plan.patch.map(({ id, fields }) => ({ id, fields })) }),
    });
  if (plan.create.length)
    await air(SESSIONS, {
      method: "POST",
      body: JSON.stringify({ records: plan.create.map(({ fields }) => ({ fields })) }),
    });
  for (const x of plan.del) await air(`${SESSIONS}/${x.id}`, { method: "DELETE" });

  console.log(
    `\nApplied: ${plan.patch.length} updated, ${plan.create.length} created, ${plan.del.length} deleted.`
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
