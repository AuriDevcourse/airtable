// Measures how much of each partner logo's own image box is actually INK.
//
//   node scripts/measure-logo-ink.mjs                 # every partner, worst first
//   node scripts/measure-logo-ink.mjs Skytek Odense   # only rows whose name matches
//
// WHY THIS EXISTS. lib/logoFit.ts equalises logos by scaling each one so its BOUNDING BOX
// covers a constant share of its tile — and for an SVG that box is the viewBox, not the
// artwork. A file exported with generous margins inside its own viewBox therefore renders
// correctly and still looks too small next to its neighbours, which is exactly the complaint
// this script answers ("Skytek and Teknologisk seem too small").
//
// It rasterises each logo, finds the bounding box of the visible pixels, and reports what
// fraction of the image box that ink covers. `suggest` is the LOGO_SCALE nudge that would undo
// the shortfall: the fitter matches area, so the correction is 1/sqrt(inkFraction). Treat it as
// a starting number to check by eye, not a value to paste in blindly — the fitter caps nudges
// at 1.6, and a mark that is genuinely light on ink (a thin outline) reads small for a reason
// the bounding box cannot express.
//
// Reads the live feed, so it measures exactly what the page will draw, whichever source the
// logo came from. Needs the dev server up: BASE=http://localhost:3000 by default.

import sharp from "sharp";

const BASE = process.env.BASE || "http://localhost:3000";
const filters = process.argv.slice(2).map((s) => s.toLowerCase());

// Alpha below this is treated as background. Not zero: SVG edges are antialiased, and counting
// a 1% ghost pixel as ink would put the bounding box back out at the full canvas.
const ALPHA_FLOOR = 24;
// For a logo on an OPAQUE background (the three PNG/JPEG rows), alpha says nothing, so ink is
// whatever differs from the corner pixel's colour instead.
const COLOR_TOLERANCE = 28;
const RASTER = 480; // px wide; enough precision, cheap to decode

async function inkFraction(bytes) {
  const img = sharp(bytes, { density: 300 }).resize({
    width: RASTER,
    fit: "inside",
    withoutEnlargement: false,
  });
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: ch } = info;
  const at = (x, y) => {
    const i = (y * w + x) * ch;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  // Is this image transparent at all? If every corner is opaque, treat the top-left pixel's
  // colour as the background and measure difference from it.
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const opaque = corners.every((c) => c[3] > 250);
  const [br, bg, bb] = corners[0];

  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = at(x, y);
      const ink = opaque
        ? Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) > COLOR_TOLERANCE
        : a >= ALPHA_FLOOR;
      if (!ink) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null; // nothing visible at all
  const fx = (maxX - minX + 1) / w;
  const fy = (maxY - minY + 1) / h;
  // The IMAGE box's aspect ratio, which is what `contain` and lib/logoFit.ts both work from —
  // for an SVG that is the viewBox, margins and all.
  return { fx, fy, area: fx * fy, opaque, imgAr: w / h };
}

const feed = await (await fetch(`${BASE}/api/partners`)).json();
const partners = feed.partners.filter(
  (p) => p.logo && (!filters.length || filters.some((f) => p.company.toLowerCase().includes(f)))
);

const rows = [];
for (const p of partners) {
  const url = p.logo.startsWith("http") ? p.logo : BASE + p.logo;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      rows.push({ company: p.company, err: `HTTP ${res.status}` });
      continue;
    }
    const m = await inkFraction(Buffer.from(await res.arrayBuffer()));
    if (!m) {
      rows.push({ company: p.company, err: "no visible pixels" });
      continue;
    }
    rows.push({
      company: p.company,
      tier: p.tier,
      current: p.scale ?? 1,
      ...m,
      suggest: 1 / Math.sqrt(m.area),
    });
  } catch (e) {
    rows.push({ company: p.company, err: e.message });
  }
}

// ─── HOW BIG A NUDGE IS SAFE ────────────────────────────────────────────────────────────
// Overflow is hidden on the tile, so too large a nudge crops. But what may not be cropped is
// the INK, not the image box: a square file holding a thin wordmark can be scaled well past
// "contain" before any ink reaches an edge, because most of what grows is empty margin. That is
// the whole reason these logos can be fixed with a nudge at all.
//
// So the ceiling is computed from the ink box rather than assumed. The tile's content box is
// 5:3 minus 18px of padding on each side (app/globals.css .lw-logo) — about 1.95:1 at the
// column widths the wall actually uses.
const BOX_AR = 1.95;
// Leave the ink a little clear of the edge, matching how the rest of the wall sits.
const EDGE_MARGIN = 0.94;
// Must match lib/logoFit.ts, or the numbers below describe a page that does not exist.
const TARGET_FILL = 0.55;

// Everything here is a FRACTION OF THE TILE'S CONTENT BOX, which is the only way the two effects
// compose sensibly: the automatic area fitter (which often SHRINKS a logo) and the ink margin
// inside the file. Reporting one without the other is how "why is this small?" stays unanswered
// — Innovation Centre Denmark has no margin at all and is still small, because the fitter takes
// it down to 0.79.
function model(r) {
  const fitW = r.imgAr >= BOX_AR ? 1 : r.imgAr / BOX_AR;
  const fitH = r.imgAr >= BOX_AR ? BOX_AR / r.imgAr : 1;
  // The automatic factor lib/logoFit.ts will apply, same formula and same clamps.
  const auto = Math.max(0.35, Math.min(1, Math.sqrt(TARGET_FILL / (fitW * fitH))));
  // Visible ink, as a share of the box, at auto scale with no nudge.
  const inkW = fitW * r.fx * auto;
  const inkH = fitH * r.fy * auto;
  // The nudge that brings the visible ink AREA up to target...
  const want = Math.sqrt(TARGET_FILL / (inkW * inkH));
  // ...and the largest nudge that keeps the ink inside the tile.
  const cap = EDGE_MARGIN / Math.max(inkW, inkH);
  return { auto, want, cap, use: Math.min(want, cap) };
}

rows.sort((a, b) => (a.area ?? 9) - (b.area ?? 9));
console.log("ink%  w%   h%   AR    auto  now   want  cap   USE   partner");
for (const r of rows) {
  if (r.err) {
    console.log(`  --                                                ${r.company}  [${r.err}]`);
    continue;
  }
  const pct = (v) => String(Math.round(v * 100)).padStart(3);
  const m = model(r);
  // Below 1.15 the difference is not worth a line in LOGO_SCALE; at or under 1 there is nothing
  // to gain, the logo is already as large as the tile allows.
  const flag =
    m.use >= 1.15 ? `  <-- set ${m.use.toFixed(2)}` : m.use <= 1.02 ? "  <-- already maxed" : "";
  console.log(
    `${pct(r.area)}% ${pct(r.fx)} ${pct(r.fy)} ${r.imgAr.toFixed(2).padStart(5)} ` +
      `${m.auto.toFixed(2)}  ${String(r.current).padEnd(5)} ${m.want.toFixed(2)}  ` +
      `${m.cap.toFixed(2)}  ${m.use.toFixed(2)}  ${r.company}${flag}`
  );
}
