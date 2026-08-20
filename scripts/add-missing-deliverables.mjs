// Create a Partner Deliverables 2026 row for every CONFIRMED partner that has none.
//
// WHY (2026-08-17). Partners 2026 held 209 rows with `Status 2026 = Confirmed`, and 21 of them had
// no row at all in Marketing Project Overview's "Partner Deliverables 2026" view — so they could
// never reach the partner wall, and nobody could see they were missing. Auri asked for all 21.
//
// WHAT IT CANNOT GIVE YOU. Almost nothing is copyable from Partners 2026: of the 21, ZERO have a
// logo, ZERO have a LinkedIn URL and exactly ONE (Cherry Ventures) has a website. So these rows are
// deliberately shells — Company, Partner ID, the Company Link back to the CRM, and a type where the
// mapping is unambiguous. The logo still has to be collected from each partner, and a row with no
// logo never reaches the wall.
//
// IDEMPOTENT. Every run re-reads the view and skips any Partner ID that already has a row, so a
// second run creates nothing. That is what makes it safe to re-run after a partial failure.
//
//   node scripts/add-missing-deliverables.mjs           dry run, writes nothing
//   node scripts/add-missing-deliverables.mjs --commit  create the rows
//   node scripts/add-missing-deliverables.mjs --commit --limit=1   prove the shape on one row first

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE_ID || "appgXNjXJqpk9Ebxd";
const CRM = "tbl9V6ZtxEbR4uELC"; // Partners 2026
const DELIV = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const VIEW = "viw7FVbsTb9IRaWF0"; // Partner Deliverables 2026

const H = { Authorization: `Bearer ${TOKEN}` };
const W = { ...H, "Content-Type": "application/json" };

const COMMIT = process.argv.includes("--commit");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "--limit=0").slice(8)) || Infinity;

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN is not set. Run under `sops exec-env secrets.enc.env`.");
  process.exit(2);
}

// The two tables do NOT share a vocabulary for partnership type, so the CRM value is translated
// rather than copied. Anything not listed here is left BLANK on purpose: an invalid option would be
// rejected, and guessing a tier is worse than an empty cell somebody can see and fill. A blank type
// means no tier resolves and the row stays off the wall, which is the honest state for these.
// PARTNER IDs THIS SCRIPT MUST NEVER CREATE A ROW FOR.
//
// "Idempotent" here means "skips what already exists", and that is NOT the same as "safe to re-run":
// a row Auri DELETED looks identical to a row that was never created, so without this list the next
// run resurrects it. Every id below was deleted deliberately on 2026-08-17 and must stay deleted.
//
//   62   "Ada Ventures promo"          a second DEAL on Ada Ventures (id 2103), not a second company
//   2550 "Business Turku Oy Ab upsell" a second DEAL on Business Turku Oy Ab (id 2196)
//   272  "CPH Fintech"                 the same org as "Copenhagen Fintech Lab" (id 1468), already live
//   1444 "Novo Nordisk Denmark AS"     LP Forum Partnership; distinct from Novo Nordisk Foundation
//                                      (id 2091, Prime, live) but Auri does not want it on the wall
//
// The first two are the general trap: the CRM files an upsell or add-on as its own row with the deal
// name appended, so a name match misses it and a "missing partner" is really a second invoice line.
//
// ADDED 2026-08-20, and these two are the OTHER shape: one organisation confirmed TWICE in the CRM,
// where the wall must show it once. Both deliverables rows were deleted by Auri that day after they
// appeared as duplicate logos on /partners, so this run reported them as "missing" — which is
// precisely the resurrection this list exists to stop.
//
//   406  "EIFO (Vækstfonden)"   confirmed 2025-12-08, but EIFO is already live at Main under
//                               id 2309 (confirmed 2026-07-07). Two confirmed EIFO deals, one logo.
//   1639 "The Kitchen (Aarhus University Startup Hub)"  confirmed 2026-05-07, and covered on the
//                               wall by "INCUBA x KITCHEN" (id 1683), the four-organisation
//                               partnership whose tiles include KITCHEN's own mark.
//
// If either should come back onto the wall, take the id out of here AND decide which of the two CRM
// rows is the canonical one first — otherwise the duplicate logo returns with it.
const NEVER_CREATE = new Set([62, 2550, 272, 1444, 406, 1639]);

// Partners to create even though `Status 2026` is not yet "Confirmed", because the signature landed
// before the CRM caught up. Keep this SHORT and delete each entry once the status is corrected.
//   2925 "Greeks in the Nordics" — Zapier reported it signed on 2026-08-17; CRM still says
//        "Contract Sent". Auri confirmed the signature.
const FORCE_INCLUDE = new Set([2925]);

const TYPE_MAP = {
  "Community Partnership (Non-commercial)": "Community",
  "Add-on / Tailored": "Tailored",
  // The deliverables option genuinely carries a trailing space. Do not "fix" it here.
  "International Pioneer Partnership": "Pioneer ",
};

const page = async (table, params) => {
  let all = [], offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/${table}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const j = await (await fetch(u, { headers: H })).json();
    if (j.error) throw new Error(`${table}: ${JSON.stringify(j.error)}`);
    all = all.concat(j.records || []);
    offset = j.offset;
  } while (offset);
  return all;
};

const norm = (s) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(a\/s|aps|ab|as|oy|ltd|limited|inc|llc|gmbh|bv|nv|plc)\b/g, "")
    .replace(/[^a-z0-9]+/g, "").trim();

const confirmedOnly = await page(CRM, { view: "viwDhqsDpfEf0PRyI", filterByFormula: '{Status 2026}="Confirmed"' });
// The forced ones are fetched separately rather than by loosening the filter, so widening the net is
// always an explicit, listed decision and never a side effect of an edited formula.
const forced = FORCE_INCLUDE.size
  ? await page(CRM, {
      view: "viwDhqsDpfEf0PRyI",
      filterByFormula: `OR(${[...FORCE_INCLUDE].map((i) => `{Partner ID}=${i}`).join(",")})`,
    })
  : [];
const seenRec = new Set(confirmedOnly.map((r) => r.id));
const confirmed = [...confirmedOnly, ...forced.filter((r) => !seenRec.has(r.id))];
const deliv = await page(DELIV, { view: VIEW });

const haveIds = new Set(deliv.map((r) => r.fields["Partner ID"]).filter((x) => x != null && x !== 0));
const haveNames = new Set(deliv.map((r) => norm(r.fields["Company"])).filter(Boolean));

const missing = confirmed.filter((r) => {
  const n = norm(r.fields["Company Name"]);
  const id = r.fields["Partner ID"];
  if (!n) return false;
  if (NEVER_CREATE.has(id)) return false;
  if (haveNames.has(n)) return false;
  if (id != null && id !== 0 && haveIds.has(id)) return false;
  return true;
});

console.log(`confirmed ${confirmed.length} · deliverables ${deliv.length} · missing ${missing.length}\n`);
if (!missing.length) {
  console.log("Nothing to create. Every confirmed partner already has a row.");
  process.exit(0);
}

const planned = missing.slice(0, LIMIT === Infinity ? undefined : LIMIT);

const buildFields = (r) => {
  const x = r.fields;
  // The CRM field is a MULTI-select and the mappable value is not always first: FailForward is
  // ["Barter Deal", "Community Partnership (Non-commercial)"], and reading [0] alone threw away the
  // half that actually translates. Scan the whole array and take the first value we can map.
  const srcTypes = x["Partnership Type 2026"] || [];
  const srcType = srcTypes.join(", ");
  const mapped = srcTypes.map((s) => TYPE_MAP[s]).find(Boolean);
  const fields = {
    Company: String(x["Company Name"]).trim(),
    // The CRM's Partner ID is an autoNumber; the deliverables column is a plain number.
    "Partner ID": x["Partner ID"],
    // The link back to the CRM row — the thing Auri could not find by hand.
    "Company Link": [r.id],
  };
  if (mapped) fields["Partnership Type 2026"] = mapped;
  // Only Cherry Ventures has one, but copy it wherever it exists.
  if (x["Website"]) fields["Link to your website"] = x["Website"];
  if (x["Company's LinkedIn Profile"]) fields["Link to LinkedIn"] = x["Company's LinkedIn Profile"];
  // CONTACT (added 2026-08-19). The CRM keeps the same person in up to four places and none of them
  // is reliably filled: `Contact Person 2026` is the 2026 intake field, `Contact Name` the legacy
  // one, and the email usually only exists as `Mail` — a LOOKUP through the linked Contacts row,
  // which is why a plain read of `Contact Email` came back empty for 6 of 8 partners. Take the first
  // value that exists, in newest-first order, and write nothing when all of them are empty.
  const first = (...vals) => {
    for (const v of vals) {
      const s = Array.isArray(v) ? v.find((y) => String(y || "").trim()) : v;
      if (String(s || "").trim()) return String(s).trim();
    }
    return "";
  };
  const cName = first(x["Contact Person 2026"], x["Contact Name"], x["Marketing contact"]);
  const cMail = first(x["Email 2026"], x["Contact Email"], x["Mail"], x["Email"], x["Email (from Contacts) 2"]);
  if (cName) fields["Contact Name"] = cName;
  if (cMail) fields["Contact Email"] = cMail;
  return { fields, srcType, mapped };
};

console.log(`${COMMIT ? "CREATING" : "WOULD CREATE"} ${planned.length} row(s):\n`);
const payloads = [];
for (const r of planned) {
  const { fields, srcType, mapped } = buildFields(r);
  payloads.push({ fields });
  console.log(
    `  ${String(fields.Company).slice(0, 38).padEnd(40)}id:${String(fields["Partner ID"]).padEnd(6)}` +
      `type:${(mapped || "— left blank").padEnd(14)}` +
      `${fields["Link to your website"] ? "website " : ""}${fields["Link to LinkedIn"] ? "linkedin " : ""}` +
      `${fields["Contact Name"] ? `name:${fields["Contact Name"]} ` : ""}${fields["Contact Email"] ? `${fields["Contact Email"]} ` : ""}` +
      `link→${r.id}`
  );
  if (!mapped && srcType) console.log(`        (CRM type "${srcType}" has no deliverables equivalent, left blank)`);
}

// NOTE: "Put on web" is deliberately NEVER set. These rows have no logo, so ticking it would only
// put them in the feed's rejected pile — and the tick is Auri's decision, not this script's.
console.log(`\n  "Put on web" is not set on any of them, and no logo exists to publish yet.`);

if (!COMMIT) {
  console.log("\nDRY RUN. Nothing was written. Add --commit to create.");
  process.exit(0);
}

// Airtable caps a create at 10 records per request.
let made = 0;
for (let i = 0; i < payloads.length; i += 10) {
  const chunk = payloads.slice(i, i + 10);
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${DELIV}`, {
    method: "POST",
    headers: W,
    body: JSON.stringify({ records: chunk }),
  });
  const txt = await res.text();
  if (!res.ok) {
    console.error(`\n  batch ${i / 10 + 1} FAILED ${res.status}: ${txt.slice(0, 400)}`);
    console.error("  Re-run to retry — already-created rows are skipped.");
    process.exit(1);
  }
  const created = JSON.parse(txt).records || [];
  made += created.length;
  created.forEach((c) => console.log(`   created ${c.id}  ${c.fields.Company}`));
}
console.log(`\n${made} row(s) created. Re-read the view to confirm they landed in it.`);
