/**
 * A SHELL ROW THE FEED DOES NOT HAVE, for a partner block that Brella carries only as its
 * separate sessions.
 *
 * THE PROBLEM. Every other partner takeover on the board has a parent row: "Future of Fintech"
 * 09:30-13:00 sits over its seven talks, the Board Summit sits over its fourteen. lib/shellRule.ts
 * spots that parent by its shape and the timeline draws it as the dashed band that says "this room
 * belongs to one programme for these hours", with the agenda nested inside it.
 *
 * AWS x NVIDIA has no parent row. Brella has four sessions in Event Room 3 on the 27th
 * (13:30-14:10, 14:20-15:20, 15:30-16:10, the 16:10-17:10 networking) with no track, no tags and
 * no programme name — each one titled after its own topic, so nothing on the board says the
 * afternoon is one event. The derived all-day band cannot help either: that one is built from
 * `programme`, which these rows do not carry, and it only fires for a room booked morning to
 * evening, which an afternoon block is not.
 *
 * So the shell is DECLARED here and appended to the feed as a session. Not a renderer change:
 * once the row exists, shellsAmong() recognises it exactly as it recognises Future of Fintech's,
 * which means the band, the nesting and the drop from the lane pass all come for free, and they
 * come to all three surfaces (/brella-program, the pasted embed, /api/program?event=brella)
 * instead of to whichever one got patched.
 *
 * WHY A DECLARATION AND NOT A RULE. "Consecutive sessions with the same description are one
 * event" would find this block, and would also merge every room where a partner pasted one blurb
 * onto each of their rows. A band drawn over the wrong sessions states something false about the
 * schedule; four rows with no band merely understate it. So each of these is written down, with
 * the room, the day and the clock that identify it.
 *
 * DELETE AN ENTRY THE DAY BRELLA GAINS THE REAL ROW. `wouldDuplicate()` below already suppresses
 * it in that case, so a stale entry is harmless rather than a second band, but it is still a lie
 * about what the feed contains.
 */
import type { ProgramSession } from "@/lib/program";
import { contains, fillOf, SHELL_MIN_FILL, type Span } from "@/lib/shellRule";

type DerivedShell = {
  /** Matched against ProgramSession.room, i.e. AFTER roomAlias() has folded the track. */
  room: string;
  /** The session's own YYYY-MM-DD, the same key lib/sessionProgrammes.ts matches on. */
  dateKey: string;
  /** Inclusive "HH:MM" bounds of the block. These are what the band's caption prints. */
  from: string;
  to: string;
  /** What the band says. The hosts first: it is the thing the four titles never mention. */
  name: string;
  /**
   * Brella's own subtitle for the block, so the row is not empty if anything ever does open it.
   * Deliberately short: the band itself is not pressable in either renderer, and the four real
   * sessions already carry the full blurb.
   */
  description: string;
};

const SHELLS: DerivedShell[] = [
  // AWS x NVIDIA, Event Room 3, 27 August 13:30-17:10 (Auri, 2026-08-19: "mention in the program
  // that from 13:30 to 17:10 AWS x Nvidia event with this transparent border that we used for all
  // day events"). The hosts' PDF covers exactly these four rows and no more.
  //
  // THE SAME ROOM RUNS FUTURE OF FINTECH THAT MORNING, 09:30-13:00, which already draws its own
  // band from its own real parent row. The two do not overlap and neither contains the other, so
  // the column draws two bands over two blocks — which is what the day is.
  {
    room: "Event Room 3",
    dateKey: "2026-08-27",
    from: "13:30",
    to: "17:10",
    name: "AWS x NVIDIA: The Agentic AI Era",
    description: "Session by NVIDIA & AWS. An afternoon on building and scaling with Agentic AI.",
  },
];

/** "HH:MM" → minutes since midnight. */
function mins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

/** The START of "13:30 - 14:10" in minutes, or null when the label has no clock in it. */
function slotStart(slot: string): number | null {
  const m = slot.match(/(\d{1,2})[:.](\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/** The END of "13:30 - 14:10" in minutes, or null. Falls back to the start for a single time. */
function slotEnd(slot: string): number | null {
  const all = [...slot.matchAll(/(\d{1,2})[:.](\d{2})/g)];
  if (!all.length) return null;
  const last = all[all.length - 1];
  return parseInt(last[1], 10) * 60 + parseInt(last[2], 10);
}

/**
 * Would this shell be a SECOND band over the same sessions?
 *
 * True when the feed already has a row in that room and day covering the whole window — the real
 * parent row arriving in Brella, which is the outcome this module is a stand-in for. Checked
 * rather than assumed, because the day it happens nobody will remember to delete the entry, and
 * two nested dashed rectangles over one agenda is the bug lib/shellRule.ts's fill test was written
 * to stop.
 */
function wouldDuplicate(shell: DerivedShell, spans: Span[]): boolean {
  const from = mins(shell.from);
  const to = mins(shell.to);
  return spans.some((s) => s.start <= from && s.end >= to);
}

/**
 * The declared shells for a mapped Brella feed.
 *
 * Each comes back with the id of the FIRST session it wraps (`anchorId`), because the caller has to
 * put it somewhere: the shell has no Brella start instant to sort on, and its day label is derived
 * from the feed rather than stored. Anchoring on a real session gives it both without this module
 * having to know how days are numbered or how the list is ordered.
 *
 * Silent on the ordinary case (no entry for that room and day) and LOUD when an entry no longer
 * describes the schedule: a block that has been moved or renumbered in Brella leaves its
 * declaration matching nothing, and a band quietly not appearing is the failure mode this whole
 * corner of the codebase keeps hitting.
 *
 * `dateKeyOf` is passed in because ProgramSession carries a day LABEL ("Day 3 · 27 August"), not a
 * date — the mapper is the only place that still has both.
 */
export function derivedShells(
  sessions: ProgramSession[],
  dateKeyOf: (s: ProgramSession) => string
): { session: ProgramSession; anchorId: string }[] {
  const out: { session: ProgramSession; anchorId: string }[] = [];
  for (const shell of SHELLS) {
    const from = mins(shell.from);
    const to = mins(shell.to);
    const here = sessions.filter((s) => s.room === shell.room && dateKeyOf(s) === shell.dateKey);
    const spans: Span[] = [];
    for (const s of here) {
      const start = slotStart(s.timeSlot);
      const end = slotEnd(s.timeSlot);
      if (start !== null && end !== null && end > start) spans.push({ id: s.id, start, end });
    }
    const outer: Span = { id: `shell-${shell.room}-${shell.dateKey}`, start: from, end: to };
    // The same two conditions the renderers will apply to this row once it is in the feed, applied
    // here so a shell that would NOT be drawn is never added. Without this a block whose sessions
    // have moved out of the window becomes an empty dashed rectangle over an unrelated hour.
    const kids = spans.filter((c) => contains(outer, c));
    if (kids.length < 2 || fillOf(outer, kids) < SHELL_MIN_FILL) {
      console.error(
        "[derivedShells] no block to wrap, skipping:",
        shell.name,
        `${kids.length} sessions inside ${shell.from}-${shell.to} in ${shell.room} on ${shell.dateKey}`
      );
      continue;
    }
    if (wouldDuplicate(shell, spans)) {
      // Not an error: this is the good outcome. Brella now carries the parent row itself and the
      // declaration can be deleted.
      console.warn("[derivedShells] a real row already spans this block, skipping:", shell.name);
      continue;
    }
    // The earliest row inside the window, in feed order. The shell is placed immediately before it
    // so a list reading top to bottom announces the block and then its agenda.
    const anchorId = kids.slice().sort((a, b) => a.start - b.start)[0].id;
    out.push({
      anchorId,
      session: {
      // Not a `brella-<id>`: nothing in Brella has this id, and a consumer that maps ids back to
      // the API would otherwise get a 404 it cannot explain.
      id: `shell-brella-${shell.room.toLowerCase().replace(/\s+/g, "-")}-${shell.dateKey}`,
      // Filled by the caller, which owns the day numbering.
      day: "",
      name: shell.name,
      timeSlot: `${shell.from} - ${shell.to}`,
      // No topic and no tags ON PURPOSE. The band is not a session: a kicker on it would put a
      // fake tag into the board's filter list, and filtering to it would show a shell with
      // nothing inside.
      type: "",
      tags: [],
      description: shell.description,
      room: shell.room,
      location: here.find((s) => s.location)?.location ?? "",
      speakers: [],
      },
    });
  }
  return out;
}
