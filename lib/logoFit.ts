"use client";

// Makes a wall of logos look evenly sized.
//
// THE PROBLEM. `object-fit: contain` fits a logo to its BOUNDING BOX, and logo bounding boxes
// are wildly different shapes: on the Life Science wall the aspect ratios run from 0.99
// (SmartSens, Blue2 — square) to 5.66 (Immunordic — a long thin wordmark). In a tile that is
// itself about 2:1, a wide wordmark is limited by width and fills the whole tile, while a
// square mark is limited by height and can only ever occupy the middle third. Both are
// "correctly" contained and they look nothing alike.
//
// THE FIX. Scale each logo so the AREA it covers is roughly constant, which is much closer to
// how the eye judges "same size" than matching one edge. A square mark grows, a wide wordmark
// shrinks slightly, and the row reads as one set.
//
// Applied with `transform: scale()` rather than by changing width/height, so the element's
// layout box never moves. The grid keeps its columns and nothing reflows.
//
// The scale is capped at 1: a logo is never blown up past what the tile can contain, because
// enlarging beyond `contain` would crop it. That means an extremely wide mark can still come
// out a little small — it has run out of width — and that is the honest limit of doing this
// without editing the artwork itself.

/** Fraction of the tile's content box a logo should aim to cover. Tuned by eye on the real
 *  sets: lower looks timid, higher makes the wide wordmarks touch the edges. */
const TARGET_FILL = 0.55;

export function fitLogo(img: HTMLImageElement): void {
  // A multi-mark strip (the EU co-funding frieze) opts out: it owns its whole row on purpose,
  // and normalising it to the same area as a single logo would undo that.
  if (img.dataset.nofit) return;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return; // not decoded yet

  // The content box: the element minus its own padding. Read from the computed style so this
  // works no matter which stylesheet set the padding.
  const cs = getComputedStyle(img);
  const boxW = img.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const boxH = img.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  if (boxW <= 0 || boxH <= 0) return;

  // What `contain` would give us.
  const scaleToFit = Math.min(boxW / w, boxH / h);
  const fitW = w * scaleToFit;
  const fitH = h * scaleToFit;
  const fitArea = fitW * fitH;
  if (!fitArea) return;

  const targetArea = boxW * boxH * TARGET_FILL;
  // Never above 1 — see the note about cropping. Never below 0.35 either, so a pathological
  // aspect ratio cannot shrink a logo into nothing.
  let k = Math.max(0.35, Math.min(1, Math.sqrt(targetArea / fitArea)));

  // Per-logo nudge from the feed (LOGO_SCALE in lib/partners.ts), for the handful the area
  // rule cannot judge: it measures the bounding box and cannot see that a file is mostly
  // internal padding, or that a mark is visually heavy for the area it covers. Allowed ABOVE
  // 1 here, unlike the automatic factor, because it is a deliberate human decision. Capped at
  // 1.6 so a typo cannot blow a logo out of its tile; overflow is hidden, so it would crop.
  const nudge = Number(img.dataset.scale);
  if (nudge > 0) k = Math.min(1.6, k * nudge);

  img.style.transform = Math.abs(k - 1) > 0.001 ? `scale(${k.toFixed(3)})` : "";
}

/** Fit every logo under `root`, now and whenever the viewport changes width. Returns a
 *  cleanup function for React effects. */
export function fitLogosIn(root: ParentNode, selector = "img.lw-logo"): () => void {
  const run = () => {
    root.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
      if (img.complete) fitLogo(img);
      else img.addEventListener("load", () => fitLogo(img), { once: true });
    });
  };
  run();

  // Column count changes at the breakpoints, so the tile changes shape and every scale has to
  // be recomputed. Debounced because resize fires continuously while dragging.
  let t: ReturnType<typeof setTimeout>;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(run, 120);
  };
  window.addEventListener("resize", onResize);
  return () => {
    clearTimeout(t);
    window.removeEventListener("resize", onResize);
  };
}
