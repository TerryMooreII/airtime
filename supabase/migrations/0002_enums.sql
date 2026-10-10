create type public.app_role as enum ('user', 'admin');
create type public.user_show_status as enum ('watching', 'completed', 'dropped', 'plan_to_watch');
create type public.channel_kind as enum ('network', 'web_channel');
create type public.sync_job_type as enum (
  'catalog_page',   -- import one page of /shows?page=N
  'full_schedule',  -- import /schedule/full (all upcoming episodes)
  'show_updates',   -- read /updates/shows?since=day and enqueue show_refresh jobs
  'show_refresh',   -- re-fetch one show (+ episodes if already synced)
  'show_episodes'   -- fetch the complete episode list for one show
);
create type public.sync_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.notification_type as enum ('new_episode', 'airing_today', 'show_status_changed');
