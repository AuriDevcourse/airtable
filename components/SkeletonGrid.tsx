// Placeholder cards shown on a cold load (no cache yet). Same shape as a real
// card so the layout doesn't shift when real data swaps in.
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid-cards" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div className="s-card" key={i}>
          <div className="s-card__img--empty shimmer" />
          <div className="s-card__body">
            <div className="skel-line shimmer" style={{ width: "70%" }} />
            <div className="skel-line shimmer" style={{ width: "45%", marginTop: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
