-- Push dispatch correctness, push registration across accounts, and a refresh lock.

-- 1. Claim pending notifications atomically. Two dispatchers could overlap before
--    (send_test_notification wakes one while the cron tick starts another) and both sent
--    the same rows. The claim also skips users who have push off, whose rows used to sit at
--    the front of the id-ordered batch forever.
create index if not exists notifications_push_pending_user_idx
  on public.notifications (user_id) where push_sent_at is null;

create or replace function public.claim_push_batch(p_limit integer default 200)
returns setof public.notifications
language sql
security definer
set search_path = public
as $$
  update public.notifications n
     set push_sent_at = now()
   where n.id in (
     select n2.id
       from public.notifications n2
       join public.profiles p on p.id = n2.user_id and p.notify_push
      where n2.push_sent_at is null
      order by n2.id
      for update of n2 skip locked
      limit greatest(1, least(p_limit, 500)))
  returning n.*;
$$;
revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;

-- Backlog rows for users who have push off: nothing will ever send them.
update public.notifications n set push_sent_at = now()
  from public.profiles p
 where p.id = n.user_id and not p.notify_push and n.push_sent_at is null;

-- 2. A browser endpoint is unique, so when a second account enables push on the same device
--    the client's upsert became an UPDATE of a row RLS hides. Reassign it server-side.
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
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
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, failed_at)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200), null)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, failed_at = null
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- 3. Only one import of a show's episodes at a time. Following a show from its own page used
--    to start two refresh-show calls (store + page) that both passed the freshness check.
alter table public.shows add column if not exists episodes_refreshing_at timestamptz;

create or replace function public.begin_show_refresh(p_tvmaze_id integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.shows where tvmaze_id = p_tvmaze_id) then
    return true; -- nothing to lock yet; the import inserts the row
  end if;
  update public.shows
     set episodes_refreshing_at = now()
   where tvmaze_id = p_tvmaze_id
     and (episodes_refreshing_at is null or episodes_refreshing_at < now() - interval '2 minutes');
  return found;
end;
$$;
revoke execute on function public.begin_show_refresh(integer) from public, anon, authenticated;
grant execute on function public.begin_show_refresh(integer) to service_role;

create or replace function public.mark_show_episodes_synced(p_tvmaze_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_show_id bigint;
begin
  update public.shows
     set episodes_synced_at = now(), episodes_refreshing_at = null
   where tvmaze_id = p_tvmaze_id
   returning id into v_show_id;
  if v_show_id is null then
    return;
  end if;
  insert into public.user_episodes (user_id, episode_id)
  select us.user_id, e.id
    from public.user_shows us
    join public.episodes e on e.show_id = us.show_id and e.airstamp <= now()
   where us.show_id = v_show_id and us.status = 'completed'
  on conflict do nothing;
end;
$$;

-- 4. Test notifications: own type, and at most one per minute per user.
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
  if exists (select 1 from public.notifications
              where user_id = v_user and type = 'test' and created_at > now() - interval '1 minute') then
    raise exception 'A test was sent less than a minute ago.' using errcode = '53400';
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  values (v_user, 'test', 'Test notification', 'Push is working on this device.',
          jsonb_build_object('test', true))
  returning id into v_id;
  perform public.tick_push_dispatch();
  return v_id;
end;
$$;
