"use client";

import { useState } from "react";
import { embedOrigin } from "@/lib/embedOrigin";
import { buildEventGuideSnippet } from "@/lib/eventGuideSnippet";

// "Copy embed code" for the Event Guide. Its own component rather than a mode on <CopyEmbed>
// because the guide is not a list of people: it has no shuffle, no load-more and no role tabs,
// and the snippet it builds shares none of that machinery.
//
// __ORIGIN__ is swapped here, so copy from the DEPLOYED dashboard. From localhost the snippet
// would bake in a loopback URL, which the guard in lib/embedOriginGuard.ts then has to repair at
// render time on someone else's page.
export function CopyEventGuideEmbed({ label }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    // Fresh id per copy so two guides on one WordPress page cannot share #id-scoped CSS or
    // collide on their tab element ids.
    const uid = "tbbq-eg-" + Math.random().toString(36).slice(2, 8);
    const code = buildEventGuideSnippet({ uid }).replace(/__ORIGIN__/g, embedOrigin());
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
