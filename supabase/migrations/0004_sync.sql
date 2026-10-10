-- ---------------------------------------------------------------------------
-- Sync infrastructure: a durable job queue processed by the `sync-worker`
-- Edge Function, a run log, and a small key/value settings table.
-- ---------------------------------------------------------------------------
create table public.sync_queue (
  id           bigint generated always as identity primary key,
  job_type     public.sync_job_type not null,
  payload      jsonb not null default '{}'::jsonb,
  priority     integer not null default 100,           -- lower runs first
  run_after    timestamptz not null default now(),
  attempts     integer not null default 0,
  max_attempts integer not null default 5,
  status       public.sync_status not null default 'queued',
  locked_at    timestamptz,
  locked_by    text,
  last_error   text,
  triggered_by text not null default 'system',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- One pending job per (type, payload).
create unique index sync_queue_pending_unique_idx
  on public.sync_queue (job_type, payload)
  where status in ('queued', 'running');
create index sync_queue_claim_idx on public.sync_queue (status, run_after, priority, id);
create trigger sync_queue_set_updated_at before update on public.sync_queue
  for each row execute function public.set_updated_at();

create table public.sync_runs (
  id           bigint generated always as identity primary key,
  job_id       bigint references public.sync_queue(id) on delete set null,
  job_type     public.sync_job_type not null,
  status       public.sync_status not null,
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now(),
  stats        jsonb not null default '{}'::jsonb,
  error        text,
  worker       text
);
create index sync_runs_finished_idx on public.sync_runs (finished_at desc);
create index sync_runs_job_type_idx on public.sync_runs (job_type, finished_at desc);

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Queue functions (internal: executed by the service role / cron / triggers)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_sync_job(
  p_job_type     public.sync_job_type,
  p_payload      jsonb default '{}'::jsonb,
  p_priority     integer default 100,
  p_run_after    timestamptz default now(),
  p_triggered_by text default 'system'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.sync_queue (job_type, payload, priority, run_after, triggered_by)
  values (p_job_type, coalesce(p_payload, '{}'::jsonb), p_priority, p_run_after, p_triggered_by)
  on conflict (job_type, payload) where status in ('queued', 'running') do nothing
  returning id into v_id;
  return v_id; -- null when an identical job is already pending
end;
$$;

create or replace function public.claim_sync_jobs(p_worker text, p_limit integer default 10)
returns setof public.sync_queue
language sql
security definer
set search_path = public
as $$
  update public.sync_queue q
     set status = 'running',
         locked_at = now(),
         locked_by = p_worker,
         attempts = q.attempts + 1
   where q.id in (
     select id from public.sync_queue
      where status = 'queued' and run_after <= now()
      order by priority, id
      for update skip locked
      limit p_limit
   )
  returning q.*;
$$;

create or replace function public.complete_sync_job(
  p_job_id bigint,
  p_ok     boolean,
  p_stats  jsonb default '{}'::jsonb,
  p_error  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.sync_queue%rowtype;
  v_next public.sync_status;
begin
  select * into v_job from public.sync_queue where id = p_job_id for update;
  if not found then
    return;
  end if;

  if p_ok then
    v_next := 'succeeded';
  elsif v_job.attempts >= v_job.max_attempts then
    v_next := 'failed';
  else
    v_next := 'queued';
  end if;

  update public.sync_queue
     set status = v_next,
         locked_at = null,
         locked_by = null,
         last_error = p_error,
         -- exponential-ish backoff: 2, 8, 18, 32 minutes
         run_after = case when v_next = 'queued'
                          then now() + make_interval(mins => 2 * v_job.attempts * v_job.attempts)
                          else run_after end
   where id = p_job_id;

  insert into public.sync_runs (job_id, job_type, status, started_at, finished_at, stats, error, worker)
  values (p_job_id, v_job.job_type,
          case when p_ok then 'succeeded'::public.sync_status else 'failed'::public.sync_status end,
          coalesce(v_job.locked_at, now()), now(), coalesce(p_stats, '{}'::jsonb), p_error, v_job.locked_by);
end;
$$;

-- Jobs whose worker died keep status=running forever; release them.
create or replace function public.release_stale_sync_jobs(p_older_than interval default interval '15 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with released as (
    update public.sync_queue
       set status = case when attempts >= max_attempts then 'failed'::public.sync_status
                         else 'queued'::public.sync_status end,
           locked_at = null,
           locked_by = null,
           last_error = coalesce(last_error, '') || ' [released stale lock]'
     where status = 'running' and locked_at < now() - p_older_than
     returning 1
  )
  select count(*) into v_count from released;
  return v_count;
end;
$$;

revoke all on function public.enqueue_sync_job(public.sync_job_type, jsonb, integer, timestamptz, text) from public, anon, authenticated;
revoke all on function public.claim_sync_jobs(text, integer) from public, anon, authenticated;
revoke all on function public.complete_sync_job(bigint, boolean, jsonb, text) from public, anon, authenticated;
revoke all on function public.release_stale_sync_jobs(interval) from public, anon, authenticated;
