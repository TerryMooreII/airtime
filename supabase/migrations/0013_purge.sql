-- Weekly housekeeping. Kept separate because it contains DELETE statements,
-- which the Supabase MCP asks to confirm before applying.
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

select cron.schedule('airtime-purge', '30 4 * * 0', $$select public.purge_old_records()$$);
