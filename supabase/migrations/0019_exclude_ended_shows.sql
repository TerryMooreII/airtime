-- Shows whose status is 'Ended' never appear in the upcoming list or trigger
-- episode notifications, even if TVMaze still lists a future-dated episode.
-- (Re-creates my_upcoming_episodes, create_new_episode_notifications and
-- create_airing_today_notifications from 0008 with `s.status is distinct from 'Ended'`.)
create or replace function public.my_upcoming_episodes(p_days integer default 14, p_limit integer default 200)
returns table (
  episode_id bigint, show_id bigint, show_name text, show_image text, season integer, number integer,
  episode_name text, airstamp timestamptz, runtime integer, status public.user_show_status
)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, s.id, s.name, s.image_medium, e.season, e.number, e.name, e.airstamp, e.runtime, us.status
    from public.user_shows us
    join public.shows s on s.id = us.show_id
    join public.episodes e on e.show_id = s.id
   where us.user_id = auth.uid()
     and s.status is distinct from 'Ended'
     and e.airstamp >= now() - interval '1 day'
     and e.airstamp < now() + make_interval(days => greatest(1, least(p_days, 90)))
   order by e.airstamp
   limit greatest(1, least(p_limit, 500));
$$;

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
    insert into public.notifications (user_id, type, title, body, show_id, episode_id, data)
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
                              'episode_name', e.name, 'show_name', s.name, 'image', coalesce(e.image_medium, s.image_medium))
      from public.episodes e
      join public.shows s on s.id = e.show_id and s.status is distinct from 'Ended'
      join public.user_shows us on us.show_id = e.show_id and us.notify
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
  with ins as (
    insert into public.notifications (user_id, type, title, body, show_id, episode_id, data)
    select p.id,
           'airing_today',
           s.name,
           format('Airs today at %s · S%sE%s%s',
                  to_char(e.airstamp at time zone p.timezone, 'HH24:MI'),
                  e.season,
                  coalesce(e.number::text, '?'),
                  case when e.name is not null then ' · ' || e.name else '' end),
           e.show_id,
           e.id,
           jsonb_build_object('season', e.season, 'number', e.number, 'airstamp', e.airstamp,
                              'episode_name', e.name, 'show_name', s.name, 'image', coalesce(e.image_medium, s.image_medium))
      from public.profiles p
      join public.user_shows us on us.user_id = p.id and us.notify
      join public.episodes e on e.show_id = us.show_id
      join public.shows s on s.id = e.show_id and s.status is distinct from 'Ended'
     where p.notify_in_app
       and extract(hour from (now() at time zone p.timezone)) = p.airing_digest_hour
       and (e.airstamp at time zone p.timezone)::date = (now() at time zone p.timezone)::date
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;
