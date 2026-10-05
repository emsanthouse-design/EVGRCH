# Phase 2 setup: accounts and keys

Everything below is done once. Keys go straight into Netlify → Environment variables
(https://app.netlify.com/projects/evg-presence-tracker/configuration/env), never into chat or the repo.

## 0. Switch Netlify to continuous deployment (required for Phase 2)

The drag-and-drop deploy only ships the front end. The collectors are Netlify functions, which only
deploy from a linked repository.

1. Netlify → evg-presence-tracker → Project configuration → Build & deploy → Continuous deployment
   → **Link repository** → GitHub → `emsanthouse-design/EVGRCH`.
2. Production branch: `main` (Netlify's default; the code is published there).
3. Build command and publish directory are read from `netlify.toml`; leave the fields as suggested.
4. Save. Netlify builds and deploys on every push from now on. First build takes 2 to 3 minutes.

## 1. SerpApi (search rankings), free plan, $0

1. Sign up at https://serpapi.com/users/sign_up with the EVG company email. No card needed.
2. Confirm the email, then open https://serpapi.com/manage-api-key and copy **Your Private API Key**.
3. Netlify env var: `SERPAPI_KEY` = that key.

Limits on the free plan: **250 searches per month** and 50 per hour. RCH's 15 queries weekly use
about 65 a month, leaving room for roughly a dozen manual refreshes. Every "Refresh now" costs 15
searches, so use it deliberately. The usage meter is at https://serpapi.com/dashboard.

If we outgrow it (a second client, or more queries), the next step is either SerpApi's $25/month
plan or DataForSEO pay-as-you-go ($50 one-time top-up that lasts years at this volume). Switching is
a Netlify variable change: set `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` and remove `SERPAPI_KEY`.

## 2. Google Cloud (Places ratings and PageSpeed), $0/month at our volume

1. Go to https://console.cloud.google.com/ and sign in with the EVG Google account.
2. Create a project named `evg-presence-tracker` (top bar → project picker → New project).
3. Enable two APIs (APIs & Services → Library, search each, click Enable):
   - **Places API (New)** (not the legacy "Places API")
   - **PageSpeed Insights API**
4. Billing: Places requires a billing account even inside the free allowance. APIs & Services → or
   Billing → link a card. Our usage is ~35 Places calls/month against 1,000 free.
5. Create the key: APIs & Services → Credentials → **Create credentials → API key**. Copy it.
6. Restrict it (click the key name): under API restrictions choose **Restrict key** and tick only
   Places API (New) and PageSpeed Insights API. Save. Leave application restrictions as None (the key
   is only used from Netlify's servers).
7. Netlify env var: `GOOGLE_MAPS_API_KEY` = the key. (`PAGESPEED_API_KEY` is optional; the same key is used.)

## 3. First run

1. After the keys are saved, trigger a redeploy (Deploys → Trigger deploy → Deploy site) so the
   functions pick up the new variables.
2. Open the app → Scorecard → **Refresh now**. The button spins while the run works (1 to 3 minutes).
3. When it finishes, the status line under the button says `succeeded`, `partial` (some errors, hover
   to read them) or `failed`.
4. Check: Google rating and review count filled in for all eight companies, mobile performance score
   filled in, and the Search tab shows ranks for all 15 queries.
5. Settings → Companies → each company's Google profile now has an External ID (the place ID) and a
   Maps URL filled in by the collector. Spot-check two or three to make sure the right business was
   matched; fix any wrong one by pasting the correct place ID.

## 4. Weekly schedule

Runs Mondays at 06:00 Eastern automatically for every workspace with "Run API collectors weekly"
on (Settings → Workspace). Nothing to configure.
