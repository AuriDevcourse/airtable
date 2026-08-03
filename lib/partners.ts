// Server-only access to the TechBBQ 2026 partner list, grouped by partnership tier.
//
// Source: Marketing Project Overview, view "Partner Deliverables 2026" — the same view
// scripts/community-tier-audit.mjs maintains, so the tier shown here is the tier marketing
// actually curates rather than the deal-size formula on the Partners 2026 CRM. Those two
// disagree (the CRM formula collapses everything into 6 buckets and has no Community), and
// this one is the marketing-facing truth.
//
// ─── WHERE THE LOGOS COME FROM ──────────────────────────────────────────────────────
// NOT from Airtable. The attachments on this view are the colour originals (69 PNG, 8 JPEG,
// 16 SVG, plus a zip, a PDF and an .ai) and would render as white boxes on a near-black wall.
// The images are served from public/partner-logos/, copied out of the tbbqvisualgen logo
// library by scripts/sync-partner-logos.mjs, which prefers the white SVG variant of each mark.
// lib/partnerLogoManifest.json maps Airtable record id -> filename.
//
// Consequence worth knowing: adding a partner in Airtable puts them on the page immediately,
// but WITHOUT a logo until someone re-runs that script. That is the price of white logos, and
// the page names the gap rather than hiding it.

import { fetchWithTimeout } from "@/lib/http";
import { str } from "@/lib/fields";
import manifest from "@/lib/partnerLogoManifest.json";
import { baseUrl } from "@/lib/photo";

const API = "https://api.airtable.com/v0";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = "tblTecOBecLQCNIeD"; // Marketing Project Overview
const VIEW = "viw7FVbsTb9IRaWF0"; // Partner Deliverables 2026

const SAFE_FIELDS = [
  "Company",
  "Partnership Type 2026",
  "Put on web",
  "Link to your website",
];

// Auri's call: drop these. Academic is really Community, Investor is a different thing, and
// Tailored was cut as not worth its own band.
const EXCLUDED_TIERS = new Set(["Investor", "Academic", "Tailored"]);

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

// TIER CORRECTIONS, taken from the live techbbq.dk/partners page.
//
// Airtable's `Partnership Type 2026` and the deal-size formula on the Partners CRM disagree on
// 16 rows, and Auri's call is that the LIVE SITE is the correct placement — "Nordea is not a
// prime partner, it has a 48,000 crown deal". So the site wins where the two differ.
//
// Only the DIFFERENCES are listed. Everything else already matches, so a silent Airtable change
// still flows through untouched, and this map stays short enough to audit by eye. Derived by
// matching our partners to the site's tier bands on website HOSTNAME, which is stable where
// company names are not (the site says "advores", Airtable says "advores Advokater &
// Rechtsanwälte PartGmbB").
//
// Re-check this map if the live page is re-tiered. There is no automatic sync: techbbq.dk sits
// behind a WAF that 455s a plain request, so this cannot be fetched at build time.
const TIER_OVERRIDES: Record<string, string> = {
  // Placed too high in Airtable
  Nordea: "Challenger", // was Prime — a 48k deal, per Auri
  Dealroom: "Challenger", // was Main
  "Owl Ventures": "Challenger", // was Conqueror
  "TÜV SÜD Danmark ApS": "Community", // was Challenger
  // "International" is not a band on the live site; each of these sits in a real tier there
  "advores Advokater & Rechtsanwälte PartGmbB": "Challenger",
  "European Innovation Council": "Conqueror",
  swisstech: "Challenger",
  TONIK: "Pioneer",
  eryk: "Core",
};

export type Partner = {
  id: string;
  company: string;
  tier: string;
  logo: string | null; // absolute URL, or null when the sync has not matched one
  website: string | null; // the partner's own site, or null when they never filled it in
  // A logo that is a STRIP of several marks rather than one. It spans the whole row and sits
  // at the top of its tier, because at 13:1 it would be unreadable in a normal 5:3 tile.
  wide?: boolean;
  // Optical size nudge, 1 = leave alone. See LOGO_SCALE.
  scale?: number;
};

// ─── PER-LOGO ADJUSTMENTS ───────────────────────────────────────────────────────────────
// The area-based fitter in logoFit.ts gets a wall of mixed artwork most of the way there, but
// it can only measure the BOUNDING BOX. It cannot see that a mark is mostly padding inside its
// own file, or that a wordmark is visually heavy for its area. These are the leftovers, judged
// by eye on the real wall by Auri. Keep the list short: if it grows past a handful, the artwork
// is the problem, not the fitter.
// NOTE these are LINEAR scales, so the visible area changes with the SQUARE: 0.85 removes ~28%
// of the area, 1.3 adds ~69%. A value that looks like a small tweak is not one.
const LOGO_SCALE: Record<string, number> = {
  Repodo: 0.85, // measures average but reads huge: a dense, very high-ink wordmark
  Flatpay: 1.3,
  "Skytek Nordics ApS": 1.3,
  Nordea: 1.3, // "Nordea Startup & Growth" — lots of internal whitespace in the file
};

// Swap in a different file than the sync script matched. Erhvervshus Sjælland's tile carries
// the EU co-funding frieze (Closing Loops + Co-funded by the European Union + Danish Board of
// Business Development) exactly as techbbq.dk shows it: one image, three marks, full width.
const LOGO_FILE_OVERRIDES: Record<string, { file: string; wide?: boolean }> = {
  "Erhvervshus Sjælland": { file: "Erhvervshus-frieze.png", wide: true },
};

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
const WEBSITE_OVERRIDES: Record<string, string | null> = {
  Copenhagen: "https://www.kk.dk/erhverv",
  "Owl Ventures": "https://www.owlvc.com",
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

export async function fetchPartners(): Promise<Partner[]> {
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
  const noLogo: string[] = [];
  const seen = new Set<string>();

  for (const rec of records) {
    const f = rec.fields;
    const company = str(f["Company"]);
    if (!company) continue;

    // The live site wins where it disagrees with Airtable — see TIER_OVERRIDES.
    const tier = TIER_OVERRIDES[company] ?? str(f["Partnership Type 2026"]);
    if (EXCLUDED_TIERS.has(tier)) continue;
    // A tier the wall has no row for would leave the partner rendered nowhere, so it is
    // skipped explicitly and logged rather than silently dropped by the grouping below.
    if (!TIER_NAMES.has(tier)) {
      if (tier) console.info(`[partners] "${company}" has unlisted tier "${tier}", skipped`);
      continue;
    }

    // The same company appears twice in this view a few times (resubmitted deliverables rows).
    const key = `${company.toLowerCase().replace(/\s+/g, " ")}|${tier}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const hit = LOGOS[rec.id];

    // ...and sometimes under two DIFFERENT names that resolve to one mark: "AISTART Incubator
    // - Business Helsinki" and "Business Helsinki" are one organisation with one logo. The
    // same image twice in the same row is always wrong on a logo wall, whatever the CRM says,
    // so the tier+logo pair is deduplicated too.
    //
    // Only WITHIN a tier. A brand legitimately appearing in two different tiers is a data
    // question for the partnerships team, not something to hide here — it is logged instead.
    if (hit) {
      const logoKey = `${tier}|${hit.file}`;
      if (seen.has(logoKey)) {
        console.info(`[partners] "${company}" duplicates ${hit.file} inside ${tier}, skipped`);
        continue;
      }
      seen.add(logoKey);
    } else if (!LOGO_FILE_OVERRIDES[company]) {
      // An override supplies a file the sync script never matched, so it is not a gap.
      noLogo.push(company);
    }

    // A hand-picked file wins over whatever the sync script matched.
    const override = LOGO_FILE_OVERRIDES[company];
    const file = override ? override.file : hit ? hit.file : null;

    partners.push({
      id: rec.id,
      company,
      tier,
      // ABSOLUTE, via the same baseUrl() every other feed uses for its photo proxy. A bare
      // "/partner-logos/..." works on the dashboard and silently breaks in the embed, where
      // the browser resolves it against techbbq.dk and gets a 404 for all 104 logos. That
      // shipped once and produced a wall of empty tiles on the live partners page.
      logo: file ? `${baseUrl()}/partner-logos/${encodeURIComponent(file)}` : null,
      website:
        company in WEBSITE_OVERRIDES
          ? WEBSITE_OVERRIDES[company]
          : safeUrl(f["Link to your website"]),
      ...(override?.wide ? { wide: true } : {}),
      ...(LOGO_SCALE[company] ? { scale: LOGO_SCALE[company] } : {}),
    });
  }

  if (noLogo.length) {
    console.info(
      `[partners] ${noLogo.length} partner(s) have no logo matched by ` +
        `scripts/sync-partner-logos.mjs: ${noLogo.join(", ")}`
    );
  }

  partners.sort((a, b) => a.company.localeCompare(b.company));
  return partners;
}
