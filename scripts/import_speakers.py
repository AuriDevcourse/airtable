#!/usr/bin/env python3
"""One-way snapshot sync: Supabase Speaker Hub  ->  Airtable "Marketing Project Overview".

Reads the live, PII-stripped `speaker_public_profiles` view from the TechBBQ Speaker
Hub (Supabase) and writes any MISSING speakers into the Airtable table as new rows
tagged `Project Name = "TechBBQ Summit"`. Dedupes by normalized Full Name, so it is
safe to re-run: it only ever ADDS people who are not already there. It never edits or
deletes existing rows.

Usage:
    python scripts/import_speakers.py            # dry run: shows the delta, writes nothing
    python scripts/import_speakers.py --write     # actually create the missing rows

Env (read from .env.local, gitignored):
    AIRTABLE_TOKEN                 (needs data.records:read + data.records:write)
    AIRTABLE_BASE_ID
    SPEAKERHUB_SUPABASE_URL
    SPEAKERHUB_SUPABASE_ANON_KEY
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

# --- Airtable target (pinned; these are stable IDs, not secrets) ---------------
TARGET_TABLE = "tblTecOBecLQCNIeD"          # Marketing Project Overview
PROJECT_NAME = "TechBBQ Summit"             # tag applied to every imported row
SUPABASE_VIEW = "speaker_public_profiles"   # PII-stripped public view


def load_env(path=".env.local"):
    """Minimal .env parser (no dependency on python-dotenv)."""
    here = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), path)
    env = {}
    if os.path.exists(here):
        with open(here, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    # process env wins (e.g. CI / Vercel)
    for k in ("AIRTABLE_TOKEN", "AIRTABLE_BASE_ID",
              "SPEAKERHUB_SUPABASE_URL", "SPEAKERHUB_SUPABASE_ANON_KEY"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


def http_json(url, headers, method="GET", body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(name):
    return " ".join((name or "").split()).strip().lower()


def fetch_supabase(env):
    base = env["SPEAKERHUB_SUPABASE_URL"].rstrip("/")
    key = env["SPEAKERHUB_SUPABASE_ANON_KEY"]
    cols = "full_name,job_title,company,linkedin_profile,photo_url"
    url = f"{base}/rest/v1/{SUPABASE_VIEW}?select={cols}&order=full_name.asc"
    rows = http_json(url, {"apikey": key, "Authorization": f"Bearer {key}"})
    out = []
    for r in rows:
        name = (r.get("full_name") or "").strip()
        if not name:
            continue
        out.append({
            "name": name,
            "title": (r.get("job_title") or "").strip(),
            "company": (r.get("company") or "").strip(),
            "linkedin": (r.get("linkedin_profile") or "").strip(),
            "photo": (r.get("photo_url") or "").strip(),
        })
    return out


def fetch_airtable_existing(env):
    """All existing Full Names already tagged TechBBQ Summit (paginated)."""
    token = env["AIRTABLE_TOKEN"]
    base = env["AIRTABLE_BASE_ID"]
    headers = {"Authorization": f"Bearer {token}"}
    names = set()
    offset = None
    formula = f'{{Project Name}}="{PROJECT_NAME}"'
    while True:
        params = {
            "filterByFormula": formula,
            "fields[]": "Full Name",
            "pageSize": "100",
        }
        qs = urllib.parse.urlencode(params, doseq=True)
        if offset:
            qs += "&offset=" + urllib.parse.quote(offset)
        url = f"https://api.airtable.com/v0/{base}/{TARGET_TABLE}?{qs}"
        data = http_json(url, headers)
        for rec in data.get("records", []):
            nm = rec.get("fields", {}).get("Full Name")
            if nm:
                names.add(norm(nm))
        offset = data.get("offset")
        if not offset:
            break
    return names


def create_records(env, speakers):
    token = env["AIRTABLE_TOKEN"]
    base = env["AIRTABLE_BASE_ID"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"https://api.airtable.com/v0/{base}/{TARGET_TABLE}"
    created = 0
    # Airtable caps createRecords at 10 per request.
    for i in range(0, len(speakers), 10):
        batch = speakers[i:i + 10]
        records = []
        for s in batch:
            fields = {
                "Full Name": s["name"],
                "Project Name": PROJECT_NAME,
            }
            if s["title"]:
                fields["Job Title"] = s["title"]
            if s["company"]:
                fields["Company"] = s["company"]
            if s["linkedin"].startswith("http"):
                fields["LinkedIn Handle"] = s["linkedin"]
            if s["photo"].startswith("http"):
                fields["Profile Picture"] = [{"url": s["photo"]}]
            records.append({"fields": fields})
        http_json(url, headers, method="POST", body={"records": records, "typecast": True})
        created += len(records)
        print(f"  ...created {created}/{len(speakers)}")
        time.sleep(0.25)  # stay well under Airtable's 5 req/s
    return created


def main():
    write = "--write" in sys.argv
    env = load_env()
    missing = [k for k in ("AIRTABLE_TOKEN", "AIRTABLE_BASE_ID",
                           "SPEAKERHUB_SUPABASE_URL", "SPEAKERHUB_SUPABASE_ANON_KEY")
               if not env.get(k)]
    if missing:
        print("Missing env:", ", ".join(missing))
        sys.exit(1)

    print("Reading Supabase Speaker Hub...")
    hub = fetch_supabase(env)
    print(f"  {len(hub)} public speakers in Supabase")

    print("Reading existing Airtable rows...")
    existing = fetch_airtable_existing(env)
    print(f"  {len(existing)} already in Airtable (Project Name = {PROJECT_NAME})")

    # dedupe the source too, in case Supabase has a repeat
    seen = set()
    to_add = []
    for s in hub:
        n = norm(s["name"])
        if n in existing or n in seen:
            continue
        seen.add(n)
        to_add.append(s)

    print(f"\nDelta: {len(to_add)} speaker(s) to add")
    for s in to_add:
        print(f"  + {s['name']}  ({s['company'] or 'no company'})")

    if not to_add:
        print("\nNothing to do. Airtable is already in sync.")
        return

    if not write:
        print("\nDRY RUN. Re-run with --write to create these rows.")
        return

    print("\nWriting to Airtable...")
    n = create_records(env, to_add)
    print(f"\nDone. Created {n} new record(s).")


if __name__ == "__main__":
    main()
