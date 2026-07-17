// Browser-facing "Sync now" for the dashboard. Same work as /api/sync-speakers, but
// authorized by the dashboard password (see middleware.ts) instead of CRON_SECRET —
// a browser can't be given CRON_SECRET without leaking it into the page bundle.
//
// Requests only reach this file if middleware already accepted the Basic auth, so there
// is no second check here. It is inside the middleware matcher on purpose: do NOT add
// this path to PUBLIC_PATHS, or the write becomes open to the internet.

import { NextResponse } from "next/server";
import { syncSpeakersToAirtable } from "@/lib/sync";
import { invalidate } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await syncSpeakersToAirtable();
    // The grid caches for an hour. Drop it so the press visibly does something: new
    // Speaker Hub arrivals AND any hierarchy edits marketing just made in Airtable
    // show up on the very next fetch.
    invalidate("speakers-2026");
    console.log("[/api/admin/sync]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[/api/admin/sync]", err);
    return NextResponse.json(
      { ok: false, error: "Sync failed. Check server logs." },
      { status: 500 }
    );
  }
}
