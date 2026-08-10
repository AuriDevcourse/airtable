"use client";

import { useState } from "react";
import { embedOrigin } from "@/lib/embedOrigin";
import { buildBrellaEmbedSnippet } from "@/lib/brellaEmbedSnippet";
import type { BrellaSection } from "@/lib/brellaSections";

// "Copy embed code" for one section of the Brella program. Separate from <CopyEmbed> and
// <CopyEventEmbed> because the program snippet is its own builder — day groups, a session
// dialog and a speaker list are not a speaker grid with different props.
//
// __ORIGIN__ is swapped for the live URL here, so copy from the DEPLOYED dashboard: from
// localhost it bakes in localhost and the embed fetches nothing on techbbq.dk.
export function CopyBrellaEmbed({
  section,
  label,
  stage,
}: {
  /** A single section, or "all" for the whole program with its own section switcher. */
  section: BrellaSection | "all";
  label?: string;
  /**
   * One column by label, e.g. "Life Science x Deep Tech Stage" — a snippet for a page that is
   * about a single stage. Overrides `section`, and drops the track pills and the phone picker,
   * both of which would be a menu of one.
   */
  stage?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    // Fresh id per copy so two sections can sit on the same WordPress page without their
    // #id-scoped styles and their scripts colliding.
    const uid = "tbbq-bp-" + Math.random().toString(36).slice(2, 8);
    const code = buildBrellaEmbedSnippet({ section, uid, stage }).replace(
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
