"use client";

import { useState } from "react";
import {
  API_SNIPPETS,
  buildAllSpeakersSnippet,
  buildApiSnippet,
} from "@/lib/apiSnippet";

// "Copy API code" — a few lines of fetch JavaScript for whoever is building the front end,
// as opposed to "Copy embed code", which ships finished markup for an Elementor widget.
//
// Same origin rule as the embeds: __ORIGIN__ becomes window.location.origin at copy time, so
// copying from localhost hands someone a snippet pointing at localhost. Copy from the deployed
// dashboard.
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
    const origin = window.location.origin;
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
