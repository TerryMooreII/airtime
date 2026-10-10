-- ---------------------------------------------------------------------------
-- Explicit privileges. This project's default ACLs give anon/authenticated/
-- service_role no DML on new tables and no EXECUTE on new functions, so grant
-- exactly what each role needs. Row Level Security (0009) narrows rows further.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role, supabase_auth_admin;

-- Service role: full access (used by Edge Functions; bypasses RLS).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Signed-in users: catalog is read-only, own data is writable (RLS enforces ownership).
grant select on public.channels, public.shows, public.show_external_ids, public.show_ratings,
                public.episodes, public.episode_ratings to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.admin_bootstrap_emails, public.sync_queue, public.sync_runs, public.app_settings to authenticated;
grant select, insert, update, delete on public.user_shows, public.push_subscriptions to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- The auth.users trigger runs as supabase_auth_admin and must be able to call its function.
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- Objects created by future migrations get the same treatment automatically.
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
alter default privileges for role postgres in schema public grant execute on functions to service_role;
