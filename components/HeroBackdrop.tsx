// Static TechBBQ brand background for the hero. Replaces the animated orb blob with
// one of the brand-kit landscape gradients. A dark scrim keeps hero text readable and
// a bottom fade blends into the page background. Pure decoration.
export function HeroBackdrop({ image }: { image: string }) {
  return (
    <div className="herobg" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="herobg__img" src={image} alt="" />
      <div className="herobg__scrim" />
      <div className="herobg__fade" />
    </div>
  );
}
