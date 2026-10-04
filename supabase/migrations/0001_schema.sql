-- 0001_schema: core tables for the Competitive Presence Tracker
create extension if not exists pgcrypto;

create type member_role    as enum ('client_viewer', 'client_editor');
create type company_group  as enum ('client', 'direct_peer', 'benchmark');
create type metric_area    as enum ('search', 'reviews', 'listings', 'social', 'website');
create type metric_source  as enum ('manual', 'api');
create type value_type     as enum ('number', 'integer', 'percent', 'score', 'boolean', 'text', 'date');
create type direction      as enum ('higher_better', 'lower_better', 'neutral');
create type display_weight as enum ('primary', 'secondary');
create type run_trigger    as enum ('scheduled', 'manual');
create type run_status     as enum ('queued', 'running', 'succeeded', 'partial', 'failed');
create type result_type    as enum ('organic', 'local_pack', 'ad', 'other');
create type match_kind     as enum ('own_site', 'third_party_profile', 'local_pack');
create type action_status  as enum ('open', 'in_progress', 'done', 'dropped');

-- workspaces ------------------------------------------------------------------
create table workspaces (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique,
  name                     text not null,
  search_location          text not null,
  search_device            text not null default 'desktop' check (search_device in ('desktop','mobile')),
  search_language          text not null default 'en',
  search_country           text not null default 'us',
  timezone                 text not null default 'America/New_York',
  stale_after_days         integer not null default 35,
  refresh_cooldown_minutes integer not null default 60,
  weekly_refresh_enabled   boolean not null default true,
  client_access_enabled    boolean not null default false,
  theme                    jsonb not null default '{}'::jsonb,
  settings                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now()
);

-- identity --------------------------------------------------------------------
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text not null,
  full_name        text,
  is_agency_admin  boolean not null default false,
  created_at       timestamptz not null default now()
);

create table workspace_members (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  role          member_role not null,
  invited_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table invites (
  email            text primary key,
  is_agency_admin  boolean not null default false,
  workspace_id     uuid references workspaces(id) on delete cascade,
  role             member_role,
  invited_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  check (is_agency_admin or (workspace_id is not null and role is not null))
);

-- companies -------------------------------------------------------------------
create table companies (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  name             text not null,
  short_name       text,
  website_url      text,
  website_domain   text,
  extra_domains    text[] not null default '{}',
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

create table company_profiles (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  platform      text not null,
  url           text,
  handle        text,
  external_id   text,
  verified_at   timestamptz,
  notes         text,
  unique (company_id, platform)
);

-- metric catalog --------------------------------------------------------------
create table metrics (
  key              text primary key,
  label            text not null,
  area             metric_area not null,
  platform         text,
  unit             text,
  value_type       value_type not null,
  direction        direction not null default 'higher_better',
  source           metric_source not null default 'manual',
  collector_key    text,
  display_weight   display_weight not null default 'primary',
  stale_after_days integer,
  help_text        text,
  sort_order       integer not null default 100,
  is_active        boolean not null default true
);

-- collection runs -------------------------------------------------------------
create table collection_runs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  trigger       run_trigger not null,
  requested_by  uuid references profiles(id),
  status        run_status not null default 'queued',
  collectors    text[] not null default '{}',
  started_at    timestamptz,
  finished_at   timestamptz,
  summary       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index collection_runs_ws on collection_runs(workspace_id, created_at desc);

-- snapshots (append-only) -----------------------------------------------------
create table snapshots (
  id             bigint generated always as identity primary key,
  company_id     uuid not null references companies(id) on delete cascade,
  metric_key     text not null references metrics(key),
  value_num      numeric,
  value_bool     boolean,
  value_text     text,
  value_date     date,
  captured_at    timestamptz not null default now(),
  source         metric_source not null,
  collector_key  text,
  run_id         uuid references collection_runs(id),
  entered_by     uuid references profiles(id),
  note           text,
  raw            jsonb,
  check (num_nonnulls(value_num, value_bool, value_text, value_date) = 1)
);
create index snapshots_lookup on snapshots(company_id, metric_key, captured_at desc);

-- search ----------------------------------------------------------------------
create table queries (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  phrase        text not null,
  "group"       text not null default 'category',
  is_branded    boolean not null default false,
  is_active     boolean not null default true,
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now(),
  unique (workspace_id, phrase)
);

create table serp_runs (
  id             uuid primary key default gen_random_uuid(),
  query_id       uuid not null references queries(id) on delete cascade,
  run_id         uuid references collection_runs(id),
  captured_at    timestamptz not null default now(),
  provider       text not null,
  location       text not null,
  device         text not null,
  total_organic  integer,
  has_local_pack boolean,
  cost_units     numeric,
  raw            jsonb
);
create index serp_runs_query on serp_runs(query_id, captured_at desc);

create table serp_results (
  id                  bigint generated always as identity primary key,
  serp_run_id         uuid not null references serp_runs(id) on delete cascade,
  result_type         result_type not null,
  position            integer not null,
  title               text,
  url                 text,
  domain              text,
  place_id            text,
  rating              numeric,
  review_count        integer,
  matched_company_id  uuid references companies(id) on delete set null,
  match_kind          match_kind
);
create index serp_results_run on serp_results(serp_run_id);

-- reports (frozen) --------------------------------------------------------------
create table reports (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text not null,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  period_start  date,
  period_end    date,
  payload       jsonb not null
);

-- actions -----------------------------------------------------------------------
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

-- derived view: latest + previous snapshot per (company, metric) ----------------
create view scorecard_cells with (security_invoker = true) as
with ranked as (
  select s.*,
         row_number() over (partition by company_id, metric_key order by captured_at desc) as rn
  from snapshots s
)
select cur.company_id, c.workspace_id, cur.metric_key,
       cur.value_num, cur.value_bool, cur.value_text, cur.value_date,
       cur.captured_at, cur.source, cur.entered_by, cur.id as snapshot_id,
       prev.value_num  as prev_value_num,
       prev.value_bool as prev_value_bool,
       prev.value_date as prev_value_date,
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
