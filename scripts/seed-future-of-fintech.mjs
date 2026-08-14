// SEED THE FUTURE OF FINTECH PROGRAMME into the Sessions table (tblSlpTzDi2oVYwqv), so it lives
// beside NASS, NISS, the Policy Stage, the Board Summit and the four Day 0 programmes instead of in
// the old "Future Of Fintech" registration table, which is a speaker form with eight programme rows
// wedged into it (Auri, 2026-08-14: "You can write it in here. Create another event: Future of
// Fintech").
//
// WHAT IS REAL AND WHAT IS NOT. The titles and times are the fintech team's own, copied from the old
// table's programme view. The three named line-ups and the one description come from Brella's own
// rows for Event Room 3 on 27 August. NOBODY IS INVENTED: the four panels get a `Session Type` of
// "Panel" and no people, because no system on earth currently records who is on them (Auri: "I don't
// know who is in panel 1 or 4. It's completely fine").
//
//   node seed-future-of-fintech.mjs --plan    prints what it would write, touches nothing
//   node seed-future-of-fintech.mjs --write   creates the rows
//
// IDEMPOTENT: it reads the table first and refuses to run if rows already carry
// `Name of the Event = "Future of Fintech"`, so a second --write cannot duplicate the programme.
// Run it with `sops exec-env secrets.enc.env "node seed-future-of-fintech.mjs --plan"`.
const T = process.env.AIRTABLE_TOKEN, B = process.env.AIRTABLE_BASE_ID || "appgXNjXJqpk9Ebxd";
const TABLE = "tblSlpTzDi2oVYwqv";
const EVENT = "Future of Fintech";
const ROOM = "Event Room 3"; // Hall C, 27 August, per Brella

const WRITE = process.argv.includes("--write");
if (!T) { console.error("AIRTABLE_TOKEN is not set. Run under sops exec-env."); process.exit(1); }

// EN DASH with spaces in the time slot, which is what 95 of the existing rows use. The connector
// parses either, but a table somebody reads by eye should not mix three dash styles.
const SESSIONS = [
  {
    "Session Name": "Networking Breakfast",
    "Time Slot": "09:30 – 10:00",
    "Session Type": "Networking & Drinks",
  },
  {
    // Brella: "Sander (Flatpay) opens Future of Fintech with a short keynote-style session".
    "Session Name": "Unicorn to Decacorn: Building for the Scale Leap",
    "Time Slot": "10:00 – 10:10",
    "Session Type": "Keynote",
    "Speaker Details": "Sander Janca-Jensen, CEO & Founder at Flatpay",
  },
  {
    // The one session with a real description anywhere: Brella's own copy on the shell row.
    // Sara Sjølin is named as the third person in that same sentence ("Sander joins Ken and Sara for
    // the fireside chat"), and her Airtable row for this event reads Moderator, so she goes in the
    // moderator cell rather than beside the two founders.
    "Session Name": "Founder Perspective: Build, Scale, Step Back and Start Again",
    "Time Slot": "10:15 – 10:35",
    "Session Type": "Fireside Chat",
    "Description":
      "How founders think about exit planning, leadership transition and the difficult question of when to step back from a company that is still doing well.",
    "Speaker Details":
      "Sander Janca-Jensen, CEO & Founder at Flatpay · Ken Villum Klausen, Founder at Lunar",
    "Moderator Details": "Sara Sjølin, Bureau Chief at Bloomberg",
  },
  {
    "Session Name": "Starting Again: Building from Zero After Lunar",
    "Time Slot": "10:40 – 11:00",
    "Session Type": "Keynote",
    "Speaker Details": "Ken Villum Klausen, Founder at Lunar",
  },
  // THE FOUR PANELS. Type only. Eighteen speakers are confirmed for this event in the old table and
  // not one of them is assigned to a panel in Airtable or in Brella, so the line-ups are left empty
  // for the fintech team to fill in. An empty cell says "not decided"; a guess would say something
  // false on techbbq.dk.
  { "Session Name": "Panel 1: Build Fintech", "Time Slot": "11:05 – 11:25", "Session Type": "Panel" },
  { "Session Name": "Panel 2: Scale Fintech", "Time Slot": "11:30 – 12:00", "Session Type": "Panel" },
  { "Session Name": "Panel 3: Capital, Scaling & Exits", "Time Slot": "12:05 – 12:25", "Session Type": "Panel" },
  { "Session Name": "Panel 4: AI Native Fintech", "Time Slot": "12:30 – 12:50", "Session Type": "Panel" },
];

const api = (path, init) =>
  fetch(`https://api.airtable.com/v0/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${T}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

// ── Guard: is the programme already there? ──────────────────────────────────────────────
const check = await api(
  `${B}/${TABLE}?filterByFormula=${encodeURIComponent(`{Name of the Event}="${EVENT}"`)}&pageSize=100`
);
if (!check.ok) {
  console.error("could not read the table:", check.status, (await check.text()).slice(0, 300));
  process.exit(1);
}
const existing = (await check.json()).records;
if (existing.length) {
  console.error(`REFUSING: ${existing.length} rows already carry Name of the Event = "${EVENT}".`);
  for (const r of existing) console.error("  ", r.id, "|", r.fields["Time Slot"], "|", r.fields["Session Name"]);
  console.error("Delete them in Airtable first if you meant to re-seed.");
  process.exit(1);
}

const records = SESSIONS.map((s) => ({
  fields: { "Name of the Event": EVENT, "Event Room": ROOM, ...s },
}));

console.log(`${WRITE ? "WRITING" : "PLAN (nothing written)"} — ${records.length} rows into Sessions, Name of the Event = "${EVENT}"\n`);
for (const r of records) {
  const f = r.fields;
  console.log(`  ${f["Time Slot"]}  ${f["Session Name"]}`);
  console.log(`      type: ${f["Session Type"]}   room: ${f["Event Room"]}`);
  if (f["Speaker Details"]) console.log(`      speakers: ${f["Speaker Details"]}`);
  if (f["Moderator Details"]) console.log(`      moderator: ${f["Moderator Details"]}`);
  if (f["Description"]) console.log(`      description: ${f["Description"]}`);
}

if (!WRITE) {
  console.log("\nRe-run with --write to create these rows.");
  process.exit(0);
}

// ── Write, ten at a time, which is Airtable's cap per create call ────────────────────────
// typecast:true so "Future of Fintech" can be a new value in a select without a schema call. The
// Session Type values are all existing options, checked against the table's schema before writing.
const created = [];
for (let i = 0; i < records.length; i += 10) {
  const batch = records.slice(i, i + 10);
  const res = await api(`${B}/${TABLE}`, {
    method: "POST",
    body: JSON.stringify({ records: batch, typecast: true }),
  });
  if (!res.ok) {
    console.error("\nWRITE FAILED at batch", i / 10 + 1, res.status, (await res.text()).slice(0, 500));
    console.error(`${created.length} rows were created before this failure:`, created.join(", "));
    process.exit(1);
  }
  for (const r of (await res.json()).records) created.push(r.id);
}
console.log(`\nCreated ${created.length} rows:`, created.join(", "));
