"use client";

import { useState } from "react";
import { buildEmbedSnippet, type EmbedOptions } from "@/lib/embedSnippet";

// Reusable "Copy embed code" button. Give it the feed path + list key and it copies a
// ready-to-paste Elementor snippet targeting exactly that table/role. __ORIGIN__ is swapped
// for the live URL here, so copy from the DEPLOYED dashboard (else it bakes in localhost).
export function CopyEmbed({
  path,
  listKey,
  loadMore,
  mobileLayout,
  gradient,
  modal,
  label,
}: EmbedOptions & { label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    // Fresh id per copy so this block won't clash with any other embed on the same page.
    const uid = "tbbq-" + Math.random().toString(36).slice(2, 8);
    const code = buildEmbedSnippet({ path, listKey, uid, loadMore, mobileLayout, gradient, modal }).replace(
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
