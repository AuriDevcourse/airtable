// Server-only: one-way snapshot sync of the live Supabase Speaker Hub into the
// Airtable "Marketing Project Overview" table.
//
// It ADDS speakers who aren't in Airtable yet (matched by normalized Full Name) and REFRESHES
// photos that have changed since they were copied. It never deletes, and it never touches a
// name, title or company on an existing row.
//
// WHY PHOTOS AND NOTHING ELSE (Auri, 2026-08-04). This sync used to be add-only, so whatever a
// profile said the day it was first copied is what Airtable still said forever. Six speakers had
// re-uploaded their headshot since — Saloumeh Sarabi, Andreas Holbak Espersen, Mikkel Bardram,
// Tina Tarighian, Ellie Middleton, Tuomo Riekki — and Airtable kept the old picture.
//
// Text is deliberately left alone. Five speakers also have a title or company that differs, and
// some of those Airtable values may be deliberate corrections; a job running every six hours
// must not silently overwrite a human's edit. Photos carry no such risk — nobody hand-retouches
// an attachment in Airtable — so the hub wins on those unconditionally. Text drift is REPORTED
// in the result instead, for a person to decide about.
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
  // Photos refreshed because the hub file no longer matched Airtable's copy.
  photosUpdated: number;
  photosUpdatedNames: string[];
  // Photos that differ but were left for the next run because of the per-run cap.
  photosDeferred: number;
  // Title/company drift, reported rather than written — see the header.
  textDrift: { name: string; field: string; airtable: string; hub: string }[];
};

// How many photo re-uploads to do in one run. Airtable fetches each image itself, so this is
// the slow part of the job; a cap keeps a mass re-upload from running into the function's time
// limit. Anything over the cap is reported and picked up next run, six hours later.
const MAX_PHOTO_UPDATES = 20;

// Compare-by-size needs the hub's byte count, and a HEAD is enough for that. Kept short: a
// hanging storage request must not take the whole sync down with it.
const HEAD_TIMEOUT_MS = 8000;

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

/** One existing Airtable row, enough of it to decide whether the photo needs refreshing. */
type ExistingRow = {
  id: string;
  name: string;
  /** Bytes of the stored file, or 0 when the row has no photo at all. */
  photoSize: number;
  attachmentCount: number;
  title: string;
  company: string;
};

// Every row already tagged TechBBQ Summit, following Airtable pagination.
//
// This used to read Full Name only, which is why the sync could never do anything but add:
// with no record id and no stored photo it had nothing to compare or patch.
async function fetchExistingRows(token: string, base: string): Promise<Map<string, ExistingRow>> {
  const rows = new Map<string, ExistingRow>();
  const formula = `{Project Name}="${PROJECT_NAME}"`;
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", formula);
    for (const f of ["Full Name", "Profile Picture", "Job Title", "Company"]) {
      params.append("fields[]", f);
    }
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
      records: {
        id: string;
        fields: {
          "Full Name"?: string;
          "Profile Picture"?: { size?: number }[];
          "Job Title"?: string;
          Company?: string;
        };
      }[];
      offset?: string;
    };
    for (const rec of data.records) {
      const nm = rec.fields["Full Name"];
      if (!nm) continue;
      const atts = rec.fields["Profile Picture"] ?? [];
      rows.set(norm(nm), {
        id: rec.id,
        name: nm,
        photoSize: atts[0]?.size ?? 0,
        attachmentCount: atts.length,
        title: rec.fields["Job Title"] ?? "",
        company: rec.fields.Company ?? "",
      });
    }
    offset = data.offset;
  } while (offset);

  return rows;
}

/**
 * Byte size of the hub's current photo, via a HEAD so nothing is downloaded.
 *
 * Size is the comparison because nothing else can be: every hub photo is stored at
 * `<uuid>/avatar.jpg`, so the filename is IDENTICAL for everybody and identical before and
 * after a re-upload. The URL carries a `?t=` upload stamp, but Airtable does not record when
 * an attachment was added, so there is nothing on our side to compare it against. Bytes are.
 *
 * null on any failure, which the caller treats as "cannot tell, leave it alone" — a storage
 * blip must not cause 187 pointless re-uploads.
 */
async function hubPhotoSize(url: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD", cache: "no-store" }, HEAD_TIMEOUT_MS);
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length"));
    return Number.isFinite(len) && len > 0 ? len : null;
  } catch {
    return null;
  }
}

/**
 * Replace the Profile Picture on rows whose hub photo has changed.
 *
 * Setting an attachment field REPLACES the whole array (see the note in this repo's progress
 * log: a PATCH does not append). That is what is wanted here — one headshot per person — and it
 * is only safe because every TechBBQ Summit row carries exactly one attachment; verified before
 * this was written, and re-checked per row below so a future multi-attachment row is skipped
 * rather than silently stripped of its extras.
 */
async function updatePhotos(
  token: string,
  base: string,
  updates: { id: string; name: string; url: string }[]
): Promise<void> {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const records = batch.map((u) => ({
      id: u.id,
      fields: { "Profile Picture": [{ url: u.url }] },
    }));
    const res = await fetchWithTimeout(`${AIRTABLE_API}/${base}/${TARGET_TABLE}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Airtable photo update failed (${res.status}): ${await res.text()}`);
    }
    // Stay well under Airtable's 5 req/s limit.
    await new Promise((r) => setTimeout(r, 250));
  }
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
  const existing = await fetchExistingRows(token, base);

  const seen = new Set<string>();
  const toAdd: NewSpeaker[] = [];
  // Everyone already in Airtable, paired with their hub profile, for the photo comparison.
  const matched: { row: ExistingRow; hubPhoto: string | null; title: string; company: string }[] = [];

  for (const s of hub) {
    const n = norm(s.name);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    const row = existing.get(n);
    if (row) {
      matched.push({ row, hubPhoto: s.photo, title: s.title, company: s.company });
      continue;
    }
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

  // ── PHOTOS ──
  // Sized in parallel but in modest batches: this is 180-odd HEAD requests to Supabase storage
  // and firing them all at once is how a polite reader gets rate-limited.
  const candidates = matched.filter((m) => m.hubPhoto?.startsWith("http") && m.row.photoSize > 0);
  const sizes = new Map<string, number | null>();
  for (let i = 0; i < candidates.length; i += 12) {
    const batch = candidates.slice(i, i + 12);
    const results = await Promise.all(batch.map((m) => hubPhotoSize(m.hubPhoto as string)));
    batch.forEach((m, j) => sizes.set(m.row.id, results[j]));
  }

  const differing = candidates.filter((m) => {
    const hubSize = sizes.get(m.row.id);
    // null = the HEAD failed, so we cannot tell; leave it alone rather than re-upload blindly.
    if (hubSize == null || hubSize === m.row.photoSize) return false;
    if (m.row.attachmentCount > 1) {
      console.warn(
        `[sync-speakers] "${m.row.name}" has ${m.row.attachmentCount} attachments — photo NOT replaced, ` +
          `because writing the field would drop the others. Reduce it to one in Airtable.`
      );
      return false;
    }
    return true;
  });

  const doNow = differing.slice(0, MAX_PHOTO_UPDATES);
  if (doNow.length > 0) {
    await updatePhotos(
      token,
      base,
      doNow.map((m) => ({ id: m.row.id, name: m.row.name, url: m.hubPhoto as string }))
    );
  }

  // ── TEXT DRIFT, reported not written ──
  // Deliberately never overwritten: an Airtable value may be a human's correction, and a job on
  // a six-hour timer must not silently undo one. Surfaced so a person can decide.
  const textDrift: SyncResult["textDrift"] = [];
  for (const m of matched) {
    const pairs: [string, string, string][] = [
      ["Job Title", m.row.title, m.title],
      ["Company", m.row.company, m.company],
    ];
    for (const [field, air, hubVal] of pairs) {
      if ((air || "").trim().toLowerCase() !== (hubVal || "").trim().toLowerCase()) {
        textDrift.push({ name: m.row.name, field, airtable: air, hub: hubVal });
      }
    }
  }

  return {
    hubCount: hub.length,
    existingCount: existing.size,
    added: toAdd.length,
    addedNames: toAdd.map((s) => s.name),
    photosUpdated: doNow.length,
    photosUpdatedNames: doNow.map((m) => m.row.name),
    photosDeferred: differing.length - doNow.length,
    textDrift,
  };
}
