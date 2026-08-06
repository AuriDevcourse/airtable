// The embed snippets, as plain text.
//
// WHY THIS EXISTS. The copy buttons build their snippet in the BROWSER, which is fine for a
// human pressing a button and useless for anything automated. Pasting a 48KB snippet into the
// Elementor editor by hand is exactly the kind of job that should be fetched, not retyped, so
// this serves the same string the copy button produces, with __ORIGIN__ already resolved.
//
// Read-only and public, like every other feed here, and it exposes nothing new: the identical
// code is visible in the source of any page that has already pasted it.
//
//   /api/embed?kind=brella&section=all   → the whole program, one snippet
//   /api/embed?kind=brella&stage=life-science → ONE stage as its own timeline
//   /api/embed?kind=partners             → the partner logo wall
//   /api/embed?kind=ls-startups          → the Life Science wall
//
// Add ?download=1 to get it as a file rather than inline text.

import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/apiRoute";
import { buildBrellaEmbedSnippet } from "@/lib/brellaEmbedSnippet";
import { buildPartnersEmbedSnippet } from "@/lib/partnersEmbedSnippet";
import { buildLsStartupsEmbedSnippet } from "@/lib/lsStartupsEmbedSnippet";
import { columnSlug, findTimelineColumn, isBrellaSection, TIMELINE_COLUMNS } from "@/lib/brellaSections";
import { baseUrl } from "@/lib/photo";

export const dynamic = "force-dynamic";
export const OPTIONS = corsPreflight;

// A fresh id per request, matching what the copy button does, so two snippets can live on one
// WordPress page without their #id-scoped styles and scripts colliding.
function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const kind = q.get("kind") || "brella";
  // The CALLER's origin, for the CORS header. Not to be confused with `origin` further down,
  // which is this server's own address baked into the snippet.
  const reqOrigin = req.headers.get("origin");

  let snippet: string;
  try {
    if (kind === "brella") {
      const raw = q.get("section") || "all";
      const section = raw === "all" || isBrellaSection(raw) ? raw : "all";
      // ?stage= narrows the timeline to ONE column, for a page that is about a single stage:
      // /api/embed?kind=brella&stage=life-science. It overrides ?section=, because a column
      // already says which section it belongs to. A name that matches nothing is a 400 rather
      // than a silent fall back to the whole board — see findTimelineColumn.
      const stageParam = q.get("stage");
      if (stageParam && !findTimelineColumn(stageParam)) {
        return withCors(
          NextResponse.json(
            {
              error: `Unknown stage "${stageParam}".`,
              stages: Object.values(TIMELINE_COLUMNS)
                .flat()
                .filter(Boolean)
                .map((c) => ({ label: c!.label, slug: columnSlug(c!.label) })),
            },
            { status: 400 }
          ),
          reqOrigin
        );
      }
      snippet = buildBrellaEmbedSnippet({
        section: section as "all",
        uid: uid("tbbq-bp"),
        stage: stageParam ?? undefined,
      });
    } else if (kind === "partners") {
      snippet = buildPartnersEmbedSnippet({ uid: uid("tbbq-pw") });
    } else if (kind === "ls-startups") {
      snippet = buildLsStartupsEmbedSnippet({ uid: uid("tbbq-lsw") });
    } else {
      return withCors(
        NextResponse.json(
          { error: "Unknown kind. Use brella, partners or ls-startups." },
          { status: 400 }
        ),
        reqOrigin
      );
    }
  } catch (err) {
    console.error("[embed] build failed", err);
    return withCors(
      NextResponse.json({ error: "Could not build the snippet." }, { status: 500 }),
      reqOrigin
    );
  }

  // The builders leave __ORIGIN__ for the copy button to swap. Here the server already knows
  // its own address. An EMPTY baseUrl means local dev with no PUBLIC_BASE_URL, and shipping a
  // snippet whose endpoints are relative would silently point them at whatever site pasted it,
  // which is the bug that took down the partner wall. Refuse instead.
  const origin = baseUrl();
  if (!origin) {
    return withCors(
      NextResponse.json(
        { error: "No absolute origin. Set PUBLIC_BASE_URL, or copy from the deployed dashboard." },
        { status: 409 }
      ),
      reqOrigin
    );
  }

  const res = new NextResponse(snippet.replace(/__ORIGIN__/g, origin), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Never cached: the snippet changes with every deploy and a stale one is the whole
      // problem this endpoint exists to avoid.
      "Cache-Control": "no-store",
      ...(q.get("download")
        ? { "Content-Disposition": `attachment; filename="tbbq-${kind}-embed.html"` }
        : {}),
    },
  });
  return withCors(res, reqOrigin);
}
