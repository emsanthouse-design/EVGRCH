# Competitive Presence Tracker

Tracks a client's digital presence against a set of competitors: search visibility, reviews,
listings, social activity and website basics. One workspace per client. Built for
Evergreen Branding Co.; first client workspace is RCH Construction.

- **Front end:** Vite + React 19 + TypeScript, static build on Netlify
- **Data and auth:** Supabase (Postgres with row-level security, magic-link auth)
- **Collectors:** Netlify functions (weekly scheduled + on-demand), one module per source
- **Docs:** `docs/01-architecture-proposal.md` (design and decisions), `docs/02-rch-seed-companies.md`

## Local development

```bash
npm install
cp .env.example .env       # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                # http://localhost:5173
npm run typecheck          # app + functions
npm run build
```

Netlify functions run locally with `npx netlify dev` (needs the Netlify CLI and the function env vars in `.env`).

## Environments

| Service | Where | Notes |
|---|---|---|
| Supabase project | `evg-presence-tracker` (ref `lnkxcigvjufszghqjfvw`, org emsanthouse, us-east-1) | Schema lives in `supabase/migrations/`; apply in order |
| Netlify site | `evg-presence-tracker` (team emsanthouse) | https://evg-presence-tracker.netlify.app |

### Environment variables

Browser (public, prefixed `VITE_`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the `sb_publishable_…` key).

Functions only (never shipped to the browser): `SUPABASE_URL`, `SUPABASE_ADMIN_KEY` (a Supabase
secret key, `sb_secret_…`), `INTERNAL_SECRET` (any random string), `SERPAPI_KEY` (or `DATAFORSEO_LOGIN` +
`DATAFORSEO_PASSWORD`), `GOOGLE_MAPS_API_KEY`, and optionally `PAGESPEED_API_KEY`.

## Collectors and runs (Phase 2)

- `netlify/functions/weekly-scheduled.mts` runs Mondays 10:00 UTC and enqueues one run per workspace
  with weekly refresh on. `POST /api/refresh` (agency admins) enqueues a manual run, rate-limited by
  the workspace's cooldown. Both call `collect-background.mts`, which has a 15-minute limit and does
  the work: company collectors (Google Places, PageSpeed) then the SERP collector (SerpApi by default,
  DataForSEO as the alternative; 20 results, organic + local pack + ads in one call).
- Results land in `snapshots` (api source), `serp_runs` and `serp_results` with company matching by
  domain, known profile URL, and Google CID. `collection_runs.summary` records per-collector counts,
  errors and SERP cost.
- Unit tests: `npm test` (matching rules and the DataForSEO parser).

### Supabase one-time setup (dashboard)

1. **Authentication → URL Configuration:** Site URL `https://evg-presence-tracker.netlify.app`;
   add `https://evg-presence-tracker.netlify.app/**` and `http://localhost:5173/**` to Redirect URLs.
2. **Authentication → SMTP:** configure a custom sender (Resend or similar) before inviting anyone
   outside the Supabase org. The built-in mailer sends 2 emails/hour and only to org members.
3. **Authentication → Sign In / Providers → Email:** magic links on; "Confirm email" can stay on.
   Public sign-up is already blocked at the database level: an email must be on the `invites`
   table or the sign-in is rejected.

## How access works

- `profiles.is_agency_admin = true` gives full access to every workspace.
- `workspace_members` holds client roles (`client_viewer`, `client_editor`) per workspace. They only
  take effect when the workspace's **Allow client logins** setting is on.
- `invites` is the allow list. A database trigger rejects any new auth user whose email is not on it,
  and another trigger creates the profile and membership from the invite row.

## How metrics work

- `metrics` is the catalog: key, label, area, platform, value type, direction, `source`
  (`manual` or `api`) and `collector_key`.
- `snapshots` is append-only. Every manual save and every collector run adds rows; nothing is
  updated or deleted. The `scorecard_cells` view returns the latest and previous value per
  (company, metric), the delta, and a staleness flag.
- Moving a metric from manual to automated: add a module under `netlify/lib/collectors/` that
  implements `CompanyCollector` (see `types.ts`), register it, then
  `update metrics set source = 'api', collector_key = '<key>' where key = '<metric>'`.
  No schema or UI change is needed.

## Phases

1. **Foundation:** schema, RLS, invite-only auth, Settings, Data entry, Scorecard.
2. **Collectors** (this release): Google Places, PageSpeed, DataForSEO SERP, weekly run, Refresh now, Search view.
3. **Reports:** company detail with trends, frozen reports, PDF / CSV / PNG exports.
4. **Later:** client logins, Instagram collector, actions, client theming.
