"use client";

import { useState } from "react";
import { buildPartnersEmbedSnippet } from "@/lib/partnersEmbedSnippet";

// "Copy embed code" for the TechBBQ partner logo wall. Its own builder rather than a prop on
// <CopyEmbed>, for the same reason the Life Science wall has one: nine coloured tier bands of
// logos is not a speaker grid with different options.
//
// __ORIGIN__ is swapped for the live URL here, so copy from the DEPLOYED dashboard: from
// localhost it bakes in localhost and the embed fetches nothing on techbbq.dk.
export function CopyPartnersEmbed({ label }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    // Fresh id per copy so two of these can sit on one WordPress page without their
    // #id-scoped styles and scripts colliding.
    const uid = "tbbq-pw-" + Math.random().toString(36).slice(2, 8);
    const code = buildPartnersEmbedSnippet({ uid }).replace(
      /__ORIGIN__/g,
      window.location.origin
    );
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
