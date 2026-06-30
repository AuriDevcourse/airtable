# TechBBQ Airtable Connector

A tiny server-side proxy that turns a **safe slice** of the TechBBQ Airtable into clean JSON,
so WordPress/Elementor can show speakers without ever touching the token or the sensitive fields.

Why a proxy and not a sync plugin: the `Speakers` table mixes marketing fields with
**passport numbers, dates of birth, phone numbers and emails**. This connector reads an explicit
allow-list of safe fields only, and only records with `On Website?` ticked. Nothing else can leak.

```
Browser (techbbq.dk)  ──►  /api/speakers  ──►  Airtable
   no token              token lives here       full table
   safe JSON only        allow-list + gate
```

## Add to a WordPress page (Elementor Pro)

1. **Deploy to Vercel** and grab the URL (e.g. `https://your-project.vercel.app`).
   Sanity-check the feed in a browser: `https://your-project.vercel.app/api/speakers`
   should return JSON.
2. Open `public/elementor-embed.html` and change the `ENDPOINT` line to your feed URL:
   `var ENDPOINT = "https://your-project.vercel.app/api/speakers";`
3. In WordPress, edit the page with **Elementor**.
4. In the widget panel, search **HTML** and drag the **HTML widget** onto the page where
   you want the speakers (it's built into Elementor, free and Pro).
5. Paste the **entire** snippet into the widget's Content box.
6. Click **Update / Publish**. The speaker grid renders in that section.
7. On Vercel, set `ALLOWED_ORIGIN` to your site origin (`https://techbbq.dk`) so the
   browser is allowed to fetch the feed. If it shows "Could not load speakers", this is
   usually the cause.

Notes:
- To restyle, edit the `<style>` block inside the snippet.
- For NISS speakers, use `public/niss-embed.html` and the `/api/niss-speakers` endpoint
  the same way (add `?role=Speaker` to show only speakers).

## What it exposes

`GET /api/speakers` → `{ count, speakers: [{ id, name, title, company, bio, quote, photo, linkedin, website }] }`

- Only fields in `SAFE_FIELDS` (see `lib/airtable.ts`) are ever requested from Airtable.
- Only records where the gate checkbox (`On Website?`) is `TRUE` are returned.
- Cached 5 min (CDN + in-memory), rate-limited 60 req/min/IP.

## Before it works: two Airtable steps

1. **Add read scope to the token.** The current token can read schema but NOT records.
   Go to <https://airtable.com/create/tokens>, open the token, add scope **`data.records:read`**,
   keep it scoped to base `appgXNjXJqpk9Ebxd`. (Or make a new token and paste it into `.env.local`.)
2. **Tick `On Website?`** on the speakers you actually want public. Nothing shows until at least one is ticked.
   (Prefer a different gate? Set `AIRTABLE_GATE_FIELD`, e.g. `Ready for website?`.)

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000  → live preview grid
# raw feed: http://localhost:3000/api/speakers
```

`.env.local` already holds the token + base id (gitignored).

## Deploy (Vercel)

1. Push this folder to a Git repo, import it on Vercel.
2. Add env vars in Vercel → Settings → Environment Variables:
   `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `AIRTABLE_SPEAKERS_TABLE=Speakers`,
   `AIRTABLE_GATE_FIELD=On Website?`, and `ALLOWED_ORIGIN=https://techbbq.dk`.
3. Your feed is then `https://<project>.vercel.app/api/speakers`.

## Put it on the WordPress page

Open `public/elementor-embed.html`, change `ENDPOINT` to your deployed `/api/speakers` URL,
then paste the whole snippet into an Elementor **HTML** widget (or a WordPress **Custom HTML** block).
It renders a responsive speaker grid. Restyle the CSS to match techbbq.dk.

## Adding more fields or tables

- More safe fields: add the Airtable field name to `SAFE_FIELDS` and map it in `mapRecord` (`lib/airtable.ts`).
- Another table (partners, side events): copy `fetchSpeakers` with a new allow-list + route. Same gate pattern.

## Security notes (per global rules)

- Token is server-side only, never `NEXT_PUBLIC_`, never in the browser bundle.
- Strict field allow-list = a code mistake still can't leak passport/DOB fields.
- Rate-limited + cached; CORS lockable to the WordPress origin via `ALLOWED_ORIGIN`.
- Public personal data (names, photos, bios) still needs a lawful basis + privacy-policy mention (GDPR).
