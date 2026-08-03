// "Copy API code" — the little fetch snippet handed to whoever is building techbbq.dk.
//
// This is NOT an embed. The embed builders in this folder ship finished markup for an
// Elementor HTML widget; this ships a few lines of JavaScript for a developer working in their
// own framework, which is what Auri sent the external designer for the main speakers.
//
// The whole reason it is generated rather than written by hand in a message: the ARRAY KEY is
// not the same on every feed. /api/main-speakers answers `{speakers:[…]}`, the event-room and
// investor feeds answer `{people:[…]}`, and /api/all-speakers answers
// `{counts, groups:{speakers, eventRoom, investors}}`. Copying one snippet and swapping the
// URL therefore produces `undefined.map is not a function`, which is a confusing thing to hand
// someone. Each snippet spells out its own shape.

export type ApiSnippetSpec = {
  /** Path on the connector, e.g. "/api/main-speakers". */
  path: string;
  /** How to reach the array in the response, e.g. "data.speakers". */
  accessor: string;
  /** Fields worth mapping. Order is the order they appear in the snippet. */
  fields: string[];
  /** One line above the code saying what comes back. */
  note: string;
  /** Variable name for the result. */
  varName?: string;
};

/** Feeds a front end is likely to want, keyed by the id used on the page. */
export const API_SNIPPETS: Record<string, ApiSnippetSpec> = {
  "main-speakers": {
    path: "/api/main-speakers",
    accessor: "data.speakers",
    fields: ["name", "title", "company", "photo", "linkedin"],
    note: "The 12 headline speakers, in the order the site should show them.",
  },
  "speakers-2026": {
    path: "/api/speakers-2026",
    accessor: "data.speakers",
    fields: ["name", "title", "company", "bio", "photo", "linkedin", "location", "role"],
    note: "Every confirmed 2026 speaker.",
  },
  "event-room-presenters": {
    path: "/api/event-room-presenters",
    accessor: "data.people",
    fields: ["name", "title", "company", "photo", "linkedin", "room", "host"],
    note: "Event room presenters. NOTE the array is `people`, not `speakers`.",
  },
  "investor-speakers": {
    path: "/api/investor-speakers",
    accessor: "data.people",
    fields: ["name", "title", "company", "photo", "linkedin", "event"],
    note: "Investor speakers. NOTE the array is `people`, not `speakers`.",
  },
};

// Worth stating in the snippet itself: a designer who hits a CORS wall on their staging domain
// has no way to guess that the allowlist is the cause.
const CORS_NOTE = `
// CORS: this connector allows ONE origin, set by ALLOWED_ORIGIN on the deployment (currently
// https://techbbq.dk). A browser on any other domain is blocked. Ask Auri to add yours.`;

/**
 * The combined feed. One request returns all three groups, which is what a single "speakers"
 * page usually wants — it saves three round trips and keeps the three lists consistent with
 * each other, since they are read in one pass on the server.
 */
export function buildAllSpeakersSnippet(origin = "__ORIGIN__"): string {
  return `// TechBBQ speakers — one request returns all three groups.
// Shape: { counts: {...}, groups: { speakers, eventRoom, investors } }${CORS_NOTE}
const res = await fetch("${origin}/api/all-speakers");
if (!res.ok) throw new Error("Speakers feed: HTTP " + res.status);
const data = await res.json();

const pick = (p) => ({
  name: p.name,
  title: p.title,
  company: p.company,
  photo: p.photo,       // stable proxy URL, safe to hotlink
  linkedin: p.linkedin, // may be null
});

const speakers  = data.groups.speakers.map(pick);   // every confirmed 2026 speaker
const eventRoom = data.groups.eventRoom.map((p) => ({ ...pick(p), room: p.room, host: p.host }));
const investors = data.groups.investors.map((p) => ({ ...pick(p), event: p.event }));

// data.counts is { speakers, eventRoom, investors } if you just need the numbers.`;
}

/** A single-feed snippet, in the same shape as the one already handed to the designer. */
export function buildApiSnippet(spec: ApiSnippetSpec, origin = "__ORIGIN__"): string {
  const v = spec.varName ?? "people";
  const body = spec.fields.map((f) => `  ${f}: s.${f},`).join("\n");
  return `// ${spec.note}${CORS_NOTE}
const res = await fetch("${origin}${spec.path}");
if (!res.ok) throw new Error("Feed: HTTP " + res.status);
const data = await res.json();

const ${v} = ${spec.accessor}.map((s) => ({
${body}
}));`;
}
