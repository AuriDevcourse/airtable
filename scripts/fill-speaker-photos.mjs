// Fills `Speaker Photo` on PR/Program Matchmaking for every 2026 "I am a: Speaker" submission,
// so the gallery `Speakers Available 2026` can finally show faces.
//
// WHY THIS EXISTS (2026-08-18). The gallery has to show exactly one population: whoever ticked
// "I am a: Speaker" on the Speaker & Media Matchmaking 2026 form. An Airtable gallery cover must be
// an ATTACHMENT FIELD ON THE SAME TABLE, so the earlier plans both failed: a lookup of the Hub's
// attachments cannot be a cover, and building the gallery on Speaker Hub 1:1 instead is blocked
// because that table is externally synced (INVALID_PERMISSIONS on create) AND holds only 148 of the
// ~497 people who have applied as a speaker. PR/Program Matchmaking is native and writable, so the
// simplest correct answer is a real attachment field here, filled from wherever the photo already is.
//
// TWO PHOTO SOURCES, in priority order:
//   1. Speaker Hub 1:1 (tblvpTxZqA5pUlDDY) through the existing `Speaker Profile` link. 73 rows.
//   2. The Marketing base speaker submissions (appgXNjXJqpk9Ebxd / Marketing Project Overview,
//      view `Speakers`, 525 rows fed by the "Speakers for Different Projects" form), matched on a
//      normalised name. This is where the 6 people blocked by the Hub sync have had a photo all
//      along, and it is the real roster: the Hub is a stale partial copy of it.
//
// Dry run by default. Prints every proposed write and every miss, changes nothing.
//   sops exec-env secrets.enc.env "node scripts/fill-speaker-photos.mjs"
//   sops exec-env secrets.enc.env "node scripts/fill-speaker-photos.mjs --apply"
//
// Only touches rows that are: I am a: = Speaker, created in YEAR, and Speaker Photo still empty.
// Never overwrites a photo, so it is safe to re-run after a manual upload.
//
// TIMING GOTCHA. Airtable attachment URLs expire a couple of hours after they are read, and the
// write hands Airtable a URL to fetch server-side. Read and write in the same run; do not save a
// dry-run listing and apply it tomorrow.

const TOKEN = process.env.AIRTABLE_TOKEN;

const PR_BASE = "appHfDkCrd7uPMItx";
const SUBS = "tblJYAh4MT3NMeOeD";        // PR/Program Matchmaking
const HUB = "tblvpTxZqA5pUlDDY";         // Speaker Hub 1:1 (externally synced, read-only)
const PHOTO_FIELD = "Speaker Photo";     // fldXzJsG66kEvbxwc, multipleAttachments, gallery cover
const LINK_FIELD = "Speaker Profile";    // fldVJwWtMIjfgq7Dk, link -> HUB

const MKT_BASE = "appgXNjXJqpk9Ebxd";
const MKT_TABLE = "tblTecOBecLQCNIeD";   // Marketing Project Overview
const MKT_VIEW = "viwfIcQFDNQ9ggSqx";    // Speakers

const YEAR = "2026";

// Known typos on the form, mapped to the spelling the photo rosters use. Kept explicit rather than
// fuzzy-matched: a wrong face on a media-facing gallery is worse than a blank tile.
// The form takes whatever the person typed; the roster holds their full name. Every entry below was
// confirmed against the Company on the submission, never on the name alone:
//   Rustamova -> Level Zero Health · Naama Harari -> Wix · Katrine Arevad -> KvindeKompagniet
//   Christie Kristensen -> Danske Bank A/S · Henriette Kirkegaard -> Zephyra
// The Company check matters most for Christie: a second Christie Kristensen submitted as Media from
// Pantrium Podcast, and there is an unrelated Thomas Kristensen in the roster.
const ALIASES = {
  "cecilia bonefedeld dahl": "Cecilia Bonefeld-Dahl",
  "rustamova": "Ula Rustamova",
  "naama harari": "Naama Harari Uzan",
  "katrine arevad": "Katrine Arevad W. R.",
  "christie kristensen": "Christie H. Kristensen",
  "henriette kirkegaard": "Henriette Schultz Kirkegaard",
};

const APPLY = process.argv.includes("--apply");

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN is not set. Run via `sops exec-env secrets.enc.env \"node scripts/fill-speaker-photos.mjs\"`.");
  process.exit(2);
}

const api = async (path, init) => {
  const res = await fetch(`https://api.airtable.com/v0/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${JSON.stringify(json.error)}`);
  return json;
};

async function listAll(base, table, view) {
  const out = [];
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (view) qs.set("view", view);
    if (offset) qs.set("offset", offset);
    const page = await api(`${base}/${table}?${qs}`);
    out.push(...page.records);
    offset = page.offset;
  } while (offset);
  return out;
}

// Several columns in these tables carry trailing spaces in their names ("Name  ", "Attachments  ").
// Read by trimmed name so a tidy-up in Airtable cannot silently blank this script's output.
const f = (rec, name) => {
  const key = Object.keys(rec.fields).find((k) => k.trim() === name);
  return key ? rec.fields[key] : undefined;
};

const TITLES = /\b(dr|prof|mr|mrs|ms|phd|md)\b/g;
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(TITLES, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const year = (rec) => String(f(rec, "Created") || rec.createdTime || "").slice(0, 4);

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Airtable will not accept its own signed URL back with the query string stripped, so pass the url
// through untouched and let Airtable re-fetch and re-host the bytes.
const asAttachment = (att) => ({ url: att.url, filename: att.filename });

(async () => {
  const [subs, hub, mkt] = await Promise.all([
    listAll(PR_BASE, SUBS),
    listAll(PR_BASE, HUB),
    listAll(MKT_BASE, MKT_TABLE, MKT_VIEW),
  ]);

  const hubById = new Map(hub.map((r) => [r.id, r]));

  // One entry per person from the Marketing roster. A person often submits for several projects;
  // prefer whichever row actually carries a Profile Picture.
  const mktByName = new Map();
  for (const r of mkt) {
    const key = norm(f(r, "Full Name"));
    if (!key) continue;
    const pics = f(r, "Profile Picture") || [];
    const prev = mktByName.get(key);
    if (!prev || (!prev.pics.length && pics.length)) {
      mktByName.set(key, { pics, title: f(r, "Job Title"), project: f(r, "Project Name") });
    }
  }

  const targets = subs.filter(
    (r) => f(r, "I am a:") === "Speaker" && year(r) === YEAR && !(f(r, PHOTO_FIELD) || []).length,
  );

  const fromHub = [];
  const fromMkt = [];
  const noPhoto = [];

  for (const r of targets) {
    const name = f(r, "Name");
    const link = (f(r, LINK_FIELD) || [])[0];
    const hubRec = link ? hubById.get(link) : undefined;
    const hubPics = hubRec ? f(hubRec, "Attachments") || [] : [];

    if (hubPics.length) {
      fromHub.push({ r, atts: hubPics, via: f(hubRec, "Name") });
      continue;
    }

    const key = norm(ALIASES[norm(name)] || name);
    const m = key ? mktByName.get(key) : undefined;
    if (m && m.pics.length) {
      fromMkt.push({ r, atts: m.pics, via: `${m.title || "?"} · ${m.project || "?"}` });
      continue;
    }

    noPhoto.push(r);
  }

  const writes = [...fromHub, ...fromMkt];
  const already = subs.filter(
    (r) => f(r, "I am a:") === "Speaker" && year(r) === YEAR && (f(r, PHOTO_FIELD) || []).length,
  ).length;

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${YEAR} speaker submissions\n`);
  console.log(`  candidates (no photo yet): ${targets.length}`);
  console.log(`  already have a photo:      ${already}`);
  console.log(`  Marketing roster rows:     ${mkt.length} (${mktByName.size} distinct people)\n`);

  console.log(`FROM SPEAKER HUB 1:1, via the Speaker Profile link (${fromHub.length})`);
  for (const { r, via } of fromHub) console.log(`  ${f(r, "Name")}  <-  ${via}`);

  console.log(`\nFROM THE MARKETING ROSTER, matched on name (${fromMkt.length})`);
  for (const { r, via } of fromMkt) console.log(`  ${f(r, "Name")}  <-  ${via}`);

  console.log(`\nNO PHOTO IN EITHER SOURCE — needs a manual upload (${noPhoto.length})`);
  for (const r of noPhoto) console.log(`  ${f(r, "Name") ?? "(blank)"} · ${f(r, "Company") || "?"}  (${r.id})`);

  if (!APPLY) {
    console.log(`\nNothing written. Re-run with --apply to fill ${writes.length} of ${targets.length} tiles.`);
    return;
  }

  let written = 0;
  for (const batch of chunk(writes, 10)) {
    await api(`${PR_BASE}/${SUBS}`, {
      method: "PATCH",
      body: JSON.stringify({
        records: batch.map(({ r, atts }) => ({
          id: r.id,
          fields: { [PHOTO_FIELD]: atts.slice(0, 1).map(asAttachment) },
        })),
      }),
    });
    written += batch.length;
    console.log(`  wrote ${written}/${writes.length}`);
  }
  console.log(`\nFilled ${written} photos. ${noPhoto.length} tiles will stay blank until someone uploads one.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
