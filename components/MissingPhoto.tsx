// The tile a person gets when their row has no Profile Picture.
//
// DASHBOARD-ONLY, and that is the whole point. Before this, a photoless person rendered as a
// plain grey rectangle that read like a slow-loading image, so nobody could tell a missing
// upload from a broken proxy URL. This says which one it is, the same way the partner wall's
// name tile says "needs a white logo" instead of leaving a hole.
//
// It cannot reach techbbq.dk: the pasted embeds build their own markup in lib/embedSnippet.ts,
// which draws an empty media box for a photoless person and never imports this. A public
// visitor sees no label, and most feeds drop photoless people before the embed anyway.
export function MissingPhoto() {
  return (
    <div className="s-card__img--empty s-card__missing">
      <span>
        No photo
        <br />
        in Airtable
      </span>
    </div>
  );
}
