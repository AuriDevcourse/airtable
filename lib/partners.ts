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
import { pickLogo } from "@/lib/logoPick";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const VIEW = "viw7FVbsTb9IRaWF0"; // Partner Deliverables 2026

const SAFE_FIELDS = [
  "Company",
  // Read for the logs only. It no longer gates anything and it never set the tier — the deal does.
  "Partnership Type 2026",
  // The tier, looked up from Partners 2026 where a formula derives it from Deal 2026.
  "Partnership Tier (from Tier)",
  // Publish rule 1. Read AND enforced since 2026-08-05 — see the header.
  "Put on web",
  "Link to your website",
  // The wall's artwork. Several variants per cell; lib/logoPick.ts chooses.
  "Logo",
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
// Danish Business Authority — Prime, by Auri's explicit call (2026-08-07). Same shape as Industriens
// Fond and it needs the extra sentence, because this one has a REAL, CONFIRMED deal beside it and so
// looks at first glance like the thing this table must never do.
//
// Erhvervsstyrelsen's `Deal 2026` is 81,250 (Confirmed), which computes to Core, and the wall showed
// it there. What that figure prices is the VIRKSOMHEDSGUIDEN work. The Danish Business Authority
// partnership is separate and is funded outside that column entirely, so no number in `Deal 2026`
// will ever describe it — the deal is not wrong, it is answering a different question.
//
// One organisation, one row: `recicegSWL1fgCvqZ` is renamed from "Erhvervsstyrelsen /
// Virksomhedsguiden" to "Danish Business Authority" and carries the DBA mark, so the wall shows it
// once, in Prime. Virksomhedsguiden no longer appears as its own tile. The KEY BELOW DEPENDS ON THAT
// RENAME: this table is keyed on `Company`, so if the row goes back to the old name the entry
// silently matches nothing and the partner drops to Core.
//
// THE BAR FOR ADDING HERE: the deal cannot express the tier, not the deal disagrees with someone.
// If Skytek's deal is ever priced, delete this entry — the deal wins.
const TIER_EXCEPTIONS: Record<string, string> = {
  "skytek nordics aps": "Core",
  "industriens fond": "Prime",
  "danish business authority": "Prime",
};

function tierException(company: string): string | null {
  return TIER_EXCEPTIONS[company.toLowerCase().replace(/\s+/g, " ").trim()] ?? null;
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
};

// ─── PER-LOGO ADJUSTMENTS ───────────────────────────────────────────────────────────────
// The area-based fitter in logoFit.ts gets a wall of mixed artwork most of the way there, but it
// can only measure the BOUNDING BOX. It cannot see that a mark is mostly transparent margin
// inside its own file — Skytek's wordmark occupies 23% of the square it was exported into, so
// the fitter sizes the empty square correctly and the logo still looks tiny.
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
  PSV: 2.92,
  "INCUBA x KITCHEN": 2.29,
  "Skytek Nordics ApS": 2.11,
  "Beyond Beta": 1.96,
  Flatpay: 1.83,
  IDA: 1.8,
  Nordea: 1.71, // "Nordea Startup & Growth" — lots of internal whitespace in the file
  "Terkko Health Hub": 1.44,
  // Zero internal margin, so the area rule shrinks it to 0.83 while padded neighbours get grown —
  // the honest file ends up the smallest on the row (Auri: "slightly bit" too small). 1.19 brings the
  // final scale to 0.99, which is still inside `contain`, so no pixel crops; the ceiling here is
  // 1/0.83 = 1.20, past which it would.
  "Business region Gothenburg AKA Gothenburg": 1.19,
  Copenhagen: 1.38,
  "Gothenburg Tech Week": 1.31,
  "Adeo Web": 1.29,
  "Southern Sweden": 1.25,
  "advores Advokater & Rechtanwälte PartGmbB": 1.24,
  // No margin to reclaim, but the AREA rule shrinks a near-2:1 mark to 0.79 and these read short
  // next to their neighbours. The nudge takes them back to what `contain` would give.
  "Innovation Centre Denmark": 1.19,
  "Creative Business Network": 1.17,
};

// Serve a LOCAL file instead of whatever sits in Airtable. Erhvervshus Sjælland's tile carries
// the EU co-funding frieze (Closing Loops + Co-funded by the European Union + Danish Board of
// Business Development) exactly as techbbq.dk shows it: one image, three marks, full width. That
// composite exists nowhere in Airtable, so it cannot come from there.
const LOGO_FILE_OVERRIDES: Record<string, { file: string; wide?: boolean }> = {
  "Erhvervshus Sjælland": { file: "Erhvervshus-frieze.png", wide: true },
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
    // Order matters. The exception comes FIRST because it exists precisely to beat a resolved
    // deal tier; the no-contract fallback comes last because it only fills a gap.
    const tier =
      tierException(company) || tierOf(f["Partnership Tier (from Tier)"]) || noContractTier(company) || "";
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
