// Read-only. Every speaker on TechBBQ 2026, checked for duplicate PEOPLE on NAME, PHOTO,
// COMPANY and JOB TITLE. Nothing is written; the report says which copy is safe to delete.
//
// Confidence tiers, because these are not equally reliable:
//   CERTAIN   same normalised name  ·  identical photo file  ·  near-identical photo pixels
//   STRONG    same surname + same company  ·  name subset  ·  whole-name typo (<=2 edits)
//   REVIEW    same company + same job title (different names)  ·  same surname + first initial
//   WEAK      same surname only. Common surnames make this noisy, so it is listed last and
//             only for pairs no stronger pass already caught.
//
// PHOTO: Brella stores /uploads/speaker/photo/<id>/<hash>.ext where <hash> is per FILE, so a
// shared hash means the same upload. That misses the same person uploaded from two different
// files, which is exactly how Ulla Sommerfeldt and Nick Sando hid, so every photo is also
// downloaded and reduced to a 16x16 greyscale signature and compared pixel-wise.
import sharp from "sharp";
const BRELLA = process.env.BRELLA_API_KEY || process.env.BRELLA;
const EV = "https://api.brella.io/api/integration/organizations/109/events/10356";
const R = { "Brella-API-Access-Token": BRELLA, Accept: "application/vnd.brella.v4+json" };
const SKIP_PHOTOS = process.argv.includes("--no-photos");

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const STOP = /^(dr|prof|mr|ms|mrs|the|van|von|de|den|der|di|el|al|bin)$/;
const words = s => norm(s).split(" ").filter(w => w && !STOP.test(w));
// Job titles and companies are compared loosely: "CEO & Founder" vs "CEO and founder", and
// "Molten Ventures" vs "Molten Secondaries" should not be treated as unrelated strings.
const co = s => norm(s).replace(/\b(aps|a s|as|ab|oy|ltd|limited|inc|llc|gmbh|bv|nv|plc|group|holding|the)\b/g, "").replace(/\s+/g, " ").trim();
const job = s => norm(s).replace(/\b(and|of|at|the|amp)\b/g, "").replace(/\s+/g, " ").trim();

function edits(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = cur;
    }
  }
  return prev[b.length];
}

let all = [], page = 1;
for (;;) {
  const j = await (await fetch(`${EV}/speakers?page[size]=200&page[number]=${page}`, { headers: R })).json();
  const d = j.data || [];
  all = all.concat(d);
  if (d.length < 200 || page++ > 20) break;
}
const ts = await (await fetch(`${EV}/timeslots?page[size]=500`, { headers: R })).json();
const byId = new Map((ts.included || []).map(x => [`${x.type}:${x.id}`, x]));
const one = r => (Array.isArray(r?.data) ? r.data[0] : r?.data) || null;
const many = r => (Array.isArray(r?.data) ? r.data : r?.data ? [r.data] : []);
const sess = new Map();
for (const slot of (ts.data || [])) {
  for (const ref of many(slot.relationships?.["speaker-assignments"])) {
    const sid = one(byId.get(`speaker-assignment:${ref.id}`)?.relationships?.speaker)?.id;
    if (!sid) continue;
    if (!sess.has(sid)) sess.set(sid, []);
    sess.get(sid).push(`${slot.attributes.title.slice(0, 44)} (${String(slot.attributes["start-time"]).slice(0, 10)})`);
  }
}

const people = all.map(s => {
  const a = s.attributes || {};
  const full = [a.honorific, a["first-name"], a["middle-name"], a["last-name"]].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const url = a["photo-url"] || "";
  return { id: s.id, full, n: norm(full), w: words(full), url,
    file: (url.split("/").pop() || "").split("?")[0],
    company: a["company-name"] || "", title: a["job-title"] || "",
    c: co(a["company-name"]), j: job(a["job-title"]),
    sessions: sess.get(s.id) || [], sig: null };
});
console.log(`speakers: ${people.length}`);

if (!SKIP_PHOTOS) {
  let done = 0, i = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (i < people.length) {
      const p = people[i++];
      if (!p.url) continue;
      try {
        const b = Buffer.from(await (await fetch(p.url, { signal: AbortSignal.timeout(25000) })).arrayBuffer());
        p.sig = await sharp(b).resize(16, 16, { fit: "fill" }).greyscale().raw().toBuffer();
        done++;
      } catch {}
    }
  }));
  console.log(`photo signatures built: ${done}`);
}
const pdiff = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]); return s / a.length; };

const seen = new Set(), out = [];
const add = (tier, why, list) => {
  const key = list.map(p => p.id).sort().join(",");
  if (seen.has(key)) return;
  seen.add(key); out.push({ tier, why, list });
};

for (let i = 0; i < people.length; i++) {
  for (let j = i + 1; j < people.length; j++) {
    const a = people[i], b = people[j];
    const sameCo = a.c && a.c === b.c;
    const al = a.w[a.w.length - 1], bl = b.w[b.w.length - 1];
    const sameSur = al && bl && al === bl;

    if (a.n && a.n === b.n) { add("CERTAIN", "same name", [a, b]); continue; }
    if (a.file && a.file === b.file) { add("CERTAIN", "identical photo file", [a, b]); continue; }
    if (a.sig && b.sig) { const d = pdiff(a.sig, b.sig); if (d < 12) { add("CERTAIN", `near-identical photo (diff ${d.toFixed(1)})`, [a, b]); continue; } }

    if (a.w.length > 1 && b.w.length > 1) {
      const [s, g] = a.w.length <= b.w.length ? [a.w, b.w] : [b.w, a.w];
      if (s.every(w => g.includes(w))) { add("STRONG", "one name contains the other", [a, b]); continue; }
      if (edits(a.n.replace(/ /g, ""), b.n.replace(/ /g, "")) <= 2) { add("STRONG", "names within 2 typos", [a, b]); continue; }
    }
    if (sameSur && sameCo) { add("STRONG", "same surname + same company", [a, b]); continue; }
    if (sameCo && a.j && a.j === b.j) { add("REVIEW", "same company + same job title", [a, b]); continue; }
    if (sameSur && a.w[0]?.[0] === b.w[0]?.[0] && a.w[0] !== b.w[0]) { add("REVIEW", "same surname + same initial", [a, b]); continue; }
    if (sameSur) add("WEAK", "same surname only", [a, b]);
  }
}

const TIER = { CERTAIN: 0, STRONG: 1, REVIEW: 2, WEAK: 3 };
out.sort((x, y) => TIER[x.tier] - TIER[y.tier]);
const counts = out.reduce((m, g) => ((m[g.tier] = (m[g.tier] || 0) + 1), m), {});
console.log(`\ngroups: ${JSON.stringify(counts)}\n`);
for (const g of out) {
  console.log(`[${g.tier}] ${g.why}`);
  for (const p of g.list) {
    console.log(`   #${p.id}  ${p.full.padEnd(24)} ${String(p.sessions.length)}s  ${p.title.slice(0, 30).padEnd(31)} ${p.company.slice(0, 26)}`);
    for (const s of p.sessions) console.log(`        · ${s}`);
  }
  const zero = g.list.filter(p => !p.sessions.length);
  if (g.tier !== "WEAK")
    console.log(`   => ${zero.length === 1 && g.list.length === 2 ? `delete #${zero[0].id} (on no session)` : zero.length === g.list.length ? "none are on a session" : "each is on a session — merge in the UI first"}`);
  console.log("");
}
