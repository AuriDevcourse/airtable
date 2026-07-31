"use client";

import { useState } from "react";
import { buildEventEmbedSnippet, type EventEmbedOptions } from "@/lib/eventEmbedSnippet";

// "Copy embed code" button for the Side Events & Event Rooms grid. Separate from
// <CopyEmbed> because the event snippet is its own builder (see lib/eventEmbedSnippet.ts).
// __ORIGIN__ is swapped for the live URL here, so copy from the DEPLOYED dashboard — from
// localhost it bakes in localhost and the embed fetches nothing on techbbq.dk.
export function CopyEventEmbed({
  path,
  kindTabs,
  transparent,
  columns,
  label,
}: EventEmbedOptions & { label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    // Fresh id per copy so this block can sit on the same WordPress page as another one.
    const uid = "tbbq-ev-" + Math.random().toString(36).slice(2, 8);
    const code = buildEventEmbedSnippet({ path, uid, kindTabs, transparent, columns }).replace(
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
