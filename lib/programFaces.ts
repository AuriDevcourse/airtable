// FACES FOR A HAND-TYPED PROGRAMME, matched by name against the speaker CRM.
//
// The problem this solves. A programme like the Board Summit arrives as a document, so its people
// live in two text cells on the session row ("Speaker Details", "Moderator Details") with a photo
// cell beside them. Those photo cells are filled by hand, per session, in the same order the names
// are typed — get the order wrong and a panel shows the wrong face beside the wrong person. For a
// 14-session programme with 27 people that is 27 uploads nobody wants to do twice.
//
// Meanwhile the same people are rows in Marketing Project Overview, the table the speaker pages
// already read, where a headshot is uploaded ONCE per person. This module joins the two by name, so
// a photo added to the CRM appears in the agenda with no second upload and no ordering to get wrong.
//
// MATCHED ON THE NAME, which is a real limitation and the reason this is opt-in per source: two
// people with the same name would collide, and a name typed differently in the two tables simply
// does not match (the session keeps its initial, which is what it showed before). Accents, case,
// punctuation and double spaces are folded away, so "Bodil Sidén" and "Bodil Siden" agree.
//
// The Sessions cell always WINS where it is filled. Somebody who uploads a face onto the session row
// meant that face for that session, and a CRM headshot must not silently replace it.

import { fetchWithTimeout } from "@/lib/http";
import { firstAttachmentId, str } from "@/lib/fields";
import { photoUrl } from "@/lib/photo";
import type { ProgramSession } from "@/lib/program";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

// Marketing Project Overview — the same table lib/policystage.ts reads, and the `marketing` key in
// lib/photo.ts. Pinned id, stable, not a secret (see lib/niss.ts for why not an env var).
const TABLE = "tblTecOBecLQCNIeD";

// The table is 113 fields wide and full of unrelated internal project data. Two fields is the whole
// allow-list this needs.
const SAFE_FIELDS = ["Full Name", "Profile Picture"];

// Same 10s as the other reads of this table: it is wide and can be slow to scan.
const TIMEOUT_MS = 10_000;

/**
 * Fold a name to a comparison key: lowercase, accents stripped, punctuation dropped, spaces
 * collapsed. "Bodil Sidén" and "bodil siden" agree; "Jan C. Olsen" and "Jan C Olsen" agree.
 *
 * A LEADING TITLE IS NOT PART OF THE NAME. An agenda typed from a document writes "Prof. Philippe
 * Tibi" where the CRM row is filed as "Philippe Tibi", and without this the two never meet — which
 * is exactly what happened to him on the Pension & Insurance Summit. Only stripped from the FRONT,
 * so a surname that happens to be one of these words survives.
 */
const HONORIFIC = /^(prof|professor|dr|doctor|mr|mrs|ms|sir|hon|rt hon)\s+/;

function key(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(HONORIFIC, "");
}

/**
 * name-key → proxied photo URL, for everyone filed under `project` who has a headshot.
 *
 * A name that appears TWICE under the project is dropped rather than resolved to whichever row came
 * back first: an arbitrary face is worse than an initial, because nobody looking at the page can
 * tell it is wrong.
 */
async function fetchOneProject(project: string): Promise<Map<string, string>> {
  const faces = new Map<string, string>();
  if (!TOKEN || !BASE_ID) return faces;

  const seen = new Set<string>();
  const ambiguous = new Set<string>();
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    // Filtered server-side on the project, so a 3.6k-row table never lands in memory here.
    params.set("filterByFormula", `{Project Name}="${project.replace(/"/g, '\\"')}"`);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${TABLE}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" },
      TIMEOUT_MS
    );
    if (!res.ok) {
      // NOT a throw. Faces are an enhancement on top of a programme that already renders; a CRM
      // read that fails must not take the agenda down with it. The caller logs and carries on.
      console.error("[program-faces] fetch failed", res.status, await res.text());
      return faces;
    }

    const data = (await res.json()) as {
      records: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };
    for (const rec of data.records) {
      const k = key(str(rec.fields["Full Name"]));
      if (!k) continue;
      if (seen.has(k)) {
        ambiguous.add(k);
        faces.delete(k);
        continue;
      }
      seen.add(k);
      const att = firstAttachmentId(rec.fields["Profile Picture"]);
      if (!att) continue;
      // Proxied, never the raw attachment URL — those are signed and expire in ~2h (lib/photo.ts).
      faces.set(k, photoUrl("marketing", rec.id, undefined, att));
    }
    offset = data.offset;
  } while (offset);

  if (ambiguous.size) {
    console.info(
      `[program-faces] ${ambiguous.size} name(s) appear more than once under "${project}" and were ` +
        `left without a face: ${[...ambiguous].join(", ")}`
    );
  }
  return faces;
}

/**
 * name-key → photo, across one project or an ORDERED FALLBACK LIST of them.
 *
 * Why a list. A speaker's CRM row is filed under one `Project Name`, and that is not always the
 * project whose agenda they appear on: Yoram Wijngaarde is filed under the LP Forum but keynotes on
 * Investor Day too, and every Nordic Family Office Summit speaker who exists in the CRM at all is
 * filed under an Event Room. Restricted to the programme's own project, those agendas render
 * initials next to people whose headshot is already in the table.
 *
 * FIRST PROJECT WINS, which is what makes this safe to widen. The event's own project is listed
 * first, so a fallback can only fill a gap, never override a face the event itself provides — and
 * one name appearing under two projects (Yoram) resolves to the first rather than being dropped as
 * ambiguous. Ambiguity is still per-project: two rows for the same person inside ONE project is a
 * duplicate to fix in Airtable, and an arbitrary pick would hide it.
 */
export async function fetchProjectFaces(
  project: string | readonly string[]
): Promise<Map<string, string>> {
  const projects = typeof project === "string" ? [project] : project;
  const merged = new Map<string, string>();
  for (const p of projects) {
    for (const [k, url] of await fetchOneProject(p)) {
      if (!merged.has(k)) merged.set(k, url);
    }
  }
  return merged;
}

/**
 * Fill in every missing face on a programme's `onStage` people from the CRM.
 *
 * Mutates nothing: returns new session objects, because the sessions it is handed come out of a
 * process-wide cache and rewriting them in place would leak the substitution into the ungrouped
 * feeds that share the same array.
 */
export function applyFaces(
  sessions: ProgramSession[],
  faces: Map<string, string>
): ProgramSession[] {
  if (!faces.size) return sessions;
  return sessions.map((s) => {
    if (!s.onStage) return s;
    // `?? null` rather than `|| null`: an empty string from the map would otherwise fall through
    // to the initial anyway, but keeping the type honest matters more than the edge case.
    const fill = (list: NonNullable<ProgramSession["onStage"]>["speakers"]) =>
      list.map((p) => (p.photo ? p : { ...p, photo: faces.get(key(p.name)) ?? null }));
    return {
      ...s,
      onStage: {
        speakers: fill(s.onStage.speakers),
        moderators: fill(s.onStage.moderators),
      },
    };
  });
}
