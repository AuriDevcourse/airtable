// Links each 2026 "I am a: Speaker" submission in PR/Program Matchmaking to that person's
// record in Speaker Hub 1:1, via the single-link field `Speaker Profile`.
//
// WHY THIS EXISTS (2026-08-18). The gallery `Speakers Available 2026` sits on the submissions
// table, which has no attachment field, so it can never show faces. Airtable gallery covers must
// be an attachment field on the SAME table; a lookup of attachments cannot be a cover. The fix is
// to flip the direction: keep the photos where they already are (Speaker Hub 1:1, every record has
// one) and pull the "this person confirmed they're a speaker" signal across the link. This script
// builds that link.
//
// Dry run by default. Prints every proposed write and every miss, changes nothing.
//   sops exec-env secrets.enc.env "node scripts/link-speaker-profiles.mjs"
//   sops exec-env secrets.enc.env "node scripts/link-speaker-profiles.mjs --apply"
//
// Only touches rows that are: I am a: = Speaker, created in YEAR, and Speaker Profile still empty.
// Never overwrites an existing link, so it is safe to re-run after manual corrections.

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = "appHfDkCrd7uPMItx";
const SUBS = "tblJYAh4MT3NMeOeD";        // PR/Program Matchmaking
const HUB = "tblvpTxZqA5pUlDDY";         // Speaker Hub 1:1
const LINK_FIELD = "Speaker Profile";    // fldVJwWtMIjfgq7Dk, single link -> HUB
const YEAR = "2026";

const APPLY = process.argv.includes("--apply");

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN is not set. Run via `sops exec-env secrets.enc.env \"node scripts/link-speaker-profiles.mjs\"`.");
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

async function listAll(table) {
  const out = [];
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const page = await api(`${BASE_ID}/${table}?${qs}`);
    out.push(...page.records);
    offset = page.offset;
  } while (offset);
  return out;
}

// Strip diacritics, titles and punctuation so "Dr. Ahmed Ismail " and "ahmed ismail" collide.
const TITLES = /\b(dr|prof|mr|mrs|ms|phd|md)\b/g;
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(TITLES, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tight = (s) => norm(s).replace(/\s/g, "");

// Last name + first initial. Catches "Tomas Zhang Mathiesen" vs "Tomas Mathiesen", and typos in
// the middle of a name. Deliberately reported for review, never auto-applied.
const loose = (s) => {
  const parts = norm(s).split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[parts.length - 1]}|${parts[0][0]}`;
};

const year = (rec) => String(rec.fields["Created"] || rec.createdTime || "").slice(0, 4);

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

(async () => {
  const [subs, hub] = await Promise.all([listAll(SUBS), listAll(HUB)]);

  // Hub indexes. A name that is ambiguous inside the Hub itself is dropped from the exact index,
  // because auto-linking to the wrong duplicate is worse than leaving it blank.
  const byTight = new Map();
  const byLoose = new Map();
  for (const r of hub) {
    const t = tight(r.fields.Name);
    const l = loose(r.fields.Name);
    if (t) byTight.set(t, (byTight.get(t) || []).concat(r));
    if (l) byLoose.set(l, (byLoose.get(l) || []).concat(r));
  }

  const targets = subs.filter(
    (r) => r.fields["I am a:"] === "Speaker" && year(r) === YEAR && !(r.fields[LINK_FIELD] || []).length,
  );

  const linked = [];
  const review = [];
  const missing = [];

  for (const r of targets) {
    const name = r.fields.Name;
    if (!name || !tight(name)) {
      missing.push({ r, why: "no name on the submission" });
      continue;
    }
    const exact = byTight.get(tight(name)) || [];
    if (exact.length === 1) {
      linked.push({ r, hub: exact[0] });
      continue;
    }
    if (exact.length > 1) {
      review.push({ r, cands: exact, why: `${exact.length} Hub records share this name` });
      continue;
    }
    const near = byLoose.get(loose(name)) || [];
    if (near.length) {
      review.push({ r, cands: near, why: "surname + initial match only" });
      continue;
    }
    missing.push({ r, why: "not in Speaker Hub 1:1" });
  }

  const already = subs.filter(
    (r) => r.fields["I am a:"] === "Speaker" && year(r) === YEAR && (r.fields[LINK_FIELD] || []).length,
  ).length;

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${YEAR} speaker submissions\n`);
  console.log(`  candidates (unlinked): ${targets.length}`);
  console.log(`  already linked:        ${already}`);
  console.log(`  Speaker Hub 1:1 rows:  ${hub.length}\n`);

  console.log(`AUTO-LINK — exact name match (${linked.length})`);
  for (const { r, hub: h } of linked) console.log(`  ${r.fields.Name}  ->  ${h.fields.Name} · ${h.fields["Job Title"] || "?"} @ ${h.fields.Company || "?"}`);

  console.log(`\nNEEDS A HUMAN — ambiguous (${review.length})`);
  for (const { r, cands, why } of review) {
    console.log(`  ${r.fields.Name}  [${why}]`);
    for (const c of cands) console.log(`      candidate: ${c.fields.Name} · ${c.fields["Job Title"] || "?"} @ ${c.fields.Company || "?"}  (${c.id})`);
  }

  console.log(`\nNO HUB RECORD — needs one created, with a photo (${missing.length})`);
  for (const { r, why } of missing) console.log(`  ${r.fields.Name ?? "(blank)"} · ${r.fields.Company || "?"}  [${why}]  (${r.id})`);

  if (!APPLY) {
    console.log(`\nNothing written. Re-run with --apply to link the ${linked.length} exact matches.`);
    return;
  }

  let written = 0;
  for (const batch of chunk(linked, 10)) {
    await api(`${BASE_ID}/${SUBS}`, {
      method: "PATCH",
      body: JSON.stringify({
        records: batch.map(({ r, hub: h }) => ({ id: r.id, fields: { [LINK_FIELD]: [h.id] } })),
      }),
    });
    written += batch.length;
    console.log(`  wrote ${written}/${linked.length}`);
  }
  console.log(`\nLinked ${written} submissions. ${review.length + missing.length} still need a human.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
