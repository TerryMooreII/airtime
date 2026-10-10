-- ---------------------------------------------------------------------------
-- Scheduling. Edge Functions are invoked through pg_net using secrets in Vault:
--   project_url       -> https://<ref>.supabase.co
--   service_role_key  -> used as the bearer token; the function compares it to
--                        its own SUPABASE_SERVICE_ROLE_KEY env var.
-- Create them once (SQL editor):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service role key>', 'service_role_key');
-- ---------------------------------------------------------------------------
create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise warning 'invoke_edge_function(%): vault secrets project_url / service_role_key are missing', p_name;
    return null;
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key),
    body := p_body,
    timeout_milliseconds := 10000);
end;
$$;
revoke all on function public.invoke_edge_function(text, jsonb) from public, anon, authenticated;

-- Every minute: release stale locks, then wake the worker if there is work and
-- no worker has claimed a job in the last two minutes.
create or replace function public.tick_sync_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_stale_sync_jobs();
  if exists (select 1 from public.sync_queue where status = 'queued' and run_after <= now())
     and not exists (select 1 from public.sync_queue where status = 'running' and locked_at > now() - interval '2 minutes')
  then
    perform public.invoke_edge_function('sync-worker', jsonb_build_object('source', 'cron'));
  end if;
end;
$$;
revoke all on function public.tick_sync_worker() from public, anon, authenticated;

create or replace function public.tick_push_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.notifications n
    join public.profiles p on p.id = n.user_id
    where n.push_sent_at is null and p.notify_push
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = n.user_id and ps.failed_at is null)
  ) then
    perform public.invoke_edge_function('push-dispatch', jsonb_build_object('source', 'cron'));
  end if;
end;
$$;
revoke all on function public.tick_push_dispatch() from public, anon, authenticated;

create or replace function public.enqueue_nightly_sync()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_sync_job('full_schedule', '{}'::jsonb, 20, now(), 'cron');
  perform public.enqueue_sync_job('show_updates', '{}'::jsonb, 30, now(), 'cron');
end;
$$;
revoke all on function public.enqueue_nightly_sync() from public, anon, authenticated;

create or replace function public.purge_old_records()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sync_runs where finished_at < now() - interval '30 days';
  delete from public.sync_queue where status in ('succeeded', 'cancelled') and updated_at < now() - interval '7 days';
  delete from public.sync_queue where status = 'failed' and updated_at < now() - interval '30 days';
  delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
  delete from public.push_subscriptions where failed_at is not null and failed_at < now() - interval '30 days';
end;
$$;
revoke all on function public.purge_old_records() from public, anon, authenticated;

select cron.schedule('airtime-sync-worker-tick',   '* * * * *',  $$select public.tick_sync_worker()$$);
select cron.schedule('airtime-push-dispatch-tick', '* * * * *',  $$select public.tick_push_dispatch()$$);
select cron.schedule('airtime-nightly-sync',       '0 6 * * *',  $$select public.enqueue_nightly_sync()$$);
select cron.schedule('airtime-airing-today',       '0 * * * *',  $$select public.create_airing_today_notifications()$$);
select cron.schedule('airtime-purge',              '30 4 * * 0', $$select public.purge_old_records()$$);
