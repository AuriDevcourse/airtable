"use client";

import { useState } from "react";
import { embedOrigin } from "@/lib/embedOrigin";
import {
  API_SNIPPETS,
  buildAllSpeakersSnippet,
  buildApiSnippet,
} from "@/lib/apiSnippet";

// "Copy API code" — a few lines of fetch JavaScript for whoever is building the front end,
// as opposed to "Copy embed code", which ships finished markup for an Elementor widget.
//
// Same origin rule as the embeds: __ORIGIN__ becomes embedOrigin() at copy time, which is
// this page's origin on the deployed dashboard and the deployed connector when you copy from
// localhost. See lib/embedOrigin.ts.
export function CopyApiSnippet({
  feed,
  label,
}: {
  /** A key of API_SNIPPETS, or "all-speakers" for the combined feed. */
  feed: keyof typeof API_SNIPPETS | "all-speakers";
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const origin = embedOrigin();
    const code =
      feed === "all-speakers"
        ? buildAllSpeakersSnippet(origin)
        : buildApiSnippet(API_SNIPPETS[feed], origin);
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button type="button" className="copy-embed copy-embed--api" onClick={copy}>
      {copied ? "Copied" : label || "Copy API code"}
    </button>
  );
}
