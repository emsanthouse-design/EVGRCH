# Competitive Presence Tracker — Architecture & Schema Proposal

Status: **DRAFT for Erin's review. No application code has been written.**
Companion file: `docs/schema-draft.sql` (full DDL, not yet applied to Supabase).

---

## 1. Decisions I'm asking you to make

| # | Decision | My recommendation | Why it matters |
|---|---|---|---|
| 1 | Front-end framework | **Vite + React 19 + TypeScript**, static build | See §3. Easy to change now, painful later. |
| 2 | SERP provider | See §6 (cost table) | Only paid API in the build. Billed per query. |
| 3 | Who is an "agency admin" | A **global** flag on the user, not a per-workspace role | Lets 3 EVG staff see every client workspace without re-inviting them per client. |
| 4 | Search device for rankings | **Desktop** by default, as a workspace setting | Local pack composition differs by device; billing is per device run. |
| 5 | Supabase project + Netlify site names | `evg-presence-tracker` for both, in org **emsanthouse** / team **emsanthouse** | Both accounts already exist; the new project is separate from your "Horse Racing Names" project. |
| 6 | Company profile URLs | Confirm the list in §8 | Seed data for the RCH workspace. |

Everything else below is a recommendation I'll proceed with unless you object.

---

## 2. System overview

```
 Browser (static React app on Netlify)
   │  supabase-js (anon key, user JWT)            fetch /api/* (user JWT in header)
   ▼                                                ▼
 Supabase ──────────────────────────────  Netlify Functions (TypeScript)
   • Postgres + RLS (all tables)            • /api/refresh         → checks role + cooldown, creates run, fires background fn
   • Auth (magic link, invite-only)         • collect-background   → runs API collectors (15-min limit)
   • Storage (optional: PDF copies)         • weekly-scheduled     → every Monday 06:00 ET, one run per workspace (30-s limit, so it only enqueues)
                                            • /api/invite          → admin invites a user (service role)
                                            Secrets: SERP key, Google key, Supabase service role — env vars only
```

Key properties:

- **The browser never sees an API key.** It talks to Supabase with the anon key plus the user's JWT (RLS does the authorization) and to Netlify functions with that same JWT, which the function verifies before using any secret.
- **Netlify scheduled functions have a 30-second limit.** Collecting 15 SERP queries + 8 Places lookups + 8 PageSpeed audits takes several minutes, so the weekly job only inserts a `collection_runs` row and invokes a **background function** (15-minute limit) that does the actual work. "Refresh now" uses the exact same path.
- **Append-only history.** `snapshots`, `serp_runs`, `serp_results`, and `reports` have no UPDATE or DELETE policies. Corrections are new rows.
- **Client-agnostic.** Everything hangs off `workspaces`. Adding a client = one workspace row, its companies, and its queries.

---

## 3. Front-end framework: Vite + React + TypeScript

Why this and not the alternatives:

- **Static output** is a hard requirement (Netlify static site). Vite builds to plain HTML/JS/CSS. Next.js would push toward SSR we don't need; SvelteKit is excellent but React has the deepest bench for charting (Recharts), PDF/image export, and future hires.
- **Supporting libraries:** React Router (routing), TanStack Query (data fetching/caching around supabase-js), React Hook Form + Zod (data-entry forms), Recharts (trend lines), Tailwind CSS v4 (styling, with all colors/type as CSS variables so a client theme is a token file swap, see §9).
- **Exports (Phase 3)** run entirely in the browser: charts are SVG → PNG via `html-to-image`; CSV is generated from the frozen report payload; PDF uses the browser's print pipeline with a dedicated print stylesheet plus `jspdf` as a one-click fallback. No headless browser on the server, which keeps Netlify functions small.

Repository layout (single package):

```
/src                      React app
  /app                    routes, layout, auth guard
  /features/scorecard     one folder per screen
  /features/search
  /features/company
  /features/data-entry
  /features/reports
  /features/settings
  /lib/supabase.ts        typed client (types generated from the DB)
  /theme/tokens.css       all colors, spacing, type as CSS variables
/netlify/functions        refresh.mts, invite.mts, collect-background.mts, weekly-scheduled.mts
/netlify/lib/collectors   one module per collector (see §4)
/netlify/lib/serp         SERP provider adapters (serpapi.ts, dataforseo.ts, ...)
/supabase/migrations      SQL migrations (applied with the Supabase CLI / MCP)
/supabase/seed            metric catalog + RCH workspace seed
/docs                     this file, decisions log
```

---

## 4. Pluggable collectors (the main architectural requirement)

Two interfaces, because SERP data is per **query** while everything else is per **company**:

```ts
// netlify/lib/collectors/types.ts
export interface CompanyCollector {
  key: string;                                   // 'google_places' | 'pagespeed' | 'yelp' | 'meta'
  produces: MetricKey[];                         // metric keys this module can fill
  canRun(company: CompanyWithProfiles): boolean; // e.g. has a google place_id
  collect(company: CompanyWithProfiles, ctx: CollectorContext): Promise<MetricValue[]>;
}

export interface QueryCollector {
  key: 'serp';
  collect(query: Query, workspace: Workspace, ctx: CollectorContext): Promise<SerpCapture>;
}

export interface MetricValue {
  metricKey: MetricKey;
  value: number | boolean | string | Date;
  capturedAt: Date;
  raw?: unknown;          // trimmed provider payload, stored in snapshots.raw
}
```

How a run works (`collect-background.mts`):

1. Load the workspace, its active companies + profiles, its active queries, and the metric catalog.
2. For every metric with `source = 'api'`, group by `collector_key`. Only collectors that own at least one `api` metric run. **A metric is "automated" purely because its catalog row says so.**
3. Run each collector for each company (with concurrency limits and per-provider retry), insert `snapshots` rows tagged with the `run_id`.
4. Run the SERP collector for each query, insert `serp_runs` + `serp_results`, run company matching (§5).
5. Write a per-collector summary (counts, errors, estimated cost) to `collection_runs.summary` and mark the run `succeeded` / `partial` / `failed`.

Moving a metric from manual to automated later (e.g. Yelp rating):

1. Add `netlify/lib/collectors/yelp.ts` implementing `CompanyCollector`.
2. Register it in the collector index.
3. `update metrics set source = 'api', collector_key = 'yelp' where key in ('yelp_rating', 'yelp_review_count');`

No schema change. No UI change: the scorecard reads `snapshots.source` per cell, the data-entry form hides fields whose metric is `api`.

Collectors in scope per phase:

| Collector | Phase | Metrics |
|---|---|---|
| `google_places` | 2 | google_rating, google_review_count, google_newest_review_date |
| `pagespeed` | 2 | mobile_performance_score (+ desktop score and CWV fields stored in `raw`) |
| `serp` | 2 | rankings (not a snapshot metric; written to `serp_*` tables), plus derived `branded_top_result_owner` for the client |
| `yelp` | 4 | yelp_rating, yelp_review_count |
| `meta` | 4 | ig_followers, ig_posts_30d, ig_last_post_date, fb_followers, fb_posts_30d, fb_last_post_date (if access rules allow; see §6) |

---

## 5. Data model — what changed from your starting point and why

Full DDL is in `docs/schema-draft.sql`. Summary of the changes to your draft:

| Table | Change | Reason |
|---|---|---|
| `profiles` + `invites` | **New.** `profiles.is_agency_admin` is global. `invites` is the allow-list; magic links are only sent to invited emails. | Supabase magic link is open sign-up by default. We disable sign-ups and gate on the invite list so a stranger can't create an account. |
| `workspace_members` | **New.** `(workspace_id, user_id, role)` with role ∈ {client_viewer, client_editor}. Empty at launch. | Client roles are per workspace; agency admins are not. |
| `workspaces` | Added `search_device`, `search_country/language`, `timezone`, `stale_after_days` (35), `refresh_cooldown_minutes` (60), `weekly_refresh_enabled`, `client_access_enabled`, `theme` jsonb. | Everything you called a "setting" is a real column so the Settings screen is typed, not a JSON blob. |
| `companies` | `group` is an enum (`client`, `direct_peer`, `benchmark`); added `website_domain` + `extra_domains[]`; a partial unique index enforces **one client per workspace**. | Domain matching for SERP results; `benchmark` separation in the grid. |
| `company_profiles` | **Split out of `companies`.** One row per (company, platform): url, handle, external_id (Google place_id, IG account id). | Drives the data-entry form (link next to each field) and gives collectors their identifiers. Adding a platform is a row, not a column. |
| `metrics` | Added `platform`, `value_type`, `collector_key`, `display_weight` (primary/secondary), `stale_after_days` override, `help_text`, `sort_order`. | `display_weight` implements "follower counts display smaller". `platform` groups Listings/Reviews cells by platform. The catalog is seeded data, editable by admins. |
| `snapshots` | Typed value columns (`value_num`, `value_bool`, `value_text`, `value_date`) with a CHECK that exactly one is set; `run_id`, `raw`. | "Pricing shown" is a boolean, "last post date" is a date, rating is numeric. One `value text` column would push type logic into the UI. |
| `serp_runs` (new) + `serp_results` | Parent row per (query, capture) holds provider, location, device, cost, raw payload. Child rows hold position, type, url/domain, place_id, matched company, `match_kind`. | Avoids repeating capture metadata on every result row; keeps the raw payload once for re-matching later. |
| `collection_runs` | **New.** One row per weekly or manual run: trigger, who, status, per-collector summary. | Powers the refresh rate limit (last manual run < 60 min → refuse), the "last refreshed" stamp, and an activity log. |
| `reports` | `payload` jsonb = frozen scorecard + search table + histories. Optional `period_start/end`. | Report renders from its own payload only, so it never changes. |
| `actions` | Added `company_id`, `due_date`, `status` enum. | As briefed, Phase 4. |
| `scorecard_cells` (view) | **New.** Latest + previous snapshot per (company, metric), delta, `is_stale`. | One query feeds the whole scorecard grid. |

### Company matching for search results

- **Organic:** result domain (with `www.` stripped) equals `companies.website_domain` or is in `extra_domains` → `match_kind = own_site`. Result URL matches a `company_profiles.url` (e.g. a Houzz or Yelp profile page) → `third_party_profile`. Both count as "the company holds that position" but are displayed differently.
- **Local pack:** provider `place_id` equals `company_profiles.external_id` for platform `google` → `local_pack`. Fallback: normalized name match, flagged as low-confidence.
- **"Who holds the top result for the client's branded queries"** is derived from this: position 1 organic + local pack position 1 on `is_branded` queries, surfaced as a Search-area cell on the client's column.

### Seed metric catalog (initial rows)

| Area | Key | Type | Source | Weight |
|---|---|---|---|---|
| reviews | google_rating | number (stars) | api · google_places | secondary |
| reviews | google_review_count | integer | api · google_places | secondary |
| reviews | google_newest_review_date | date | api · google_places | **primary** |
| reviews | google_response_rate | percent | manual | **primary** |
| reviews | yelp_rating, yelp_review_count | number, integer | manual | secondary |
| reviews | yelp_response_rate | percent | manual | primary |
| reviews | houzz_rating, houzz_review_count | number, integer | manual | secondary |
| reviews | houzz_response_rate | percent | manual | primary |
| listings | listing_claimed_{google,yelp,houzz,facebook,bbb} | boolean | manual | primary |
| listings | listing_owner_name_ok_{…} | boolean | manual | primary |
| listings | listing_contact_ok_{…} | boolean | manual | primary |
| social | ig_posts_30d, fb_posts_30d | integer | manual | **primary** |
| social | ig_last_post_date, fb_last_post_date | date | manual | primary |
| social | ig_followers, fb_followers | integer | manual | secondary (displayed smaller) |
| website | mobile_performance_score | score 0–100 | api · pagespeed | primary |
| website | homepage_lead_message | text | manual | primary |
| website | visible_inquiry_path | boolean | manual | primary |
| website | pricing_shown | boolean | manual | primary |
| search | branded_top_result_owner | text | api · serp (derived) | primary |

The Listings platform list (`google, yelp, houzz, facebook, bbb`) is my guess; tell me which platforms you actually audit and I'll seed those.

---

## 6. External APIs: terms, quotas, pricing (checked 2026-10-04)

> Filled in from today's research in §6 of the companion summary; see the "API research" section appended below.

---

## 7. Behavior details

- **Refresh now.** `POST /api/refresh` → verify JWT → require agency admin → read last `collection_runs` row with `trigger = 'manual'` for the workspace → if younger than `refresh_cooldown_minutes`, return 429 with the time remaining → else insert a `queued` run and invoke `collect-background`. The UI polls the run row and shows per-collector progress.
- **Weekly schedule.** `weekly-scheduled.mts` with `schedule: "0 10 * * 1"` (Monday 10:00 UTC = 06:00 ET). For each workspace with `weekly_refresh_enabled`, enqueue a run. The 30-second limit is irrelevant because it only enqueues.
- **Staleness.** `is_stale` in the view = manual snapshot older than `coalesce(metric.stale_after_days, workspace.stale_after_days)`. API snapshots are never "stale" in this sense, but the cell still shows its date.
- **Scorecard ordering.** Columns: client first, then direct peers, a visual gutter, then benchmark companies. Rows grouped by area; within Reviews the order is newest-review date, response rate, then rating/count; within Social, posts-in-30-days first and followers last at reduced weight.
- **Data entry.** One company at a time, platform by platform. Each field group shows the `company_profiles.url` as an "Open ↗" link so a full pass is open-tab, read, type, next. Fields whose metric is `api` are shown read-only with the API value and date.
- **Exports (Phase 3).** Report → frozen `payload` → render page → PDF (print CSS / jspdf), CSV (one row per company × metric with current, previous, delta, captured_at), each chart has a "Download PNG" button.

---

## 8. RCH workspace seed data

> Proposed company URLs for you to confirm are in the "Company lookup" section appended below. Nothing is seeded until you say so.

Queries: the 15 phrases from your brief, grouped `branded` (2), `category` (5), `community` (4), `buyer_situation` (4); the two branded ones have `is_branded = true` and pin to the top of the Search view.

Search location: `Hilton Head Island, South Carolina, United States` (the canonical string most SERP providers accept), desktop, `en`/`us`.

---

## 9. Theming

All colors, type scale, radii and spacing live in `src/theme/tokens.css` as CSS variables (`--color-bg`, `--color-text`, `--color-accent`, `--color-client`, `--color-peer`, `--color-benchmark`, `--font-sans`, …). Tailwind v4 maps its utilities onto those variables. A client theme is a second file that sets `[data-theme="rch"] { --color-accent: … }` and is selected from `workspaces.theme`. Components never reference a raw color.

---

## 10. Deployment and environments

- **Supabase:** new project `evg-presence-tracker` in org `emsanthouse`, region `us-east-1` (same as your existing project, closest to SC). Schema managed as SQL migrations in the repo and applied via the Supabase CLI / MCP, so the whole project can be recreated under the company account later by running the migrations and seed.
- **Netlify:** new site `evg-presence-tracker` on team `emsanthouse`, connected to this GitHub repo, deploys `main`. Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SERP_API_KEY`, `GOOGLE_MAPS_API_KEY` (Places + PageSpeed, restricted to those two APIs). The browser build only gets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Auth:** Supabase email magic link, public sign-up **disabled**, "invite" flow via a Netlify function using the service role. Free-plan Supabase email is rate-limited (see §6), so I'd set up a free Resend SMTP sender before you invite the team.
- **Moving to company accounts later:** transfer the Supabase project to the company org (Supabase supports org transfer), or re-run migrations + a `pg_dump` of data; move the Netlify site between teams in the Netlify UI; re-enter env vars. Nothing is tied to your personal identity in the code.

---

## 11. Phase plan (each phase deployable on its own)

| Phase | Delivers | Usable outcome |
|---|---|---|
| 1 Foundation | Supabase project + migrations + RLS, magic-link auth with invites, Settings (companies, profiles, queries, users), Data entry, Scorecard, metric catalog seed, RCH seed | You can log in, fill in manual data for 8 companies, and see the scorecard with staleness and deltas. |
| 2 Collectors | `google_places`, `pagespeed`, `serp` (your chosen provider), background run pipeline, weekly schedule, Refresh now with cooldown, Search view | The "done" state in your brief. |
| 3 Reports | Company detail with trend lines, report generation (frozen), PDF / CSV / PNG exports | Audit evidence pack. |
| 4 Later | Client logins (flip `client_access_enabled`), Yelp + Meta collectors, actions, client theming | Client-facing deliverable. |

---
