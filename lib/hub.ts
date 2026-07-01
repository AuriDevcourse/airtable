// Server-only access to the TechBBQ "Speaker Hub" — the live 2026 speaker roster.
// Speaker Hub is a Supabase app (built in Lovable), NOT Airtable. We read its
// PURPOSE-BUILT public view `speaker_public_profiles`, which the Hub team designed
// to expose only marketing-safe fields. The underlying `profiles` table holds email,
// phone and PA contacts; the view strips all of that and Supabase row-level security
// enforces who is public (a speaker's `visible_in_directory` flag). So RLS is the
// gate here — we don't add our own.
//
// The anon key is a *publishable* key (safe to expose), but we still proxy through
// the server so this feed matches /api/speakers and /api/niss-speakers: one embed
// pattern, one allowed origin, shared rate-limit + cache.

const URL_BASE = process.env.SPEAKERHUB_SUPABASE_URL;
const ANON_KEY = process.env.SPEAKERHUB_SUPABASE_ANON_KEY;

// Ask the view for only these columns.
const COLUMNS = [
  "id",
  "full_name",
  "job_title",
  "company",
  "biography",
  "photo_url",
  "linkedin_profile",
  "location",
  "ecosystem_role",
] as const;

export type HubSpeaker = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
  location: string;
  role: string;
};

type Row = {
  id: string | null;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  biography: string | null;
  photo_url: string | null;
  linkedin_profile: string | null;
  location: string | null;
  ecosystem_role: string | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function mapRow(r: Row): HubSpeaker {
  return {
    id: str(r.id),
    name: str(r.full_name),
    title: str(r.job_title),
    company: str(r.company),
    bio: str(r.biography),
    photo: str(r.photo_url) || null,
    linkedin: str(r.linkedin_profile) || null,
    location: str(r.location),
    role: str(r.ecosystem_role),
  };
}

export class HubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchHubSpeakers(): Promise<HubSpeaker[]> {
  if (!URL_BASE || !ANON_KEY) {
    throw new HubError("Speaker Hub Supabase env vars are not set on the server.", 503);
  }

  const params = new URLSearchParams();
  params.set("select", COLUMNS.join(","));
  params.set("order", "full_name.asc");

  const res = await fetch(
    `${URL_BASE}/rest/v1/speaker_public_profiles?${params.toString()}`,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("[hub] supabase fetch failed", res.status, detail);
    throw new HubError("Could not reach the Speaker Hub source.", 502);
  }

  const rows = (await res.json()) as Row[];
  return rows.map(mapRow).filter((s) => s.name);
}
