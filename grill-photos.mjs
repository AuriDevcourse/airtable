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

  // --- 2026-08-10 pass. Same rules. Found with a real browser (JS-rendered team pages are
  // invisible to a plain fetch) and each one opened and looked at before being listed here.
  { name: "Kasper Hulthin", verified: "looked at it", src: "__FROM_SPEAKERS__",
    from: "already in THIS base - the Speakers table has his headshot. Own asset, best source" },
  { name: "Andreas Schwarz", verified: "looked at it",
    src: "https://commission.europa.eu/sites/default/files/styles/oe_theme_medium_2x_no_crop/public/2025-03/andreas-schwarz.jpg",
    from: "commission.europa.eu, Commissioner Zaharieva's own cabinet page. filename+alt both match" },
  { name: "Mårten Skogh", verified: "looked at it",
    src: "https://www.chalmers.se/api/media/?url=https://cms.www.chalmers.se/Media/2kfl1pxs/skoghm.jpeg",
    from: "chalmers.se staff profile, alt='Profile photo of Mårten Skogh'. NOTE: use this /api/media/ URL - cms.www.chalmers.se refuses a plain server-side fetch, so the direct .jpeg 502s" },
  { name: "Martin Keller", verified: "looked at it",
    src: "https://www.acodis.io/hs-fs/hubfs/Websites%20Page/Martin_Keller_copy-removebg-preview.png",
    from: "acodis.io own about-us page (acodis.IO, not .com - .com is a different company)" },
  { name: "Rogier Brakshoofden", verified: "looked at it",
    src: "https://www.nextnextyear.com/assets/rogier.png",
    from: "nextnextyear.com own about page, alt is his full name" },
  { name: "Juuso Juhila", verified: "looked at it",
    src: "https://thestra.fi/wp-content/uploads/juuso_juhila.jpg",
    from: "thestra.fi own front page. The earlier reject was of their og:image (a logo) - this is the real portrait, filename is his name" },
  { name: "Thomas Eaton", verified: "looked at it",
    src: "https://limula.ch/wp-content/uploads/2025/08/Tom_LIM4471.jpg",
    from: "limula.ch own about page. Filename is 'Tom_...', so matched by the caption instead: the image sits under the heading THOMAS EATON. Their page says Founder and CEO where the row says CFO - same person, one of the two titles is stale" },
  { name: "Olli Huhtinen", verified: "looked at it",
    src: "https://www.evogencebio.com/assets/team-olli-D2mtnqhZ.png",
    from: "evogencebio.com own team section, alt is his full name" },
  { name: "Maarten Everts", verified: "looked at it",
    src: "https://files.gotocon.com/uploads/portraits/1409/square_medium/maarten_everts_1677146261.jpg",
    from: "GOTO conference speaker page, filename+alt match and the page states 'CTO & co-founder Linksight', which matches the row" },
  { name: "Pia Hardy", verified: "looked at it",
    src: "https://womenintech.se/wp-content/uploads/2025/04/pia_.jpg",
    from: "Women in Tech Sweden speaker page. Filename is only 'pia_', so corroborated on the page text: 'Head of Healthcare & Life Sciences Nordics, Nvidia' - the row's title word for word" },
  { name: "Richard Holborow", verified: "looked at it",
    src: "https://www.conferenceharvester.com/uploads/harvester/photos/cropZZLBVRUB-Presenter-HolborowR.jpg",
    from: "RAPS Convergence 2025 presenter page, which states 'Global Head of Clinical Compliance, BSI, United Kingdom'" },
  { name: "Frank Kjerstein", verified: "looked at it",
    src: "https://www.gitexeurope.com/images/Frank-Kjerstein-Reblade-CEO-BW.jpg",
    from: "GITEX Europe speaker asset. Filename carries name+company+role; their alt text says 'Geoffrey Hinton', which is scrambled - same trap as boras-ink. Black and white" },
  // --- 2026-08-11. Two that the 2026-08-10 pass concluded were unfindable, but are not.
  // Both sit on MULTI-PERSON pages, where taking the nearest image by character distance in the
  // raw HTML is unsafe - it hands you the neighbour's face. Both confirmed instead by DOM
  // ADJACENCY in a real browser: the image inside the same card as the person's own name.
  { name: "Sara Storm", verified: "looked at it",
    src: "https://funnelemea.com/__l5e/assets-v1/e339193a-82f2-4cff-adb9-d9262e76c5ea/sara-storm.png",
    from: "funnelemea.com speaker page - filename AND alt independently both read 'Sara Storm'" },
  { name: "Anders Rosenqvist", verified: "looked at it",
    src: "https://www.whitepress.com/userfiles/int_seovibes_ontour_agendas/174764673377344300.png",
    from: "whitepress.com SEO Vibes Copenhagen agenda. Numeric filename and NO alt, so confirmed by DOM adjacency to 'Anders Rosenqvist / Marketing Performance Manager, A.P. Moller - Maersk' - the row's title AND company word for word" },
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
//                          SUPERSEDED 2026-08-10: chalmers.se, his university, does have one
//
// Rejected in the 2026-08-10 pass, same rules:
//   Louise Lachmann        evalyze.ai is a third-party investor directory, not her own org, 200x200
//   Katrine Rasmussen      only muraena.ai / clay.earth contact-scraper avatars, 200x200
//   Michael Yngfors        the aigothenburg.com shot names five people in it (rule 4)
//   Laurie Lancee          the photo on her OWN site is captioned as her AND Tessa de Flines
//   Fabio Cavaliere        achucarro.org has a Fabio Cavaliere, but a Basque neuroscientist. The
//                          row is Ideon Science Park, Sweden. Different person, do not re-add
//   Moritz Hartmann        only a XING profile photo, same auth-walled social class as LinkedIn
//   Yuval Temam            ru.nl profile is a Radboud University "Y. Temam", unconfirmed as the
//                          Lighthouse Lab one, and the URL is a hashed short-lived link
//   Gaia Balossi           confirmed her by the name badge in the shot, but it is a candid with
//                          another person's head in frame, not a portrait
//   Vincent van der Holst  emeaentrepreneur.com photo is genuinely him, but it is a stunt pose
//                          (hand shielding eyes) and the row says VNYX where the piece says BOAS
//   Jennifer Montague      helloretail.com podcast still is one person, but nothing outside
//                          LinkedIn ties that Jennifer Montague to Cerivo
//   Kim Rants              only the Y Combinator avatar: 200x200 behind a 1-hour presigned S3 URL
//   Bue Fisker, Daniel Nordin Baker, Vahid Sohrabpour, Maarten Kas, Raymond Alves,
//   Monika Kanda, Lisa Nyman, Anna Kivinen, Catarina Mendonça, Agnieszka Chlad, Ramona Ocak,
//   Marie Adam, Ulla Sommerfeldt, Nadia Lodroman
//                          searched, nothing fetchable that is provably them
//   Maarten Kas            EXHAUSTED 2026-08-11, every non-LinkedIn avenue named so nobody re-walks
//                          them: remotik.nl does not resolve; DVR Solutions (his other company)
//                          /over-ons/ returns 403 even in a real browser, so that page is gone not
//                          bot-blocked; the EDIH and Enterprise Europe Network pieces that confirm
//                          "Maarten Kas, CEO van Remotik" carry no photo of him; and his F6S
//                          self-made profile avatar is A LOGO (a yellow play-button mark), not a
//                          face - largest variant 192x192, under the bar anyway. LinkedIn only.
//   Yuval Temam            EXHAUSTED, and deliberately blank. The submission form says Lighthouse
//                          Lab "helps business validate and audit AI systems"; the only public
//                          Yuval Temam in NL has an SES (satellite operator) headline. That is
//                          positive evidence of a DIFFERENT PERSON, not absent evidence. There is
//                          no confirmed identity to attach a face to. Needs the partner, not search.
//   Sara Storm             FOUND 2026-08-11 on funnelemea.com - now in the list above
//   Anders Rosenqvist      FOUND 2026-08-11 on whitepress.com - now in the list above
//   Kim Rants              left rejected. The YC avatar IS provably him (alt='Kim Rants') but the
//                          200x200 bar is a fair call, and it is a 1-hour presigned S3 URL. If you
//                          ever want it, resolve it live like resolveFromSpeakers does - do NOT
//                          hardcode a signed URL, it will rot

// One entry takes its photo from elsewhere in this same base rather than the open web. Resolved
// live so the link cannot go stale: Airtable attachment URLs are signed and expire.
async function resolveFromSpeakers(fullName) {
  let out = [], offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/Speakers`);
    u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const j = await (await fetch(u, { headers: h })).json();
    if (j.error) return null;
    out = out.concat(j.records || []); offset = j.offset;
  } while (offset);
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const hit = out.find(r => norm(r.fields["Full Name"] || r.fields["Name"]) === norm(fullName));
  const att = hit && Object.values(hit.fields).find(v => Array.isArray(v) && v[0] && /^image\//.test(v[0].type || ""));
  return att ? att[0].url : null;
}
for (const p of PHOTOS) {
  if (p.src !== "__FROM_SPEAKERS__") continue;
  p.src = await resolveFromSpeakers(p.name);
  if (!p.src) console.log(`could not resolve from Speakers table: ${p.name}`);
}

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
