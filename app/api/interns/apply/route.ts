// The intern pool's SUBMISSION endpoint — the one route in this project that WRITES.
//
// Everything else here is a read-only proxy over an allow-listed slice of Airtable. This accepts a
// POST from an unauthenticated stranger and creates a record, which is a different threat model and
// gets its own defences rather than inheriting the feeds' posture.
//
// WHY NOT AN AIRTABLE FORM VIEW. It was the plan, and the Airtable API cannot create one — form
// views are UI-only. Rather than leave the last step as a manual instruction nobody would follow
// exactly, the form is ours, which also buys the two things an Airtable form cannot do: a live
// 220-character counter on the pitch (the cap lib/interns.ts enforces, shown while typing rather
// than discovered afterwards as a truncation) and consent wording that names what is published,
// where, and for how long.
//
// ─── WHAT PROTECTS IT ───────────────────────────────────────────────────────────────────
//   * RATE LIMITED HARD, per IP: 5 submissions per window against the feeds' 60. An intern fills
//     this in once (SECURITY r1).
//   * EVERY FIELD LENGTH-CAPPED and the body size-capped before anything is parsed. An unbounded
//     string reaches Airtable, and Airtable bills by request, not by kilobyte (SECURITY r4).
//   * THE PHOTO IS TYPE- AND SIZE-CHECKED against its actual bytes, not its filename.
//   * `Put on web` IS NEVER READ FROM THE REQUEST. It is TechBBQ's decision, so it is simply not in
//     the payload this route builds — a caller cannot publish themselves by adding a JSON key.
//   * `Show until` IS NEVER READ FROM THE REQUEST either, for the same reason: it is the promise
//     about how long the page keeps them, and it is not the applicant's to set.
//   * A HONEYPOT field that a human never sees and a bot fills in. Answered with a 200 so the bot
//     records a success and does not retry with a different shape.
//
// What is deliberately NOT here: a captcha. It would need a third-party script on the page and the
// rate limit plus honeypot is proportionate for a form perhaps thirty people will ever submit.

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/apiRoute";
import { INTERN_DEPARTMENTS } from "@/lib/internDepartments";
import { invalidate } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const API = "https://api.airtable.com/v0";
const CONTENT_API = "https://content.airtable.com/v0";
const TABLE = "tbl5VhWYQ6FeXfoJy"; // Intern Pool
const PHOTO_FIELD = "fldjrKVRy7SXaUdiB"; // Intern Pool → Photo

// Per IP per window (the limiter's window is a minute). Deliberately mean: this is a form somebody
// fills in once, so anything above a handful is either a mistake or an attack.
const MAX_SUBMISSIONS = 5;

// Caps chosen from what the card can actually draw, not from what a database column allows.
// `pitch` matches PITCH_MAX in lib/interns.ts with slack: the client counts to 220 and the server
// accepts a little more so a trailing space cannot produce a rejection nobody can see.
const LIMITS = {
  name: 120,
  role: 120,
  responsibilities: 400,
  pitch: 240,
  lookingFor: 160,
  linkedin: 300,
  email: 254,
};

// 4 MB of raw bytes, which is a generous phone photo and well inside Airtable's 5 MB attachment
// limit once base64 has added its third. Checked against the DECODED length, because base64 in the
// JSON body is what a caller controls.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
// The body cap has to clear the photo plus its base64 overhead plus the text fields.
const MAX_BODY_BYTES = 7 * 1024 * 1024;

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);

// Magic bytes, because a caller sets contentType and a filename ends in whatever it likes. This is
// the only statement about the file that the sender does not get to write.
function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  // RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // Collapse whitespace before measuring, so a paste full of newlines is judged on its content.
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

// Multiline fields keep their line breaks — responsibilities read as a short list — but still get
// their runs of blank lines collapsed and their length capped.
function multiline(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

/**
 * A LinkedIn profile URL, or null.
 *
 * Deliberately narrower than lib/linkedin.ts, which is a lenient normaliser for data TechBBQ staff
 * typed into Airtable. This value comes from the open internet and becomes an href on a public
 * page, so it is an allow-list: https, a linkedin.com host, nothing else. That is what stops a
 * `javascript:` or a look-alike domain becoming a link under an intern's name.
 */
function linkedInUrl(v: unknown): string | null {
  const raw = text(v, LIMITS.linkedin);
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  // Suffix match on a dot, so "linkedin.com" and "www.linkedin.com" and "dk.linkedin.com" pass
  // while "linkedin.com.evil.tld" and "notlinkedin.com" do not.
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  u.protocol = "https:";
  u.search = "";
  u.hash = "";
  return u.toString();
}

// An ISO date the applicant picked, or null. Bounded so a typo cannot write year 0202 or 9999.
function isoDate(v: unknown): string | null {
  const s = text(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const year = Number(s.slice(0, 4));
  if (year < 2026 || year > 2030) return null;
  return s;
}

function bad(message: string, status = 400): NextResponse {
  const res = NextResponse.json({ error: message }, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  // Fails CLOSED. A missing token must not become a form that silently accepts and discards.
  if (!token || !baseId) {
    console.error("[interns/apply] Airtable env vars are not set");
    return bad("The form is not available right now. Please try again later.", 503);
  }

  const ip = clientIp(req);
  const limit = rateLimit(ip, { bucket: "interns-apply:", max: MAX_SUBMISSIONS });
  if (!limit.ok) {
    const res = NextResponse.json(
      { error: "Too many submissions from this connection. Try again shortly." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(limit.retryAfter));
    return res;
  }

  // Size-checked BEFORE parsing. Reading the body first and then measuring it is measuring
  // something already in memory.
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return bad("That photo is too large. Keep it under 4 MB.", 413);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return bad("That photo is too large. Keep it under 4 MB.", 413);
    }
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return bad("Could not read the form. Please try again.");
  }

  // THE HONEYPOT. Hidden from people and from screen readers; a bot fills every input it finds.
  // 200 rather than 400 on purpose — a rejected bot retries, an accepted one moves on.
  if (text(body.website, 200)) {
    console.info("[interns/apply] honeypot triggered, discarded");
    return NextResponse.json({ ok: true });
  }

  const name = text(body.name, LIMITS.name);
  if (!name) return bad("Please enter your name.");

  const department = text(body.department, 60);
  if (!INTERN_DEPARTMENTS.includes(department)) return bad("Please pick your department.");

  const pitch = text(body.pitch, LIMITS.pitch);
  if (!pitch) return bad("Please write your pitch — it is the part people actually read.");

  // THE GATE. Nothing about them is published without it, so nothing is written without it either:
  // a record that exists with consent unticked is a record somebody might tick later on their
  // behalf, having never asked.
  if (body.consent !== true) {
    return bad("We can only publish your profile if you agree to it.");
  }

  const linkedin = linkedInUrl(body.linkedin);
  // Not fatal — a card without LinkedIn still stands — but say so rather than dropping it silently,
  // since a recruiter with nowhere to click is most of the value gone.
  if (body.linkedin && !linkedin) {
    return bad("That does not look like a LinkedIn profile URL. It should start with linkedin.com.");
  }

  // The photo, if there is one. Optional here and required by lib/interns.ts before the card goes
  // live: somebody who cannot upload from their phone right now should still be able to submit.
  let photo: { bytes: Buffer; type: string; filename: string } | null = null;
  if (typeof body.photo === "string" && body.photo) {
    const b64 = body.photo.replace(/^data:[^;]+;base64,/, "");
    let bytes: Buffer;
    try {
      bytes = Buffer.from(b64, "base64");
    } catch {
      return bad("Could not read that image. Try a JPG or PNG.");
    }
    if (bytes.length === 0) return bad("Could not read that image. Try a JPG or PNG.");
    if (bytes.length > MAX_PHOTO_BYTES) return bad("That photo is too large. Keep it under 4 MB.", 413);
    const sniffed = sniffImage(bytes);
    if (!sniffed || !ALLOWED_IMAGE.has(sniffed)) {
      return bad("That file is not a JPG, PNG or WebP image.");
    }
    const filename = text(body.photoName, 100).replace(/[^\w.\- ]+/g, "") || "photo";
    photo = { bytes, type: sniffed, filename };
  }

  // NOTE WHAT IS NOT HERE: `Put on web` and `Show until`. Both are TechBBQ's decisions and neither
  // is read from the request, so no JSON key can set them. See the header.
  const fields: Record<string, unknown> = {
    Name: name,
    Role: text(body.role, LIMITS.role),
    Department: department,
    Responsibilities: multiline(body.responsibilities, LIMITS.responsibilities),
    Pitch: pitch,
    "Looking for": text(body.lookingFor, LIMITS.lookingFor),
    "Consent to publish": true,
  };
  const availableFrom = isoDate(body.availableFrom);
  if (availableFrom) fields["Available from"] = availableFrom;
  if (linkedin) fields["LinkedIn"] = linkedin;
  const email = text(body.email, LIMITS.email);
  // Internal only — never published, never in SAFE_FIELDS. It is how TechBBQ reaches them about
  // their own card.
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields["Email"] = email;

  let recordId: string;
  try {
    const res = await fetch(`${API}/${baseId}/${TABLE}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: [{ fields }] }),
    });
    if (!res.ok) {
      // The detail goes to the log, never to the browser: an Airtable error names fields and tables.
      console.error("[interns/apply] create failed", res.status, await res.text());
      return bad("Could not save your profile. Please try again.", 502);
    }
    const data = (await res.json()) as { records: { id: string }[] };
    recordId = data.records[0].id;
  } catch (err) {
    console.error("[interns/apply] create threw", err);
    return bad("Could not save your profile. Please try again.", 502);
  }

  // Uploaded as a SECOND step, after the record exists, because Airtable's attachment upload is
  // addressed by record and field id. A failure here is deliberately NOT fatal: the answers are
  // already saved, and losing a whole submission over a photo would be the worse outcome. It is
  // logged, and lib/interns.ts already reports "Needs a photo" on the dashboard.
  if (photo) {
    try {
      const res = await fetch(
        `${CONTENT_API}/${baseId}/${recordId}/${PHOTO_FIELD}/uploadAttachment`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: photo.type,
            file: photo.bytes.toString("base64"),
            filename: photo.filename,
          }),
        }
      );
      if (!res.ok) console.error("[interns/apply] photo upload failed", res.status, await res.text());
    } catch (err) {
      console.error("[interns/apply] photo upload threw", err);
    }
  }

  // So the dashboard shows the new submission on the next load rather than up to an hour later.
  // Only the server's own copy — the CDN never caches a feed variant that carries pending rows.
  invalidate("interns");

  const out = NextResponse.json({ ok: true, photo: Boolean(photo) });
  out.headers.set("Cache-Control", "no-store");
  return out;
}
