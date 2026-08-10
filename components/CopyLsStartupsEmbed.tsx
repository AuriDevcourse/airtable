"use client";

import { useState } from "react";
import { embedOrigin } from "@/lib/embedOrigin";
import { buildLsStartupsEmbedSnippet } from "@/lib/lsStartupsEmbedSnippet";

// "Copy embed code" for the Life Science startup logo wall. Its own builder rather than a
// prop on <CopyEmbed>, because a three-row logo wall is not a speaker grid with different
// options — no names, no cards, no load-more, and a coloured row heading per category.
//
// __ORIGIN__ is swapped for the live URL here, so copy from the DEPLOYED dashboard: from
// localhost it bakes in localhost and the embed fetches nothing on techbbq.dk.
export function CopyLsStartupsEmbed({ label }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    // Fresh id per copy so two of these can sit on the same WordPress page without their
    // #id-scoped styles and scripts colliding.
    const uid = "tbbq-lsw-" + Math.random().toString(36).slice(2, 8);
    const code = buildLsStartupsEmbedSnippet({ uid }).replace(
      /__ORIGIN__/g,
      embedOrigin()
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
