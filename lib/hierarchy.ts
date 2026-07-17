// Server-only: the manual display order for the 2026 speaker grid.
//
// The order is curated by marketing in the Airtable "Marketing Project Overview"
// table (the same table lib/sync.ts writes the Speaker Hub roster into), NOT in
// Supabase. The website reads speakers from Supabase, so the two are joined here
// on normalized Full Name — see fetchHubSpeakers in lib/hub.ts.
//
// Only "Full Name" and "Hierarchy" are ever requested. That table is wide and holds
// unrelated internal project fields; none of them are read.

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

// normalized full name -> rank (1 = first). Unranked people are simply absent.
export type HierarchyMap = Map<string, number>;

export async function fetchHierarchyMap(): Promise<HierarchyMap> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const map: HierarchyMap = new Map();
  if (!token || !base) return map;

  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", `{Project Name}="${PROJECT_NAME}"`);
    params.set("pageSize", "100");
    params.append("fields[]", "Full Name");
    params.append("fields[]", "Hierarchy");
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(`${API}/${base}/${TABLE}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

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
      const rank = rec.fields["Hierarchy"];
      const key = normName(name);
      if (!key) continue;
      if (typeof rank !== "number" || !Number.isFinite(rank)) continue;
      if (rank >= UNRANKED_FROM) continue; // the 10000 "no opinion" bucket
      // Duplicate names would be ambiguous; first (lowest) rank wins.
      const prev = map.get(key);
      if (prev === undefined || rank < prev) map.set(key, rank);
    }
    offset = data.offset;
  } while (offset);

  return map;
}
