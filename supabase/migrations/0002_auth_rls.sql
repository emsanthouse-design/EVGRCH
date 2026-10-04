-- 0002_auth_rls: helper functions, invite-only sign-up, row-level security

-- helpers ---------------------------------------------------------------------
create or replace function public.is_agency_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_agency_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.member_role_in(ws uuid)
returns member_role language sql stable security definer set search_path = public as $$
  select m.role
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.workspace_id = ws and m.user_id = auth.uid() and w.client_access_enabled;
$$;

create or replace function public.can_view_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_agency_admin() or public.member_role_in(ws) is not null;
$$;

create or replace function public.can_enter_data(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_agency_admin() or public.member_role_in(ws) = 'client_editor';
$$;

create or replace function public.company_workspace(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.companies where id = cid;
$$;

-- invite-only sign-up ---------------------------------------------------------
-- Block creation of any auth user whose email is not on the invite list.
create or replace function public.enforce_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.invites i where lower(i.email) = lower(new.email)) then
    raise exception 'This email address has not been invited.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger auth_users_enforce_invite
  before insert on auth.users
  for each row execute function public.enforce_invite();

-- After a user is created, materialize profile + membership from the invite.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.invites%rowtype;
begin
  select * into inv from public.invites where lower(email) = lower(new.email);
  insert into public.profiles (id, email, is_agency_admin)
  values (new.id, new.email, coalesce(inv.is_agency_admin, false));
  if inv.workspace_id is not null and inv.role is not null then
    insert into public.workspace_members (workspace_id, user_id, role, invited_by)
    values (inv.workspace_id, new.id, inv.role, inv.invited_by)
    on conflict do nothing;
  end if;
  update public.invites set accepted_at = now() where lower(email) = lower(new.email);
  return new;
end;
$$;
create trigger auth_users_handle_new
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at ------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger actions_touch before update on public.actions
  for each row execute function public.touch_updated_at();

-- RLS -------------------------------------------------------------------------
alter table workspaces        enable row level security;
alter table profiles          enable row level security;
alter table workspace_members enable row level security;
alter table invites           enable row level security;
alter table companies         enable row level security;
alter table company_profiles  enable row level security;
alter table metrics           enable row level security;
alter table collection_runs   enable row level security;
alter table snapshots         enable row level security;
alter table queries           enable row level security;
alter table serp_runs         enable row level security;
alter table serp_results      enable row level security;
alter table reports           enable row level security;
alter table actions           enable row level security;

-- workspaces
create policy ws_select on workspaces for select to authenticated using (can_view_workspace(id));
create policy ws_admin  on workspaces for all    to authenticated using (is_agency_admin()) with check (is_agency_admin());

-- profiles: see yourself; admins see everyone and can edit flags
create policy prof_self   on profiles for select to authenticated using (id = auth.uid());
create policy prof_admin  on profiles for all    to authenticated using (is_agency_admin()) with check (is_agency_admin());

-- workspace_members
create policy wm_select on workspace_members for select to authenticated using (user_id = auth.uid() or is_agency_admin());
create policy wm_admin  on workspace_members for all    to authenticated using (is_agency_admin()) with check (is_agency_admin());

-- invites: admins only
create policy inv_admin on invites for all to authenticated using (is_agency_admin()) with check (is_agency_admin());

-- companies / profiles / queries: view by workspace, write by admins
create policy co_select on companies for select to authenticated using (can_view_workspace(workspace_id));
create policy co_admin  on companies for all    to authenticated using (is_agency_admin()) with check (is_agency_admin());

create policy cp_select on company_profiles for select to authenticated using (can_view_workspace(company_workspace(company_id)));
create policy cp_admin  on company_profiles for all    to authenticated using (is_agency_admin()) with check (is_agency_admin());

create policy q_select on queries for select to authenticated using (can_view_workspace(workspace_id));
create policy q_admin  on queries for all    to authenticated using (is_agency_admin()) with check (is_agency_admin());

-- metrics catalog: everyone signed in can read, admins write
create policy m_select on metrics for select to authenticated using (true);
create policy m_admin  on metrics for all    to authenticated using (is_agency_admin()) with check (is_agency_admin());

-- collection runs: view by workspace; created by functions (service role) only
create policy cr_select on collection_runs for select to authenticated using (can_view_workspace(workspace_id));

-- snapshots: append-only. Manual entries by admins/editors, API entries via service role.
create policy snap_select on snapshots for select to authenticated using (can_view_workspace(company_workspace(company_id)));
create policy snap_insert on snapshots for insert to authenticated
  with check (
    can_enter_data(company_workspace(company_id))
    and source = 'manual'
    and entered_by = auth.uid()
    and exists (select 1 from metrics m where m.key = metric_key and m.source = 'manual' and m.is_active)
  );

-- serp data: read by workspace; written by service role only
create policy sr_select  on serp_runs    for select to authenticated
  using (can_view_workspace((select workspace_id from queries q where q.id = query_id)));
create policy srr_select on serp_results for select to authenticated
  using (exists (select 1 from serp_runs r join queries q on q.id = r.query_id
                 where r.id = serp_run_id and can_view_workspace(q.workspace_id)));

-- reports: frozen. Read by workspace, insert by admins, never update/delete.
create policy rep_select on reports for select to authenticated using (can_view_workspace(workspace_id));
create policy rep_insert on reports for insert to authenticated with check (is_agency_admin() and created_by = auth.uid());

-- actions
create policy act_select on actions for select to authenticated using (can_view_workspace(workspace_id));
create policy act_write  on actions for all    to authenticated
  using (can_enter_data(workspace_id)) with check (can_enter_data(workspace_id));
