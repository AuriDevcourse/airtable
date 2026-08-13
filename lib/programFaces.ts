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

// The table is 113 fields wide and full of unrelated internal project data. Three fields is the
// whole allow-list this needs. `Role` is a multi-select (Speaker | Moderator | Keynote | Managing
// Partner | Host) and is read for one reason: WHO IS THE EVENT'S HOST. See hostKeys() below.
const SAFE_FIELDS = ["Full Name", "Profile Picture", "Role"];

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
const HONORIFIC = /^(prof|professor|dr|doctor|mr|mrs|ms|sir|hon|rt hon|amb|ambassador)\s+/;

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
 * A MIDDLE NAME IS NOT A DIFFERENT PERSON. A roster people fill in themselves carries the name they
 * sign documents with — "Jamie Thurston Wyngaard", "Jesper Vesten Drescher", "Simon C. Mears" —
 * while the agenda types the name they are announced by. Exact keys never meet, and both pages then
 * show an initial next to a face that is already uploaded.
 *
 * So a second, looser key: FIRST AND LAST WORD ONLY. Tried after the exact key, never instead of it,
 * and a looser key that two different people share is dropped rather than guessed at (see below) —
 * the same rule the exact keys already follow.
 */
function shortKey(k: string): string {
  const parts = k.split(" ").filter(Boolean);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : k;
}

/**
 * FIRST AND SECOND-TO-LAST, for a DOUBLE-BARRELLED SURNAME.
 *
 * shortKey takes the last word, which is the wrong half when the surname has two parts and the
 * agenda announces only the first of them. The Nordic Africa MC signed up as "Natalie Bridgette
 * Becker-Aakervik" and the agenda says "Natalie Becker": shortKey folds the roster entry to
 * "natalie aakervik", so the two never met and her headshot sat one table away from her initial.
 *
 * Registered ALONGSIDE shortKey rather than instead of it, and clash-guarded exactly the same way,
 * so a pair that two people share is dropped rather than guessed at.
 */
function pairKey(k: string): string {
  const parts = k.split(" ").filter(Boolean);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 2]}` : k;
}

/**
 * The keys a NAME ON THE AGENDA may be found by, in the order they are tried: exact first, then the
 * looser ones, so a looser match can only ever fill a gap an exact one left.
 *
 * The last entry drops leading given names — "Charity Wanjiru Kiarie" on the agenda against
 * "Wanjiru Kiarie" in the roster, which is the mirror image of the middle-name case and needs the
 * trimming done on THIS side. Stops at two words: one word is a surname on its own, which is not
 * enough to identify anybody.
 */
function lookupKeys(k: string): string[] {
  const parts = k.split(" ").filter(Boolean);
  const keys = [k, shortKey(k), pairKey(k)];
  if (parts.length > 2) keys.push(parts.slice(1).join(" "));
  return [...new Set(keys)];
}

/**
 * The name as a self-filled roster writes it, folded to a comparison key.
 *
 * Three things the CRM's "Full Name" never has and a sign-up form always does:
 *   "Alvaro Perezcano (Moderator)"  — the ROLE, appended in ROUND brackets
 *   "Sherif Kesseba  [Moderator]"   — the same thing in SQUARE ones
 *   "Adama Ibrahim, EMBA"           — CREDENTIALS, appended after a comma
 * All three are stripped before folding, so they cannot keep a face off the agenda.
 *
 * The square-bracket case was a real miss: only the round form was handled, so his key came out as
 * "sherif kesseba moderator" and could not have matched any agenda spelling of his name. Whoever
 * types the role by hand picks the bracket, so both have to be understood (Auri, 2026-08-13).
 */
function rosterKey(name: string): string {
  return key(name.replace(/[([][^)\]]*[)\]]/g, " ").split(",")[0]);
}

/**
 * name-key → proxied photo URL, for everyone filed under `project` who has a headshot.
 *
 * A name that appears TWICE under the project is dropped rather than resolved to whichever row came
 * back first: an arbitrary face is worse than an initial, because nobody looking at the page can
 * tell it is wrong.
 */
async function fetchOneProject(project: string): Promise<ProjectPeople> {
  const faces = new Map<string, string>();
  const hosts = new Set<string>();
  if (!TOKEN || !BASE_ID) return { faces, hosts };

  const seen = new Set<string>();
  const ambiguous = new Set<string>();
  // Same loose layer the view source has had all along, added here 2026-08-13. applyFaces looks up
  // the exact key and THEN shortKey, but this function only ever stored exact ones, so the second
  // lookup could never hit for a CRM-sourced agenda: "Micha Breakstone" on the LP Forum agenda
  // missed "Micha Y. Breakstone" in the CRM, and "Frederik von Bennigsen" missed "Frederik Runge
  // von Bennigsen", while both headshots sat in the table. Merged LAST, so an exact match always
  // wins over a first-and-last-word one whatever order the records arrived in.
  const loose = new Map<string, string>();
  const looseClash = new Set<string>();
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
      return { faces, hosts };
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

      // The host is recorded on the PERSON, not on the session, so it has to be read here. Both
      // keys are registered because the agenda may type the name without the middle one, exactly
      // as the faces below do.
      const roles = rec.fields["Role"];
      if (Array.isArray(roles) && roles.some((r) => /^host$/i.test(String(r)))) {
        hosts.add(k);
        hosts.add(shortKey(k));
      }

      const att = firstAttachmentId(rec.fields["Profile Picture"]);
      if (!att) continue;
      // Proxied, never the raw attachment URL — those are signed and expire in ~2h (lib/photo.ts).
      const url = photoUrl("marketing", rec.id, undefined, att);
      faces.set(k, url);

      for (const alt of [shortKey(k), pairKey(k)]) {
        if (alt === k) continue;
        // Two people who shorten to the same key make that key useless — "Anna Maria Berg" and
        // "Anna Sofie Berg" both become "anna berg". Neither gets it: an arbitrary face is worse
        // than an initial, because nobody looking at the page can tell it is wrong.
        if (loose.has(alt) && loose.get(alt) !== url) looseClash.add(alt);
        loose.set(alt, url);
      }
    }
    offset = data.offset;
  } while (offset);

  for (const [k, url] of loose) {
    if (!faces.has(k) && !looseClash.has(k)) faces.set(k, url);
  }

  if (ambiguous.size) {
    console.info(
      `[program-faces] ${ambiguous.size} name(s) appear more than once under "${project}" and were ` +
        `left without a face: ${[...ambiguous].join(", ")}`
    );
  }
  return { faces, hosts };
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
): Promise<ProjectPeople> {
  const projects = typeof project === "string" ? [project] : project;
  const faces = new Map<string, string>();
  const hosts = new Set<string>();
  for (const p of projects) {
    const one = await fetchOneProject(p);
    for (const [k, url] of one.faces) {
      if (!faces.has(k)) faces.set(k, url);
    }
    // Unioned, not first-wins: being the host of THIS event is what the flag means, and the event's
    // own project is always first in the list, so a fallback project can only add someone the event
    // itself never named. applyHostRole then only ever uses it on a session that has one person.
    for (const k of one.hosts) hosts.add(k);
  }
  return { faces, hosts };
}

/** What one CRM project yields: the headshots, and who is flagged as a Host. */
export type ProjectPeople = { faces: Map<string, string>; hosts: Set<string> };

/**
 * A CURATED VIEW as the face source, instead of a `Project Name` in the CRM.
 *
 * Why a second shape. Marketing Project Overview is where TechBBQ files its own speakers, but a
 * co-hosted summit collects its people through its own sign-up form: NASS 2026's 45 presenters live
 * in the Ticketing Forms table behind the "Nordic-Africa Summit Presenters" view — the same view
 * lib/nass.ts publishes /nass from — and only 21 of them are in the CRM at all. Pointed at the CRM,
 * that agenda renders initials for more than half the room while every headshot sits one table away.
 *
 * MEMBERSHIP IN THE VIEW IS THE GATE, exactly as in lib/nass.ts: a face reaches the agenda because
 * somebody curated that person into the view, not because a formula matched. Only the two fields
 * named here are ever requested, so the form's emails and free-text answers stay on Airtable.
 */
export type FaceViewSource = {
  table: string;
  view: string;
  nameField: string;
  photoField: string;
  /** The lib/photo.ts feed key that can re-sign attachments from `table`. */
  feed: string;
};

export async function fetchViewFaces(src: FaceViewSource): Promise<Map<string, string>> {
  const faces = new Map<string, string>();
  if (!TOKEN || !BASE_ID) return faces;

  const seen = new Set<string>();
  const ambiguous = new Set<string>();
  // Loose keys are collected separately and merged LAST, so an exact match always wins over a
  // first-and-last-word one, whatever order the records came back in.
  const loose = new Map<string, string>();
  const looseClash = new Set<string>();
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("view", src.view);
    params.set("pageSize", "100");
    for (const field of [src.nameField, src.photoField]) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${src.table}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" },
      TIMEOUT_MS
    );
    if (!res.ok) {
      // Same rule as fetchOneProject: faces are an enhancement, never a reason to fail the agenda.
      console.error("[program-faces] view fetch failed", res.status, await res.text());
      return faces;
    }

    const data = (await res.json()) as {
      records: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };
    for (const rec of data.records) {
      const k = rosterKey(str(rec.fields[src.nameField]));
      if (!k) continue;
      if (seen.has(k)) {
        ambiguous.add(k);
        faces.delete(k);
        continue;
      }
      seen.add(k);
      const att = firstAttachmentId(rec.fields[src.photoField]);
      if (!att) continue;
      const url = photoUrl(src.feed, rec.id, undefined, att);
      faces.set(k, url);

      for (const alt of [shortKey(k), pairKey(k)]) {
        if (alt === k) continue;
        // Two people who shorten to the same key make that key useless — "Anna Maria Berg" and
        // "Anna Sofie Berg" both become "anna berg". Neither gets it.
        if (loose.has(alt) && loose.get(alt) !== url) looseClash.add(alt);
        loose.set(alt, url);
      }
    }
    offset = data.offset;
  } while (offset);

  for (const [k, url] of loose) {
    if (!faces.has(k) && !looseClash.has(k)) faces.set(k, url);
  }

  if (ambiguous.size) {
    console.info(
      `[program-faces] ${ambiguous.size} name(s) appear more than once in view ${src.view} and were ` +
        `left without a face: ${[...ambiguous].join(", ")}`
    );
  }
  return faces;
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
      list.map((p) => {
        if (p.photo) return p;
        // Exact key first, then the looser ones in order — so "Simon Mears" on the agenda finds
        // "Simon C. Mears" in the roster, and never the other way round. See lookupKeys().
        for (const k of lookupKeys(key(p.name))) {
          const hit = faces.get(k);
          if (hit) return { ...p, photo: hit };
        }
        return { ...p, photo: null };
      });
    return {
      ...s,
      onStage: {
        speakers: fill(s.onStage.speakers),
        moderators: fill(s.onStage.moderators),
      },
    };
  });
}

/**
 * ONE PERSON, TWO ROLES — label them by what they are doing in THIS session.
 *
 * The investor events each have a host who also moderates. Marianne Dahl opens the Pension &
 * Insurance Summit alone ("Intro by the Host") and then chairs the opening panel; her CRM row says
 * `Role: Host + Moderator`. The agenda called her a "Speaker" for the intro, because the session
 * row puts her in `Speaker Details` and that is the only thing the label was ever read from.
 *
 * The session already answers the moderator half: whoever is in `Moderator Details` is chairing, and
 * that group is labelled "Moderator" already. So the only thing missing was the opening.
 *
 * THE RULE, deliberately narrow (Auri, 2026-08-13):
 *   they are ALONE on stage — one speaker, no moderators, AND
 *   the session is Opening or Closing Remarks, AND
 *   either the person is flagged `Role: Host` in the CRM, or the SESSION NAME says host
 *     ("Intro by the Host", which is what all four investor agendas call that slot).
 *
 * The solo + type conditions matter on their own. Host-and-alone without the type check would
 * relabel a host's solo KEYNOTE as "Host", wrong in the other direction: Joe Schorge hosts the LP
 * Forum, and if he gives a keynote there he is giving a keynote.
 *
 * TWO SIGNALS for who the host is, because neither is complete. The CRM flag is the durable one and
 * is what Marianne Dahl, Joe Schorge and Trine Hoffensetz Winther are found by. The title is the
 * fallback: the Nordic Family Office Summit runs the identical slot with Zenia W. Francker, who
 * opens alone and then moderates a panel, and nobody in that project has `Role: Host` ticked. A
 * session called "Intro by the Host" with exactly one person on stage has already told us who that
 * person is. Ticking the CRM flag is still worth doing — it survives the title being reworded.
 */
export function applyHostRole(
  sessions: ProgramSession[],
  hosts: Set<string>
): ProgramSession[] {
  return sessions.map((s) => {
    const st = s.onStage;
    if (!st || st.moderators.length > 0 || st.speakers.length !== 1) return s;
    if (!/^(opening|closing)\b/i.test(s.type)) return s;
    const p = st.speakers[0];
    const k = key(p.name);
    const flagged = hosts.has(k) || hosts.has(shortKey(k));
    // \bhost\b, not a substring: it must not fire on a session about "hosting" or a "Host Country"
    // panel. Combined with solo + Opening/Closing above, this is the intro slot and nothing else.
    if (!flagged && !/\bhost\b/i.test(s.name)) return s;
    // Same no-mutation rule as applyFaces: these sessions come out of a shared cache entry.
    return { ...s, onStage: { ...st, speakers: [{ ...p, role: "Host" }] } };
  });
}
