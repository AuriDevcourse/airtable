// Creates missing Speaker Hub 1:1 records from the Supabase roster (`speaker_public_profiles`),
// so every confirmed speaker has a face, job title, company and bio in Airtable.
//
// WHY THIS EXISTS (2026-08-18). `Speaker Hub 1:1` was imported from Supabase at some point and
// then drifted: 73 of the 208 roster people are missing from it. Six of those missing people have
// already submitted the 2026 speaker form, so they fall out of the availability gallery for no
// reason other than the drift. Companion to scripts/link-speaker-profiles.mjs.
//
//   sops exec-env secrets.enc.env "node scripts/sync-speaker-hub-1on1.mjs"            # dry run, all
//   sops exec-env secrets.enc.env "node scripts/sync-speaker-hub-1on1.mjs --needed"   # dry run, only 2026 submitters
//   ...add --apply to write.
//
// CAUTION: the Hub view `Speakers 1:1` (viwP58QXZiQncyzdH) is UNFILTERED and is what the live media
// form's `Speakers` picker reads. Every record created here lands in that picker immediately. Use
// --needed until the picker is repointed at the filtered availability view.
//
// Matching and creation are both keyed on the normalised name, so re-running is a no-op.

const TOKEN = process.env.AIRTABLE_TOKEN;
const SUPA_URL = process.env.SPEAKERHUB_SUPABASE_URL;
const SUPA_KEY = process.env.SPEAKERHUB_SUPABASE_ANON_KEY;
const BASE_ID = "appHfDkCrd7uPMItx";
const SUBS = "tblJYAh4MT3NMeOeD";
const HUB = "tblvpTxZqA5pUlDDY";
const YEAR = "2026";

const APPLY = process.argv.includes("--apply");
const NEEDED_ONLY = process.argv.includes("--needed");

if (!TOKEN || !SUPA_URL || !SUPA_KEY) {
  console.error("Missing AIRTABLE_TOKEN / SPEAKERHUB_SUPABASE_*. Run via sops exec-env.");
  process.exit(2);
}

const air = async (path, init) => {
  const res = await fetch(`https://api.airtable.com/v0/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${JSON.stringify(json.error)}`);
  return json;
};

async function listAll(table) {
  const out = [];
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const page = await air(`${BASE_ID}/${table}?${qs}`);
    out.push(...page.records);
    offset = page.offset;
  } while (offset);
  return out;
}

const TITLES = /\b(dr|prof|mr|mrs|ms|phd|md)\b/g;
const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(TITLES, " ").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
const tight = (s) => norm(s).replace(/\s/g, "");

const year = (rec) => String(rec.fields["Created"] || rec.createdTime || "").slice(0, 4);
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

(async () => {
  const roster = await (await fetch(`${SUPA_URL}/rest/v1/speaker_public_profiles?select=*&limit=2000`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  })).json();
  if (!Array.isArray(roster)) throw new Error(`Supabase: ${JSON.stringify(roster).slice(0, 300)}`);

  const [hub, subs] = await Promise.all([listAll(HUB), listAll(SUBS)]);
  const hubNames = new Set(hub.map((r) => tight(r.fields.Name)));

  // Who has actually submitted the 2026 speaker form but has no Hub record yet.
  const wanted = new Set(
    subs.filter((r) => r.fields["I am a:"] === "Speaker" && year(r) === YEAR && r.fields.Name)
      .map((r) => tight(r.fields.Name)),
  );

  let missing = roster.filter((p) => p.full_name && !hubNames.has(tight(p.full_name)));
  if (NEEDED_ONLY) missing = missing.filter((p) => wanted.has(tight(p.full_name)));

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${NEEDED_ONLY ? "2026 submitters only" : "full roster resync"}\n`);
  console.log(`  Supabase roster:        ${roster.length}`);
  console.log(`  Speaker Hub 1:1 now:    ${hub.length}`);
  console.log(`  to create:              ${missing.length}\n`);

  for (const p of missing) {
    const flag = wanted.has(tight(p.full_name)) ? "[has 2026 submission] " : "";
    console.log(`  ${flag}${p.full_name} · ${p.job_title || "?"} @ ${p.company || "?"}${p.photo_url ? "" : "  (NO PHOTO)"}`);
  }

  if (!APPLY) {
    console.log(`\nNothing written. Add --apply to create these ${missing.length} records.`);
    return;
  }

  let made = 0;
  for (const batch of chunk(missing, 10)) {
    await air(`${BASE_ID}/${HUB}`, {
      method: "POST",
      body: JSON.stringify({
        records: batch.map((p) => ({
          fields: {
            Name: p.full_name,
            "Job Title": p.job_title || "",
            Company: p.company || "",
            "Speaker Bio": p.biography || "",
            ...(p.photo_url ? { Attachments: [{ url: p.photo_url }] } : {}),
          },
        })),
      }),
    });
    made += batch.length;
    console.log(`  created ${made}/${missing.length}`);
  }
  console.log(`\nCreated ${made} Hub records. Re-run scripts/link-speaker-profiles.mjs to link them.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
