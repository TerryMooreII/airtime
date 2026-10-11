-- "Send test" in Settings: creates one notification for the caller and wakes the push
-- dispatcher right away instead of waiting for the next cron minute.
create or replace function public.send_test_notification()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id bigint;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  values (v_user, 'airing_today', 'Test notification', 'Push is working on this device.',
          jsonb_build_object('test', true))
  returning id into v_id;
  perform public.tick_push_dispatch();
  return v_id;
end;
$$;
revoke all on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;
