# Project: Hosted Lead-Gen Dashboard (Next.js + Turso + Auth.js, deployed on Vercel) — OpenStreetMap Edition

## Goal
A web app, deployed on Vercel and accessible from any device (phone included), used by a **team of 6**, that searches OpenStreetMap for businesses in a given niche + location, flags ones with no website, stores results permanently in a shared hosted database, and shows them in a dashboard with contacted-status tracking and per-lead assignment. Gated behind real email/password login. No paid APIs — built entirely on free, public OpenStreetMap services, used within their published usage policies.

## Team model
- All 6 users share one leads pool — anyone can see any lead.
- Any logged-in user can trigger a new search.
- Leads can be **assigned** to a specific team member (so two people don't call the same clinic). Unassigned leads are visible to everyone as "up for grabs."
- Status changes and assignment changes are **attributed** to the user who made them (audit trail) — important with 6 people touching the same data.
- No self-service signup — accounts are provisioned manually by you via a script (rare event, 6 people total).

## Stack
- **Framework:** Next.js 15+ (App Router), TypeScript
- **Auth:** Auth.js (NextAuth v5) — Credentials provider (email + password, hashed with bcrypt, cost factor 12). No OAuth providers needed — this is internal team tooling, not public signup.
- **Database:** Turso (libSQL — SQLite-compatible, hosted). Stores app data (leads, search cells, scrape jobs) AND the users table for auth.
- **Hosting:** Vercel
- **Styling:** Tailwind CSS (ships with Next.js starter, keep it simple — no heavy component library needed)
- **Geocoding:** Nominatim public API (nominatim.openstreetmap.org) — used ONLY to convert the user's typed location string (e.g. "Dibrugarh, Assam") into a single lat/lng point. One request per search. Never used for grid/area sweeps.
- **Business data:** Overpass API (overpass-api.de primary, with fallback mirrors) — used for the actual area sweep to find businesses matching the niche.

---

## MANDATORY: OpenStreetMap usage policy compliance
1. **Nominatim is for single-point geocoding only.** Use it exactly once per user search, to convert the typed location string into one lat/lng. Never use Nominatim in a loop, never use it for grid/systematic queries, never use it to enumerate POIs. Nominatim's policy explicitly forbids "systematic queries" including "reverse queries in a grid" and "downloading all POIs in an area" — that work belongs to Overpass, not Nominatim.
2. **Rate limit:** max 1 request/second to Nominatim, and realistically far less since it's one call per search action, not per grid cell. Add a hard 1.1-second minimum spacing in code between any two Nominatim calls regardless of who triggers them (team-wide, not per-user), as a safety margin.
3. **Always send a descriptive HTTP `User-Agent` header** identifying this application on every Nominatim and Overpass request — e.g. `User-Agent: DentalLeadFinder/1.0 (internal tool; contact: <fill in a real contact email in env var CONTACT_EMAIL>)`. Generic default library user-agents are explicitly disallowed by policy and may get silently blocked.
4. **Cache aggressively and never repeat the same query.** Both Nominatim geocodes and Overpass area-sweeps must be cached by their exact input (location string for geocodes; niche+cell for Overpass) and never re-fetched within the freshness window (default 30 days).
5. **For Overpass, implement a multi-mirror fallback chain** rather than hammering one server when it's rate-limiting you.
6. **Display attribution in the UI footer**: "Business data © OpenStreetMap contributors, ODbL license" with a link to https://www.openstreetmap.org/copyright — required by the data license.

---

## Overpass mirror fallback
Define an ordered list of Overpass endpoints in `lib/config.ts`:
```ts
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
```
Logic for every Overpass call:
1. Try the first endpoint. If it returns HTTP 429 (rate limited) or times out (use a 25-second client timeout), wait briefly (2 seconds) and try the next endpoint in the list.
2. If all endpoints fail for a cell, mark that cell's scrape job as `status: 'failed_rate_limited'` in the `search_cells`/`scrape_jobs` table and continue processing other cells. Surface this in the final job summary as "N cells could not be searched due to rate limiting, will retry automatically next time you search this area".
3. Never parallelize Overpass requests across cells — process cells sequentially with at least a 1-second gap between requests, even across different mirrors.

---

## SECURITY NOTE
Do not rely on middleware alone to protect routes/pages (CVE-2025-29927). Implement defense in depth:
1. Middleware-level redirect for unauthenticated users (UX convenience).
2. Re-verify session inside every Server Component page AND every API route handler that touches leads data or triggers a search. Check `auth()` at the top of each protected route/handler and return 401 if there's no valid session.
3. Implement basic login rate-limiting: track attempts in a `login_attempts` table (email, ip, timestamp) and block further attempts for an email+IP pair for 15 minutes after 5 failed attempts within 10 minutes.

---

## Auth setup (Auth.js v5)
- Install: `next-auth@beta`, `bcryptjs`, `@auth/core` (plus `@types/bcryptjs` if needed)
- Split config pattern: `auth.config.ts` (edge-safe: providers, pages, callbacks) + `auth.ts` (full config with adapter/credentials logic).
- Credentials provider: compare password hash with `bcrypt.compare` (hash cost factor 12).
- Session strategy: JWT.
- Custom sign-in page at `/login` — simple email + password form. No public signup.
- Protect: `/dashboard` and `/api/leads/*`, `/api/search`, `/api/jobs/*`.

---

## Database: Turso setup
- Stores app data and users.
- Use `@libsql/client` to connect.
- Initialize schema via setup script `scripts/init-db.ts`.

### Full schema
(Included in specification)

---

## Core data flow
1. User logs in, lands on `/dashboard`.
2. Search form: niche, location, radius (default 5000m). Submits to `POST /api/search`.
3. `POST /api/search` creates a `scrape_jobs` row (`queued`) and returns its ID immediately.
4. Background processing: run the search cell-by-cell sequentially in the serverless invocation. Cap `MAX_CELLS_PER_SEARCH = 10` per job. Update the `scrape_jobs` row after every cell.
5. Frontend polls `GET /api/jobs/[jobId]` every ~2 seconds and shows a progress indicator.
6. Dashboard displays leads in a table: filterable, sortable, with status, assignment control, and email enrichment.
7. Email enrichment: best-effort fetching and parsing of lead websites for mailto links or contact pages.

---

## Build order
1. Scaffold Next.js app (TypeScript + Tailwind + App Router).
2. Set up Turso database and run schema init.
3. Set up Auth.js v5 with Credentials provider + login rate-limiting. Seed test user. Test auth & route protection.
4. Build Nominatim geocoder with User-Agent and rate limit spacing.
5. Build Overpass query function with mirror fallback.
6. Build grid generation logic.
7. Build scrape_jobs + search_cells sequential wiring.
8. Build leads upsert.
9. Build email enrichment.
10. Build assignment + status API endpoints.
11. Build Dashboard UI.
12. Verify updates persist.
13. Verify search caching.
14. Deploy/verify.
15. Summary report.
