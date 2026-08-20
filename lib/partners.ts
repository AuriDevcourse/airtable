// Server-only access to the TechBBQ 2026 partner list, grouped by partnership tier.
//
// Source: Marketing Project Overview, view "Partner Deliverables 2026".
//
// THE TIER COMES FROM THE DEAL SIZE (Auri, 2026-08-04). It used to come from this view's own
// `Partnership Type 2026` plus ten hand-written corrections copied off the live site, because
// that column and the CRM disagreed on 16 rows and nobody trusted the CRM. That is no longer
// true: the `Company Link` column has been filled in across this view, so
// `Partnership Tier (from Tier)` now resolves for every partner but one, and it derives from
// Deal 2026 through a formula on Partners 2026 rather than from anybody's memory.
//
// So the corrections are GONE. Do not reintroduce them: a hand-maintained override table beside
// a computed field is two sources of truth, and it was already drifting (its Dealroom entry said
// Challenger while the deal says Community).
//
// WHICH COMPANIES APPEAR used to be a separate question, with Investor, Academic and Tailored
// partnerships excluded by `Partnership Type 2026`. **That exclusion is gone as of 2026-08-05** — the
// tier follows the deal price now, and Auri's call is that the price places everyone. See the section
// below for the reasoning and what it added.
//
// ─── THE TWO PUBLISH RULES (Auri, 2026-08-05) ───────────────────────────────────────────
// Both must hold, or the partner is not on the website at all. They are gates, not warnings:
// half a rule produces a wall with holes in it, which is what this replaced.
//
//   1. "Put on web" MUST BE TICKED. The column was already being read here and then ignored,
//      so the checkbox marketing maintains had no effect on techbbq.dk while looking as though
//      it did — seven published partners were unticked. It is the record of what is live, so it
//      now decides what is live.
//
//   2. THE LOGO MUST BE ONE A NEAR-BLACK WALL CAN DRAW: a white SVG, or at worst a white PNG.
//      No logo, or a logo in another format, means no place on the wall rather than an empty
//      tile beside 103 filled ones.
//
// ─── THE DASHBOARD SEES THE ONES THAT FAILED; techbbq.dk DOES NOT ───────────────────────
// A rule that silently removes a partner is a rule nobody can act on: the only trace was a line
// in the Vercel log. So `fetchPartners({ includePending: true })` also returns the rows the two
// rules turned away, each carrying `pending` with the reason, and /partners draws them as named
// placeholder tiles — the worklist of what still needs a logo or a tick (Auri, 2026-08-05).
//
// It is OPT-IN, and that direction matters. The default is the strict list, so the snippet pasted
// into techbbq.dk keeps getting exactly what it gets today even if someone forgets a parameter.
// The route also requires the dashboard password for it: an unannounced partnership is not
// something to publish on a public endpoint.
//
// An EMBARGOED partner is never pending and never returned either way — see HIDDEN_UNTIL.
//
//      WHAT THIS FILE CAN AND CANNOT CHECK. Format is structural, so it is enforced here
//      (PUBLISHABLE_LOGO below). WHITENESS is a property of the pixels, and this feed cannot
//      fetch and rasterise 104 logos per request to find out. Filenames are no substitute: this
//      dataset's worst offender, a near-black SVG at luminance 69, is called
//      "Virksomhedsguiden_Logo.svg", so a name rule would have shipped it and did.
//      So whiteness is MEASURED OUT OF BAND by `node scripts/check-logo-tone.mjs`, which
//      rasterises every published logo and reports the ink luminance. Its failures are fixed in
//      Airtable, or listed in AIRTABLE_LOGO_REJECT below when a curated copy has to stand in.
//      Run it after any bulk upload.
//
// ─── WHERE THE LOGOS COME FROM ──────────────────────────────────────────────────────
// AIRTABLE, as of 2026-08-04 (Auri). This reversed the previous decision, and the reason is
// simply that the data changed: the `Logo` column used to hold colour originals only (69 PNG,
// 8 JPEG, 16 SVG, plus a zip, a PDF and an .ai), which is why the wall was built off a copy of
// the tbbqvisualgen library instead. Auri has since uploaded white SVG exports into that column
// — it now holds 146 SVGs — so the view carries the right artwork for a near-black wall and
// there is no longer a reason to keep a second copy of it in this repo.
//
// What that buys, and it is the whole point: adding or REPLACING a partner logo in Airtable now
// shows up on techbbq.dk on its own. Nobody has to re-run a script, and nobody has to remember
// that a script exists. Measured before switching: all 104 published partners resolve to a
// usable image, 100 of them to a white SVG.
//
// The bytes are served through /api/photo/partners/<recordId>, not by linking Airtable directly:
// attachment URLs are signed and 410 after ~2 hours, so a cached feed would serve dead images
// (see lib/photo.ts). ?v=<attachment id> rides along so REPLACING a file busts every cache.
//
// public/partner-logos/ + lib/partnerLogoManifest.json + scripts/sync-partner-logos.mjs are kept
// as the FALLBACK, for a row whose Airtable cell holds nothing a browser can draw. That is
// currently no rows at all, so treat the script as a safety net rather than part of the workflow.

import { fetchWithTimeout } from "@/lib/http";
import { str } from "@/lib/fields";
import manifest from "@/lib/partnerLogoManifest.json";
import { baseUrl, photoUrl } from "@/lib/photo";
import { pickLogo, type LogoAttachment } from "@/lib/logoPick";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const VIEW = "viw7FVbsTb9IRaWF0"; // Partner Deliverables 2026

// ─── WHO IS PAYING, FOR THE DASHBOARD ONLY ──────────────────────────────────────────────
// Auri, 2026-08-20: "All the partners that are paying. Can you have a small label ... make sure it
// doesnt copy to embed, i just wna to see here."
//
// The amount is NOT on the deliverables table. Its 114 fields carry Partnership Type and three
// tier lookups and no deal figure at all, so this is a second read of Partners 2026, joined on
// `Company Link` (see the note on fetchPaying for why not `Partner ID`).
//
// FILTERED TO CONFIRMED, WHICH IS NOT A DETAIL. `partners` is in NEAR_LIVE_FEEDS, so the cache
// turns over every 60 seconds; an unfiltered scan of that table is 2,750 rows and would spend
// ~28 Airtable requests a minute to learn nothing. Confirmed is ~220 rows, about 3 pages, and a
// partner who is not Confirmed is not on the wall anyway.
//
// BARTER IS REPORTED SEPARATELY rather than folded into "paying". Auri's rule is that barter deals
// and add-ons count as value given, but a barter partner and a partner who wired money are
// different conversations, so the label says which.
//
// THE TIER ALONE CANNOT ANSWER THIS. `Partnership Tier (Based on Deal Size)` is a formula whose
// Community branch means Deal 2026 = 0, so the band tells you "zero cash" but not whether the
// partner gave anything else — and the paid Community-typed partners (19 of them, 2.25M DKK) sit
// in the bands above, indistinguishable from commercial deals of the same size.
const CRM_TABLE = "tbl9V6ZtxEbR4uELC"; // Partners 2026
const CRM_SAFE_FIELDS = ["Deal 2026", "Partnership Type 2026", "Add-ons"];

// KEYED ON THE CRM RECORD ID, NOT ON `Partner ID`, and that is the whole correctness story here.
//
// The obvious join is `Partner ID`, and it is wrong on this data. Measured 2026-08-20:
//
//   AWS Startups              Partner ID 2222, NO Company Link. 2222 belongs to NVIDIA, so the
//                             label read NVIDIA's 261.000 DKK and badged AWS Startups as paying.
//   European Investment Fund  Partner ID 1744, Company Link -> "EIF" (id 404, deal 0, No Deal).
//                             The two identifiers name different partners, so the badge and the
//                             tier disagreed on the same tile.
//
// Ten Partner IDs in this view sit on two rows each and at least one is simply wrong, so a
// Partner ID join attributes one company's money to another. `Company Link` is the real relation
// and it is already what `Partnership Tier (from Tier)` resolves through, so keying on it means
// the badge and the band can never contradict each other. No link, no label.
export type Paying = "cash" | "barter";

async function fetchPaying(): Promise<Map<string, Paying>> {
  const out = new Map<string, Paying>();
  if (!TOKEN || !BASE_ID) return out;

  let offset: string | undefined;
  do {
    const u = new URL(`${API}/${BASE_ID}/${CRM_TABLE}`);
    u.searchParams.set("pageSize", "100");
    u.searchParams.set("filterByFormula", '{Status 2026}="Confirmed"');
    for (const f of CRM_SAFE_FIELDS) u.searchParams.append("fields[]", f);
    if (offset) u.searchParams.set("offset", offset);

    // No explicit timeout, matching the deliverables read below: fetchWithTimeout's own default
    // applies, and this file has never declared one of its own.
    const res = await fetchWithTimeout(u.toString(), {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    // NOT fatal, deliberately. The label is an internal convenience; the wall itself has to render
    // either way, so a failure here means no labels rather than no partners.
    if (!res.ok) {
      console.error("[partners] paying lookup failed", res.status, "— rendering without labels");
      return new Map();
    }

    const body = (await res.json()) as {
      records?: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };
    for (const rec of body.records ?? []) {
      const id = rec.id;
      if (!id) continue;
      const deal = Number(rec.fields["Deal 2026"] ?? 0);
      const types = Array.isArray(rec.fields["Partnership Type 2026"])
        ? (rec.fields["Partnership Type 2026"] as unknown[]).map(String)
        : [];
      const addons = Array.isArray(rec.fields["Add-ons"]) ? rec.fields["Add-ons"] : [];
      if (deal > 0) out.set(id, "cash");
      else if (types.some((t) => /barter|add-?on/i.test(t)) || addons.length) out.set(id, "barter");
    }
    offset = body.offset;
  } while (offset);

  return out;
}

const SAFE_FIELDS = [
  "Company",
  // The link to the CRM row. Read for the paying label, which resolves through the SAME relation
  // the tier lookup uses so the two can never disagree. See fetchPaying().
  "Company Link",
  // Read for the logs only. It no longer gates anything and it never set the tier — the deal does.
  "Partnership Type 2026",
  // The tier, looked up from Partners 2026 where a formula derives it from Deal 2026.
  "Partnership Tier (from Tier)",
  // Publish rule 1. Read AND enforced since 2026-08-05 — see the header.
  "Put on web",
  "Link to your website",
  // The wall's artwork. Several variants per cell; lib/logoPick.ts chooses.
  "Logo",
  // A free-text tier instruction typed by the partnerships team. Beats every other tier source.
  // See exceptionTier().
  "Exceptions",
];

// Publish rule 2, the part that can be checked from the record alone. The wall is #0d0d0d, so
// the artwork has to be a knockout: a white SVG, or a white PNG when that is all there is.
// pickLogo() is deliberately more permissive than this (it also allows JPEG, GIF and WEBP, which
// the startup walls need), so the narrowing happens here rather than there.
const PUBLISHABLE_LOGO = /^image\/(svg\+xml|png)$/i;

// ─── THE PARTNERSHIP TYPE NO LONGER DECIDES ANYTHING (Auri, 2026-08-05) ──────────────────
// "We are following the partnership tier by price. This should be followed and all the logos should
// be added based on that."
//
// `Partnership Type 2026` used to exclude Investor, Academic and Tailored partnerships from the wall.
// That made sense while the tier was a typed label, but the tier is now DERIVED FROM THE DEAL: the
// price decides the band. Rockstart is the case that exposed the contradiction — type "Investor",
// tier "Challenger", five logos uploaded, and invisible. Auri went looking for it and found nothing.
//
// So the type gate is gone and the deal is the only classifier. The other two rules still apply, so
// nothing publishes itself: "Put on web" must be ticked and the logo must be a white SVG or PNG. An
// unticked investor partner shows on the DASHBOARD as a pending tile and not on techbbq.dk.
//
// For the record, in case the decision ever reverses: the excluded types were "Investor", "Academic"
// and "Tailored", read from `Partnership Type 2026`. No constant is kept for them — a dangling
// unused one is worse than a sentence.

// ─── PARTNERS WITH NO CONTRACT, AND THEREFORE NO DEAL TO DERIVE A TIER FROM ─────────────
// Read the header before adding to this. The old hand-written tier CORRECTIONS were deleted on
// purpose and must not come back: a table of overrides beside a computed field is two sources of
// truth, and it had already drifted.
//
// This is not that. These are partners where the formula has NOTHING to work from — no contract, so
// no Deal 2026, so no tier, ever. Computing cannot help; the only alternatives are naming them here
// or leaving them off the wall.
//
// It therefore fills a MISSING tier and never replaces a resolved one, which is what keeps the deal
// the single source of truth for every partner that has one. If a deal appears later, that deal wins
// and the entry here becomes dead weight — delete it then.
//
//   Crescita Partners — no contract, but Community by Auri's call (2026-08-05).
const NO_CONTRACT_TIERS: Record<string, string> = {
  "crescita partners": "Community",
};

function noContractTier(company: string): string | null {
  return NO_CONTRACT_TIERS[company.toLowerCase().replace(/\s+/g, " ").trim()] ?? null;
}

// ─── THE TIER EXCEPTIONS, AND THEY ARE NOT THE OLD CORRECTIONS TABLE ────────────────────
// Read the header first. The ten hand-written tier corrections were deleted on purpose and must
// not come back — they were a second source of truth beside a computed field and had already
// drifted. This is deliberately NOT that, and the difference is worth stating so nobody deletes
// it as a relic or, worse, starts adding to it:
//
//   NO_CONTRACT_TIERS fills a tier the formula could not produce.
//   This REPLACES one the formula did produce, which is a stronger claim and needs a reason.
//
// Skytek Nordics ApS — Core, by Auri's explicit call (2026-08-06). Its Deal 2026 is 0 across all
// three of its Partners 2026 records, so the deal-size formula can only ever say Community; the
// partnership is real but is not priced in that column. The view's own `Partnership Type 2026`
// has said "Core" all along, which is the same judgement recorded somewhere the wall stopped
// reading on 2026-08-05.
//
// Industriens Fond — Prime, by Auri's explicit call (2026-08-07). It funds TechBBQ by GRANT, and a
// grant never lands in `Deal 2026 inc. VAT %`: all five of its Partners 2026 records read 0, so the
// deal-size formula can only ever say Community. Prime starts at 751,000 on that ladder and no
// commercial row in the base reaches it, which is why the Prime band was empty entirely.
//
// The money is real, the column it would be measured in is the wrong column. That is the bar below.
//
// Erhvervsfremmebestyrelsen — Prime, by Auri's explicit call (2026-08-08). Same shape as Industriens
// Fond: it funds TechBBQ by GRANT, so its money never lands in `Deal 2026 inc. VAT %` and the
// deal-size formula has nothing to read. Prime starts at 751,000 on that ladder and no commercial row
// in the base reaches it, so without this entry the grant funder sits in no band at all.
//
// ─── THIS ENTRY REPLACED A WRONG ONE, WHICH IS WHY THE NAMES ARE SPELT OUT ──────────────
// Between 2026-08-07 and 2026-08-08 the Prime slot was held by "danish business authority", on the
// same grant argument. That was the WRONG ORGANISATION. Two Danish agencies are involved and the
// English names blur them:
//
//   Erhvervsstyrelsen         = Danish Business Authority. Commercial partner. `Deal 2026` 81,250
//                               (Confirmed) for the VIRKSOMHEDSGUIDEN work, which computes to Core.
//                               `recicegSWL1fgCvqZ`, still on the wall, now in the band its deal says.
//   Erhvervsfremmebestyrelsen = Danish Board of Business Development. The GRANT funder, and the one
//                               this entry is for. `recHE7XwVZgNPqtlP`.
//
// So Erhvervsstyrelsen never needed an exception — its deal describes its partnership perfectly well.
// Removing its entry is not overruling the earlier call, it is pointing the call at the right body.
//
// THE KEY DEPENDS ON THE `Company` CELL reading exactly "Erhvervsfremmebestyrelsen": this table is
// keyed on that name, so a rename (to the English "Danish Board of Business Development", say)
// silently matches nothing and drops the partner off the wall entirely, since it has no deal tier to
// fall back to.
//
// Humandone — Challenger, by Auri's explicit call (2026-08-11). They built the TechBBQ website, and
// that work was never invoiced: `Deal 2026 inc. VAT %` on `recAbOhyaZ0HV5pAj` is 0, as is every
// other year, so the deal-size formula resolves them to Community and can never say anything else.
// Their `Partnership Type 2026` reads "Community Challenger Partnership" and the view's own column
// says Challenger — the same judgement, recorded where the wall stopped reading on 2026-08-05.
//
// NOTE THIS IS NOT A NO_CONTRACT_TIERS CASE, despite there being no contract. That table only fills
// a MISSING tier, and Humandone's is not missing: the formula produces "Community" from a zero deal.
// Overriding a resolved tier is the stronger claim, so the entry belongs here, under the bar below.
//
// THE BAR FOR ADDING HERE: the deal cannot express the tier, not the deal disagrees with someone.
// If Skytek's deal is ever priced, delete this entry — the deal wins.
// Jyske Bank Growth — Pioneer, by Auri's explicit call (2026-08-17), and it clears the bar above
// rather than merely disagreeing with the formula. Their 2026 deal is 157,500, which the deal-size
// formula reads as Core and can never read as anything else at that price. But the CRM's own
// `Partnership Success Tier/Type 2026` on `recvMhIh17Jx3EkHo` says "Pioneer Partner", and the
// deliverables row's `Partnership Type 2026` says "Pioneer " — so two human-set columns already
// agree on Pioneer and only the price-derived one says Core. The deal cannot express what was
// agreed, which is exactly the case this table exists for.
//
// If the deal is ever repriced into the Pioneer band, delete this entry — the deal wins.
//
// TWO OF THESE ARE NOW REDUNDANT (2026-08-19). The `Exceptions` column says the same thing for
// Skytek ("Has to be in Core") and Jyske Bank Growth ("Has to be placed in Pioneer"), and
// exceptionTier() runs first, so those two entries no longer decide anything. They are kept as a
// floor in case the cell is cleared. The other three have NO exception cell and must stay.
const TIER_EXCEPTIONS: Record<string, string> = {
  "skytek nordics aps": "Core",
  "industriens fond": "Prime",
  "erhvervsfremmebestyrelsen": "Prime",
  humandone: "Challenger",
  // Keyed on the deliverables `Company` value, lowercased — "Jyske Bank Growth", not "Jyske Bank".
  "jyske bank growth": "Pioneer",
};

function tierException(company: string): string | null {
  return TIER_EXCEPTIONS[company.toLowerCase().replace(/\s+/g, " ").trim()] ?? null;
}

// ─── THE `Exceptions` COLUMN, WHICH IS WHERE THE TEAM ALREADY WRITES THESE (2026-08-19) ──
// Auri: "there is the last column that says exceptions. Please look at that because this is very
// important." The deliverables view has carried a free-text `Exceptions` cell all along and the
// wall was not reading it, so two partners sat in the wrong band while the instruction to move
// them was sitting in the record:
//
//   "Has to be Placed in Challenger"        Highbridge Law Firm  — was rendering as Community
//   "we gotta put in in the Challenger tier" rebriQ              — was rendering as Community
//   "Has to be placed in Pioneer"           Jyske Bank Growth    — already right, via the hardcode
//   "Has to be in Core"                     Skytek Nordics ApS   — already right, via the hardcode
//
// THE TEXT IS PROSE, NOT AN ENUM, and it will stay prose — those four are four different phrasings
// of one instruction. So the cell is scanned for the NAME OF A BAND rather than parsed: find every
// tier in PARTNER_TIERS that appears in it as a whole word, and accept the answer only when exactly
// one does. Two names or none means a human has to read it, and a silent guess in that situation
// puts a partner in a band nobody chose.
//
// It runs AHEAD of TIER_EXCEPTIONS on purpose. A cell somebody typed in Airtable this morning
// should beat a constant compiled in last week, and it makes the hardcodes for Skytek and Jyske
// Bank Growth redundant rather than contradictory.
function exceptionTier(raw: unknown): string | null {
  const text = str(raw).trim();
  if (!text) return null;
  const haystack = text.toLowerCase();
  // Whole-word matching WITHOUT a built regex. A word boundary escape inside a template literal is
  // one keystroke away from being the BACKSPACE character instead, which matches nothing and fails
  // silently; checking the neighbouring characters cannot go wrong that way. It also means a cell
  // reading "corefully placed" or "Community Core Partnership" cannot be mistaken for an
  // instruction — the first has no whole word, the second names two bands and is refused below.
  const isLetter = (ch: string | undefined) => !!ch && /[a-z]/.test(ch);
  const hits = PARTNER_TIERS.map((t) => t.name).filter((name) => {
    const needle = name.toLowerCase();
    for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + 1)) {
      if (!isLetter(haystack[i - 1]) && !isLetter(haystack[i + needle.length])) return true;
    }
    return false;
  });
  if (hits.length === 1) return hits[0];
  console.info(
    hits.length
      ? `[partners] Exceptions cell "${text}" names ${hits.length} tiers (${hits.join(", ")}) — ignored, someone has to pick one`
      : `[partners] Exceptions cell "${text}" names no tier on the wall — ignored`
  );
  return null;
}

// Tier order, highest commitment first. Colour runs hot at the top and cools down it, so the
// ranking is legible without reading the labels. Every value clears 4.5:1 on #0d0d0d.
//
// `cols` is Auri's spec, and it is a RANKING device rather than a layout convenience: fewer
// columns means a bigger logo, so a Prime partner reads larger than a Community one on the
// same page. Four at the top, five in the middle, six for Community because there are 62 of
// them and any fewer would run down the page forever.
//
// "Tailored" was removed on Auri's call, along with "Investor" and "Academic". A partner whose
// tier is not listed here is skipped and logged by fetchPartners, never silently dropped.
export const PARTNER_TIERS: { name: string; color: string; cols: number }[] = [
  { name: "Prime", color: "#CE0F2E", cols: 4 },
  { name: "Main", color: "#FF2600", cols: 4 },
  { name: "Conqueror", color: "#FA7000", cols: 4 },
  { name: "Pioneer", color: "#fd9d04", cols: 5 },
  { name: "Core", color: "#10c8a7", cols: 5 },
  { name: "Challenger", color: "#2BB4E1", cols: 5 },
  { name: "International", color: "#7C9CFF", cols: 5 },
  // Community is grey on Auri's call. It is the largest band by far (62 of 105), and a
  // saturated colour on that many rows pulled the eye away from the paid tiers above it.
  { name: "Community", color: "#9a9a9c", cols: 6 },
];

const TIER_NAMES = new Set(PARTNER_TIERS.map((t) => t.name));

// ─── PARTNERS HELD BACK UNTIL A DATE ────────────────────────────────────────────────────
// Repodo is not public until 26 August (Auri, 2026-08-04). Their CRM row was literally named
// "Stealth TBD" until this week and the announcement is timed to the event, so the logo must not
// appear on the wall before then — including on techbbq.dk, which fetches this feed on every page
// load and would otherwise reveal them early.
//
// The date is read from the CLOCK ON EVERY CALL and never captured at module load. A value read
// once at cold start would freeze, and a long-lived Vercel instance would keep hiding them after
// the 26th — the same rule as lib/cachePolicy.ts, and the bug that bit the AI Workshop dashboard.
// So this reveals itself with no deploy and needs no cleanup afterwards; the entry can simply be
// deleted whenever someone is tidying.
//
// Keyed on the company name normalized the same way the dedupe below does it, because this data
// is full of trailing spaces ("Boardway ", "Cloudflare\n") and an exact match would silently fail
// to hide someone.
const HIDDEN_UNTIL: Record<string, string> = {
  repodo: "2026-08-25T22:00:00Z", // 26 August 2026, 00:00 Copenhagen (CEST = UTC+2)
};

function hiddenUntilDate(company: string, now: number = Date.now()): string | null {
  const until = HIDDEN_UNTIL[company.toLowerCase().replace(/\s+/g, " ").trim()];
  return until && now < Date.parse(until) ? until : null;
}

// A lookup field always arrives as an ARRAY, because a link can point at several records. One
// partner, one tier, so the first value wins; a row linked to two partner companies would be a
// data error to fix in Airtable rather than something to average here.
function tierOf(v: unknown): string {
  if (Array.isArray(v)) return str(v[0]);
  return str(v);
}

/**
 * Why a partner is NOT on the wall yet, and therefore what somebody has to do about it.
 *
 *   "no-logo"     the Logo cell holds nothing this wall can draw. Upload a white SVG.
 *   "not-on-web"  the logo is fine, the "Put on web" box is not ticked. Tick it.
 *   "no-tier"     no tier resolves, so there is no band to draw them in. Fill in Company Link, or
 *                 give the linked partner a Deal 2026 for the formula to work from.
 *
 * Only ever set when the caller asked for pending rows. A strict read has none.
 */
export type PendingReason = "no-logo" | "not-on-web" | "no-tier";

export type Partner = {
  id: string;
  company: string;
  tier: string;
  logo: string | null; // absolute URL, or null when the sync has not matched one
  // Set ONLY on a dashboard read. Its presence means "not live", so anything rendering for the
  // public must drop these rather than style them.
  pending?: PendingReason;
  website: string | null; // the partner's own site, or null when they never filled it in
  // A logo that is a STRIP of several marks rather than one. It spans the whole row and sits
  // at the top of its tier, because at 13:1 it would be unreadable in a normal 5:3 tile.
  wide?: boolean;
  // Optical size nudge, 1 = leave alone. See LOGO_SCALE.
  scale?: number;
  // Several tiles that belong to ONE partnership and must render side by side. Every renderer
  // shuffles inside a tier, so without a key like this the marks of one partnership scatter
  // across the band. Same value = same partnership = keep adjacent. See MULTI_LOGO.
  group?: string;
  // Position inside the group. Needed EXPLICITLY: the renderers shuffle before they sort, so a
  // stable sort preserves the shuffled order, not this feed's order, and the marks of one
  // partnership came out in a different sequence on every load.
  groupRank?: number;
  // Is this partner paying, and how. "cash" = Deal 2026 > 0, "barter" = no cash but a barter deal
  // or an add-on attached, absent = neither.
  //
  // DASHBOARD ONLY. This is commercial data and it must never reach techbbq.dk. It is not enough
  // that the embeds fetch without `?pending=1`: app/api/partners/route.ts caches ONE read with the
  // pending rows included and then only FILTERS ROWS for the public response, so every field on a
  // live partner is public by default. The route strips this one explicitly — see the note there
  // before adding any other internal field to this type.
  paying?: "cash" | "barter";
};

// ─── PER-LOGO ADJUSTMENTS ───────────────────────────────────────────────────────────────
// The area-based fitter in logoFit.ts gets a wall of mixed artwork most of the way there, but it
// can only measure the BOUNDING BOX. It cannot see that a mark is mostly transparent margin
// inside its own file: a wordmark sitting in 80% empty canvas gets its empty box sized correctly
// and still looks tiny. Both examples this comment used to name — Skytek at 23% ink and PSV at
// 12% — have since been re-exported as tight crops and no longer need a nudge at all, which is
// exactly why the re-run rule below exists. INCUBA x KITCHEN (19% ink) and IDA (33%) are the
// live examples now.
//
// MEASURED, NOT EYEBALLED (2026-08-04). Every value below comes from
// `node scripts/measure-logo-ink.mjs`, which rasterises each logo, finds the bounding box of the
// visible pixels, and reports both the nudge that brings the ink up to the target area and the
// largest nudge that keeps the ink inside the tile. Where those disagree the smaller one is used,
// which is why a few sit below what the ink alone would ask for.
//
// Re-run that script after replacing artwork in Airtable — a new export usually has different
// margins, so a stale number here is worse than none. Anything it reports as "already maxed" is
// a logo that fills its tile's width already, and no number in this table can help it.
//
// NOTE these are LINEAR scales, so the visible area changes with the SQUARE: 0.85 removes ~28%
// of the area, 2.11 adds ~345%. A value that looks like a small tweak is not one.
const LOGO_SCALE: Record<string, number> = {
  Repodo: 0.85, // measures average but reads huge: a dense, very high-ink wordmark
  // Marks exported into a square canvas with a thin wordmark inside it. The worst offenders.
  //
  // FOUR ENTRIES WERE DELETED FROM THIS TABLE ON 2026-08-19, NOT LOWERED: PSV (was 2.92),
  // Flatpay (1.83), Copenhagen (1.38) and "Business region Gothenburg AKA Gothenburg" (1.19).
  // Auri re-exported all four as tight crops, so each now measures ink at 100% of its image box and
  // `want` lands at or below 1.00. Absent means 1, 1 is the right answer, and it puts them on
  // exactly the same footing as the ~190 other tight-crop logos on this wall. Do not re-add a number
  // for any of them unless the artwork changes again.
  //
  // Business region Gothenburg's old comment claimed its file had "zero internal margin" and still
  // read small. That was true of an export whose ink filled 100% of a 1.56:1 box; the fitter shrank
  // it to 0.83 and 1.19 pushed it back. The new file measures `want` 1.00 against `cap` 1.13, so the
  // shortfall the nudge existed to correct is gone.
  "INCUBA x KITCHEN": 2.29,
  IDA: 1.8,
  Nordea: 1.71, // "Nordea Startup & Growth" — lots of internal whitespace in the file
  "Terkko Health Hub": 1.44,
  "Gothenburg Tech Week": 1.31,
  "Adeo Web": 1.29,
  "Southern Sweden": 1.25,
  "advores Advokater & Rechtanwälte PartGmbB": 1.24,
  // No margin to reclaim, but the AREA rule shrinks a near-2:1 mark to 0.79 and these read short
  // next to their neighbours. The nudge takes them back to what `contain` would give.
  "Innovation Centre Denmark": 1.19,
  "Creative Business Network": 1.17,
  // BELOW 1, and the only entry here that shrinks a padded mark rather than growing it. Beyond Beta
  // sat at 1.96 because its old file was a thin wordmark inside a square canvas. The artwork was
  // replaced with a tight crop — measure-logo-ink now reports ink at 100% of the image box, AR 5.05
  // — so that same nudge was doubling a logo that already reached its own edges, and it broke out of
  // the tile (Auri, 2026-08-17). 0.94 is the script's `cap`: the largest nudge whose ink still fits.
  //
  // THE LESSON THIS ROW EXISTS TO TEACH: a stale nudge is worse than none. Re-run
  // `node scripts/measure-logo-ink.mjs <name>` whenever a partner replaces their logo.
  "Beyond Beta": 0.94,
  // THE SAME BUG, SECOND OCCURRENCE (Auri, 2026-08-19: "fix skytek logo"). Skytek sat at 2.11
  // because its file was a wordmark in 77% transparent margin. That file is gone: measure-logo-ink
  // now reports **ink at 100% of the image box**, AR 3.33, and flags the row "already maxed". The
  // 2.11 was therefore adding ~345% of area to a mark already touching its own edges. 0.97 is the
  // script's `cap` and its `USE`.
  //
  // Note the 2026-08-17 entry above this table says "DO NOT FIX SKYTEK" — that was true of the OLD
  // artwork, where only transparent margin overflowed the tile's bounding box and no ink left it.
  // The verdict belonged to the file, not to the partner, and the file changed.
  "Skytek Nordics ApS": 0.97,
};

// Serve a LOCAL file instead of whatever sits in Airtable. Erhvervshus Sjælland's tile carries
// the EU co-funding frieze (Closing Loops + Co-funded by the European Union + Danish Board of
// Business Development) exactly as techbbq.dk shows it: one image, three marks, full width. That
// composite exists nowhere in Airtable, so it cannot come from there.
const LOGO_FILE_OVERRIDES: Record<string, { file: string; wide?: boolean }> = {
  "Erhvervshus Sjælland": { file: "Erhvervshus-frieze.png", wide: true },
};

// ─── ONE CRM ROW, SEVERAL BRANDS, ONE TILE EACH ─────────────────────────────────────────
// INCUBA x KITCHEN (Partner ID 1683) is a SINGLE partnership shared by four organisations, and
// Auri uploaded a white SVG for each of them (2026-08-20: "I added all 4 logos for that
// partnership, so add it up next to each other" / "dont add it as one logo. add it as 4
// different logos, just next to eachother").
//
// A normal row draws ONE image, so three of the four were invisible: pickLogo scored the KITCHEN
// and INCUBA files identically (both SVG, both name-hinted white) and the tie broke on upload
// order. This is NOT the `wide` frieze case above — a frieze is one image of several marks, and
// what is wanted here is four real tiles, each fitted and scaled like every other logo on the
// wall.
//
// `group` is what keeps them together. Every renderer shuffles inside a tier (see the comment on
// the sort in app/partners/page.tsx), so consecutive entries in this feed do NOT stay adjacent on
// the page. The four share a group key, the sorts cluster on it, and Array.sort being stable
// preserves the order below inside the cluster.
//
// EACH TILE LINKS TO ITS OWN SITE, which the single tile could not do: the row's website cell
// holds four urls and safeUrl's first-one-wins picked INCUBA's for all of them, which is why
// WEBSITE_OVERRIDES nulls this company out. One brand per tile removes that problem.
//
// Matched on FILENAME against the row's own Logo cell, so Airtable stays the source: replace a
// file there and the tile follows. A named file that has gone missing is logged and skipped
// rather than silently dropping the whole partnership.
const MULTI_LOGO: Record<string, { file: string; label: string; site: string }[]> = {
  "INCUBA x KITCHEN": [
    { file: "white-INCUBA.svg", label: "INCUBA", site: "https://www.incuba.dk" },
    { file: "Kicthen_logo_tag_en_white_rgb.svg", label: "KITCHEN", site: "https://kitchen.au.dk" },
    { file: "Startup Aarhus.svg", label: "Startup Aarhus", site: "https://www.startupaarhus.com" },
    { file: "Delphinus.svg", label: "Delphinus", site: "https://delphinus.vc" },
  ],
};

// Rows where the Airtable cell holds a DRAWABLE image that is still the wrong one for this wall, so
// the curated local copy is used instead. Airtable wins everywhere else.
//
// EMPTY, AND THAT IS THE POINT. It held "Erhvervsstyrelsen / Virksomhedsguiden" because the only SVG
// in that cell measured luminance 69 — near-black ink on a near-black wall — so the wall fell back to
// a local white copy. Auri uploaded a proper white SVG on 2026-08-05, so Airtable is the source again
// and the dark file is demoted by name in lib/logoPick.ts instead.
//
// Prefer that route for the next one of these: demoting a FILE keeps the feed and the photo proxy
// agreeing on which attachment a record means, while rejecting a COMPANY sends the wall to a copy of
// the artwork that nobody will remember to update.
const AIRTABLE_LOGO_REJECT = new Set<string>([]);

// Two filenames, one mark. The duplicate check below compares artwork by FILENAME, and moving to
// Airtable broke that for the one organisation that sits in this view twice: "Beta Health " holds
// white-Beta-Heath.svg and "BETA.HEALTH" holds Beta-Heath.svg. Same file, exported twice, so the
// wall showed the logo twice.
//
// Stripping the variant words and the punctuation collapses both to "betaheath". Same
// normalisation scripts/sync-partner-logos.mjs uses to match a CRM name to a filename, for the
// same reason: these words describe which EXPORT it is, never which brand.
function logoIdent(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(white|black|colour|color|logo|rgb|cmyk|transparent|negative|inverted)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

type AirtableRecord = { id: string; fields: Record<string, unknown> };

export class PartnersError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const LOGOS = manifest as Record<string, { file: string; tone: string }>;

// Airtable url cells are free text: this column holds both "https://x.com/" and a bare
// "www.x.com". Only http(s) survives, so a stray javascript: URL can never become a live link
// on techbbq.dk, and a bare www. host is upgraded rather than dropped (it is 30 of the 93).
// Hand-corrected websites, checked by Auri against the live site. These override whatever
// `Link to your website` holds, because that column is partner-submitted and a few rows point
// at the wrong entity or list several organisations at once.
//
// `null` means "no website" on purpose: INCUBA x KITCHEN is four organisations sharing a row
// and there is no single site to send a visitor to, so its logo stays unlinked.
// RE-CHECKED 2026-08-04 after Auri filled in every website in Airtable — all 125 rows now hold
// one. These are NOT stale corrections: they are exactly the rows whose cell holds SEVERAL
// organisations' urls, where safeUrl's "first one wins" picks the wrong one.
//
//   Copenhagen                → cell starts with copcap.com (Copenhagen Capacity, a different
//                               organisation); the partner is the municipality
//   cse advisory, OMR Reviews → cell starts with omr.com; two companies share the row
//   INCUBA x KITCHEN          → four organisations, no single site to send a visitor to
//
// "Owl Ventures" was dropped from this list: its cell now begins with owlvc.com, so the override
// agreed with the data and was doing nothing.
const WEBSITE_OVERRIDES: Record<string, string | null> = {
  Copenhagen: "https://www.kk.dk/erhverv",
  "cse advisory, OMR Reviews": "https://www.cse-advisory.com/en",
  "INCUBA x KITCHEN": null,
};

function safeUrl(v: unknown): string | null {
  const raw = str(v);
  if (!raw) return null;

  // Four of these cells hold SEVERAL urls in one field, joined with ", " or " & " or even
  // " @ " — Owl Ventures lists two companies, Copenhagen lists four. Passing the whole string
  // through produced an href with spaces in it, which is why clicking those logos did nothing.
  // A logo can only point at one place, so the FIRST url wins and the rest are ignored.
  const first = raw.split(/[\s,;]+|&(?=\s*https?:)/i).find((t) => t.trim());
  const token = (first ?? raw).trim().replace(/[),.]+$/, "");

  if (/^https?:\/\//i.test(token)) return token;
  if (/^www\./i.test(token)) return `https://${token}`;
  return null;
}

export async function fetchPartners({
  includePending = false,
}: { includePending?: boolean } = {}): Promise<Partner[]> {
  if (!TOKEN || !BASE_ID) {
    throw new PartnersError("Airtable env vars are not set on the server.", 503);
  }

  // Fetched alongside the deliverables rows rather than per row: one filtered pass over the CRM,
  // then an in-memory lookup by Partner ID. See fetchPaying().
  const paying = await fetchPaying();

  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("view", VIEW);
    params.set("pageSize", "100");
    for (const field of SAFE_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const res = await fetchWithTimeout(
      `${API}/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[partners] fetch failed", res.status, detail);
      throw new PartnersError("Could not reach the partners source.", 502);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  const partners: Partner[] = [];
  // Everyone the two publish rules turned away, so the reason is in the log instead of being a
  // mystery. Summarised after the loop rather than a line per row: at 126 rows a per-row log
  // buries the ones that matter.
  const noLogo: string[] = [];
  const notOnWeb: string[] = [];
  const wrongFormat: string[] = [];
  const seen = new Set<string>();

  for (const rec of records) {
    const f = rec.fields;
    const company = str(f["Company"]);
    if (!company) continue;

    // Whether this partner is paying, from the CRM pass above, resolved through `Company Link` —
    // the same relation the tier comes from. A row with no link gets no label rather than a guessed
    // one: that is what stops AWS Startups (no link, Partner ID belonging to NVIDIA) from wearing
    // NVIDIA's deal.
    const crmId = Array.isArray(f["Company Link"]) ? String((f["Company Link"] as unknown[])[0] ?? "") : "";
    const pays = crmId ? paying.get(crmId) : undefined;

    // Not public yet. Checked before anything else, so an embargoed partner cannot leak through
    // a tier, a logo or a website link.
    const embargo = hiddenUntilDate(company);
    if (embargo) {
      console.info(`[partners] "${company}" is held back until ${embargo} — not published yet`);
      continue;
    }

    // NO TYPE GATE. The tier comes from the deal price and that is what places a partner now — see
    // the note at the top of this file for what the type gate used to drop and why it stopped.

    // PUBLISH RULE 1. The checkbox is the record of what is live, so it decides what is live.
    // Named in the log rather than dropped quietly: an unticked box is usually an oversight, and
    // "our logo is missing" is the complaint this line answers before it is made.
    //
    // On a dashboard read this does not `continue`: the row carries on through the tier and
    // dedupe gates so the page can draw it as a placeholder in the right band.
    const notTicked = f["Put on web"] !== true;
    if (notTicked) {
      notOnWeb.push(company);
      if (!includePending) continue;
    }

    // The tier as derived from the deal, not as typed by a human — with the no-contract fallback
    // applied ONLY when the deal produced nothing. See NO_CONTRACT_TIERS.
    // Order matters, strongest claim first:
    //   1. the row's own `Exceptions` cell, typed by the partnerships team for this record
    //   2. TIER_EXCEPTIONS, the same judgement recorded in code before that column was read
    //   3. the deal-size formula, which is the rule for everybody else
    //   4. NO_CONTRACT_TIERS, which only fills a gap the formula left empty
    const tier =
      exceptionTier(f["Exceptions"]) ||
      tierException(company) ||
      tierOf(f["Partnership Tier (from Tier)"]) ||
      noContractTier(company) ||
      "";
    // No tier means no BAND, so the public wall cannot place them at all.
    //
    // It used to end here for every reader, and that made a partner INVISIBLE IN BOTH DIRECTIONS:
    // Crescita Partners had "Put on web" ticked and two logos uploaded, and still appeared nowhere,
    // with the only trace a line in the Vercel log (Auri, 2026-08-05). A dashboard read now keeps
    // them, flagged, and /partners lists them outside the bands — a person who has just uploaded a
    // logo must be able to see what is still missing.
    const noTier = !TIER_NAMES.has(tier);
    if (noTier) {
      console.info(
        tier
          ? `[partners] "${company}" has unlisted tier "${tier}", not on the wall`
          : `[partners] "${company}" has no partnership tier (no Company Link, or the linked partner has no Deal 2026) — not on the wall`
      );
      if (!includePending) continue;
    }

    // The same company appears twice in this view a few times (resubmitted deliverables rows).
    const key = `${company.toLowerCase().replace(/\s+/g, " ")}|${tier}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // ─── PICK THE ARTWORK ───────────────────────────────────────────────────────────────
    // Three sources in priority order: a hand-composed local file, then Airtable, then the
    // library copy as a fallback. `ident` is whatever the choice resolves to, and it exists so
    // the duplicate check below can compare two rows regardless of which source each came from.
    const override = LOGO_FILE_OVERRIDES[company];
    const picked = AIRTABLE_LOGO_REJECT.has(company) ? null : pickLogo(f["Logo"]);
    // PUBLISH RULE 2, the format half. A cell holding only a JPEG has no transparency, so on this
    // wall it draws a white box around the mark; it counts as no logo rather than as a bad one.
    const att = picked && PUBLISHABLE_LOGO.test(picked.type ?? "") ? picked : null;
    if (picked && !att) {
      wrongFormat.push(`${company} (${picked.type ?? "unknown type"})`);
    }
    const local = LOGOS[rec.id];

    // A multi-brand partnership becomes one tile per mark. Only when the row would actually
    // publish: a pending row belongs on the dashboard worklist as ONE named placeholder, because
    // four placeholders for one partnership is four times the noise for one job.
    const multi = MULTI_LOGO[company];
    if (multi && !noTier && !notTicked) {
      const atts = Array.isArray(f["Logo"]) ? (f["Logo"] as LogoAttachment[]) : [];
      let drawn = 0;
      for (const brand of multi) {
        const a = atts.find((x) => x.filename === brand.file);
        if (!a || !PUBLISHABLE_LOGO.test(a.type ?? "")) {
          console.info(
            `[partners] "${company}" multi-logo: "${brand.file}" is missing from the Logo cell or ` +
              `is not a drawable format, skipped`
          );
          continue;
        }
        // Registered in `seen` like any other tile, so a mark that also sits on another row in
        // this tier still trips the duplicate check rather than appearing twice.
        const logoKey = `${tier}|${logoIdent(brand.file) || brand.file.toLowerCase()}`;
        if (seen.has(logoKey)) {
          console.info(`[partners] "${company}" multi-logo: ${brand.file} already drawn in ${tier}, skipped`);
          continue;
        }
        seen.add(logoKey);
        partners.push({
          // Unique per tile: the record id alone would repeat four times and collide as a React key.
          id: `${rec.id}:${a.id}`,
          // The BRAND, not the row. It is the alt text and the aria-label, and four tiles all
          // announcing "INCUBA x KITCHEN" tells a screen reader nothing.
          company: brand.label,
          tier,
          logo: photoUrl("partners", rec.id, undefined, a.id),
          website: brand.site,
          group: company,
          groupRank: drawn,
          // The whole partnership is one deal, so every tile in the group carries the same label.
          ...(pays ? { paying: pays } : {}),
          ...(LOGO_SCALE[brand.label] ? { scale: LOGO_SCALE[brand.label] } : {}),
        });
        drawn++;
      }
      // Nothing drew — every named file has been renamed or removed. Fall through to the ordinary
      // single-logo path rather than dropping the partner off the wall entirely.
      if (drawn) continue;
      console.info(`[partners] "${company}" multi-logo: no named file resolved, falling back to one tile`);
    }

    let logo: string | null = null;
    let ident: string | null = null;
    if (override) {
      ident = override.file;
      logo = `${baseUrl()}/partner-logos/${encodeURIComponent(override.file)}`;
    } else if (att) {
      // The FILENAME is the identity, not the attachment id: the same mark uploaded to two rows
      // gets two different ids, and those two rows are exactly what the dedupe below is for.
      ident = att.filename ?? att.id ?? null;
      // ?v=<attachment id> means REPLACING the file in Airtable changes this URL, so a corrected
      // logo appears immediately instead of sitting behind a week of CDN cache.
      logo = photoUrl("partners", rec.id, undefined, att.id);
    } else if (local) {
      ident = local.file;
      // ABSOLUTE, via the same baseUrl() every other feed uses for its photo proxy. A bare
      // "/partner-logos/..." works on the dashboard and silently breaks in the embed, where
      // the browser resolves it against techbbq.dk and gets a 404 for all 104 logos. That
      // shipped once and produced a wall of empty tiles on the live partners page.
      logo = `${baseUrl()}/partner-logos/${encodeURIComponent(local.file)}`;
    } else {
      // PUBLISH RULE 2, the other half: no white SVG, no white PNG, no curated stand-in, so no
      // place on the wall. On the public feed it is dropped — an empty tile in a grid of filled
      // ones reads as a broken page rather than as missing artwork. On the dashboard it stays, as
      // a named tile, which is the whole point: that is the list of logos to go and get.
      noLogo.push(company);
      if (!includePending) continue;
    }

    // Ordered by what somebody has to DO about it. A missing logo wins, because artwork has to be
    // found either way and ticking a box for a partner with no logo publishes nothing. A missing
    // tier comes next, since it blocks the wall regardless of the checkbox. The unticked box is
    // last: it is the one-click fix.
    const pending: PendingReason | undefined = !logo
      ? "no-logo"
      : noTier
        ? "no-tier"
        : notTicked
          ? "not-on-web"
          : undefined;

    // The same organisation sometimes appears under two DIFFERENT names that resolve to one
    // mark: "AISTART Incubator - Business Helsinki" and "Business Helsinki", or "Beta Health"
    // and "BETA.HEALTH". The same image twice in the same row is always wrong on a logo wall,
    // whatever the CRM says, so the tier+artwork pair is deduplicated too.
    //
    // Only WITHIN a tier. A brand legitimately appearing in two different tiers is a data
    // question for the partnerships team, not something to hide here — it is logged instead.
    if (ident) {
      const logoKey = `${tier}|${logoIdent(ident) || ident.toLowerCase()}`;
      if (seen.has(logoKey)) {
        console.info(`[partners] "${company}" duplicates ${ident} inside ${tier}, skipped`);
        continue;
      }
      seen.add(logoKey);
    }

    partners.push({
      id: rec.id,
      company,
      tier,
      logo,
      website:
        company in WEBSITE_OVERRIDES
          ? WEBSITE_OVERRIDES[company]
          : safeUrl(f["Link to your website"]),
      ...(pending ? { pending } : {}),
      ...(override?.wide ? { wide: true } : {}),
      ...(pays ? { paying: pays } : {}),
      ...(LOGO_SCALE[company] ? { scale: LOGO_SCALE[company] } : {}),
    });
  }

  if (notOnWeb.length) {
    console.info(
      `[partners] ${notOnWeb.length} partner(s) are NOT on the wall because "Put on web" is not ` +
        `ticked in Partner Deliverables 2026: ${notOnWeb.join(", ")}`
    );
  }
  if (wrongFormat.length) {
    console.info(
      `[partners] ${wrongFormat.length} partner(s) have a logo the wall cannot use — it needs a ` +
        `white SVG, or a white PNG at worst: ${wrongFormat.join(", ")}`
    );
  }
  if (noLogo.length) {
    console.info(
      `[partners] ${noLogo.length} partner(s) are NOT on the wall because they have no usable ` +
        `logo in Airtable and none in lib/partnerLogoManifest.json either: ${noLogo.join(", ")}`
    );
  }

  partners.sort((a, b) => a.company.localeCompare(b.company));
  return partners;
}
