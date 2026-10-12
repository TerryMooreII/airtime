-- Reconcile the migrations folder with the live project.
--
-- 0026_performance.sql recorded changes that were applied through the Supabase MCP but
-- did not include the SQL, so a database rebuilt from this folder ended up with the older
-- bodies (per-row auth.uid() in RLS, a pg_timezone_names scan on every profile update,
-- correlated sub-selects in my_show_progress, count(*) over 90k shows in admin_stats).
-- Everything below is the live definition as of 2026-10-12; applying it live is a no-op.
-- (search_shows already matches 0028; compute_discover_rails is rewritten in 0037.)

-- 1. RLS policies evaluate auth.uid() once per statement (initplan) instead of per row.
alter policy "profiles select own or admin" on public.profiles
  using (id = (select auth.uid()) or public.is_admin());
alter policy "profiles update own" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "user_shows owner" on public.user_shows
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "notifications owner select" on public.notifications
  using (user_id = (select auth.uid()));
alter policy "notifications owner update" on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "notifications owner delete" on public.notifications
  using (user_id = (select auth.uid()));
alter policy "push_subscriptions owner" on public.push_subscriptions
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "user_episodes owner" on public.user_episodes
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 2. protect_profile(): validate the time zone by using it, not by scanning pg_timezone_names.
create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.timezone is distinct from old.timezone then
    begin
      perform now() at time zone new.timezone;
    exception when others then
      raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
    end;
  end if;

  if new.role is distinct from old.role then
    if auth.uid() is not null and (not public.is_admin() or old.id = auth.uid()) then
      raise exception 'not allowed to change role' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- 3. my_show_progress(): one grouped pass instead of three correlated sub-selects per show.
create or replace function public.my_show_progress()
returns table (show_id bigint, aired integer, watched integer, next_unwatched_episode_id bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select us.show_id,
         count(e.id) filter (where e.airstamp <= now())::integer as aired,
         count(ue.episode_id)::integer as watched,
         (array_agg(e.id order by e.season, e.number nulls last, e.airstamp)
            filter (where e.airstamp <= now() and ue.episode_id is null))[1] as next_unwatched_episode_id
    from public.user_shows us
    left join public.episodes e on e.show_id = us.show_id
    left join public.user_episodes ue on ue.episode_id = e.id and ue.user_id = us.user_id
   where us.user_id = (select auth.uid())
   group by us.show_id;
$$;

-- 4. admin_stats(): planner estimates for the two big tables instead of count(*).
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'shows', (select greatest(reltuples, 0)::bigint from pg_class where oid = 'public.shows'::regclass),
    'shows_with_episodes', (select count(*) from public.shows where episodes_synced_at is not null),
    'episodes', (select greatest(reltuples, 0)::bigint from pg_class where oid = 'public.episodes'::regclass),
    'users', (select count(*) from public.profiles),
    'tracked_shows', (select count(*) from public.user_shows),
    'notifications_24h', (select count(*) from public.notifications where created_at > now() - interval '1 day'),
    'queue', (select jsonb_object_agg(status, c) from (select status, count(*) c from public.sync_queue group by status) q),
    'catalog_import', (select value from public.app_settings where key = 'catalog_import'),
    'last_full_schedule', (select to_jsonb(r) from (select status, finished_at, stats, error from public.sync_runs where job_type = 'full_schedule' order by finished_at desc limit 1) r)
  );
end;
$$;
