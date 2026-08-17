import { NextRequest } from "next/server";
import { fetchBoardSummit, BOARD_ROLES, BoardRole } from "@/lib/boardsummit";
import { cached, invalidate } from "@/lib/rate-limit";
import { corsPreflight, errorResponse, feedGate, feedResponse } from "@/lib/apiRoute";
import { isDashboardRequest } from "@/lib/dashboardAuth";
import { feedTtlMs } from "@/lib/cachePolicy";

// THE BOARD SUMMIT feed: the roster hosted by Boardway in Event Room 1, from the Marketing Project
// Overview rows whose Session Name is "Board Summit". See lib/boardsummit.ts for where they come
// from and why the room alone is not enough to identify them.
//
// The Board Summit's SESSIONS are a different feed: /api/program?event=board.

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

const KEY = "board-summit";

// ?role=Speaker | Moderator | all
//
// SPEAKER IS THE DEFAULT, and deliberately: whatever gets pasted on techbbq.dk fetches this URL
// bare, so defaulting to "all" would drop four moderators into the middle of a speaker grid on a
// live page with no way to correct it except a re-paste. An unknown value falls back to Speaker for
// the same reason. Same contract as /api/policy-stage and /api/fintech-speakers.
const DEFAULT_ROLE: BoardRole = "Speaker";

export async function GET(req: NextRequest) {
  const gate = feedGate(req, KEY);
  if (!gate.ok) return gate.res;

  const param = req.nextUrl.searchParams.get("role");
  const role =
    param === "all"
      ? "all"
      : (BOARD_ROLES as readonly string[]).includes(param ?? "")
        ? (param as BoardRole)
        : DEFAULT_ROLE;

  try {
    if (gate.fresh) invalidate(KEY);

    // One Airtable read serves every variant: the lib returns both roles and the filter happens
    // after the cache, the same way ?tier=, ?kind= and ?stage= work elsewhere.
    const roster = await cached(KEY, fetchBoardSummit, feedTtlMs(KEY));
    const all = roster.people;
    const people = role === "all" ? all : all.filter((p) => p.role === role);

    // `counts` lets the dashboard label its tabs without a request per tab.
    const counts = Object.fromEntries(BOARD_ROLES.map((r) => [r, all.filter((p) => p.role === r).length]));

    // `groups` carries BOTH roles whatever ?role= says, because the tabbed Elementor snippet fetches
    // this URL once and swaps groups client-side — the contract the tabs mode in lib/embedSnippet.ts
    // expects (`{ groups: { [key]: Person[] } }`).
    const groups = Object.fromEntries(BOARD_ROLES.map((r) => [r, all.filter((p) => p.role === r)]));

    // WHO IS MISSING, and only for the dashboard. These are people on a real stage whose row is not
    // finished, so the answer to "why is our speaker not on the wall" belongs on the page somebody
    // is already looking at rather than in a server log. Gated on the dashboard password because a
    // public feed has no business naming people it has decided not to publish — the same instinct as
    // ?pending=1 on /api/interns.
    const forDashboard = isDashboardRequest(req.headers.get("authorization"));
    const waiting = forDashboard ? { needsRole: roster.needsRole, needsPhoto: roster.needsPhoto } : {};

    // A response carrying the waiting list is NEVER STORED, the same rule ?pending=1 follows on
    // /api/interns. The dashboard and the embed fetch the identical URL, so a cacheable authenticated
    // copy is a copy the CDN could hand to the next public visitor — which would publish the names of
    // exactly the people this route decided not to publish.
    return feedResponse({ count: people.length, role, counts, people, groups, ...waiting }, forDashboard ? { ...gate, fresh: true } : gate, {
      key: KEY,
    });
  } catch (err) {
    console.error("[/api/board-summit]", err);
    return errorResponse(err, "Something went wrong loading the Board Summit.", gate);
  }
}
