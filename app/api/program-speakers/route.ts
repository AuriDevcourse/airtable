import { NextRequest, NextResponse } from "next/server";
import { fetchProgram, type ProgramSourceKey } from "@/lib/program";
import {
  crmProjectsFor,
  enrichFromCrm,
  fetchCrmPeople,
  isProgrammeProject,
  peopleFromSessions,
  PROGRAMME_PROJECTS,
  PROGRAMME_ROLES,
  projectLabel,
  type ProgrammeRole,
} from "@/lib/programPeople";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse, withCors } from "@/lib/apiRoute";
import { feedTtlMs } from "@/lib/cachePolicy";

// THE SPEAKERS AND MODERATORS OF ONE PROJECT, read off that project's own agenda rather than out of a
// roster table. Why that is the only possible source for some of them is in lib/programPeople.ts.
//
//   /api/program-speakers?event=denmark-sweden              → the speakers
//   /api/program-speakers?event=denmark-sweden&role=Moderator
//   /api/program-speakers?event=denmark-sweden&role=all     → both, in agenda order

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// EVERYONE IS THE DEFAULT here, unlike /api/policy-stage and /api/fintech-speakers where a bare URL
// serves speakers only. Those two feed a grid that cannot say who is chairing; this one tags its
// moderators (see ProgrammePerson.tag), so one grid holds the whole line-up and a bare URL pasted into
// WordPress should render all of it. An unknown value falls back here too.
const DEFAULT_ROLE: ProgrammeRole | "all" = "all";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, "program-speakers");
  if (!gate.ok) return gate.res;

  // NO DEFAULT PROJECT, unlike /api/program which can fall back to the Summit's own schedule. Ten
  // projects share this route and none of them is the obvious one, so a missing ?event= is a mistake
  // worth saying out loud — a silent fallback would put one project's people on another's page.
  const eventParam = req.nextUrl.searchParams.get("event");
  if (!isProgrammeProject(eventParam)) {
    return withCors(
      NextResponse.json(
        {
          error: `Add ?event= one of: ${PROGRAMME_PROJECTS.map((p) => p.key).join(", ")}.`,
          projects: PROGRAMME_PROJECTS,
        },
        { status: 400 }
      ),
      gate.origin
    );
  }
  const source: ProgramSourceKey = eventParam;

  const roleParam = req.nextUrl.searchParams.get("role");
  const role: ProgrammeRole | "all" =
    roleParam === "all"
      ? "all"
      : (PROGRAMME_ROLES as readonly string[]).includes(roleParam ?? "")
        ? (roleParam as ProgrammeRole)
        : DEFAULT_ROLE;

  try {
    // THE SAME CACHE ENTRY /api/program FILLS, on purpose: one Airtable read serves the agenda and
    // this roster, and the two can never disagree about who is on stage. It also means the Refresh
    // button on either page updates both.
    if (gate.fresh) invalidate(`program:${source}`);
    // The CRM overlay is cached under its own key, because it is a second table and a second read —
    // and a shared one: two projects reading "Event Room 1" hit the same entry.
    const crmProjects = crmProjectsFor(source);
    const crmKey = `crm-people:${crmProjects.join("+") || "none"}`;
    if (gate.fresh) invalidate(crmKey);

    // In parallel: the two reads have nothing to say to each other, and a roster should not wait for
    // one to finish before the other starts.
    const [sessions, crm] = await Promise.all([
      cached(`program:${source}`, () => fetchProgram(source), feedTtlMs()),
      cached(crmKey, () => fetchCrmPeople(crmProjects), feedTtlMs()),
    ]);
    // Names and roles from the agenda, job title / company / LinkedIn from the CRM where a row
    // exists (Auri, 2026-08-19). See enrichFromCrm for what wins and why.
    const all = enrichFromCrm(peopleFromSessions(sessions), crm);

    const people = role === "all" ? all : all.filter((p) => p.role === role);

    // `counts` lets the dashboard label both tabs from one request.
    const counts = Object.fromEntries(
      PROGRAMME_ROLES.map((r) => [r, all.filter((p) => p.role === r).length])
    );
    // `groups` carries both roles whatever ?role= says: the tabbed Elementor snippet fetches this URL
    // once and switches client-side, which is the contract the tabs mode in lib/embedSnippet.ts
    // expects (`{ groups: { [key]: Person[] } }`).
    const groups = Object.fromEntries(
      PROGRAMME_ROLES.map((r) => [r, all.filter((p) => p.role === r)])
    );

    return feedResponse(
      {
        count: people.length,
        event: source,
        label: projectLabel(source),
        role,
        counts,
        // How much of this roster the CRM answered for, so the dashboard can say so rather than
        // leaving "why has this person no title" to be guessed at.
        crm: { projects: crmProjects, rows: crm.size },
        people,
        groups,
      },
      gate,
      { key: `program:${source}` }
    );
  } catch (err) {
    console.error("[/api/program-speakers]", err);
    return errorResponse(
      err,
      `Something went wrong loading the ${projectLabel(source)} line-up.`,
      gate
    );
  }
}

