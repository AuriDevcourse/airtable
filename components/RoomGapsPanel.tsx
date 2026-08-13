"use client";

import { useMemo } from "react";
import type { RoomGap, RoomGapKind } from "@/lib/roomGaps";

// WHAT STILL LOOKS INCOMPLETE, as a panel. Findings come from lib/roomGaps.ts; this only decides
// how they read and in what order.
//
// ONE COMPONENT, TWO PAGES. /partner-events asked for it first (Auri, 2026-08-12) and Program 2026
// asked for the same box an hour later — and this repo's own history says a near-copy across those
// two pages drifts within the day (see the venue line, the artwork override, the title key, and the
// shell rule that had already diverged between two files by the time it was extracted).
//
// DASHBOARD ONLY. Never in an embed snippet: it is a to-do list naming paying partners' rooms.
//
// KIND ORDER IS THE SEVERITY ORDER: a column with nothing in it needs a phone call, a missing
// description needs five minutes. Judged here rather than in the lib, because what to chase first
// is an opinion and not a property of the data.
const GAP_ORDER: RoomGapKind[] = [
  "empty",
  "no-agenda",
  "double-booked",
  "no-speakers",
  "thin-speakers",
  "no-descriptions",
];

const GAP_WORD: Record<RoomGapKind, string> = {
  empty: "empty",
  "no-agenda": "no programme",
  "double-booked": "clash",
  "no-speakers": "no speakers",
  "thin-speakers": "few speakers",
  "no-descriptions": "no descriptions",
};

export function RoomGapsPanel({
  gaps,
  /**
   * What the columns are called on the page mounting this, so the heading matches the thing the
   * reader is looking at: "rooms" on the Event Rooms board, "stages" on the Stages one. A heading
   * that says "rooms" above a list of stages reads as somebody else's panel.
   */
  subject = "rooms",
}: {
  gaps: RoomGap[];
  subject?: string;
}) {
  const byRoom = useMemo(() => {
    const m = new Map<string, RoomGap[]>();
    // ONE ROOM+DAY CAN LEGITIMATELY REPORT THE SAME KIND TWICE. lib/roomGaps.ts finds
    // "no-speakers" down two independent paths — once per speakerless SHELL, and once for the
    // speakerless standalone sessions around it — so Event Room 2 on 26 August produced two of
    // them and the render crashed on a duplicate React key (kind+day was the key, 2026-08-13).
    //
    // Both lines are worth showing: they name different sessions. Only a line identical in all
    // four fields is a genuine repeat and gets dropped.
    const seen = new Set<string>();
    for (const g of gaps) {
      const fingerprint = `${g.room}|${g.day}|${g.kind}|${g.detail}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      m.set(g.room, [...(m.get(g.room) ?? []), g]);
    }
    for (const [, list] of m) {
      list.sort(
        (a, b) => GAP_ORDER.indexOf(a.kind) - GAP_ORDER.indexOf(b.kind) || a.day.localeCompare(b.day)
      );
    }
    // Ordered by each column's WORST finding, so the one that needs a phone call is first.
    return [...m.entries()].sort(
      (a, b) =>
        Math.min(...a[1].map((g) => GAP_ORDER.indexOf(g.kind))) -
        Math.min(...b[1].map((g) => GAP_ORDER.indexOf(g.kind)))
    );
  }, [gaps]);

  if (!byRoom.length) return null;

  return (
    <section className="ev-gaps" aria-label={`Programmes that look incomplete`}>
      <h2>Which {subject} still look incomplete</h2>
      <ul>
        {byRoom.map(([room, list]) => (
          <li key={room}>
            <strong>{room}</strong>
            {/* `detail` is what separates two findings of the same kind on the same day; the index
                is the last resort so a key can never collide even if that repeats. */}
            {list.map((g, i) => (
              <span key={`${g.kind}|${g.day}|${g.detail}|${i}`} className="ev-gaps__line">
                <span className="ev-gaps__tag" data-kind={g.kind}>
                  {GAP_WORD[g.kind]}
                </span>
                <span className="ev-gaps__day">{g.day.replace(/^Day \d+ · /, "")}</span>
                {g.detail}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {/* Says where the judgement comes from, so nobody treats it as a hand-maintained list that
          somebody forgot to update. */}
      <p className="ev-gaps__note">
        Read from Brella every time this page loads · a {subject.replace(/s$/, "")} leaves this list
        by being finished
      </p>
    </section>
  );
}
