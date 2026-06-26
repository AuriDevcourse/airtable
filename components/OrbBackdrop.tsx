// Two blurred gradient orbs drifting behind a band. Pure decoration.
export function OrbBackdrop({ fade = true }: { fade?: boolean }) {
  return (
    <div className="orbs" aria-hidden>
      <span className="orbs__orb orbs__orb--a" />
      <span className="orbs__orb orbs__orb--b" />
      {fade && <div className="orbs__fade" />}
    </div>
  );
}
