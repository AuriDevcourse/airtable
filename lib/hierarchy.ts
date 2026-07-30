// Server-only: the manual display order + bio overrides for the 2026 speaker grid.
//
// The order is curated by marketing in the Airtable "Marketing Project Overview"
// table (the same table lib/sync.ts writes the Speaker Hub roster into), NOT in
// Supabase. The website reads speakers from Supabase, so the two are joined here
// on normalized Full Name — see fetchHubSpeakers in lib/hub.ts.
//
// The same row also carries an optional "Bio" cell. Filled in, it WINS over the
// speaker's Supabase biography: the Hub is self-service, so a speaker can leave a
// placeholder ("TBD") there and marketing needs a way to fix the public page without
// editing someone else's Hub profile.
//
// Only "Full Name", "Hierarchy" and "Bio" are ever requested. That table is wide and
// holds unrelated internal project fields; none of them are read.

import { fetchWithTimeout } from "@/lib/http";

const API = "https://api.airtable.com/v0";

// Pinned Airtable ids (stable, not secrets) — same target lib/sync.ts writes to.
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const PROJECT_NAME = "TechBBQ Summit"; // only rows tagged as summit speakers

// Marketing parks everyone who isn't deliberately ranked on 10000 so they sink to the
// bottom of the Airtable view. Anything at or above this is "unranked" to us, and gets
// shuffled rather than ordered.
export const UNRANKED_FROM = 10000;

// Names are the join key between Supabase and Airtable, so both sides must normalize
// identically. Kept in sync with norm() in lib/sync.ts.
export function normName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

// What marketing curates per speaker. Both parts are optional: a row can rank someone
// without a bio override, or override the bio without ranking them.
export type MarketingRow = {
  // 1 = first. Absent = unranked (the UI shuffles those in behind the ranked block).
  rank?: number;
  // Non-empty override for the Supabase biography. Absent = keep the Hub's own text.
  bio?: string;
};

// normalized full name -> curated row. People with neither a rank nor a bio are absent.
export type HierarchyMap = Map<string, MarketingRow>;

// Placeholders speakers type into the Hub instead of leaving the field blank. Treated as
// "no bio" so the card falls back to the marketing override / the empty-state line rather
// than publishing the literal word.
const PLACEHOLDER_BIOS = new Set(["tbd", "tba", "n/a", "na", "-", "—", "todo", "to be added"]);

export function isPlaceholderBio(bio: string): boolean {
  const core = bio.trim().toLowerCase().replace(/[.!]+$/, "").trim();
  // Stripping the trailing punctuation also catches the lone "." someone typed to get
  // past a required field.
  return core === "" || PLACEHOLDER_BIOS.has(core);
}

// filterByFormula makes Airtable scan the whole (wide, growing) Marketing Project
// Overview table, so this call is the slow one — normally ~1s, but it spikes past the
// default 8s fetch timeout on a cold Airtable. When it aborts, the caller drops EVERY
// speaker to unranked and that alphabetical roster gets cached for an hour. So give each
// attempt 10s and retry once: a single latency blip must not un-rank the whole grid.
const HIERARCHY_TIMEOUT_MS = 10_000;
const HIERARCHY_ATTEMPTS = 2;

async function fetchHierarchyMapOnce(token: string, base: string): Promise<HierarchyMap> {
  const map: HierarchyMap = new Map();
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `{Project Name}="${PROJECT_NAME}"`);
    params.set("pageSize", "100");
    params.append("fields[]", "Full Name");
    params.append("fields[]", "Hierarchy");
    params.append("fields[]", "Bio");
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${base}/${TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      HIERARCHY_TIMEOUT_MS
    );

    if (!res.ok) {
      // Detail stays in the server log; the caller decides how to degrade.
      console.error("[hierarchy] fetch failed", res.status, await res.text());
      throw new Error(`Airtable hierarchy fetch failed (${res.status})`);
    }

    const data = (await res.json()) as {
      records: { fields: Record<string, unknown> }[];
      offset?: string;
    };

    for (const rec of data.records) {
      const name = typeof rec.fields["Full Name"] === "string" ? rec.fields["Full Name"] : "";
      const key = normName(name);
      if (!key) continue;

      const rawRank = rec.fields["Hierarchy"];
      const rank =
        typeof rawRank === "number" && Number.isFinite(rawRank) && rawRank < UNRANKED_FROM
          ? rawRank // anything at/above 10000 is the "no opinion" bucket
          : undefined;

      const rawBio = rec.fields["Bio"];
      const bioText = typeof rawBio === "string" ? rawBio.trim() : "";
      const bio = bioText && !isPlaceholderBio(bioText) ? bioText : undefined;

      if (rank === undefined && bio === undefined) continue;

      // Duplicate names would be ambiguous: the lowest rank wins, and the first non-empty
      // bio wins (a second row can still fill in whichever half the first one left blank).
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { rank, bio });
        continue;
      }
      if (rank !== undefined && (prev.rank === undefined || rank < prev.rank)) prev.rank = rank;
      if (bio !== undefined && prev.bio === undefined) prev.bio = bio;
    }
    offset = data.offset;
  } while (offset);

  return map;
}

export async function fetchHierarchyMap(): Promise<HierarchyMap> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return new Map();

  let lastErr: unknown;
  for (let attempt = 1; attempt <= HIERARCHY_ATTEMPTS; attempt++) {
    try {
      return await fetchHierarchyMapOnce(token, base);
    } catch (err) {
      lastErr = err;
      if (attempt < HIERARCHY_ATTEMPTS) {
        console.error(`[hierarchy] attempt ${attempt} failed, retrying`, err);
      }
    }
  }
  throw lastErr;
}
