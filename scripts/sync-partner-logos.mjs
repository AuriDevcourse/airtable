// Resolves every 2026 partner in the "Partner Deliverables 2026" view to a logo file from
// the tbbqvisualgen logo library, and copies the matches into public/partner-logos/.
//
//   node scripts/sync-partner-logos.mjs          # report only, writes nothing
//   node scripts/sync-partner-logos.mjs --write  # copy the files + write the manifest
//
// WHY A COPY AND NOT AIRTABLE. The Airtable attachments on this view are the colour
// originals: 69 PNG, 8 JPEG, 16 SVG, plus a zip, a PDF and an .ai. On a near-black wall those
// render as white boxes, which is exactly the problem the Life Science wall had before Auri
// exported white SVGs. tbbqvisualgen/public/logos already holds ~830 hand-curated logos, most
// of them white SVG, with a brightness measurement per file in logoLibrary.json. That is the
// better source for a dark logo wall, so Airtable stays the source of truth for WHO is a
// partner and WHICH TIER they are, and the library supplies the IMAGE.
//
// The trade-off, stated plainly: this is a copy, so a logo added to tbbqvisualgen does not
// appear here until someone re-runs this script. That is why the script is re-runnable and
// reports its coverage every time.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIB_ROOT = "C:/Users/User/Desktop/GITHUB/tbbqvisualgen";
const LIB_JSON = join(LIB_ROOT, "src/data/logoLibrary.json");
const LIB_FILES = join(LIB_ROOT, "public/logos");
const EXTRA_FILES = "C:/Users/User/Desktop/SVG"; // Auri's white exports, not in the library
const OUT_DIR = join(ROOT, "public/partner-logos");
const MANIFEST = join(ROOT, "lib/partnerLogoManifest.json");

const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const VIEW = "viw7FVbsTb9IRaWF0"; // Partner Deliverables 2026
// Auri: drop these two. Academic is really Community, and Investor is a different thing.
const EXCLUDE_TIERS = new Set(["Investor", "Academic"]);

const WRITE = process.argv.includes("--write");

// Logos that live in neither library, pointed at by absolute path. Use sparingly: a file here
// is invisible to everyone else and to the tbbqvisualgen picker. The right long-term home is
// the logo library; this exists so a one-off white export Auri has on his desktop can be used
// today rather than blocking the wall.
const MANUAL_FILES = {
  // Only a PNG exists for this one, no SVG anywhere.
  "Innovation District Copenhagen": "C:/Users/User/Desktop/IDC_white_transparent.png",
  // Desktop/SVG/"DanishLifeScienec Cluster.svg" was suggested for this, but it renders as the
  // DANISH LIFE SCIENCE CLUSTER mark and duplicated that partner across two tiers. The real
  // CBN file is this PNG on the desktop.
  "Creative Business Network": "C:/Users/User/Desktop/CBN-Logo-white_CBN-logo-black-1.png",

  // Auri's white exports for the partners no automatic match could reach. These were the
  // ambiguous ones ("Mesh" matched two different marks in the library, "Copenhagen" three) or
  // simply absent from both libraries.
  "Young AI Leaders Linz":
    "C:/Users/User/Desktop/TBBQ/2026 Season/Partners/SVG/YoungAILeadersCommunity.svg",
  "START Paris": "C:/Users/User/Desktop/START_Paris_white_SVG.svg",
  Mesh: "C:/Users/User/Desktop/Meshmatrikel-1.svg",
  "Ignite Sweden": "C:/Users/User/Desktop/Ignite.svg",
  "EIT Urban Mobility": "C:/Users/User/Desktop/UrbanMobility-EU.svg",
  "Beta Health": "C:/Users/User/Desktop/Beta-Heath.svg",
  "Third Law ApS": "C:/Users/User/Desktop/SVG/3rd.svg",
  "Plug and Play": "C:/Users/User/Desktop/PlugAndPlay.svg",
  // The row named "European Commission" is really InvestEU — its Airtable website is
  // investeu.europa.eu, and the live site lists InvestEU in Core at that same URL. Not to be
  // confused with the European Innovation Council, a separate partner sitting in Conqueror.
  "European Commission": "C:/Users/User/Desktop/SVG/InvestEU.svg",
  // Auri's white export, overriding the library's "Talent Garden" which is the colour version.
  "Talent Garden Denmark": "C:/Users/User/Desktop/SVG/TalentGardenW.svg",
  // "MADE" trades as Future Manufacturers; its Airtable website is futuremanufacturers.dk.
  MADE: "C:/Users/User/Desktop/Futuremanufacturers.svg",

  // Second pass: Auri's corrected white exports, replacing marks that resolved automatically
  // but to the wrong or an off-brand version. An override here always beats the libraries.
  "Copenhagen Fintech": "C:/Users/User/Desktop/CphFintech.svg",
  "Copenhagen School of Entrepreneurship": "C:/Users/User/Desktop/SVG/CSE.svg",
  "EIT Urban Mobility": "C:/Users/User/Desktop/SVG/UrbanMobility.svg",
  "Health Tech Hub Copenhagen": "C:/Users/User/Desktop/SVG/Health Tech Hub Copenhagen.svg",
  "Women in Data Science AI and ML": "C:/Users/User/Desktop/SVG/WomenInData Science.svg",
  "Odense Robotics": "C:/Users/User/Desktop/SVG/Odense Robotics.svg",
  Dealroom: "C:/Users/User/Desktop/SVG/Dealroom.svg",
};

// Airtable's company name -> the logo library's filename stem. Only for the cases automatic
// matching cannot reach: a different trading name, a Danish spelling, an acronym, or a parent
// brand. Everything else is matched by normalising both sides.
const ALIASES = {
  // Trading name vs legal name
  "AceON Accelerator": "Aceon",
  "advores Advokater & Rechtanwälte PartGmbB": "Advores",
  "advores Advokater & Rechtsanwälte PartGmbB": "Advores",
  "AISTART Incubator - Business Helsinki": "AIStart Incubator",
  "Business Helsinki": "AIStart Incubator",
  "Arctic Startup": "ArcticStartup Mark",
  "Crispa Technologies ApS": "Crispa",
  "Skytek Nordics ApS": "SkyTek ApS",
  "Third Law ApS": "Third Law",
  "TÜV SÜD Danmark ApS": "Tuvsud",
  "TÜV SÜD Denmark Medical Health Services": "Tuvsud",
  "THINGS (The Innovation Growhouse Stockholm AB)": "Things",
  "INNOVX BUSINESS ACCELERATOR S.R.L.": "Innovx",
  "Auxxo Management GmbH": "AUXXO Female Catalyst Fund",
  "Humble AI Limited": "HumbleAI",
  "Venture Café Warsaw Foundation": "Venture Cafe Warsaw Horiz",
  "Sri Sathya Sai Institute of Higher Learning": "Sri Sathya",

  // Country suffix the library does not carry
  "Microsoft Danmark": "Microsoft White",
  "Grant Thornton Denmark": "Grant Thornton",
  "Talent Garden Denmark": "Talent Garden",
  "Teknologisk Institut (Humanoide robotter)": "Teknologisk Institut",
  "Odense Robotics": "Odense Rob",

  // Danish spelling / accents
  "Erhvervshus Sjælland": "Erhvervhus Sjaelland",
  "Erhvervsstyrelsen / Virksomhedsguiden": "Erhvervsstyrelsen White",
  "Business region Gothenburg AKA Gothenburg": "Business Region Göteborg",
  "Embassy of India": "Indianembassy",

  // Acronyms and parent brands
  "International Workplace Group": "IWG",
  "SPACES/REGUS": "Spacesdot",
  "Innovation Centre Denmark": "ICDK",
  "EIFO (Export & Investment Fund of Denmark)": "EIFO",
  "FBV - Association of Listed Danish Companies": "FBV",
  "Copenhagen School of Entrepreneurship": "CBS CSE",
  Copenhagen: "City", // Auri: this row is Copenhagen the CITY, not a company called Copenhagen
  // The file is misnamed in Desktop/SVG — it contains the Creative Business Network wordmark,
  // not a Danish Life Science one. Aliased by its real content, not its filename.
  "Creative Business Network": "DanishLifeScienec Cluster",
  "cse advisory, OMR Reviews": "CSE Advisory",
  "Medicon Valleyh Alliance": "Medicon Valley Alliance", // sic: typo lives in Airtable
  "Brotherhood for Professionals of Color (BPoC)": "BPoC",
  "Indian Venture & Alternate Capital Association": "IVCA",
  "Women in Data Science AI and ML": "Womenindatascience",
  "Highbridge Law Firm": "High Bridge",
  "INCUBA x KITCHEN": "INCUBA",
  "ZOKU Copenhagen": "Zoku",
  "Young AI Leaders Linz": "Young AI Leaders",
  Nordea: "Nordea Startup & Growth",
  Clean: "Clean Cluster",
  "e-conomic": "E Conomic Primary Pos",
  Shine: "IVN Shine",
  DI: "Dansk Industri",

  // WRONG ALIAS, REMOVED: "European Commission" -> "EIC". The European Commission and the
  // European Innovation Council are different bodies, and the EIC is separately a partner in
  // its own right, so this put the SAME mark in two tiers and read as a duplicate on the wall.
  // Neither library has a European Commission logo; it shows its name until one is added.

  // DELIBERATELY UNRESOLVED — guessing these would put the wrong brand on techbbq.dk:
  //   "Copenhagen"          matches Copenhagen Capacity / Fintech / Institute for Futures Studies
  //   "Mesh"                Mesh Community and Mesh Matrikel1 are two different marks
  //   "MADE"                nothing in the library
  //   "EIT Urban Mobility"  nothing in the library
  // Fix the company name in Airtable, or drop the right file into the logo library.
};

// Strip everything that differs between a CRM company name and a logo filename: case,
// accents, punctuation, legal suffixes, and the library's own variant words.
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(colour|color|white|black|dark|light|logo)\b/g, " ")
    .replace(/\b(a\/s|aps|ab|as|oy|gmbh|ltd|limited|inc|llc|bv|srl|vzw|plc|holding|group)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Force every ink colour in an SVG to white.
 *
 * Rewrites hex, rgb() and named colours in `fill`/`stroke`, whether they sit in a presentation
 * attribute or inside a <style> block, and adds a `fill:#fff` on the root so anything relying
 * on the default black inherits white instead.
 *
 * LEFT ALONE on purpose:
 *   fill="none" / stroke="none"   removing these would flood-fill outlined shapes
 *   gradients and images          a <linearGradient> cannot be flattened to white sensibly
 *
 * Caveat, and the reason this is not applied to everything: a MULTI-COLOUR mark becomes a
 * white silhouette. It is the right move for a one- or two-colour wordmark and the wrong move
 * for something like a colour wheel, so it only runs on files already measured as dark.
 */
function whitenSvg(svg) {
  const WHITE = "#ffffff";
  let out = svg
    // fill="#123456" / stroke='rgb(1,2,3)' / fill="black"
    .replace(/(fill|stroke)\s*=\s*"(?!none|url\()[^"]*"/gi, `$1="${WHITE}"`)
    .replace(/(fill|stroke)\s*=\s*'(?!none|url\()[^']*'/gi, `$1='${WHITE}'`)
    // fill:#123456 inside style="" or a <style> block
    .replace(/(fill|stroke)\s*:\s*(?!none|url\()[^;"'}]+/gi, `$1:${WHITE}`);

  // Anything with no fill at all defaults to black, so state white once on the root.
  if (!/<svg[^>]*\sfill\s*=/i.test(out)) {
    out = out.replace(/<svg/i, `<svg fill="${WHITE}"`);
  }
  return out;
}

function loadEnv() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const TOKEN = env.AIRTABLE_TOKEN;
const BASE = env.AIRTABLE_BASE_ID;

async function fetchView() {
  const out = [];
  let offset;
  do {
    const p = new URLSearchParams({ view: VIEW, pageSize: "100" });
    for (const f of ["Company", "Partnership Type 2026", "Put on web"]) p.append("fields[]", f);
    if (offset) p.set("offset", offset);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?${p}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const d = await res.json();
    out.push(...d.records);
    offset = d.offset;
  } while (offset);
  return out;
}

// TWO sources, in priority order. The tbbqvisualgen library is the big curated one and comes
// with a per-file brightness measurement. Auri's Desktop/SVG folder is the newer batch of
// white exports he made for these walls and is NOT in that library, so it is read straight
// off disk — every file in it is a white SVG by construction, hence tone:"light".
const library = JSON.parse(readFileSync(LIB_JSON, "utf8"));
const extra = existsSync(EXTRA_FILES)
  ? readdirSync(EXTRA_FILES)
      .filter((f) => /\.(svg|png|jpe?g|webp)$/i.test(f))
      .map((f) => ({ name: f.replace(/\.[^.]+$/, ""), src: "extra:" + f, tone: "light" }))
  : [];

// name -> entries. A brand can have several files (Acme.svg + Acme White.svg); they collapse
// to the same normalised key and the light one is preferred below.
const byNorm = new Map();
for (const e of [...library, ...extra]) {
  const k = norm(e.name);
  // A name that normalises to nothing must NEVER become a key. The library contains a file
  // called "Inc.svg", and norm() strips "inc" as a legal suffix, so its key was "" — and an
  // empty key prefix-matches every string on earth. That one entry silently claimed 15
  // partners before this guard existed.
  if (!k) continue;
  if (!byNorm.get(k)) byNorm.set(k, []);
  byNorm.get(k).push(e);
}

// Prefer a WHITE/light file, then SVG, then whatever is left. The wall is near-black, so a
// dark logo is worse than a slightly lower-quality light one.
function best(entries) {
  const score = (e) =>
    (e.tone === "light" ? 4 : e.tone === "mixed" ? 1 : 0) + (e.src.endsWith(".svg") ? 2 : 0);
  return entries.reduce((a, b) => (score(b) > score(a) ? b : a), entries[0]);
}

function resolve(company) {
  const manual = MANUAL_FILES[String(company).trim()];
  if (manual && existsSync(manual)) {
    return { name: company, src: "abs:" + manual, tone: "light" };
  }
  const alias = ALIASES[String(company).trim()];
  for (const candidate of [alias, company]) {
    if (!candidate) continue;
    const k = norm(candidate);
    if (byNorm.has(k)) return best(byNorm.get(k));
  }
  // Last resort: a unique prefix match, guarded on length so short names can't collide.
  // Prefix fallback, guarded on BOTH sides: a short library key must not swallow a long
  // company name, and the match has to be unique. Six characters is enough to make a
  // collision unlikely without losing real matches like "Zoku" -> "Zoku Copenhagen".
  const k = norm(company);
  if (k.length >= 6) {
    const hits = [...byNorm.keys()].filter(
      (x) => x.length >= 6 && (x.startsWith(k) || k.startsWith(x))
    );
    if (hits.length === 1) return best(byNorm.get(hits[0]));
  }
  return null;
}

const records = await fetchView();
const partners = records
  .map((r) => ({
    id: r.id,
    company: String(r.fields["Company"] || "").trim(),
    tier: String(r.fields["Partnership Type 2026"] || "").trim(),
    onWeb: r.fields["Put on web"] === true,
  }))
  .filter((p) => p.company && !EXCLUDE_TIERS.has(p.tier));

const manifest = {};
const missing = [];
let dark = 0;

for (const p of partners) {
  const hit = resolve(p.company);
  if (!hit) {
    missing.push(p);
    continue;
  }
  // logoLibrary stores src URL-encoded ("/logos/Aalborg%20Universitet.svg").
  const isAbs = hit.src.startsWith("abs:");
  const fromExtra = hit.src.startsWith("extra:");
  const absPath = isAbs ? hit.src.slice("abs:".length) : null;
  const file = isAbs
    ? absPath.split("/").pop()
    : fromExtra
      ? hit.src.slice("extra:".length)
      : decodeURIComponent(hit.src.replace(/^\/logos\//, ""));
  const srcDir = isAbs ? dirname(absPath) : fromExtra ? EXTRA_FILES : LIB_FILES;
  if (!existsSync(join(srcDir, file))) {
    missing.push({ ...p, note: `library lists ${file} but the file is gone` });
    continue;
  }
  if (hit.tone !== "light") dark++;
  manifest[p.id] = {
    file,
    tone: hit.tone,
    from: isAbs ? absPath : fromExtra ? "desktop-svg" : "library",
  };
}

console.log(`partners in view (excl ${[...EXCLUDE_TIERS].join(" + ")}): ${partners.length}`);
console.log(`matched to a logo file: ${Object.keys(manifest).length}`);
console.log(`  of which NOT light (will look wrong on the dark wall): ${dark}`);
console.log(`unmatched: ${missing.length}`);
for (const m of missing) console.log(`   ${m.company}${m.note ? "  [" + m.note + "]" : ""}`);

const byTier = {};
for (const p of partners) {
  byTier[p.tier || "(no tier)"] ??= { n: 0, logo: 0 };
  byTier[p.tier || "(no tier)"].n++;
  if (manifest[p.id]) byTier[p.tier || "(no tier)"].logo++;
}
console.log("\ntier -> partners / with logo");
for (const [k, v] of Object.entries(byTier).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`   ${k.padEnd(16)}${String(v.n).padStart(3)} / ${String(v.logo).padStart(3)}`);
}

if (!WRITE) {
  console.log("\nDRY RUN. Pass --write to copy the files and write the manifest.");
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
let copied = 0;
let recoloured = 0;
for (const entry of Object.values(manifest)) {
  const srcDir =
    entry.from === "desktop-svg"
      ? EXTRA_FILES
      : entry.from === "library"
        ? LIB_FILES
        : dirname(entry.from); // absolute one-off
  const from = join(srcDir, entry.file);

  // A dark SVG is recoloured on the way in rather than shipped and squinted at. Only SVG can
  // be done this way — a dark PNG has no colours to rewrite, so it still needs a real export.
  if (entry.tone !== "light" && /\.svg$/i.test(entry.file)) {
    const whitened = whitenSvg(readFileSync(from, "utf8"));
    writeFileSync(join(OUT_DIR, entry.file), whitened);
    entry.tone = "light";
    entry.whitened = true;
    recoloured++;
  } else {
    copyFileSync(from, join(OUT_DIR, entry.file));
  }
  copied++;
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log(`\nCopied ${copied} logo file(s) into public/partner-logos/`);
console.log(`Wrote ${MANIFEST}`);
