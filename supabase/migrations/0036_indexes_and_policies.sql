-- Index hygiene and policy cleanup, from pg_stat_user_indexes / EXPLAIN on the live project.

-- admin_stats() spent 7.7 s in a sequential scan for `episodes_synced_at is not null`; the
-- only index on that column was partial on `is null` (0 scans). Flip it: ~100 rows.
drop index if exists public.shows_episodes_synced_idx;
create index if not exists shows_episodes_synced_not_null_idx
  on public.shows (episodes_synced_at) where episodes_synced_at is not null;

-- Unused or redundant (idx_scan, size): shows_name_trgm_idx GIN (34, 10 MB; the GiST index
-- serves both `%` and `<->`), episodes_airstamp_idx (superset exists in the covering index),
-- user_episodes_user_idx (prefix of the PK), user_shows_user_status_idx (5),
-- profiles_role_idx (0), sync_runs_job_idx (0), shows_status_idx (15, low selectivity).
drop index if exists public.shows_name_trgm_idx;
drop index if exists public.episodes_airstamp_idx;
drop index if exists public.user_episodes_user_idx;
drop index if exists public.user_shows_user_status_idx;
drop index if exists public.profiles_role_idx;
drop index if exists public.sync_runs_job_idx;
drop index if exists public.shows_status_idx;

-- my_show_progress() (191 ms mean) reads id/season/number from the heap for every episode of
-- every followed show. Carry them in the index so the scan is index-only.
drop index if exists public.episodes_show_airstamp_idx;
create index episodes_show_airstamp_idx
  on public.episodes (show_id, airstamp) include (id, season, number);

-- shows/episodes were bulk-loaded and never vacuumed, so the covering indexes from 0029 still
-- fetch heap pages (Heap Fetches: 935/847 in EXPLAIN). Vacuum more eagerly from now on; a
-- one-time `vacuum (analyze) public.shows, public.episodes` is run outside this migration.
alter table public.shows set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.episodes set (autovacuum_vacuum_scale_factor = 0.05);
-- search_shows spent 128 ms walking the GIN pending list; the catalog is written in nightly
-- batches, so index tuples can go straight into the main structure.
alter index public.shows_search_idx set (fastupdate = off);

-- "user_shows admin read" has been `using (false)` since 0020: a dead permissive policy that is
-- still OR-ed into every SELECT (advisor: multiple_permissive_policies).
drop policy if exists "user_shows admin read" on public.user_shows;

-- is_admin() as an initplan, evaluated once per statement rather than per row.
alter policy "profiles select own or admin" on public.profiles
  using (id = (select auth.uid()) or (select public.is_admin()));
alter policy "bootstrap emails admin read" on public.admin_bootstrap_emails using ((select public.is_admin()));
alter policy "sync_queue admin read" on public.sync_queue using ((select public.is_admin()));
alter policy "sync_runs admin read" on public.sync_runs using ((select public.is_admin()));
alter policy "app_settings admin read" on public.app_settings using ((select public.is_admin()));

create or replace function public.mark_notifications_read(p_ids bigint[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.notifications set read_at = now()
   where id = any (p_ids) and user_id = (select auth.uid()) and read_at is null;
$$;
create or replace function public.mark_all_notifications_read()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.notifications set read_at = now()
   where user_id = (select auth.uid()) and read_at is null;
$$;

drop function if exists public.stale_shows_v1(jsonb);
