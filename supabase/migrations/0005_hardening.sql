-- 0005_hardening: lock down function execution per the Supabase security advisor
alter function public.touch_updated_at() set search_path = public;

-- Trigger functions on auth.users: only the auth service needs to run them.
revoke execute on function public.enforce_invite() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.enforce_invite() to supabase_auth_admin;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- RLS helpers: signed-in users need EXECUTE because policies evaluate as the caller.
-- They only ever describe the caller's own permissions. Anonymous callers get nothing.
revoke execute on function public.is_agency_admin() from public, anon;
revoke execute on function public.member_role_in(uuid) from public, anon;
revoke execute on function public.can_view_workspace(uuid) from public, anon;
revoke execute on function public.can_enter_data(uuid) from public, anon;
revoke execute on function public.company_workspace(uuid) from public, anon;
