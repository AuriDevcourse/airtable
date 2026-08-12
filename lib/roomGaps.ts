// WHICH EVENT ROOM PROGRAMMES STILL LOOK INCOMPLETE, derived from the sessions themselves.
//
// Auri asked for this on 2026-08-12, looking at the Creative Business Cup: "which sessions feel
// incomplete still? For example this CBC, I think it's still incomplete." The page already had a
// hand-written "Still missing in Airtable" panel; a hand-written list of gaps is right for a fixed
// set of schema problems and wrong for this, because the answer changes every time a partner sends
// their programme. So this computes it, and a room drops off the list by being finished.
//
// DASHBOARD ONLY. Never goes in an embed snippet: it is a to-do list for the TechBBQ team, and a
// techbbq.dk visitor reading "no speakers yet" about a paying partner's room is the opposite of
// what the embed is for.
//
// The rules are deliberately about SHAPE, not about names, so a room nobody has thought about is
// caught on the same terms as one somebody is watching.
import { parseSlot } from "@/lib/brellaSections";
// The shell rule lives in ONE place: this module and the timeline used to each carry their own copy,
// and they disagreed — the timeline had already been fixed to require a shell's agenda to fill it
// while this file still reported "Scaling Europe — 2 sessions and not one names a speaker" about
// Google's session, from the same false shell (2026-08-12).
import { contains, shellsAmong } from "@/lib/shellRule";

export type RoomGapKind =
  | "empty" // the room has nothing on that day
  | "no-agenda" // one long block and nothing inside it
  | "no-speakers" // an agenda exists, but not one of its sessions names a speaker
  | "thin-speakers" // some of the agenda has speakers and a lot of it does not
  | "no-descriptions" // sessions with nothing to read behind the title
  | "double-booked"; // two bookings overlap in one room and neither contains the other

export type RoomGap = {
  day: string;
  room: string;
  kind: RoomGapKind;
  /** One line, already written for a reader. Names the actual sessions where that helps. */
  detail: string;
};

type Placed = { id: string; name: string; start: number; end: number; speakers: number; body: string };

/** A block this long with nothing inside it is a programme nobody has handed over yet. */
const LONG_BLOCK_MIN = 120;
/** Below this, a session with no description is fine: "Break", "Lunch", "Networking". */
const NEEDS_BODY_MIN = 20;
/** Same floor the timeline uses to decide a card is worth opening (see hasDetail). */
const BODY_MIN_CHARS = 24;

// NOT SESSIONS, and asking them for a speaker or a description is noise. The first version of this
// panel reported "Networking Lunch, Networking & Refreshments, Networking & Drinks — no speakers
// listed" against the Policy Stage, which is true and useless: nobody is going to fix it.
// A NAME rule, unlike everything else here, because nothing in the data distinguishes a break from
// a session — Brella gives both a title, a time and a track.
const NOT_A_SESSION =
  /\b(break|lunch|breakfast|dinner|networking|refreshment|coffee|registration|check[- ]?in|reception|drinks|mingling|transition|reset)\b/i;

/** An all-day row has no clock to parse; it covers whatever the day holds. */
const ALL_DAY = { start: 0, end: 24 * 60 };

/**
 * Brella's subtitle line stripped, so "Session by Google" does not count as a description. Same
 * rule as ProgramTimeline's bodyText — kept in step deliberately; if one changes, change both.
 */
function body(description: string): string {
  return (description || "")
    .split("\n")
    .filter((line) => !/^\s*(session|side event promotion)\b.*\bby\b/i.test(line))
    .join("\n")
    .trim();
}

const overlaps = (a: Placed, b: Placed) => a.start < b.end && b.start < a.end;

const list = (names: string[], max = 3): string =>
  names.length <= max
    ? names.join(", ")
    : `${names.slice(0, max).join(", ")} and ${names.length - max} more`;

/**
 * @param sessions every session in the section, across all days
 * @param roomOf maps a session's raw track to the column it is drawn in, so the findings are
 *        phrased in the same words as the board's headings ("Event Room 5,6,7", not two tracks)
 * @param days the days to report on, in the order they should read
 * @param rooms the columns to report on. A room absent from the data entirely still gets an
 *        "empty" finding, which is the whole point for a room nobody has filled in.
 */
export function roomGaps(
  sessions: { id: string; name: string; day: string; timeSlot: string; description: string; room: string; speakers?: unknown[] }[],
  roomOf: (room: string) => string,
  days: string[],
  rooms: string[]
): RoomGap[] {
  const out: RoomGap[] = [];

  for (const day of days) {
    const onDay = sessions.filter((s) => s.day === day);
    for (const room of rooms) {
      const mine: Placed[] = onDay
        .filter((s) => roomOf(s.room) === room)
        .map((s) => {
          // An all-day row parses to nothing, and DROPPING it reported Event Room 1 as empty on the
          // 27th while Board Summit had the room for the whole day (found 2026-08-12). It counts as
          // present and as covering the day; the flags below treat it like any other container.
          const slot = parseSlot(s.timeSlot) ?? (/all\s*day/i.test(s.timeSlot || "") ? ALL_DAY : null);
          return slot
            ? {
                id: s.id,
                name: s.name,
                start: slot.start,
                end: slot.end,
                speakers: (s.speakers || []).length,
                body: body(s.description),
              }
            : null;
        })
        .filter((x): x is Placed => x !== null)
        .sort((a, b) => a.start - b.start);

      if (mine.length === 0) {
        out.push({ day, room, kind: "empty", detail: "Nothing in this room yet." });
        continue;
      }

      // A shell is a block with an agenda inside it; a lone long block is a booking with none.
      const shells = shellsAmong(mine);
      const inAShell = new Set(shells.flatMap((u) => mine.filter((c) => contains(u, c)).map((c) => c.id)));
      const lonely = mine.filter(
        (s) =>
          s.end - s.start >= LONG_BLOCK_MIN &&
          !inAShell.has(s.id) &&
          !shells.some((u) => u.id === s.id) &&
          // Not lonely if something at least shares its time — that is a programme, however
          // messy, rather than an unfilled booking.
          !mine.some((o) => o.id !== s.id && overlaps(o, s)) &&
          // AND IT HAS TO LOOK UNFILLED. A long block with a speaker and a real description is one
          // long session, not a missing programme: "What VCs won't tell you about raising in this
          // market" is a two-hour workshop with François Mazoudier on it and a full blurb, and
          // reporting it as an empty booking was the panel's worst false positive (2026-08-12).
          s.speakers === 0 &&
          s.body.length < BODY_MIN_CHARS
      );
      if (lonely.length) {
        out.push({
          day,
          room,
          kind: "no-agenda",
          detail: `${list(lonely.map((s) => s.name))} — one block, no programme inside it.`,
        });
      }

      // Speakers, judged over the AGENDA rather than over every row: a shell's own row often
      // carries the whole partner lineup, which says nothing about who is on at 11:15.
      for (const u of shells) {
        // Breaks are dropped from the count as well as from the report: an agenda of six talks and
        // four coffee breaks is not "speakers on 6 of 10".
        const kids = mine.filter((c) => contains(u, c) && !NOT_A_SESSION.test(c.name));
        if (!kids.length) continue;
        const withPeople = kids.filter((k) => k.speakers > 0).length;
        if (withPeople === 0) {
          out.push({
            day,
            room,
            kind: "no-speakers",
            detail: `${u.name} — ${kids.length} sessions and not one names a speaker.`,
          });
        } else if (withPeople < kids.length / 2) {
          out.push({
            day,
            room,
            kind: "thin-speakers",
            detail: `${u.name} — speakers on ${withPeople} of ${kids.length} sessions.`,
          });
        }
      }

      // Standalone sessions with nobody on them. Skipped inside a shell, where the line above
      // already reports the agenda as a whole.
      const bareStandalone = mine.filter(
        (s) =>
          !inAShell.has(s.id) &&
          !shells.some((u) => u.id === s.id) &&
          s.speakers === 0 &&
          s.end - s.start >= NEEDS_BODY_MIN &&
          !NOT_A_SESSION.test(s.name)
      );
      if (bareStandalone.length && !lonely.length) {
        out.push({
          day,
          room,
          kind: "no-speakers",
          detail: `${list(bareStandalone.map((s) => s.name))} — no speakers listed.`,
        });
      }

      const noBody = mine.filter(
        (s) =>
          s.end - s.start >= NEEDS_BODY_MIN &&
          s.body.length < BODY_MIN_CHARS &&
          !shells.some((u) => u.id === s.id) &&
          !NOT_A_SESSION.test(s.name)
      );
      if (noBody.length) {
        out.push({
          day,
          room,
          kind: "no-descriptions",
          detail: `${list(noBody.map((s) => s.name))} — nothing to read behind the title.`,
        });
      }

      // A genuine clash: two bookings sharing time where neither is the other's shell.
      const clashes: string[] = [];
      for (let i = 0; i < mine.length; i++) {
        for (let j = i + 1; j < mine.length; j++) {
          const a = mine[i];
          const b = mine[j];
          if (!overlaps(a, b)) continue;
          if (contains(a, b) || contains(b, a)) continue;
          clashes.push(`${a.name} and ${b.name}`);
        }
      }
      if (clashes.length) {
        out.push({
          day,
          room,
          kind: "double-booked",
          detail: `${list(clashes, 2)} — overlapping in one room.`,
        });
      }
    }
  }

  return out;
}
