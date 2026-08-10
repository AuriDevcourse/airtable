// Fills Profile Picture on Grill Session rows from PUBLICLY FETCHABLE portrait URLs.
// Airtable pulls the URL server-side and re-hosts it, so the source must be open (no auth).
//
// RULES THAT PRODUCED THIS LIST - keep them if you extend it:
//  1. Source must be the person's own org/press/conference page, NOT a search result.
//  2. Trust the FILENAME, not the alt text. boras-ink.se serves Mats-Ekman_1.1.jpg with
//     alt="Annelie Rådhall" - alt-only matching puts the wrong face on a speaker.
//  3. Reject og:image on article pages: it is usually a logo or stock art. Dealfront's
//     press release og:image is a 3D cartoon ID card, not Jillian Als.
//  4. Reject group shots and multi-person team photos.
//  5. Eyeball it before it goes in. Two wrong faces were caught this way.
//
// verified: "looked at it" = image was opened and confirmed a single-person portrait.
//           "page-match"   = dedicated single-person page, filename AND alt both match.

const token = process.env.AIRTABLE_TOKEN;
const BASE = "appgXNjXJqpk9Ebxd", T = "tblTecOBecLQCNIeD", V = "viwfIcQFDNQ9ggSqx";
const h = { Authorization: `Bearer ${token}` };
const COMMIT = process.argv.includes("--commit");
const ONLY = (process.argv.find(a => a.startsWith("--only=")) || "").slice(7);

const PHOTOS = [
  { name: "Guillaume Petit-Pierre", verified: "looked at it",
    src: "https://www.venturelab.swiss/demandit/files/M_BB941CC4DCEF687AD98/dms//Image/ARTIRIA_Guillaume_PetitPierre.jpg",
    from: "venturelab.swiss Venture Leaders profile" },
  { name: "Olgac Ergeneman", verified: "looked at it",
    src: "https://magnes.ch/wp-content/uploads/2025/09/Olgac-gray.jpg",
    from: "magnes.ch own company page" },
  { name: "Victoria Throen Longhi", verified: "looked at it",
    src: "https://cdn.prod.website-files.com/6888a2feaeb58a0dabd9d905/69ab4317b8be3f24bf91fb4b_Victoria%20Longhi.jpg",
    from: "owlvc.com own team profile page" },
  { name: "George Storm", verified: "looked at it",
    src: "https://assets.swoogo.com/uploads/full/6669392-69b2efd215224.png",
    from: "B2B Marketing European ABM Forum speaker page" },
  { name: "Annelie Rådhall", verified: "looked at it",
    src: "https://boras-ink.se/wp-content/uploads/2025/01/Annelie-Radhall_1.1.jpg",
    from: "boras-ink.se own about page (FILENAME match - their alt text is scrambled)" },
  { name: "Olivia Stokholm", verified: "looked at it",
    src: "https://amplitude.dk/wp-content/uploads/2026/04/IMG_0543-1.jpg",
    from: "amplitude.dk own about page" },
  { name: "Carl Carell", verified: "page-match",
    src: "https://images.teamtailor-cdn.com/images/s3/teamtailor-production/gallery_picture-v6/image_uploads/1bd17902-e525-4ee6-8f5a-10e75fb8483e/original.jpg",
    from: "GetAccept own careers people page, alt='Picture of Carl Carell'" },
  { name: "Jussi Pyysalo", verified: "page-match",
    src: "https://businessturku.fi/app/uploads/2026/02/Jussi_Pyysalo.jpg",
    from: "businessturku.fi own contact page for him" },
  { name: "Roxana Belciu Kerns", verified: "page-match",
    src: "https://gynecology.magnusconferences.com/uploads/speakers/roxana-belciu-kerns-6219.jpg",
    from: "Magnus Conferences speaker page, filename+alt both match" },
  { name: "Manuel\tMejia", verified: "looked at it",
    src: "https://haydenbiotech.com/wp-content/uploads/2024/12/Manuel-CEO.webp",
    from: "haydenbiotech.com own team page. Site shows first names only, but there is exactly one Manuel and he is Co-founder & CEO, matching this row" },
  { name: "Gertrude Chilufya", verified: "page-match",
    src: "https://theblackwomenintech.com/wp-content/uploads/2023/08/gertrude-chilufya-westrin-scaled-e1692892501762-1369x1369.jpg",
    from: "theblackwomenintech.com feature about her, filename+alt both match" },
  // Found via the Chrome extension, which renders JS and carries a real browser fingerprint -
  // both of these are invisible to a plain server-side fetch.
  { name: "Isabella Vahdati", verified: "looked at it",
    src: "https://cdn.prod.website-files.com/6924982cd85cbab57fe65dd1/69612520f41dfda666d78587_IV_blue.avif",
    from: "brighteyevc.com/team - JS-rendered. Matched by DOM adjacency to the text 'Isabella Vahdati / Principal', NOT by filename (they file portraits by initials, IV_blue)" },
  { name: "Juuso Blomster", verified: "page-match",
    src: "https://images.squarespace-cdn.com/content/v1/612cd2833850b4741fea579d/f4f91bd2-4fbe-401a-a73f-488e84e1037a/Juuso+Blomster.png",
    from: "cardiosignal.com own team page, filename is his name" },
];

// REJECTED, and why - do not silently re-add these:
//   Anders Rosenqvist      seoday.dk now redirects to s360digital.com; its only "Anders" image is
//                          anders-lynggaard-poulsen.jpeg - a DIFFERENT Anders
//   Yohanna Gustafsson     cse.cbs.dk/team/yohanna-gustafsson/ opened in a real browser: the page
//                          genuinely has no portrait, just her name. Confirmed negative, not a fetch failure
//   Jillian Als            og:image on the Dealfront press release is a stock 3D ID-card graphic
//   Magnus Dadi Eyjolfsson only klak.is match is KLAK_VMS_portrett_magnus_ingi_oskarsson - a DIFFERENT Magnus
//   Frank Kjerstein        nordiclabourjournal shot is him AND Andre Alexander Westergaard - two people
//   Juuso Juhila           thestra.fi og:image is the company logo
//   Jens Sonnenborg        skytek.dk og:image is a site banner
//   Teis Nilou Nørgaard    icdk.dk og:image is a photo of Shanghai
//   Yohanna Gustafsson     cse.cbs.dk serves only the site logo and a Facebook tracking pixel
//   Louise Lachmann        uglyduckling.ventures only has a 147x74 blurred thumbnail
//   Isabella Vahdati       brighteyevc.com/team renders its portraits in JS, nothing in the HTML
//   Mårten Skogh           chalmersnextlabs.se team page has no per-person image

let recs = [], offset;
do {
  const u = new URL(`https://api.airtable.com/v0/${BASE}/${T}`);
  u.searchParams.set("view", V); u.searchParams.set("pageSize", "100");
  if (offset) u.searchParams.set("offset", offset);
  const j = await (await fetch(u, { headers: h })).json();
  recs = recs.concat(j.records || []); offset = j.offset;
} while (offset);
const grill = recs.filter(r => /Grill Session$/i.test(r.fields["Project Name"] || ""));

const updates = [];
for (const p of PHOTOS) {
  if (ONLY && p.name !== ONLY) continue;
  const hit = grill.find(r => (r.fields["Full Name"] || "").trim() === p.name);
  if (!hit) { console.log("NOT FOUND in grill rows:", p.name); continue; }
  if (Array.isArray(hit.fields["Profile Picture"]) && hit.fields["Profile Picture"].length) {
    console.log(`already has a picture, skipping: ${p.name}`); continue;
  }
  // confirm the URL is actually live and actually an image before handing it to Airtable
  let head;
  try { head = await fetch(p.src, { method: "GET", headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(25000) }); }
  catch (e) { console.log(`SOURCE UNREACHABLE ${p.name}: ${e.message}`); continue; }
  const ct = head.headers.get("content-type") || "";
  if (!head.ok || !ct.startsWith("image/")) {
    console.log(`SOURCE NOT AN IMAGE ${p.name}: ${head.status} ${ct}`); continue;
  }
  const ext = ct.includes("png") ? "png" : "jpg";
  updates.push({ id: hit.id, fields: { "Profile Picture": [{ url: p.src, filename: `${p.name}.${ext}` }] } });
  console.log(`will set photo: ${p.name.padEnd(24)} [${p.verified}]  <- ${p.from}`);
}

console.log(`\n${updates.length} row(s) to update.`);
if (!COMMIT) { console.log("DRY RUN. add --commit"); process.exit(0); }

let done = 0;
for (let i = 0; i < updates.length; i += 10) {
  const chunk = updates.slice(i, i + 10);
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${T}`, {
    method: "PATCH", headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ records: chunk }),
  });
  if (!r.ok) { console.error("PATCH failed", r.status, (await r.text()).slice(0, 400)); process.exit(1); }
  done += chunk.length;
}
console.log("updated:", done);
