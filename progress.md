# Progress · TechBBQ Airtable Connector

Server-side proxy that exposes a **safe slice** of the TechBBQ Airtable as JSON, so
techbbq.dk (WordPress + Elementor) can show speakers without the token or PII ever
reaching the browser.

## Current state (2026-06-30)

Card redesign DONE (preview pages only): card is a padded dark frame (`.s-card`,
`padding: 8px`). Photo on top in `.s-card__media` (square `aspect-ratio: 1/1`, rounded
12px, `z-index: 1` so the hover glow can't bleed onto it), name + title in a padded
bottom band (`.s-card__overlay`, in normal flow below the photo). On **hover** a diagonal
glow fades in via `.s-card::after` (`inset: -8px` covers the whole card, reaches the true
bottom edge; gradient `115deg` black → red → orange → transparent, so the fire only shows
in the bottom band since the photo sits above it). Files: `app/page.tsx` (media wrapper +
overlay sibling), `app/globals.css` (.s-card / .s-card__media / .s-card__overlay /
.s-card::after / .s-card__name+meta white w/ text-shadow). `/niss` shares these styles.
STILL NOT ported to embed snippets — `public/elementor-embed.html` + `niss-embed.html`
keep the old photo-on-top + body-below layout. Port them next.
Tuning knobs: glow angle (115deg), black amount, red/orange stops, frame padding (8px),
photo shape (media aspect-ratio).

Per-image shimmer added (preview only): a `SpeakerPhoto` component (in `app/page.tsx`)
holds its own `loaded` state and shows `.s-card__media.shimmer` (+ `#1d1d1d` bg) until
its photo fires onLoad/onError. State lives in the component so SWR revalidation re-renders
can't restart the shimmer (the earlier classList.remove approach kept re-shimmering — bug
fixed). Reuses `tbbq-shimmer` keyframes. SkeletonGrid still handles the cold whole-grid
load. To see it: DevTools → Network → Slow 3G → hard refresh.

README: added top section "Add to a WordPress page (Elementor Pro)" — 7-step embed flow
(deploy → set ENDPOINT → drag Elementor HTML widget → paste snippet → publish → set
ALLOWED_ORIGIN).

Dashboard now self-serves the embed: the `.howto` `<details>` panel on `/` explains what
the snippet is and has a **Copy embed code** button (`copyEmbed`). It copies `EMBED_SNIPPET`
(constant in `app/page.tsx`) with `__ORIGIN__` swapped for `window.location.origin`. The
copied snippet is the NEW card ported to vanilla JS/CSS (frame, diagonal hover glow,
per-image shimmer via inline `onload`/`onerror`). So the canonical embed now lives in
page.tsx, generated fresh with the right feed URL. Gotcha: copy from the DEPLOYED Vercel
dashboard, else the baked-in ENDPOINT is localhost.

Preview now has search + pagination + responsive list (preview only, NOT in the embed
snippet yet): search bar filters by name/title/company; Load More shows `PAGE_SIZE` (12)
at a time and resets on search; under 640px the card grid is swapped for `.list-rows`
(60px thumbnail left, name/title right) via CSS media query; back-to-top button (`.scrolltop`,
fixed, appears after 600px scroll, Lucide-style chevron SVG). `SpeakerPhoto` now takes
`mediaClassName` so the row reuses it for the thumbnail + shimmer. All in `app/page.tsx`
+ `app/globals.css`. Heading still says "Speakers preview" (mockup said "Speakers 2026").
Defaults: `PAGE_SIZE = 20` (20 loaded, +20 per Load More). Desktop grid is `repeat(5, 1fr)`
(5 cols), 3 cols on tablet (641-1000px), list under 640px.

Next:
0. Decide if the WordPress embed (EMBED_SNIPPET) needs search + mobile list + Load More too,
   or if those stay preview-only. Currently the snippet is just the card grid.
1. The static `public/elementor-embed.html` + `niss-embed.html` still hold the OLD card —
   either regenerate them from EMBED_SNIPPET or just rely on the dashboard copy button.
2. Build a NISS variant of the copy button / snippet (`/api/niss-speakers`, role filter).
3. Deploy to Vercel (env vars + `ALLOWED_ORIGIN=https://techbbq.dk`), then test the copied
   snippet in a real Elementor HTML widget.

Pushed to GitHub: https://github.com/AuriDevcourse/airtable (`main`).

Photo crop fix: speaker headshots were center-cropped (`object-fit: cover` default
`50% 50%`), cutting foreheads/chins. Set `object-position: 50% 30%` in all three render
spots — `app/globals.css` (.s-card__img, covers `/` and `/niss`), `public/elementor-embed.html`,
`public/niss-embed.html`. Fixed heuristic, not per-face. If specific photos still crop
wrong, next step is server-side smartcrop focal points (smartcrop-sharp → `focusX/focusY`
in the JSON, computed once per image + cached, card uses `object-position: var(--focus)`).

## Earlier state (2026-06-26)

Working locally. Two feeds live and tested against the real base:

- `GET /api/speakers` — the big `Speakers` table, gated to `On Website?` = TRUE → 312 records.
- `GET /api/niss-speakers` — `NISS 2025` table, gated to `Status = "On website"` → 38 (25 Speaker, 9 Moderator, 4 Team). Optional `?role=Speaker|Moderator|Team`.

Both return only allow-listed marketing fields. No passport/DOB/email/phone leaves the server.

Preview pages styled to the TechBBQ design system (Onest + Inter, #0D0D0D, fire gradient,
orb backdrop, flat #131313 cards, pill segmented filter):
- `/` — Speakers preview
- `/niss` — NISS 2025 preview with role filter

Client UX: skeleton on cold load, `localStorage` stale-while-revalidate cache (instant
paint, background refetch, re-render only if data changed). Per-role cache keys.

## Architecture

```
Browser (techbbq.dk)  ──fetch──►  /api/* (token server-side)  ──►  Airtable
   no token, safe JSON only        allow-list + gate + cache
```

- `lib/airtable.ts` — Speakers fetch + `SAFE_FIELDS` allow-list + gate.
- `lib/niss.ts` — NISS fetch + allow-list + status gate + role filter.
- `lib/rate-limit.ts` — in-memory rate limit (60/min/IP) + 5-min response cache.
- `lib/useCachedList.ts` — client SWR-over-localStorage hook.
- `app/api/speakers/route.ts`, `app/api/niss-speakers/route.ts` — handlers (CORS, rate-limit, cache headers).
- `components/OrbBackdrop.tsx`, `components/SkeletonGrid.tsx`.
- `public/elementor-embed.html`, `public/niss-embed.html` — paste-into-Elementor snippets (TechBBQ-styled, load Onest via Google Fonts).

## Gotchas

- Token (`.env.local`, gitignored) is reused from the `docs-to-airtable` kit in Downloads.
  It now has `data.records:read`. If it ever 502s, re-check the scope at airtable.com/create/tokens.
- The raw `Speakers` table mixes marketing fields with passport numbers, DOB, emails. NEVER
  widen `SAFE_FIELDS` without checking what you're exposing.
- Server cache TTL is 5 min, so a fresh Airtable edit can take ~5 min to appear. Drop
  `TTL_MS` in `lib/rate-limit.ts` to 60s if faster updates are needed.
- Ran `npm run build` then `npm run dev` once → corrupted `.next` (404 chunks). Fix: stop
  dev, `rm -rf .next`, restart. Don't interleave build and dev on the same `.next`.

## Next steps

1. Deploy to Vercel; set env vars there + `ALLOWED_ORIGIN=https://techbbq.dk`.
2. Decide which feed/role the techbbq.dk page uses (speakers only vs incl. moderators).
3. Point the embed snippet `ENDPOINT` at the deployed URL, paste into an Elementor HTML widget.
4. Confirm every `On Website?` / `On website` record is actually meant to be public this year.
5. GDPR: public names/photos/bios need a lawful basis + a line in /privacy.
6. Optional: port skeleton + cache into the embed snippets; add a light-background embed variant.

## Run

```bash
npm install
npm run dev   # http://localhost:3000  and  /niss
```
