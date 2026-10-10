-- Extensions required by Airtime.
-- pg_cron: nightly / per-minute scheduling.  pg_net: async HTTP from Postgres (invoke Edge Functions).
-- pg_trgm: fuzzy show-name search.  supabase_vault: secrets read by cron jobs.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists supabase_vault;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
