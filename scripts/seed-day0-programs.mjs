// SEED THE FOUR DAY 0 PROGRAMMES into the Sessions table (tblSlpTzDi2oVYwqv).
//
// Source of truth: the four designed pages Auri handed over (lp-forum.html, investor-day.html,
// pension-summit.html, family-office.html). Those pages carry a START time per slot; the
// "Time Slot" cell wants a range, so each row's end is the NEXT row's start — the same shape the
// Board Summit rows already use ("09:00 – 09:30").
//
// Session Type is pinned to the seven options the field already offers. Nothing new is added to the
// single-select: "Check-in" is a Break on the Board Summit, so Checking In is too, and the two rows
// that fit none of the seven (the LP Forum's morning bridge line, the Pension Summit's Award) are
// left blank, which renders as a row with no pill.
//
//   node scripts/seed-day0-programs.mjs          # print the rows, write nothing
//   node scripts/seed-day0-programs.mjs --write  # create them in Airtable
//
// Idempotent-ish: --write refuses to run if the table already holds rows for one of the four
// events, so a second run cannot double the programme.

import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE_ID;
const TABLE = "tblSlpTzDi2oVYwqv"; // Sessions

// A slot: [start, title, type, moderators, speakers]. type "" = no pill.
// Moderator/Speaker strings are " · "-joined "Name, Title, Company" entries, exactly as
// lib/program.ts's parsePeople() expects. "To be announced" is kept where the design shows a
// placeholder — the parser drops those, so the embed stays clean while the cell records the slot.
const PROGRAMS = {
  "European Growth Pension & Insurance Summit": [
    ["09:00", "Checking In", "Break", "", ""],
    ["09:30", "Intro by the Host", "Opening Remarks", "", "Marianne Dahl"],
    [
      "09:35",
      "Opening Panel: Pension & Insurance Capital Anno 2026",
      "Panel",
      "Marianne Dahl, Professional Board Member",
      "Merete Clausen, Deputy CEO, EIF · Jakob Engel-Schmidt, Minister for Taxation and Growth · Kent Damsgaard, CEO, F&P · Michael Dithmer, Chairman, EIFO · Jan Johan Kühl, Managing Partner, Polaris Private Equity",
    ],
    [
      "10:03",
      "Keynote: State of European Pension (Report Launch)",
      "Keynote",
      "",
      "Yoram Wijngaarde, Founder and CEO, Dealroom",
    ],
    [
      "10:14",
      "Panel: State of European Pension (Discussion)",
      "Panel",
      "Anne Marie Kindberg, CEO, Altinget",
      "Prof. Philippe Tibi, Founder, Tibi Initiative · Rasmus Bessing, CIO, PFA · Yoram Wijngaarde, Founder and CEO, Dealroom",
    ],
    ["10:42", "Coffee Break", "Break", "", ""],
    [
      "10:55",
      "Panel: The Future of Pension Ecosystems in Europe",
      "Panel",
      "Oliver Holle, Managing Partner, Speedinvest",
      "Torben M. Andersen, Author of Pension Economics · Andreas Treichl, CEO, ERSTE Foundation · Matti Leppälä, Secretary General and CEO, PensionsEurope",
    ],
    [
      "11:23",
      "Panel: How Do We Unlock European Pension Capital to Growth",
      "Panel",
      "Anja Bach Eriksson, Professional Board Member",
      "Kasim Kutay, CEO, Novo Holdings · Peter Stensgaard Mørch, CEO, PensionDanmark · Jaakko Kiander, CEO, Keva · Jens Munch Holst, CEO, AkademikerPension · Kjetil Houg, CEO, Folketrygdfondet",
    ],
    ["11:51", "Building Tomorrow's Europe Award", "", "", ""],
    ["12:00", "Close", "Closing Remarks & Reflections", "", ""],
  ],

  "Nordic Family Office Summit": [
    ["08:30", "Checking In", "Break", "", ""],
    ["09:30", "Intro by the Host", "Opening Remarks", "", "Zenia W. Francker, Director, CVX Ventures"],
    [
      "09:40",
      "The Blueprint: Structuring a High-Performing Family Office",
      "Panel",
      "Zenia W. Francker, Director, CVX Ventures",
      "Rene Rechtman, Co-founder, Moonbug Entertainment",
    ],
    [
      "10:13",
      "Keynote: Introducing Venture Equity: New Variations of Venture Capital",
      "Keynote",
      "",
      "Robert Westerdahl, Founding Partner, Navisalma",
    ],
    [
      "10:26",
      "How do Successful Founders Approach Building a Family Office?",
      "Panel",
      "Marek Kiisa, Partner, NordicNinja",
      "Robert Westerdahl, Founding Partner, Navisalma · Linnéa Kornehed Falck, Founding Partner, Navisalma",
    ],
    [
      "10:58",
      "The Family Office Edge in Venture",
      "Panel",
      "Adrian Larsen, Partner, Aros Capital",
      "Victor Pancic, CIO, Habico Invest · Jesper Søgaard, CEO, Better Collective",
    ],
    ["11:30", "Close", "Closing Remarks & Reflections", "", ""],
  ],

  "LP Forum": [
    // The morning bridge line from the design: the LP Forum's room is running the other two
    // summits until noon. No type, so it draws as a plain row rather than claiming to be a session.
    ["09:00", "European Growth Pension & Insurance Summit and the Nordic Family Office Summit", "", "", ""],
    ["12:00", "Networking Lunch", "Networking & Drinks", "", ""],
    [
      "12:30",
      "Intro by the Host",
      "Opening Remarks",
      "",
      "Joe Schorge, Founder and Managing Partner, Isomer Capital",
    ],
    [
      "12:40",
      "Building Europe's Next Champions",
      "Panel",
      "Daragh Brown, Senior Regional Representative, EIF",
      "Hrönn Greipsdóttir, CEO, Nýsköpunarsjóðurinn Kría · Peder Lundquist, CEO, EIFO",
    ],
    ["13:08", "Keynote: Dealroom Report", "Keynote", "", "Yoram Wijngaarde, Founder and CEO, Dealroom"],
    [
      "13:31",
      "Venture Capital After Zero Interest Rates: Valuations, Exits and AI Disruption",
      "Panel",
      "Erik Balck Sørensen, CIO, EIFO",
      "Paul Rippon, Founder, Rippon Capital · To be announced · Aileen Lee, Founder and Managing Partner, Cowboy Ventures",
    ],
    ["13:58", "Round Table Discussion", "Panel", "", ""],
    [
      "14:36",
      "Panel Talk: A Founder Story",
      "Panel",
      "Peter Aksel Villadsen, Senior Vice President, GN Hearing",
      "Mads Krogsgaard, CEO, Novo Nordisk Foundation · Micha Breakstone, Founder, Cellular Intelligence",
    ],
    [
      "15:04",
      "Global Fund Selection: How to Get the Right Access?",
      "Panel",
      "Frederik von Bennigsen, Investment Director, EIFO",
      "Ben Choi, Managing Director, Next Legacy · Thomas Kristensen, Partner, LGT Capital Partners · Carsten Gjørtler Salling, Partner, Danske Private Equity · Søren Thinggaard Hansen, Senior Partner, Novo Holdings",
    ],
    [
      "15:32",
      "Routes to Exit: The State of Liquidity in Venture",
      "Panel",
      "Federica Rayneri, Secondaries Investor, Lombard Odier",
      "Nicholas Sando, General Partner, Molten Ventures · Tim Thonhauser-Röhrich, Partner, i5invest · Erick Diaz, Co-Head EMEA Capital Markets, NYSE",
    ],
    ["16:00", "Close", "Closing Remarks & Reflections", "", ""],
  ],

  "TechBBQ Investor Day": [
    ["12:00", "Checking In & Lunch", "Break", "", ""],
    ["13:00", "Intro by the Host", "Opening Remarks", "", "Trine Hoffensetz Winther, CEO, DanBAN"],
    ["13:10", "Keynote: Welcome to Innovation District Copenhagen", "Keynote", "", "To be announced"],
    [
      "13:23",
      "Keynote: European Tech Sovereignty",
      "Keynote",
      "",
      "Margrethe Vestager, Chair of the Board, DTU",
    ],
    ["13:36", "Keynote", "Keynote", "", "To be announced"],
    [
      "13:49",
      "Panel: European Tech Sovereignty",
      "Panel",
      "Lars Frølund, Lecturer, MIT",
      "Margrethe Vestager, Chair of the Board, DTU · To be announced · To be announced",
    ],
    [
      "14:17",
      "Keynote: Data: State of Venture",
      "Keynote",
      "",
      "Yoram Wijngaarde, Founder and CEO, Dealroom",
    ],
    [
      "14:45",
      "Panel: Built in Europe, Bought by America",
      "Panel",
      "To be announced",
      "To be announced · To be announced · To be announced · To be announced",
    ],
    [
      "15:03",
      "Panel: What It Actually Takes to Win and Close a Fund Right Now",
      "Panel",
      "Alexis Horowitz-Burdick, General Partner, Unconventional Ventures",
      "Tamara Savic, Investment Director, EIFO · To be announced · Johan Bøe Bjørkevoll, Investment Director, Investinor",
    ],
    [
      "15:31",
      "Private LP Panel: Fundraising from Family Offices and HNWIs",
      "Panel",
      "To be announced",
      "To be announced · To be announced · To be announced",
    ],
    ["16:22", "Close", "Closing Remarks & Reflections", "", ""],
  ],
};

/** Each slot's end is the next slot's start; the last row keeps a bare start time. */
function rowsFor(event, slots) {
  return slots.map(([start, name, type, mod, spk], i) => {
    const next = slots[i + 1];
    const fields = {
      "Name of the Event": event,
      "Session Name": name,
      "Time Slot": next ? `${start} – ${next[0]}` : start,
    };
    if (type) fields["Session Type"] = type;
    if (mod) fields["Moderator Details"] = mod;
    if (spk) fields["Speaker Details"] = spk;
    return { fields };
  });
}

const ALL = Object.entries(PROGRAMS).flatMap(([event, slots]) => rowsFor(event, slots));

if (!process.argv.includes("--write")) {
  for (const [event, slots] of Object.entries(PROGRAMS)) {
    console.log(`\n=== ${event} · ${slots.length} rows ===`);
    for (const { fields } of rowsFor(event, slots)) {
      console.log(
        `  ${fields["Time Slot"].padEnd(15)} ${(fields["Session Type"] || "—").padEnd(30)} ${fields["Session Name"]}`
      );
      if (fields["Moderator Details"]) console.log(`      MOD: ${fields["Moderator Details"]}`);
      if (fields["Speaker Details"]) console.log(`      SPK: ${fields["Speaker Details"]}`);
    }
  }
  console.log(`\n${ALL.length} rows total. Dry run — nothing written. Re-run with --write.`);
  process.exit(0);
}

const events = Object.keys(PROGRAMS);
const formula = `OR(${events.map((e) => `{Name of the Event}="${e}"`).join(",")})`;
const existing = await fetch(
  `https://api.airtable.com/v0/${BASE}/${TABLE}?pageSize=100&fields%5B%5D=${encodeURIComponent("Name of the Event")}&filterByFormula=${encodeURIComponent(formula)}`,
  { headers: { Authorization: `Bearer ${TOKEN}` } }
).then((r) => r.json());

if (existing.records?.length) {
  console.error(
    `REFUSING TO WRITE: ${existing.records.length} row(s) for these events already exist. ` +
      `Delete them in Airtable first, or this run would duplicate the programme.`
  );
  process.exit(1);
}

for (let i = 0; i < ALL.length; i += 10) {
  const batch = ALL.slice(i, i + 10);
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: batch }),
  });
  if (!res.ok) {
    console.error("FAILED at batch", i / 10, res.status, await res.text());
    process.exit(1);
  }
  console.log(`wrote ${i + batch.length}/${ALL.length}`);
}
console.log("done");
