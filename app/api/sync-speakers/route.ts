// Protected sync endpoint: pulls the live Supabase Speaker Hub into Airtable.
// This route WRITES to Airtable, so it is locked behind CRON_SECRET.
//
// Auth: caller must send `Authorization: Bearer <CRON_SECRET>`. Vercel Cron adds
// this header automatically when CRON_SECRET is set in the project env; an external
// scheduler (e.g. GitHub Actions) sends the same header. The compare is constant-time
// and FAILS CLOSED — if CRON_SECRET is unset the route rejects everything, so a
// misconfigured deploy can never leave the write endpoint open.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { syncSpeakersToAirtable } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed: no secret configured => no access

  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false; // timingSafeEqual needs equal lengths
  return timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncSpeakersToAirtable();
    console.log("[/api/sync-speakers]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[/api/sync-speakers]", err);
    return NextResponse.json(
      { ok: false, error: "Sync failed. Check server logs." },
      { status: 500 }
    );
  }
}

// GET so Vercel Cron (which issues GET) can trigger it; POST for manual/webhook use.
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
