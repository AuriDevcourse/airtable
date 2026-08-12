// WHEN IS A SESSION A SHELL AROUND OTHER SESSIONS. One definition, because three places ask.
//
// A shell is a booking whose agenda is drawn inside it: "Future of Fintech" 09:30-13:00 with its
// seven talks, the Creative Business Cup block with its six items. The timeline draws it as a
// dashed band instead of a neighbour, and lib/roomGaps.ts judges a programme's completeness over
// the agenda rather than over the shell's own row.
//
// TWO CONDITIONS, both learned from a specific wrong answer:
//   1. It contains at least two STRICTLY SHORTER sessions. Strictly shorter stops two identical
//      spans swallowing each other; two stops an ordinary back-to-back pair being reinterpreted.
//   2. Those sessions FILL at least half of it. Without this, Google's `Scaling Europe`
//      (12:00-14:45) became a shell the moment the Creative Business Cup was given a 14:00 start,
//      because CBC's first two items (15 and 5 minutes) happen to fall inside it — 20 minutes of
//      165, and the column drew two dashed bands over one agenda (Auri, 2026-08-12).
//
// Fill is measured as the UNION of the contained spans, not the sum: children overlapping each
// other would otherwise count shared minutes twice and could push a coincidence over the line.
//
// A THIRD COPY EXISTS, unavoidably, in lib/brellaEmbedSnippet.ts — that renderer is a string of
// JavaScript sent to WordPress and cannot import this. It carries a comment pointing here. If you
// change the rule, change it there too.

export type Span = { id: string; start: number; end: number };

/** Is `inner` wholly inside `outer` and shorter than it? */
export function contains(outer: Span, inner: Span): boolean {
  return (
    inner.id !== outer.id &&
    inner.start >= outer.start &&
    inner.end <= outer.end &&
    inner.end - inner.start < outer.end - outer.start
  );
}

/** How much of `outer` the given spans cover, 0..1, counting overlapping spans once. */
export function fillOf(outer: Span, inside: Span[]): number {
  if (!inside.length || outer.end <= outer.start) return 0;
  const iv = inside.map((s) => [s.start, s.end] as [number, number]).sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let [lo, hi] = iv[0];
  for (const [s, e] of iv.slice(1)) {
    if (s <= hi) hi = Math.max(hi, e);
    else {
      covered += hi - lo;
      [lo, hi] = [s, e];
    }
  }
  return (covered + (hi - lo)) / (outer.end - outer.start);
}

/** The minimum share of a shell its own agenda has to cover. */
export const SHELL_MIN_FILL = 0.5;

/** Every span in `all` that is a shell around the others. */
export function shellsAmong<T extends Span>(all: T[]): T[] {
  return all.filter((u) => {
    const kids = all.filter((c) => contains(u, c));
    return kids.length >= 2 && fillOf(u, kids) >= SHELL_MIN_FILL;
  });
}
