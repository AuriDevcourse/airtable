// Which attachment to use when a logo cell holds several.
//
// Shared by lib/lsstartups.ts (decides whether to publish a logo URL at all) and lib/photo.ts
// (serves the bytes). They MUST agree: if the feed says "this record has a logo" while the
// proxy serves a different attachment, the page renders the wrong file, and if the proxy picks
// something unrenderable the card shows a broken image. One function, both callers.
//
// Written for the real shape of this data. Auri uploaded white SVG variants alongside the
// originals, appended LAST, so "first attachment" (the old rule) served the old colour logo.
// But "last attachment" is wrong too: Rilemo holds logotipo_bianco.svg AND logotipo_nero.svg,
// where nero is the BLACK one and sorts last. So the choice is made on what the file IS, not
// on where it sits in the list.

export type LogoAttachment = {
  // Airtable's stable per-attachment id ("att..."). Used as a cache-busting version in the
  // proxy URL: replace the file in Airtable and the id changes, so the URL changes with it.
  id?: string;
  url?: string;
  filename?: string;
  type?: string;
  thumbnails?: { large?: { url?: string } };
};

// Formats a browser can actually draw. Two startups uploaded an Illustrator .ai and a
// CorelDRAW .cdr; Airtable stores both happily and generates no thumbnail, so they have to be
// excluded here or the card shows a broken-image icon.
const WEB_IMAGE = /^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/i;

// Filename hints for a white/knockout variant, in the languages these startups actually used
// (Italian "bianco" is not hypothetical, it is Rilemo's file).
const WHITE_HINT =
  /(^|[^a-z])(white|bianco|blanco|blanc|weiss|hvid|negative|inverted|knockout)([^a-z]|$)/i;

// ...and for the dark variant, so a black file that happens to sort last never wins.
const DARK_HINT = /(^|[^a-z])(black|nero|noir|negro|schwarz|sort|dark)([^a-z]|$)/i;

// THE PRINT ORIGINAL, which is nobody's web export.
//
// Embankment's cell holds `embankment-logo high res.svg` (measured luminance 19, near-black) and
// `Embankment.svg` (255, perfect). Both are SVG, neither names its colour, so they scored the same and
// the tie fell to upload order — putting a black mark on a #0d0d0d wall (2026-08-05).
//
// A file announcing itself as high-res, print or CMYK is the artwork sent to a printer, and in this
// dataset that is reliably the colour or black one. It is a WEAKER signal than the colour words, on
// purpose: "logo white high res.svg" should still win on its "white", so this only decides ties.
const PRINT_HINT = /(^|[^a-z])(high[\s_-]?res|hi[\s_-]?res|print|cmyk|original)([^a-z]|$)/i;

// MEASURED DUDS: files that win on their name and lose on their content.
//
// Microsoft Danmark's cell holds four files. `white-Microsoft White.svg` takes the white hint and wins,
// and it is white — but its artwork covers 8% of its own canvas, so the mark renders tiny inside a
// mostly empty box. `Micro.svg` beside it is equally white with 43% ink, five times the drawing, and
// scored lower purely because nobody put "white" in its name (measured 2026-08-05, Auri: "Microsoft's
// logo is too small, I uploaded a new one").
//
// Keyed on the FILENAME rather than the company, and that is deliberate: lib/photo.ts serves the bytes
// and calls this function with no idea which company it is looking at. A preference the feed knew and
// the proxy did not would point ?v= at one file while serving another — the exact trap in the header
// above. A filename is all both callers have in common.
//
// Deleting the file in Airtable is the better fix, and then the entry here harmlessly matches nothing.
// Virksomhedsguiden_Logo.svg is the second kind of dud: not empty, but DARK. Measured luminance 69 —
// near-black ink on a #0d0d0d wall. Auri uploaded virksomhedsguiden.svg beside it (luminance 255), and
// the two tie at score 5 because both are SVG and neither filename mentions its colour, so upload
// order would hand the wall the invisible one (2026-08-05).
//
// This file is also why AIRTABLE_LOGO_REJECT existed for that company. With the dark file demoted the
// picker gets it right, so the reject entry is gone and Airtable is the source again.
const DEMOTED_FILES = new Set(["white-Microsoft White.svg", "Virksomhedsguiden_Logo.svg"]);

function score(a: LogoAttachment): number {
  const name = a.filename ?? "";
  if (DEMOTED_FILES.has(name)) return -100;
  let s = 0;
  // SVG outranks a raster even one named "white", because in this dataset the SVGs ARE the
  // white set: Auri exported them specifically for this wall and every one is fill:#fff.
  // Concretely, Walther has both "Logo in white.png" (450 kB) and a white SVG (11 kB); the
  // name hint alone used to pick the PNG. Vector also stays crisp at any size.
  if (/svg/i.test(a.type ?? "")) s += 5;
  // Then the filename hint, which is what separates two files of the SAME format.
  if (WHITE_HINT.test(name)) s += 4;
  // ...and demotes the dark twin, so Rilemo's logotipo_nero.svg never beats logotipo_bianco.
  if (DARK_HINT.test(name)) s -= 4;
  // Weaker than the colour words by design: it breaks a tie between two files that look identical to
  // the scorer, and never overrides an explicit "white".
  if (PRINT_HINT.test(name)) s -= 2;
  return s;
}

/**
 * The best attachment to render, or null when none can be drawn.
 *
 * Ties keep upload order, so the result is stable across requests — a logo that silently
 * changed between two page loads would be worse than either choice.
 */
export function pickLogo(v: unknown): LogoAttachment | null {
  if (!Array.isArray(v)) return null;
  const usable = (v as LogoAttachment[]).filter((a) => WEB_IMAGE.test(a?.type ?? ""));
  if (usable.length === 0) return null;
  let best = usable[0];
  for (const a of usable.slice(1)) if (score(a) > score(best)) best = a;
  return best;
}

/**
 * The URL to serve for a chosen attachment.
 *
 * Vector keeps its original URL: Airtable's thumbnails are rasterised PNGs, so taking one
 * would throw away the reason the SVG was uploaded. Rasters take the large thumbnail, which
 * is plenty for a logo and much smaller than a print-resolution original.
 */
export function logoUrl(a: LogoAttachment): string | null {
  if (/svg/i.test(a.type ?? "")) return a.url ?? null;
  return a.thumbnails?.large?.url || a.url || null;
}
