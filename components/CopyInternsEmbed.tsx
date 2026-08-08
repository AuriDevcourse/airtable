"use client";

import { useState } from "react";
import { buildInternsEmbedSnippet } from "@/lib/internsEmbedSnippet";
import { INTERN_DEPARTMENTS } from "@/lib/internDepartments";

// "Copy embed code" for the intern pool. Same contract as CopyPartnersEmbed: the snippet is built
// client-side and __ORIGIN__ is swapped for this page's origin, so copying from localhost bakes in
// localhost and the pasted block fetches a host WordPress cannot reach.
//
// The department list comes from lib/internDepartments.ts, NOT from lib/interns.ts. That split
// exists for this file: lib/interns.ts reads process.env.AIRTABLE_TOKEN at module scope, and
// importing it from a client component would pull the Airtable fetcher into the browser bundle.
export function CopyInternsEmbed({ department }: { department?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    // Fresh id per copy so two intern blocks on one WordPress page cannot collide.
    const uid = "tbbq-ip-" + Math.random().toString(36).slice(2, 8);
    const code = buildInternsEmbedSnippet({
      uid,
      department,
      departments: INTERN_DEPARTMENTS,
    }).replace(/__ORIGIN__/g, window.location.origin);
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button type="button" className="copy-embed" onClick={copy}>
      {copied ? "Copied" : department ? `Copy embed (${department})` : "Copy embed code"}
    </button>
  );
}
