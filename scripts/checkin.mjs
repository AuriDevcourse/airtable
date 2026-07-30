// "What needs Auri's attention in Airtable right now?"
//
//   node scripts/checkin.mjs           # human-readable report
//   node scripts/checkin.mjs --json    # same data, for an agent to act on
//   node scripts/checkin.mjs --hook    # SessionStart hook JSON (see .claude/settings.json)
//
// READ-ONLY. It never writes to Airtable.
//
// --hook is wired to the SessionStart hook so every session in this repo opens with what is
// waiting on Auri. That mode NEVER fails the session: no network, no token, no Airtable, it
// stays silent and exits 0. A check-in is not worth a broken session start.
//
// Purpose: some Airtable tables are inboxes. Other people file rows there (print requests,
// form submissions) and Auri has to act on them or fill in what's missing. Opening each
// view by hand is the thing that gets skipped, so this checks them all in one command and
// says what is overdue, what is unassigned, and which cells are still empty.
//
// ADDING A TABLE: append one entry to WATCHES. Everything else is generic.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");
const HOOK_OUT = process.argv.includes("--hook");

// In hook mode nothing may reach the transcript except our own JSON, and no failure may
// surface at all: a missing .env.local on a fresh clone must not greet Auri with a stack
// trace. Everything below that would exit non-zero or print is swallowed here.
function bailQuietly() {
  if (HOOK_OUT) {
    console.log(JSON.stringify({ suppressOutput: true }));
    process.exit(0);
  }
}
process.on("uncaughtException", (err) => {
  if (HOOK_OUT) bailQuietly();
  console.error(String(err?.message ?? err));
  process.exit(1);
});

// --- what to watch ----------------------------------------------------------

const BASE_URL = "https://airtable.com/appgXNjXJqpk9Ebxd";

const WATCHES = [
  {
    key: "prints",
    label: "Prints 2026",
    table: "tbluSfDoEXnvOquvE",
    view: "viwds5x6kwU2Mg1hP", // "Prints for 2026 grid"
    // Everything read. Keep this tight: it is also the allow-list.
    fields: [
      "Name of the Print",
      "Status",
      "Deadline",
      "Project",
      "What other project?",
      "Size",
      "Notes",
      "Attachments",
      "Sent to print",
      "Assignee",
      "Person who assigned",
    ],
    // Auri's rule: anything not Done is still his to do. Status is often left blank on a
    // fresh request, and blank is emphatically not Done.
    needsAction: (f) => String(f["Status"] ?? "").trim() !== "Done",
    title: (f) => str(f["Name of the Print"]) || "(no print name filled in)",
    // Print requests come in via a form, so a row can arrive with almost nothing in it.
    // Naming the empty cells is the actual work item.
    missing: (f) => {
      const gaps = [];
      if (!str(f["Name of the Print"])) gaps.push("name");
      if (!str(f["Size"])) gaps.push("size");
      if (!(f["Attachments"] ?? []).length) gaps.push("artwork");
      if (!f["Deadline"]) gaps.push("deadline");
      return gaps;
    },
    meta: (f) => {
      const project =
        str(f["Project"]) === "Other" ? str(f["What other project?"]) || "Other" : str(f["Project"]);
      const bits = [project || "no project"];
      const who = f["Assignee"]?.name || str(f["Person who assigned"]);
      bits.push(who ? `from ${who}` : "unassigned");
      if (f["Sent to print"]) bits.push("already sent to print");
      return bits.join(" · ");
    },
    deadline: (f) => f["Deadline"] || null,
    status: (f) => str(f["Status"]) || "no status",
  },
  {
    key: "partner-deliverables",
    label: "Partner Deliverables 2026 · not on web yet",
    table: "tblTecOBecLQCNIeD", // Marketing Project Overview
    view: "viw7FVbsTb9IRaWF0", // "Partner Deliverables 2026"
    // Deliberately TIGHT. These rows are web-form submissions that also carry "Contact
    // Name" and "Contact Email" — partner PII with no business appearing in a check-in
    // report. Not requested, so it cannot leak into the output.
    fields: [
      "Company",
      "Put on web",
      "Partnership Type 2026",
      "Submitted",
      "Logo",
      "Link to your website",
      "Social Media Handles",
      "Partner ID",
    ],
    // The whole question: a partner has filed their deliverables but isn't on techbbq.dk.
    // "Put on web" is the checkbox marketing actually maintains here (the older
    // "Logo website status" select is blank on all 120 rows — don't use it).
    needsAction: (f) => !f["Put on web"],
    title: (f) => str(f["Company"]) || "(no company name)",
    // What is still missing before this one can go up.
    missing: (f) => {
      const gaps = [];
      if (!(f["Logo"] ?? []).length) gaps.push("logo");
      if (!str(f["Link to your website"])) gaps.push("website link");
      if (!str(f["Partnership Type 2026"])) gaps.push("tier");
      return gaps;
    },
    meta: (f) => {
      const bits = [str(f["Partnership Type 2026"]) || "no tier"];
      if (f["Partner ID"]) bits.push(`partner ${f["Partner ID"]}`);
      if (!str(f["Social Media Handles"])) bits.push("no social handles");
      return bits.join(" · ");
    },
    // No deadline field on this table; the pressure is how long they have waited since
    // submitting, so this watch ranks by age instead.
    waitingSince: (f) => f["Submitted"] || null,
    status: () => "not on web",
  },
];

// --- env --------------------------------------------------------------------

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  } catch {
    bailQuietly(); // hook mode: silent
    console.error("Could not read .env.local");
    process.exit(1);
  }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    // Tolerates `KEY = value` (the Brella key was pasted that way).
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const TOKEN = env.AIRTABLE_TOKEN;
const BASE = env.AIRTABLE_BASE_ID;
if (!TOKEN || !BASE) {
  bailQuietly(); // hook mode: silent
  console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID in .env.local");
  process.exit(1);
}

// --- helpers ----------------------------------------------------------------

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

// Computed fresh every run, never a hardcoded constant: a stale "today" silently breaks
// every overdue calculation below.
const TODAY = new Date();
const todayKey = TODAY.toISOString().slice(0, 10);

// Accepts both Airtable shapes: a date field ("2026-07-29") and a createdTime/timestamp
// ("2026-07-22T09:12:00.000Z"). Slicing to the date part first is what makes the second
// one work — appending T00:00:00Z to a full timestamp produces an Invalid Date.
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const day = String(dateStr).slice(0, 10);
  const then = new Date(`${day}T00:00:00Z`);
  const now = new Date(`${todayKey}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.round((then - now) / 86_400_000);
}

// Days since a past date. Kept separate from daysUntil so a null can never be flipped into
// a misleading 0 by unary minus.
function daysSince(dateStr) {
  const d = daysUntil(dateStr);
  return d === null ? null : -d;
}

function urgency(days) {
  if (days === null) return { tag: "no deadline", rank: 3 };
  if (days < 0) return { tag: `OVERDUE by ${Math.abs(days)}d`, rank: 0 };
  if (days === 0) return { tag: "due TODAY", rank: 1 };
  if (days <= 7) return { tag: `due in ${days}d`, rank: 1 };
  return { tag: `due in ${days}d`, rank: 2 };
}

// Some inboxes have no deadline field at all — the pressure is simply how long a submission
// has been sitting there. Ranked below anything genuinely overdue but above undated work.
function waiting(days) {
  if (days === null) return { tag: "just submitted", rank: 3 };
  if (days >= 14) return { tag: `waiting ${days}d`, rank: 0 };
  if (days >= 4) return { tag: `waiting ${days}d`, rank: 1 };
  return { tag: `waiting ${days}d`, rank: 2 };
}

async function fetchView(watch) {
  const out = [];
  let offset;
  do {
    const p = new URLSearchParams({ pageSize: "100" });
    if (watch.view) p.set("view", watch.view);
    for (const f of watch.fields) p.append("fields[]", f);
    if (offset) p.set("offset", offset);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${watch.table}?${p}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      throw new Error(`Airtable ${res.status} on ${watch.label}: ${await res.text()}`);
    }
    const data = await res.json();
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

// --- run --------------------------------------------------------------------

const report = [];

for (const watch of WATCHES) {
  let records;
  try {
    records = await fetchView(watch);
  } catch (err) {
    report.push({ key: watch.key, label: watch.label, error: String(err.message ?? err), items: [] });
    continue;
  }

  const items = records
    .filter((r) => watch.needsAction(r.fields))
    .map((r) => {
      const f = r.fields;
      // A watch ranks EITHER by a deadline (how soon it's due) or by age (how long it has
      // been sitting). Deadline wins if the watch defines one.
      const deadline = watch.deadline ? watch.deadline(f) : null;
      const since = watch.waitingSince ? watch.waitingSince(f) : null;
      const days = deadline ? daysUntil(deadline) : since ? daysSince(since) : null;
      const u = deadline ? urgency(days) : since ? waiting(days) : urgency(null);
      return {
        id: r.id,
        title: watch.title(f),
        meta: watch.meta(f),
        status: watch.status(f),
        deadline,
        waitingSince: since,
        daysUntil: days,
        urgency: u.tag,
        rank: u.rank,
        missing: watch.missing(f),
        url: `${BASE_URL}/${watch.table}/${watch.view}`,
      };
    })
    // Within a rank: deadline watches show the soonest first, age watches the oldest first.
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.deadline
          ? (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999)
          : (b.daysUntil ?? -1) - (a.daysUntil ?? -1))
    );

  report.push({
    key: watch.key,
    label: watch.label,
    url: `${BASE_URL}/${watch.table}/${watch.view}`,
    total: records.length,
    outstanding: items.length,
    items,
  });
}

if (JSON_OUT) {
  console.log(JSON.stringify({ checkedAt: TODAY.toISOString(), watches: report }, null, 2));
  process.exit(0);
}

// SessionStart hook: hand the model a compact summary as context, and stay silent when
// there is nothing to report so a clean day doesn't cost a paragraph.
if (HOOK_OUT) {
  const lines = [];
  for (const w of report) {
    if (w.error || !w.outstanding) continue; // a broken read is not worth interrupting for
    lines.push(`${w.label} (${w.outstanding} open) — ${w.url}`);
    for (const it of w.items) {
      const gaps = it.missing.length ? ` · missing: ${it.missing.join(", ")}` : "";
      lines.push(`  - [${it.urgency}] ${it.title} · ${it.meta}${gaps}`);
    }
  }
  if (!lines.length) {
    console.log(JSON.stringify({ suppressOutput: true }));
    process.exit(0);
  }
  console.log(
    JSON.stringify({
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: [
          `Airtable check-in for ${todayKey} — rows waiting on Auri:`,
          ...lines,
          "",
          "Mention this to Auri at the start of your first reply, briefly, then get on with whatever he asked. Do not write to Airtable without his say-so.",
        ].join("\n"),
      },
    })
  );
  process.exit(0);
}

console.log(`\nAirtable check-in · ${todayKey}\n${"=".repeat(34)}`);

let totalOutstanding = 0;
for (const w of report) {
  if (w.error) {
    console.log(`\n${w.label}: COULD NOT READ — ${w.error}`);
    continue;
  }
  totalOutstanding += w.outstanding;
  console.log(`\n${w.label} · ${w.outstanding} of ${w.total} still open`);
  console.log(w.url);
  if (!w.outstanding) {
    console.log("  Nothing outstanding.");
    continue;
  }
  for (const it of w.items) {
    console.log(`\n  [${it.urgency}] ${it.title}`);
    console.log(
      `     ${it.meta} · ${it.status}${it.deadline ? ` · deadline ${it.deadline}` : ""}${
        it.waitingSince ? ` · submitted ${String(it.waitingSince).slice(0, 10)}` : ""
      }`
    );
    if (it.missing.length) console.log(`     you still need to fill: ${it.missing.join(", ")}`);
  }
}

console.log(
  `\n${"-".repeat(34)}\n${totalOutstanding} item${totalOutstanding === 1 ? "" : "s"} waiting on you.\n`
);
