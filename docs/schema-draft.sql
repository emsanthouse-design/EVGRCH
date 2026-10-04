-- =============================================================================
-- Competitive Presence Tracker — schema DRAFT for review (not yet applied)
-- Target: Supabase (Postgres 17). One workspace per client. RLS on every table.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------- enums ------------------------------------------------------------
create type member_role     as enum ('client_viewer', 'client_editor');            -- agency admins are global, see profiles
create type company_group   as enum ('client', 'direct_peer', 'benchmark');
create type metric_area     as enum ('search', 'reviews', 'listings', 'social', 'website');
create type metric_source   as enum ('manual', 'api');
create type value_type      as enum ('number', 'integer', 'percent', 'score', 'boolean', 'text', 'date');
create type direction       as enum ('higher_better', 'lower_better', 'neutral');
create type display_weight  as enum ('primary', 'secondary');
create type run_trigger     as enum ('scheduled', 'manual');
create type run_status      as enum ('queued', 'running', 'succeeded', 'partial', 'failed');
create type result_type     as enum ('organic', 'local_pack', 'ad', 'other');
create type match_kind      as enum ('own_site', 'third_party_profile', 'local_pack');
create type action_status   as enum ('open', 'in_progress', 'done', 'dropped');

-- ---------- identity ---------------------------------------------------------
-- One row per auth user. is_agency_admin grants full access to every workspace.
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text not null,
  full_name        text,
  is_agency_admin  boolean not null default false,
  created_at       timestamptz not null default now()
);

-- Client-side roles, per workspace. Off at launch (no rows), enabled later.
create table workspace_members (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  role          member_role not null,
  invited_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Who is allowed to sign in. Magic links are only issued to invited emails.
create table invites (
  email         text primary key,
  is_agency_admin boolean not null default false,
  workspace_id  uuid references workspaces(id) on delete cascade,
  role          member_role,
  invited_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz
);

-- ---------- workspaces -------------------------------------------------------
create table workspaces (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique,                 -- 'rch'
  name                     text not null,                        -- 'RCH Construction'
  search_location          text not null,                       -- 'Hilton Head Island, South Carolina, United States'
  search_device            text not null default 'desktop',     -- 'desktop' | 'mobile'
  search_language          text not null default 'en',
  search_country           text not null default 'us',
  timezone                 text not null default 'America/New_York',
  stale_after_days         integer not null default 35,
  refresh_cooldown_minutes integer not null default 60,
  weekly_refresh_enabled   boolean not null default true,
  client_access_enabled    boolean not null default false,      -- gates client_viewer/editor logins
  theme                    jsonb not null default '{}'::jsonb,  -- token overrides, phase 4
  settings                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now()
);

-- ---------- companies and their profiles -------------------------------------
create table companies (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  name             text not null,
  short_name       text,                                         -- for tight grid headers
  website_url      text,
  website_domain   text,                                         -- normalized, used for SERP matching
  extra_domains    text[] not null default '{}',                 -- redirects, old domains
  city             text,
  is_client        boolean not null default false,
  "group"          company_group not null default 'direct_peer',
  sort_order       integer not null default 100,
  is_active        boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now(),
  unique (workspace_id, name)
);
create unique index one_client_per_workspace on companies(workspace_id) where is_client;

-- One row per (company, platform). Drives the data-entry form (direct links) and
-- gives collectors their identifiers (place_id, yelp alias, IG username, ...).
create table company_profiles (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  platform      text not null,              -- 'google' | 'yelp' | 'houzz' | 'instagram' | 'facebook' | 'bbb' | 'angi' | ...
  url           text,
  handle        text,                       -- '@rchconstruction', yelp alias, etc.
  external_id   text,                       -- Google place_id, IG business account id, ...
  verified_at   timestamptz,                -- when an admin confirmed this is the right profile
  notes         text,
  unique (company_id, platform)
);

-- ---------- metric catalog ---------------------------------------------------
-- The catalog is data, not code. Moving a metric from manual to api is an UPDATE
-- on this row (source, collector_key). No schema or UI change.
create table metrics (
  key             text primary key,          -- 'google_rating', 'ig_posts_30d', 'listing_claimed_yelp'
  label           text not null,
  area            metric_area not null,
  platform        text,                      -- optional grouping dimension: 'google', 'yelp', 'instagram', ...
  unit            text,                      -- 'stars', 'reviews', 'posts', '%', 'ms', null
  value_type      value_type not null,
  direction       direction not null default 'higher_better',
  source          metric_source not null default 'manual',
  collector_key   text,                      -- 'google_places' | 'pagespeed' | 'serp' | 'yelp' | 'meta' (when source = 'api')
  display_weight  display_weight not null default 'primary',
  stale_after_days integer,                  -- overrides workspace default when set
  help_text       text,                      -- shown in the data-entry form
  sort_order      integer not null default 100,
  is_active       boolean not null default true
);

-- ---------- snapshots (append-only) ------------------------------------------
create table snapshots (
  id             bigint generated always as identity primary key,
  company_id     uuid not null references companies(id) on delete cascade,
  metric_key     text not null references metrics(key),
  value_num      numeric,                    -- numbers, integers, percents, scores
  value_bool     boolean,
  value_text     text,
  value_date     date,                       -- e.g. date of newest review / last post
  captured_at    timestamptz not null default now(),
  source         metric_source not null,
  collector_key  text,
  run_id         uuid references collection_runs(id),
  entered_by     uuid references profiles(id),
  note           text,
  raw            jsonb,                      -- trimmed API payload for audit; null for manual
  check (num_nonnulls(value_num, value_bool, value_text, value_date) = 1)
);
create index snapshots_lookup on snapshots(company_id, metric_key, captured_at desc);
-- RLS: INSERT only. No UPDATE policy, no DELETE policy for anyone. Corrections are new rows.

-- ---------- search ------------------------------------------------------------
create table queries (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  phrase        text not null,
  "group"       text not null default 'category',  -- 'branded' | 'category' | 'community' | 'buyer_situation' (free text, editable)
  is_branded    boolean not null default false,
  is_active     boolean not null default true,
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now(),
  unique (workspace_id, phrase)
);

-- One row per query per capture. Holds the raw provider payload once.
create table serp_runs (
  id            uuid primary key default gen_random_uuid(),
  query_id      uuid not null references queries(id) on delete cascade,
  run_id        uuid references collection_runs(id),
  captured_at   timestamptz not null default now(),
  provider      text not null,               -- 'serpapi' | 'dataforseo' | ...
  location      text not null,
  device        text not null,
  total_organic integer,
  has_local_pack boolean,
  cost_units    numeric,                     -- provider credits consumed
  raw           jsonb
);

create table serp_results (
  id                  bigint generated always as identity primary key,
  serp_run_id         uuid not null references serp_runs(id) on delete cascade,
  result_type         result_type not null,
  position            integer not null,       -- 1-based within its type (organic 1..N, local pack 1..3)
  title               text,
  url                 text,
  domain              text,
  place_id            text,                   -- local pack only, when the provider exposes it
  rating              numeric,                -- local pack only
  review_count        integer,                -- local pack only
  matched_company_id  uuid references companies(id),
  match_kind          match_kind
);
create index serp_results_run on serp_results(serp_run_id);

-- ---------- collection runs ---------------------------------------------------
create table collection_runs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  trigger       run_trigger not null,
  requested_by  uuid references profiles(id),
  status        run_status not null default 'queued',
  collectors    text[] not null,              -- which collector modules ran
  started_at    timestamptz,
  finished_at   timestamptz,
  summary       jsonb not null default '{}'::jsonb,   -- per-collector counts, errors, cost
  created_at    timestamptz not null default now()
);
create index collection_runs_ws on collection_runs(workspace_id, created_at desc);

-- ---------- reports (frozen) --------------------------------------------------
create table reports (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text not null,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  period_start  date,
  period_end    date,
  payload       jsonb not null                 -- frozen scorecard + search + history used to render
);
-- RLS: INSERT and SELECT only. No UPDATE or DELETE.

-- ---------- actions -----------------------------------------------------------
create table actions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  company_id    uuid references companies(id) on delete set null,
  metric_key    text references metrics(key),
  text          text not null,
  status        action_status not null default 'open',
  due_date      date,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- derived views -----------------------------------------------------
-- Latest and previous snapshot per (company, metric), with staleness flag.
create view scorecard_cells as
with ranked as (
  select s.*,
         row_number() over (partition by company_id, metric_key order by captured_at desc) as rn
  from snapshots s
)
select cur.company_id, cur.metric_key,
       cur.value_num, cur.value_bool, cur.value_text, cur.value_date,
       cur.captured_at, cur.source, cur.entered_by,
       prev.value_num  as prev_value_num,
       prev.captured_at as prev_captured_at,
       cur.value_num - prev.value_num as delta_num,
       (cur.source = 'manual'
        and cur.captured_at < now() - make_interval(days => coalesce(m.stale_after_days, w.stale_after_days))) as is_stale
from ranked cur
join companies c on c.id = cur.company_id
join workspaces w on w.id = c.workspace_id
join metrics m on m.key = cur.metric_key
left join ranked prev on prev.company_id = cur.company_id and prev.metric_key = cur.metric_key and prev.rn = 2
where cur.rn = 1;

-- ---------- RLS sketch ---------------------------------------------------------
-- helper: is the caller an agency admin?
--   create function is_agency_admin() returns boolean language sql stable
--   as $$ select coalesce((select is_agency_admin from profiles where id = auth.uid()), false) $$;
-- helper: caller's role in a workspace (null if none)
--   create function member_role_in(ws uuid) returns member_role ...
--
-- Every workspace-scoped table:
--   SELECT  : is_agency_admin() or member_role_in(workspace_id) is not null
--             (and workspaces.client_access_enabled for client roles)
--   INSERT  : is_agency_admin() or member_role_in(workspace_id) = 'client_editor'   (snapshots, actions only)
--   UPDATE  : is_agency_admin()                                                     (never on snapshots/reports)
--   DELETE  : is_agency_admin()                                                     (never on snapshots/reports)
-- metrics catalog: SELECT for any authenticated user; writes for agency admins.
-- Netlify functions use the service role key and bypass RLS; they verify the
-- caller's JWT and role themselves before doing anything.
