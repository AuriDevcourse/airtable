// What changed between the list a page is showing and the list it just refetched.
//
// Exists so the local refresh button can answer "did anything actually change?" instead of
// silently repainting. "Nothing changed" is a useful answer too: it tells an editor their
// Airtable save has definitely landed, rather than leaving them wondering whether the page
// is stale or the edit failed.
//
// Rows are matched by `id` — every feed in this project returns Airtable/Brella record ids,
// so a row that moves position is not reported as a delete plus an add. Lists without ids
// fall back to position, which is the best that can be done.

export type FieldChange = { field: string; from: string; to: string };

export type ListChange = {
  kind: "added" | "removed" | "changed";
  label: string;
  fields?: FieldChange[]; // only for kind === "changed"
};

export type ChangeSummary = {
  added: number;
  removed: number;
  changed: number;
  total: number;
  items: ListChange[]; // capped at MAX_ITEMS
  hidden: number; // how many changes are real but not in `items`
};

// A refresh that rewrites a whole feed (a view swapped, a table emptied) would otherwise
// print hundreds of lines into the page.
const MAX_ITEMS = 15;
// Long bios/descriptions are unreadable inline and the point is only "this field moved".
const MAX_VALUE = 70;

// The feeds are camelCase JSON, but the person reading the report is looking at Airtable
// column names. Anything unmapped falls back to a de-camelCased version of the key, so a
// new field added to a feed still reads sensibly without touching this list.
const FIELD_LABELS: Record<string, string> = {
  timeSlot: "Time Slot",
  name: "Name",
  day: "Day",
  type: "Type",
  room: "Room",
  description: "Description",
  title: "Title",
  company: "Company",
  role: "Role",
  bio: "Bio",
  photo: "Photo",
  linkedin: "LinkedIn",
  hierarchy: "Order",
  tag: "Tag",
  tagColor: "Tag colour",
};

function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const NO_CHANGES: ChangeSummary = {
  added: 0,
  removed: 0,
  changed: 0,
  total: 0,
  items: [],
  hidden: 0,
};

function rec(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}

function keyOf(x: unknown, index: number): string {
  const id = rec(x).id;
  return typeof id === "string" && id ? id : `@${index}`;
}

// Best-effort human name for a row. Speaker feeds use `name`, sessions use `name`, and
// anything else falls back to the id so a change is never reported as a blank line.
function labelOf(x: unknown, fallback: string): string {
  const o = rec(x);
  for (const k of ["name", "title", "fullName", "session", "day"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "(empty)";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (!s) return "(empty)";
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE)}…` : s;
}

function fieldDiff(before: unknown, after: unknown): FieldChange[] {
  const a = rec(before);
  const b = rec(after);
  const out: FieldChange[] = [];
  for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (field === "id") continue;
    if (JSON.stringify(a[field]) === JSON.stringify(b[field])) continue;
    out.push({ field: fieldLabel(field), from: show(a[field]), to: show(b[field]) });
  }
  return out;
}

export function diffList<T>(before: T[], after: T[]): ChangeSummary {
  const beforeMap = new Map(before.map((x, i) => [keyOf(x, i), x]));
  const afterMap = new Map(after.map((x, i) => [keyOf(x, i), x]));

  const all: ListChange[] = [];

  // Walk `after` first so additions and edits are listed in the order they appear on the
  // page, which is the order the reader is looking at.
  after.forEach((item, i) => {
    const k = keyOf(item, i);
    const prev = beforeMap.get(k);
    if (prev === undefined) {
      all.push({ kind: "added", label: labelOf(item, k) });
      return;
    }
    const fields = fieldDiff(prev, item);
    if (fields.length) all.push({ kind: "changed", label: labelOf(item, k), fields });
  });

  before.forEach((item, i) => {
    const k = keyOf(item, i);
    if (!afterMap.has(k)) all.push({ kind: "removed", label: labelOf(item, k) });
  });

  const added = all.filter((c) => c.kind === "added").length;
  const removed = all.filter((c) => c.kind === "removed").length;
  const changed = all.filter((c) => c.kind === "changed").length;

  return {
    added,
    removed,
    changed,
    total: all.length,
    items: all.slice(0, MAX_ITEMS),
    hidden: Math.max(0, all.length - MAX_ITEMS),
  };
}
