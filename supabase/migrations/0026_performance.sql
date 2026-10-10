-- Performance pass (advisor findings + pg_stat_statements hot spots). Applied via the
-- Supabase MCP on 2026-10-10; see git history for the full function bodies, which are
-- also the current definitions of: protect_profile(), my_show_progress(),
-- search_shows(), discover_rails(), admin_stats().
--
-- 1. Covering indexes for foreign keys + the rated-shows candidate pool.
create index if not exists notifications_episode_idx on public.notifications (episode_id);
create index if not exists notifications_show_idx on public.notifications (show_id);
create index if not exists shows_network_idx on public.shows (network_id);
create index if not exists shows_web_channel_idx on public.shows (web_channel_id);
create index if not exists sync_runs_job_idx on public.sync_runs (job_id);
create index if not exists show_ratings_provider_value_idx on public.show_ratings (provider, value desc);

-- 2. RLS policies evaluate (select auth.uid()) once per query instead of per row:
--    profiles (select/update), user_shows owner, notifications (select/update/delete),
--    push_subscriptions owner, user_episodes owner.
--
-- 3. protect_profile(): time zone validated with `now() at time zone tz` instead of
--    scanning pg_timezone_names (160 ms per call).
-- 4. my_show_progress(): single grouped pass instead of three correlated subqueries per show.
-- 5. search_shows(): prefix full-text (word:*) UNION trigram nearest-neighbour, both indexed.
-- 6. discover_rails(): rails driven from episodes-in-range / rated shows / indexed channel ids.
-- 7. admin_stats(): pg_class.reltuples estimates for shows and episodes.
