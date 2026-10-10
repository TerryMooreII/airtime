-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
-- Fan out "new episode" notifications for freshly inserted episodes to users who
-- track the show. Only future (or very recent) episodes count, and only for users
-- who tracked the show before the episode appeared (avoids spamming on backfill).
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
      join public.shows s on s.id = e.show_id
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

-- Run hourly. For every user whose local clock just reached their digest hour,
-- create one "airing today" notification per tracked episode airing that local day.
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
      join public.shows s on s.id = e.show_id
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

-- ---------------------------------------------------------------------------
-- User-facing RPCs (invoked with the caller's JWT)
-- ---------------------------------------------------------------------------
create or replace function public.search_shows(p_query text, p_limit integer default 24, p_offset integer default 0)
returns table (
  id bigint, tvmaze_id integer, name text, type text, status text, premiered date, genres text[],
  image_medium text, language text, network_name text, rating numeric, rank real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select trim(p_query) as raw,
           websearch_to_tsquery('simple', trim(p_query)) as tsq
  )
  select s.id, s.tvmaze_id, s.name, s.type, s.status, s.premiered, s.genres, s.image_medium, s.language,
         coalesce(n.name, w.name) as network_name,
         r.value as rating,
         (ts_rank(s.search, q.tsq) + similarity(s.name, q.raw))::real as rank
    from q, public.shows s
    left join public.channels n on n.id = s.network_id
    left join public.channels w on w.id = s.web_channel_id
    left join public.show_ratings r on r.show_id = s.id and r.provider = 'tvmaze'
   where length(q.raw) > 0
     and (s.search @@ q.tsq or s.name % q.raw)
   order by rank desc, s.weight desc, s.id
   limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
$$;
grant execute on function public.search_shows(text, integer, integer) to authenticated;

create or replace function public.mark_notifications_read(p_ids bigint[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.notifications set read_at = now()
   where id = any (p_ids) and user_id = auth.uid() and read_at is null;
$$;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Upcoming episodes for the caller's tracked shows.
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
     and e.airstamp >= now() - interval '1 day'
     and e.airstamp < now() + make_interval(days => greatest(1, least(p_days, 90)))
   order by e.airstamp
   limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.my_upcoming_episodes(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_enqueue_sync(p_job_type public.sync_job_type, p_payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return public.enqueue_sync_job(p_job_type, p_payload, 5, now(), 'admin');
end;
$$;
grant execute on function public.admin_enqueue_sync(public.sync_job_type, jsonb) to authenticated;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot change your own role' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'shows', (select count(*) from public.shows),
    'shows_with_episodes', (select count(*) from public.shows where episodes_synced_at is not null),
    'episodes', (select count(*) from public.episodes),
    'users', (select count(*) from public.profiles),
    'tracked_shows', (select count(*) from public.user_shows),
    'notifications_24h', (select count(*) from public.notifications where created_at > now() - interval '1 day'),
    'queue', (select jsonb_object_agg(status, c) from (select status, count(*) c from public.sync_queue group by status) q),
    'catalog_import', (select value from public.app_settings where key = 'catalog_import'),
    'last_full_schedule', (select to_jsonb(r) from (select status, finished_at, stats, error from public.sync_runs where job_type = 'full_schedule' order by finished_at desc limit 1) r)
  );
end;
$$;
grant execute on function public.admin_stats() to authenticated;

revoke all on function public.create_new_episode_notifications(bigint[]) from public, anon, authenticated;
revoke all on function public.create_airing_today_notifications() from public, anon, authenticated;
