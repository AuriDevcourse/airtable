"use client";

import { useState } from "react";
import { embedOrigin } from "@/lib/embedOrigin";
import { buildPartnersEmbedSnippet } from "@/lib/partnersEmbedSnippet";
import { buildPartnersBareEmbedSnippet } from "@/lib/partnersBareEmbedSnippet";

// "Copy embed code" for the TechBBQ partner logo wall. Its own builder rather than a prop on
// <CopyEmbed>, for the same reason the Life Science wall has one: nine coloured tier bands of
// logos is not a speaker grid with different options.
//
// `bare` swaps in the unstyled builder — same data, no TechBBQ design — for handing to an
// outside agency who will write their own CSS. See lib/partnersBareEmbedSnippet.ts.
//
// __ORIGIN__ is swapped for the live URL here. It used to be window.location.origin, which
// baked in http://localhost:3000 when copied locally and left the wall on techbbq.dk stuck on
// "Loading…" forever. embedOrigin() refuses to hand out a loopback origin.
export function CopyPartnersEmbed({ label, bare }: { label?: string; bare?: boolean }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    // Fresh id per copy so two of these can sit on one WordPress page without their
    // #id-scoped styles and scripts colliding. Distinct prefixes so a page carrying both
    // the branded wall and a bare one cannot collide either.
    const uid =
      (bare ? "tbbq-pb-" : "tbbq-pw-") + Math.random().toString(36).slice(2, 8);
    const build = bare ? buildPartnersBareEmbedSnippet : buildPartnersEmbedSnippet;
    const code = build({ uid }).replace(/__ORIGIN__/g, embedOrigin());
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button type="button" className="copy-embed" onClick={copy}>
      {copied ? "Copied" : label || "Copy embed code"}
    </button>
  );
}
