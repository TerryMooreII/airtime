-- Two fixes to the notification fan-out functions.
--
-- 1. 0033 was copied from 0008 rather than 0019, which dropped the "not Ended" filter:
--    users were alerted about ended shows again while the Guide hid them. Restored here.
-- 2. The hourly airing-today job compared `(airstamp at time zone tz)::date`, an expression
--    the planner cannot index, so it read every episode of every tracked show each hour.
--    The local day is now computed once per user and the join is an airstamp range, which
--    uses episodes_show_airstamp_idx (show_id, airstamp).
-- Rows for users who have push turned off are stamped push_sent_at on insert so they never
-- sit in the dispatcher's pending set (see 0039).
create or replace function public.create_new_episode_notifications(p_episode_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with ins as (
    insert into public.notifications (user_id, type, title, body, show_id, episode_id, data, push_sent_at)
    select us.user_id,
           'new_episode',
           s.name,
           format('New episode: S%sE%s%s%s',
                  e.season,
                  coalesce(e.number::text, '?'),
                  case when e.name is not null then ' · ' || e.name else '' end,
                  case when e.airstamp is not null then ' · airs ' || to_char(e.airstamp, 'Mon DD') else '' end),
           e.show_id,
           e.id,
           jsonb_build_object('season', e.season, 'number', e.number, 'airstamp', e.airstamp,
                              'episode_name', e.name, 'show_name', s.name, 'image', coalesce(e.image_medium, s.image_medium)),
           case when p.notify_push then null else now() end
      from public.episodes e
      join public.shows s on s.id = e.show_id and s.status is distinct from 'Ended'
      join public.user_shows us on us.show_id = e.show_id and us.notify and us.status <> 'dropped'
      join public.profiles p on p.id = us.user_id and p.notify_in_app
     where e.id = any (p_episode_ids)
       and e.airstamp >= now() - interval '1 day'
       and us.added_at <= now() - interval '10 minutes'
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

create or replace function public.create_airing_today_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with u as (
    -- Users whose local clock just reached their digest hour, with the local day as a range.
    select p.id, p.timezone, p.notify_push,
           ((now() at time zone p.timezone)::date::timestamp) at time zone p.timezone as day_start
      from public.profiles p
     where p.notify_in_app
       and extract(hour from (now() at time zone p.timezone)) = p.airing_digest_hour
  ), ins as (
    insert into public.notifications (user_id, type, title, body, show_id, episode_id, data, push_sent_at)
    select u.id,
           'airing_today',
           s.name,
           format('Airs today at %s · S%sE%s%s',
                  to_char(e.airstamp at time zone u.timezone, 'HH24:MI'),
                  e.season,
                  coalesce(e.number::text, '?'),
                  case when e.name is not null then ' · ' || e.name else '' end),
           e.show_id,
           e.id,
           jsonb_build_object('season', e.season, 'number', e.number, 'airstamp', e.airstamp,
                              'episode_name', e.name, 'show_name', s.name, 'image', coalesce(e.image_medium, s.image_medium)),
           case when u.notify_push then null else now() end
      from u
      join public.user_shows us on us.user_id = u.id and us.notify and us.status <> 'dropped'
      join public.episodes e on e.show_id = us.show_id
                            and e.airstamp >= u.day_start
                            and e.airstamp < u.day_start + interval '1 day'
      join public.shows s on s.id = e.show_id and s.status is distinct from 'Ended'
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;
