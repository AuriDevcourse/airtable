// Server-only: one-way snapshot sync of the live Supabase Speaker Hub into the
// Airtable "Marketing Project Overview" table. Idempotent — it only ADDS speakers
// who aren't already in Airtable (matched by normalized Full Name). It never edits
// or deletes existing rows, so it is safe to run on a schedule.
//
// Read side reuses fetchHubSpeakers (same PII-stripped view the public feed uses).
// Write side needs a token with data.records:write on the base.

import { fetchHubSpeakers } from "@/lib/hub";
import { UNRANKED_FROM } from "@/lib/hierarchy";
import { fetchWithTimeout } from "@/lib/http";

// Pinned Airtable target (stable IDs, not secrets).
const TARGET_TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const PROJECT_NAME = "TechBBQ Summit"; // tag applied to every imported row
const AIRTABLE_API = "https://api.airtable.com/v0";

export type SyncResult = {
  hubCount: number;
  existingCount: number;
  added: number;
  addedNames: string[];
};

function norm(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

function requireEnv(): { token: string; base: string } {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) {
    throw new Error("AIRTABLE_TOKEN or AIRTABLE_BASE_ID is not set on the server.");
  }
  return { token, base };
}

// All Full Names already tagged TechBBQ Summit, following Airtable pagination.
async function fetchExistingNames(token: string, base: string): Promise<Set<string>> {
  const names = new Set<string>();
  const formula = `{Project Name}="${PROJECT_NAME}"`;
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", formula);
    params.append("fields[]", "Full Name");
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${AIRTABLE_API}/${base}/${TARGET_TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      throw new Error(`Airtable read failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as {
      records: { fields: { "Full Name"?: string } }[];
      offset?: string;
    };
    for (const rec of data.records) {
      const nm = rec.fields["Full Name"];
      if (nm) names.add(norm(nm));
    }
    offset = data.offset;
  } while (offset);

  return names;
}

type NewSpeaker = {
  name: string;
  title: string;
  company: string;
  linkedin: string | null;
  photo: string | null;
};

async function createRecords(
  token: string,
  base: string,
  speakers: NewSpeaker[]
): Promise<void> {
  // Airtable caps createRecords at 10 per request.
  for (let i = 0; i < speakers.length; i += 10) {
    const batch = speakers.slice(i, i + 10);
    const records = batch.map((s) => {
      const fields: Record<string, unknown> = {
        "Full Name": s.name,
        "Project Name": PROJECT_NAME,
        // New arrivals are never top speakers — park them in the unranked bucket so they
        // join the random tail on the website and sink to the bottom of the Airtable view.
        // The top 30 are curated by hand; promoting someone means editing this by hand too.
        Hierarchy: UNRANKED_FROM,
      };
      if (s.title) fields["Job Title"] = s.title;
      if (s.company) fields["Company"] = s.company;
      if (s.linkedin && s.linkedin.startsWith("http")) {
        fields["LinkedIn Handle"] = s.linkedin;
      }
      if (s.photo && s.photo.startsWith("http")) {
        fields["Profile Picture"] = [{ url: s.photo }];
      }
      return { fields };
    });

    const res = await fetchWithTimeout(`${AIRTABLE_API}/${base}/${TARGET_TABLE}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records, typecast: true }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Airtable write failed (${res.status}): ${await res.text()}`);
    }
    // Stay well under Airtable's 5 req/s limit.
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function syncSpeakersToAirtable(): Promise<SyncResult> {
  const { token, base } = requireEnv();

  const hub = await fetchHubSpeakers();
  const existing = await fetchExistingNames(token, base);

  const seen = new Set<string>();
  const toAdd: NewSpeaker[] = [];
  for (const s of hub) {
    const n = norm(s.name);
    if (!n || existing.has(n) || seen.has(n)) continue;
    seen.add(n);
    toAdd.push({
      name: s.name,
      title: s.title,
      company: s.company,
      linkedin: s.linkedin,
      photo: s.photo,
    });
  }

  if (toAdd.length > 0) {
    await createRecords(token, base, toAdd);
  }

  return {
    hubCount: hub.length,
    existingCount: existing.size,
    added: toAdd.length,
    addedNames: toAdd.map((s) => s.name),
  };
}
