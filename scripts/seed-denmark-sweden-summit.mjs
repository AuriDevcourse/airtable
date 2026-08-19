// Creates the Denmark-Sweden Summit programme in the Sessions table, Event Room 6, Day 2 (27 August),
// and uploads each speaker's headshot into the row they speak on.
//
// SOURCE (2026-08-18, from Auri): the run of show supplied by Øresundsinstituttet and Greater
// Copenhagen. Eight rows, 12 people, photos from the "Dansk-svenska talarbilder TechBBQ" folder.
// Descriptions are left EMPTY on purpose: the source has no session descriptions and inventing
// programme copy for a partner's event is not this script's job.
//
// Dry run by default. Prints every row and every photo pairing, writes nothing.
//   sops exec-env secrets.enc.env "node scripts/seed-denmark-sweden-summit.mjs"
//   sops exec-env secrets.enc.env "node scripts/seed-denmark-sweden-summit.mjs --apply"
//
// RE-RUNNING IS NOT SAFE BY DEFAULT. There is no natural key on a session row, so a second --apply
// would create eight more of them. The script refuses to write if any row already carries this
// `Name of the Event`; pass --force only when you have deleted the previous set by hand.
//
// TWO THINGS THE RENDERER CARES ABOUT, both handled here:
//  1. `Speaker Details` is one line, people joined with " · ", and the first comma in an entry splits
//     name from job title. Later commas are harmless. NO SEMICOLONS: some programmes opt into
//     splitting people on ";" (see parsePeople in lib/program.ts), and a semicolon inside a job title
//     would invent a nameless person there. Anne-Louise's two roles are joined with a comma for that
//     reason.
//  2. `Speaker Photo` pairs with those names BY INDEX, and lib/program.ts drops every photo on a row
//     when the counts disagree rather than risking the wrong face on the wrong person. So the upload
//     order below must match the name order exactly, and PHOTOS ARE UPLOADED ONE CALL AT A TIME
//     because each call appends.

const TOKEN = process.env.AIRTABLE_TOKEN;

const BASE = "appgXNjXJqpk9Ebxd";
const SESSIONS = "tblSlpTzDi2oVYwqv";
const SPEAKER_PHOTO = "fldksEh4ZHM6Iz7dx";   // Speaker Photo
const MODERATOR_PHOTO = "fld3fmx2tZ7V7wg8a"; // Moderator Photo

const EVENT = "Denmark-Sweden Summit";
const ROOM = "Event Room 6";
const DAY = "Day 2";

// Trine moderates the whole programme (Auri). She goes on the six content sessions, not on the
// networking reception or the closing, because a reception has no moderator.
const MODERATOR = "Trine Grönlund";
const MODERATOR_FILE = "Trine Gronlund 1.jpg"; // the headshot; "2" is a casual shot holding a book

const PHOTO_DIR = process.env.FACE_DIR;

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

// `photos` lists one file per person in `speakers`, in the same order. A row with no speakers gets
// neither, and no moderator.
const ROWS = [
  {
    time: "12:00 – 12:05",
    name: "Welcome",
    type: "Opening Remarks",
    speakers: "Johan Wessman, CEO at Øresundsinstituttet",
    photos: ["Johan Wessman.jpg"],
  },
  {
    time: "12:05 – 12:20",
    name: "The Øresund Region as a growing and innovative research region",
    type: "Presentation",
    speakers: "Micael Nord, Director of Business and External Relations at City of Malmö",
    photos: ["Micael Nord.jpg"],
  },
  {
    time: "12:20 – 12:50",
    name:
      "What does the European Spallation Source (ESS), with its research facility in Lund and data centre at DTU in Lyngby, mean for research and innovation?",
    type: "Keynote",
    speakers:
      "Kevin Jones, former Operations and Machine Director at the European Spallation Source (ESS)",
    photos: ["Kevin Jones- ESS.jpg"],
  },
  {
    time: "12:50 – 13:15",
    name: "Innovation and Danish-Swedish collaboration",
    type: "Presentation",
    speakers:
      "Anne-Louise Thon-Jensen, Partner and Co-Founder at SDG Invest & Vår Ventures, Board Member at Minc · Johannes Ivarsson, COO at Hetch",
    photos: ["Anne_Louise_Thon_Jensen.jpg", "Johannes Ivarsson.jpg"],
  },
  {
    time: "13:15 – 13:55",
    name:
      "Panel debate: The Øresund region as a hotspot for Danish-Swedish innovation and research",
    type: "Panel",
    speakers:
      "Anders G Nilsson, CEO at Ideon Science Park, Lund · Anette Steenberg, CEO at Medicon Valley Alliance · Markus Herrgård, CTO at BioInnovation Institute, Copenhagen · Petter Hartman, CEO at Medicon Village Innovation, Lund · Thomas Unt, Head of Incubation at Medeon Science Park, Malmö",
    photos: [
      "Anders Nilsson Ideon.jpg",
      "Anette Steenberg.jpg",
      "Markus Herrgard.jpg",
      "Petter Hartman.jpg",
      "Thomas Unt.jpg",
    ],
  },
  {
    time: "13:55 – 14:00",
    name: "Final remarks",
    type: "Closing Remarks & Reflections",
    speakers: "Jan Juul Christensen, Managing Director at Greater Copenhagen",
    photos: ["Jan Juul Christensen.jpg"],
  },
  { time: "14:00 – 14:30", name: "Networking reception", type: "Networking & Drinks" },
  { time: "14:30", name: "Closing", type: "Closing Remarks & Reflections" },
];

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN is not set. Run via `sops exec-env secrets.enc.env \"node scripts/seed-denmark-sweden-summit.mjs\"`.");
  process.exit(2);
}
if (!PHOTO_DIR) {
  console.error("FACE_DIR is not set. Point it at the folder of 800x800 headshots.");
  process.exit(2);
}

const { readFile } = await import("node:fs/promises");
const { join } = await import("node:path");

const api = async (path, init) => {
  const res = await fetch(`https://api.airtable.com/v0/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${JSON.stringify(json.error)}`);
  return json;
};

// The attachment upload lives on content.airtable.com, not api.airtable.com, takes the file as
// base64 and caps at 5MB — which is why the source photos (up to 16MB) are resized first. Each call
// APPENDS one attachment, so calling in order is what puts the faces in order.
async function uploadPhoto(recordId, fieldId, file) {
  const bytes = await readFile(join(PHOTO_DIR, file));
  const res = await fetch(
    `https://content.airtable.com/v0/${BASE}/${recordId}/${fieldId}/uploadAttachment`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: "image/jpeg",
        file: bytes.toString("base64"),
        filename: file,
      }),
    }
  );
  const json = await res.json();
  if (json.error) throw new Error(`upload ${file}: ${JSON.stringify(json.error)}`);
  return json;
}

const people = (s) => (s ? s.split("·").map((x) => x.trim()).filter(Boolean) : []);

(async () => {
  // Fail before writing if this programme is already in the table.
  const probe = await api(
    `${BASE}/${SESSIONS}?filterByFormula=${encodeURIComponent(`{Name of the Event}="${EVENT}"`)}&pageSize=100`
  );
  if (probe.records.length && !FORCE) {
    console.error(
      `${probe.records.length} row(s) already carry Name of the Event = "${EVENT}".\n` +
        `Refusing to create duplicates. Delete them first, or pass --force if you know what you are doing.`
    );
    process.exit(1);
  }

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${EVENT} · ${ROOM} · ${DAY} · 27 August\n`);

  let bad = 0;
  for (const r of ROWS) {
    const names = people(r.speakers);
    const pics = r.photos || [];
    const ok = names.length === pics.length;
    if (!ok) bad++;
    console.log(`${r.time.padEnd(15)} ${r.type.padEnd(30)} ${r.name}`);
    for (let i = 0; i < Math.max(names.length, pics.length); i++) {
      const nm = names[i] ? names[i].split(",")[0] : "(NO NAME)";
      console.log(`    ${String(i + 1).padStart(2)}. ${nm.padEnd(28)} <- ${pics[i] || "(NO PHOTO)"}`);
    }
    if (names.length) console.log(`        moderator: ${MODERATOR} <- ${MODERATOR_FILE}`);
    if (!ok) console.log(`    !! ${names.length} names vs ${pics.length} photos — the renderer would drop every face on this row`);
  }

  const totalPhotos = ROWS.reduce((n, r) => n + (r.photos?.length || 0) + (r.speakers ? 1 : 0), 0);
  console.log(`\n${ROWS.length} sessions · ${totalPhotos} photo uploads · ${bad} misaligned row(s)`);

  if (bad) {
    console.error("Refusing to continue: fix the name/photo pairing first.");
    process.exit(1);
  }
  if (!APPLY) {
    console.log("\nNothing written. Re-run with --apply.");
    return;
  }

  const created = await api(`${BASE}/${SESSIONS}`, {
    method: "POST",
    body: JSON.stringify({
      records: ROWS.map((r) => ({
        fields: {
          "Name of the Event": EVENT,
          "Session Name": r.name,
          "Time Slot": r.time,
          "Session Type": r.type,
          "Event Room": ROOM,
          "When Is it": DAY,
          ...(r.speakers ? { "Speaker Details": r.speakers, "Moderator Details": MODERATOR } : {}),
        },
      })),
      typecast: false,
    }),
  });
  console.log(`\ncreated ${created.records.length} sessions`);

  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i];
    const rec = created.records[i];
    for (const file of row.photos || []) {
      await uploadPhoto(rec.id, SPEAKER_PHOTO, file);
      console.log(`  ${row.time} speaker photo <- ${file}`);
    }
    if (row.speakers) {
      await uploadPhoto(rec.id, MODERATOR_PHOTO, MODERATOR_FILE);
      console.log(`  ${row.time} moderator photo <- ${MODERATOR_FILE}`);
    }
  }
  console.log("\nDone.");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
