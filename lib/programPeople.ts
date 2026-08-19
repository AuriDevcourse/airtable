// WHO IS ON STAGE AT EACH PROJECT, derived from that project's own agenda.
//
// WHY THIS IS NOT ANOTHER AIRTABLE FEED. Every roster page in this dashboard reads a table where
// somebody registered: the Speaker Hub, the CRM, a presenter form. The projects around the Summit
// increasingly do NOT work that way — Denmark-Sweden's twelve people are Øresundsinstituttet's
// guests, typed straight onto the session rows with their headshots attached there, and they appear
// in no roster anywhere. Asked for "the speakers for the Denmark-Sweden Summit", there is no table
// to point at. The agenda IS the roster.
//
// So this module reads the same programme feed /program already renders (lib/program.ts, one entry
// per project in PROGRAM_SOURCES) and turns its per-session line-ups into one list of PEOPLE:
// deduplicated, each carrying the sessions that bill them. That makes every project a speaker grid
// for free — Denmark-Sweden today, and the nine others the same afternoon — with no new table, no
// new sync and no second copy of anyone's headshot.
//
// It costs no extra Airtable read either: the route reuses the `program:<source>` cache entry that
// /api/program already fills.

import { fetchWithTimeout } from "@/lib/http";
import { escFormula, firstAttachmentId, linkedinUrl, str } from "@/lib/fields";
import { photoUrl } from "@/lib/photo";
import {
  fetchProgram,
  PROGRAM_SOURCES,
  type ProgramSession,
  type ProgramSourceKey,
} from "@/lib/program";
import { foldName } from "@/lib/programFaces";

/**
 * TWO ROLES, which is what the agendas actually mark.
 *
 * The programme feed is richer than this — Brella carries "Panelist", "Keynote speaker" and
 * "Facilitator", and lib/programFaces.ts marks the one event host who opens alone as "Host". All of
 * them are folded into Speaker here: on a page whose question is "who is on stage", a panelist and a
 * keynote are the same answer, and the only distinction worth printing is who is CHAIRING.
 */
export const PROGRAMME_ROLES = ["Speaker", "Moderator"] as const;
export type ProgrammeRole = (typeof PROGRAMME_ROLES)[number];

/**
 * One person on a project's line-up, shaped like every other roster feed here (name, title,
 * company, photo, linkedin) so the existing card grid and the Elementor embed builder render it with
 * no special case — see lib/embedSnippet.ts.
 */
export type ProgrammePerson = {
  id: string;
  name: string;
  /**
   * The billing line as the agenda writes it.
   *
   * A hand-typed session cell holds ONE string: "Secretary General, Nordic Council of Ministers",
   * "CEO & Founder at Flatpay", sometimes just "Moneycontrol". Splitting that into title and company
   * would be guesswork — "at" is not always the separator and a comma appears inside titles — so the
   * whole line goes in `title` and `company` stays empty. The card then prints exactly what the
   * agenda prints, which is also what the organisers approved.
   *
   * Brella-sourced sessions are the exception: they carry the two fields separately, so both are
   * filled and the card shows "Title · Company" as it does everywhere else.
   */
  title: string;
  company: string;
  photo: string | null;
  /**
   * From the CRM row, when the person has one — a session row carries no LinkedIn cell of its own.
   * See enrichFromCrm below. Null when nobody has filed them yet, and the card is then simply not a
   * link.
   */
  linkedin: string | null;
  role: ProgrammeRole;
  /**
   * The label printed above the name on a card: "Moderator", and nothing at all for a speaker.
   *
   * ONE GRID, NOT TWO TABS (Auri, 2026-08-19). A project's chair belongs with the line-up rather than
   * behind a switch — Denmark-Sweden has one moderator, and a tab holding a single card is a click
   * that hides a person. `tag` is the field the card grid and the embed already print above a name
   * (lib/embedSnippet.ts), so this needs no new markup on either side.
   */
  tag?: ProgrammeRole;
  /**
   * The sessions that bill this person, in agenda order.
   *
   * NOT SHOWN ON THE CARDS (Auri, 2026-08-19: name, job title and company only). Kept in the feed
   * because it is what ties this roster back to /program and costs one array per person.
   */
  sessions: string[];
};

/**
 * THE PROJECTS, in the order /program shows its tabs.
 *
 * Kept here rather than in the page so the API can validate against the same list, and deliberately
 * NOT the whole of PROGRAM_SOURCES: `brella` is the Summit's own schedule (its roster is
 * /all-speakers-2026, a much better answer) and `techbbq` is a legacy table with no people on it.
 *
 * app/program/page.tsx keeps its own EVENTS array for the agenda side, because each entry there also
 * carries a theme, a heading and an embed's worth of design. Labels must match between the two.
 */
export const PROGRAMME_PROJECTS: { key: ProgramSourceKey; label: string }[] = [
  { key: "niss", label: "NISS 2026" },
  { key: "nass", label: "NASS 2026" },
  { key: "fintech", label: "Future of Fintech" },
  { key: "policy", label: "The Policy Stage" },
  { key: "board", label: "Board Summit" },
  { key: "pension-summit", label: "Pension & Insurance Summit" },
  { key: "family-office", label: "Nordic Family Office Summit" },
  { key: "lp-forum", label: "LP Forum" },
  { key: "investor-day", label: "TechBBQ Investor Day" },
  { key: "denmark-sweden", label: "Denmark-Sweden Summit" },
];

/** Whether a string is a project this module will serve. */
export function isProgrammeProject(v: string | null): v is ProgramSourceKey {
  return Boolean(v) && PROGRAMME_PROJECTS.some((p) => p.key === v) && v! in PROGRAM_SOURCES;
}

/** The label for a project key, for a page heading or an error message. */
export function projectLabel(key: ProgramSourceKey): string {
  return PROGRAMME_PROJECTS.find((p) => p.key === key)?.label ?? key;
}

type Draft = ProgrammePerson & { metaSeen: string[] };

/**
 * Flatten an agenda into its people.
 *
 * ONE ENTRY PER PERSON PER ROLE, not per session. Trine Grönlund moderates all six Denmark-Sweden
 * content sessions and Sander Janca-Jensen speaks in two Fintech ones; a grid that repeated them
 * would be reporting the schedule, not the line-up. Names are matched with the same fold the face
 * lookup uses (accents, punctuation and a leading honorific ignored), so "Dr. Rajneesh" and
 * "Rajneesh" are one person rather than two cards.
 *
 * A person who both chairs one session and speaks in another gets ONE entry per role, so they can
 * appear twice on a grid that shows everyone — once labelled Moderator, once not. That is truthful
 * rather than tidy: they really are doing both jobs, and merging the two would have to throw one away.
 */
export function peopleFromSessions(sessions: ProgramSession[]): ProgrammePerson[] {
  const byId = new Map<string, Draft>();

  const add = (
    role: ProgrammeRole,
    session: string,
    p: { name: string; title: string; company: string; photo: string | null }
  ) => {
    const name = p.name.trim();
    if (!name) return;
    const id = `${role.toLowerCase()}-${foldName(name).replace(/ /g, "-") || "unnamed"}`;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        id,
        name,
        title: p.title.trim(),
        company: p.company.trim(),
        photo: p.photo,
        linkedin: null,
        role,
        // Speakers carry no tag: on a grid that is mostly speakers, labelling every one of them
        // says nothing, and the label exists to mark the exception.
        ...(role === "Moderator" ? { tag: role } : {}),
        sessions: session ? [session] : [],
        metaSeen: [p.title.trim()],
      });
      return;
    }
    // THE FULLEST VERSION WINS. The same person is billed "Founder at Lunar" on one row and "Lunar"
    // on the next, because two people typed the two rows. Taking the longest line means a card is
    // never worse than the best cell the organisers wrote, and it is stable: the answer does not
    // depend on which session happens to come first.
    if (p.title.trim().length > existing.title.length) existing.title = p.title.trim();
    if (p.company.trim().length > existing.company.length) existing.company = p.company.trim();
    // First face wins, and only a real one replaces an absent one — a later empty cell must not
    // blank a headshot that is already found.
    if (!existing.photo && p.photo) existing.photo = p.photo;
    if (session && !existing.sessions.includes(session)) existing.sessions.push(session);
  };

  for (const s of sessions) {
    // THE HAND-TYPED PROGRAMMES (Policy Stage, NASS, Fintech, the Day 0s, Denmark-Sweden). One
    // string per person, so it all goes in `title` — see the field's own note above.
    if (s.onStage) {
      for (const m of s.onStage.moderators) {
        add("Moderator", s.name, { name: m.name, title: m.meta, company: "", photo: m.photo });
      }
      for (const p of s.onStage.speakers) {
        add("Speaker", s.name, { name: p.name, title: p.meta, company: "", photo: p.photo });
      }
    }
    // BRELLA-SOURCED SESSIONS carry a proper speaker record with the role on the assignment, so the
    // split is on that rather than on which cell the name sat in.
    for (const p of s.speakers ?? []) {
      add(p.role === "Moderator" ? "Moderator" : "Speaker", s.name, {
        name: p.name,
        title: p.title,
        company: p.company,
        photo: p.photo,
      });
    }
  }

  // MODERATORS FIRST, then agenda order — the order the first session that bills them appears in.
  // Deliberately not shuffled like the CRM rosters: on a twelve-person programme the running order IS
  // the useful order, and now that both roles share one grid the chair opens it, as they open the day.
  const people = [...byId.values()].map(({ metaSeen: _metaSeen, ...person }) => person);
  return [
    ...people.filter((p) => p.role === "Moderator"),
    ...people.filter((p) => p.role !== "Moderator"),
  ];
}

// --- THE CRM LAYER ---------------------------------------------------------------------------------
//
// THE AGENDA SAYS WHO IS ON STAGE, THE CRM SAYS WHO THEY ARE (Auri, 2026-08-19).
//
// A session cell is written to be READ ALOUD: "CEO at Oresundsinstituttet", one string, no LinkedIn,
// and a moderator whose cell is blank because the organisers never billed her. The CRM row for the
// same person has the fields kept separately by the people whose job that is: Job Title, Company,
// LinkedIn, a headshot. So the roster takes its NAMES and its ROLES from the agenda, and everything
// else from the CRM wherever a row exists.
//
// Nobody is dropped for having no CRM row: the agenda's own line is the fallback, which is what keeps
// the nine other projects rendering as before while Denmark-Sweden gains proper titles and links.

const CRM_API = "https://api.airtable.com/v0";
const CRM_TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
// Same 10s as every other read of this table (3k+ rows, 114 fields, slow to scan cold).
const CRM_TIMEOUT_MS = 10_000;

// Only these fields are ever requested. The table holds unrelated internal project data and none of
// it is this feed's business. BOTH LinkedIn columns, because linkedinUrl() reads them in preference
// order and Airtable returns nothing you did not ask for.
const CRM_FIELDS = [
  "Full Name",
  "Job Title",
  "Company",
  "Profile Picture",
  "Link to LinkedIn",
  "LinkedIn Handle",
];

/**
 * WHICH `Project Name` VALUES IN THE CRM HOLD A PROJECT'S PEOPLE.
 *
 * The CRM files people under its own project options, which are NOT the agenda's `Name of the Event`
 * strings: Future of Fintech's speakers sit under "Event Room 3", the Policy Stage's under
 * "Event Room 5,6,7", Denmark-Sweden's under "Event Room 6" (created 2026-08-19 by
 * scripts/seed-denmark-sweden-crm.mjs).
 *
 * Where lib/program.ts already names a source's CRM projects for its FACE lookup (`facesFrom`), that
 * list is REUSED rather than copied - see crmProjectsFor. This map adds only what a project needs on
 * top of it, so the two cannot drift apart on the projects they both cover.
 *
 * An extra project name only widens the pool of candidate rows; the join is by NAME, so a person is
 * either matched or they are not.
 */
const CRM_EXTRA_PROJECTS: Partial<Record<ProgramSourceKey, string[]>> = {
  niss: ["NISS"],
  nass: ["NASS"],
  fintech: ["Event Room 3"],
  policy: ["Event Room 5,6,7"],
  "denmark-sweden": ["Event Room 6"],
};

/** The CRM `Project Name` values to read for one project, `facesFrom` included. */
export function crmProjectsFor(source: ProgramSourceKey): string[] {
  const cfg = PROGRAM_SOURCES[source] as { facesFrom?: string | string[] };
  const faces = cfg.facesFrom
    ? Array.isArray(cfg.facesFrom)
      ? cfg.facesFrom
      : [cfg.facesFrom]
    : [];
  return [...new Set([...faces, ...(CRM_EXTRA_PROJECTS[source] ?? [])])];
}

/** What the CRM knows about a person, beyond their name. */
export type CrmPerson = {
  title: string;
  company: string;
  linkedin: string | null;
  photo: string | null;
};

/**
 * The CRM rows for one project's people, keyed by folded name.
 *
 * Filtered server-side on Project Name so a 3k-row table never lands in memory here. Returns an empty
 * map when the project names no CRM project, which costs no request at all.
 */
export async function fetchCrmPeople(projects: string[]): Promise<Map<string, CrmPerson>> {
  const out = new Map<string, CrmPerson>();
  if (!projects.length) return out;

  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return out;

  const clause = (p: string) => "{Project Name}='" + escFormula(p) + "'";
  const formula =
    projects.length === 1 ? clause(projects[0]) : `OR(${projects.map(clause).join(",")})`;

  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.set("filterByFormula", formula);
    params.set("pageSize", "100");
    // One `fields[]` PER NAME. URLSearchParams joins an array with commas, and Airtable then reads the
    // whole comma string as ONE field name and 422s the request.
    for (const f of CRM_FIELDS) params.append("fields[]", f);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${CRM_API}/${base}/${encodeURIComponent(CRM_TABLE)}?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      CRM_TIMEOUT_MS
    );
    if (!res.ok) {
      console.error("[programme-people] CRM read failed", res.status, await res.text());
      // Whatever was already collected still helps, and everyone missing falls back to the agenda's
      // own line. A CRM blip must not blank a roster.
      return out;
    }
    const data = (await res.json()) as {
      records: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };
    for (const rec of data.records) {
      const name = str(rec.fields["Full Name"]);
      if (!name) continue;
      const key = foldName(name);
      // FIRST ROW WINS. Somebody filed under two projects has two rows, and taking the first keeps
      // the answer stable rather than dependent on page order.
      if (out.has(key)) continue;
      out.set(key, {
        title: str(rec.fields["Job Title"]),
        company: str(rec.fields["Company"]),
        // Both columns, whichever normalizes to a real profile URL first: some rows are filled
        // scheme-less ("linkedin.com/in/..."), which normalizeLinkedInUrl repairs.
        linkedin: linkedinUrl(rec.fields["Link to LinkedIn"], rec.fields["LinkedIn Handle"]),
        // Stable proxy URL - a raw signed attachment URL expires in ~2h (lib/photo.ts).
        photo: photoUrl(
          "marketing",
          rec.id,
          undefined,
          firstAttachmentId(rec.fields["Profile Picture"])
        ),
      });
    }
    offset = data.offset;
  } while (offset);

  return out;
}

/**
 * Overlay the CRM onto an agenda-derived roster.
 *
 * THE CRM WINS ON TITLE, COMPANY AND LINKEDIN, because those are maintained there while the agenda's
 * single line is a reading script. It does NOT win on the photo: the headshot on the session row is
 * the file the organisers supplied for this event and is what /program already shows, so the CRM's
 * picture fills in only where the session row has none.
 *
 * Anyone with no CRM row keeps the agenda's line exactly as before.
 */
export function enrichFromCrm(
  people: ProgrammePerson[],
  crm: Map<string, CrmPerson>
): ProgrammePerson[] {
  if (!crm.size) return people;
  return people.map((p) => {
    const row = crm.get(foldName(p.name));
    if (!row) return p;
    return {
      ...p,
      title: row.title || p.title,
      company: row.company || p.company,
      linkedin: row.linkedin ?? p.linkedin,
      photo: p.photo ?? row.photo,
    };
  });
}

/** Every person on one project's agenda, with the CRM's fields overlaid. */
export async function fetchProgrammePeople(
  source: ProgramSourceKey
): Promise<ProgrammePerson[]> {
  const [sessions, crm] = await Promise.all([
    fetchProgram(source),
    fetchCrmPeople(crmProjectsFor(source)),
  ]);
  return enrichFromCrm(peopleFromSessions(sessions), crm);
}
