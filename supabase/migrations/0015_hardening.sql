-- Security advisor follow-ups.
-- 1. Pin search_path on the two helper functions that lacked it.
alter function public.set_updated_at() set search_path = public;
alter function public.text_array_to_text(text[]) set search_path = public;

-- 2. Anonymous visitors cannot call any RPC. Signed-in users keep only the
--    functions explicitly granted in 0008 (search, notifications, admin_* guards).
revoke execute on all functions in schema public from public, anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- 3. Trigger functions are never meant to be called over the API. Postgres does not
--    check EXECUTE when a trigger fires, so revoking is safe.
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.protect_profile() from authenticated;
revoke execute on function public.enqueue_episodes_for_tracked_show() from authenticated;
revoke execute on function public.set_updated_at() from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;

-- Keep what signed-in users legitimately need.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.search_shows(text, integer, integer) to authenticated;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.my_upcoming_episodes(integer, integer) to authenticated;
grant execute on function public.admin_enqueue_sync(public.sync_job_type, jsonb) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on all functions in schema public to service_role;
