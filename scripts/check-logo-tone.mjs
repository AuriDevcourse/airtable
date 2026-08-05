// Is every published partner logo actually WHITE?
//
//   node scripts/check-logo-tone.mjs            # every published partner, worst first
//   node scripts/check-logo-tone.mjs --all      # list the passes too
//
// WHY THIS IS A SCRIPT AND NOT A RULE IN lib/partners.ts. The wall is #0d0d0d, so its artwork has
// to be a knockout: a white SVG, or a white PNG at worst. lib/partners.ts enforces the FORMAT half
// of that from the record alone, but whiteness is a property of the pixels, and a feed serving
// techbbq.dk cannot fetch and rasterise 104 logos per request to find out.
//
// Filenames are not a substitute, and this dataset is the proof: its darkest file is called
// "Virksomhedsguiden_Logo.svg" (ink luminance 69 out of 255) and a name-based rule shipped it once.
// Another is called "CBN Logo white_CBN logo black (1).png" and contains BOTH lockups in one image.
//
// So run this after any bulk upload to Airtable. Failures are fixed in Airtable by uploading a
// white export; when that is impossible, the row goes in AIRTABLE_LOGO_REJECT in lib/partners.ts
// and a curated white copy stands in.
//
// Reads the LIVE FEED, so it measures exactly what the page draws, whichever source each logo came
// from. Needs the dev server up: BASE=http://localhost:3000 by default.

import sharp from "sharp";

const BASE = process.env.BASE || "http://localhost:3000";
const showAll = process.argv.includes("--all");

// Alpha below this is background, not ink. Not zero: SVG edges are antialiased and a 1% ghost
// pixel counted as ink would drag the average toward the backdrop.
const ALPHA_FLOOR = 24;
// Mean ink luminance, 0-255. A white knockout measures ~250; the near-black offender measured 69.
// 200 is the floor for "white enough on #0d0d0d", 150-200 is the grey zone worth a look.
const WHITE_FLOOR = 200;
const LIGHT_FLOOR = 150;
// A file with no transparent pixels at all is a rectangle, not a knockout: on this wall it draws
// as a visible box around the mark however white the ink is.
const OPAQUE_LIMIT = 0.97;

/** Mean luminance of the visible pixels, and how much of the box they cover. */
async function inkTone(bytes) {
  const { data, info } = await sharp(bytes, { density: 200 })
    .resize({ width: 240, fit: "inside", withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  let ink = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < ALPHA_FLOOR) continue;
    // Rec. 709, the same weighting a contrast check uses.
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    ink++;
  }
  return {
    lum: ink ? sum / ink : null,
    coverage: ink / (info.width * info.height),
  };
}

const res = await fetch(`${BASE}/api/partners`);
if (!res.ok) {
  console.error(`Could not read ${BASE}/api/partners — ${res.status}. Is the dev server up?`);
  process.exit(1);
}
const { partners } = await res.json();

const rows = [];
for (const p of partners) {
  if (!p.logo) {
    rows.push({ ...p, verdict: "no logo at all", lum: null, coverage: null });
    continue;
  }
  try {
    // The feed emits a RELATIVE logo URL in local dev, where PUBLIC_BASE_URL is unset and
    // lib/photo.ts deliberately returns "" as the origin (see baseUrl). Resolve against BASE, or
    // every row comes back as "Failed to parse URL".
    const img = await fetch(new URL(p.logo, BASE));
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    const { lum, coverage } = await inkTone(Buffer.from(await img.arrayBuffer()));
    let verdict;
    if (lum == null) verdict = "nothing visible in the file";
    else if (coverage > OPAQUE_LIMIT) verdict = "opaque background — a box, not a knockout";
    else if (lum >= WHITE_FLOOR) verdict = "ok";
    else if (lum >= LIGHT_FLOOR) verdict = "light, but not white";
    else verdict = "DARK INK — invisible on the wall";
    rows.push({ ...p, verdict, lum, coverage });
  } catch (err) {
    rows.push({ ...p, verdict: `could not read: ${err.message}`, lum: null, coverage: null });
  }
}

const bad = rows.filter((r) => r.verdict !== "ok");
const listed = showAll ? rows : bad;
listed.sort((a, b) => (a.lum ?? -1) - (b.lum ?? -1));

for (const r of listed) {
  const lum = r.lum == null ? "  -" : String(Math.round(r.lum)).padStart(3);
  const cov = r.coverage == null ? "  - " : `${Math.round(r.coverage * 100)}%`.padStart(4);
  console.log(`${r.verdict.padEnd(42)} lum=${lum} ink=${cov}  ${r.company} [${r.tier}]`);
}

console.log(
  `\n${rows.length} published · ${rows.length - bad.length} white · ${bad.length} to fix in Airtable`
);
// Non-zero exit so this can gate a deploy later without rewriting it.
process.exit(bad.length ? 1 : 0);
