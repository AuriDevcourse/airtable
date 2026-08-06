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
  /**
   * An optional trailing comment, for the one fact that does not fit in `note` and would
   * otherwise be lost in an email — the partner wall's tier order, say. Mirrors how the
   * all-speakers snippet signs off with what `data.counts` holds.
   */
  tail?: string;
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
  // The wall as DATA, for an agency building in their own framework. The alternative is
  // /api/embed?kind=partners-bare, which ships finished markup — this is for the ones who
  // want the list and will render it themselves.
  partners: {
    path: "/api/partners",
    accessor: "data.partners",
    fields: ["company", "tier", "logo", "website"],
    varName: "partners",
    note: "Every partner on the wall. Only ones with a logo are returned, so nothing needs filtering.",
    // The order trips people up: the feed is ALPHABETICAL, and the sponsorship ranking lives in
    // `tier`, which is a string. Sorting by it needs the ladder, so the response carries it —
    // that is what `data.tiers` is for, and saying so here saves a round of email.
    tail: `// The feed is alphabetical. To rank by sponsorship level, sort on data.tiers, which
// comes back in the response as [{ name: "Prime" }, { name: "Main" }, …] highest first:
// const order = data.tiers.map((t) => t.name);
// partners.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
//
// logo is an absolute URL and safe to hotlink. website is null for a couple of them.`,
  },
};

// Worth stating in the snippet itself: a designer who hits a CORS wall on their staging domain
// has no way to guess that the allowlist is the cause.
const CORS_NOTE = `
// CORS: this connector answers browsers on an ALLOWLIST of origins, set by ALLOWED_ORIGIN on the
// deployment (currently techbbq.dk and staging.techbbq.dk). A browser on any other domain is
// blocked — ask Auri to add yours, it is one comma-separated value. A SERVER-side fetch is not
// subject to this and works from anywhere today.`;

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
}));${spec.tail ? `\n\n${spec.tail}` : ""}`;
}
