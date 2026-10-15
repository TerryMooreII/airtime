-- One notification per airing, not per TVmaze episode record.
--
-- TVmaze sometimes lists the same episode more than once under different ids (South Park's
-- S29 special "Moving to Stupid Celebrity Town" arrived as 3789234/5/6). Each is its own row
-- in public.episodes, and notifications_dedupe_idx is per episode_id, so followers got one
-- push per copy. Both fan-out functions now collapse episodes that share show, season,
-- number, name and airstamp, keeping the lowest id. distinct on treats NULLs as equal, so
-- unnumbered specials collapse too. Otherwise identical to 0035.
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
    select distinct on (us.user_id, e.show_id, e.season, e.number, e.name, e.airstamp)
           us.user_id,
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
     order by us.user_id, e.show_id, e.season, e.number, e.name, e.airstamp, e.id
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
    select distinct on (u.id, e.show_id, e.season, e.number, e.name, e.airstamp)
           u.id,
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
     order by u.id, e.show_id, e.season, e.number, e.name, e.airstamp, e.id
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;
