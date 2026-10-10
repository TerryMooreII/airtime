-- ---------------------------------------------------------------------------
-- Catalog upserts (called by the sync-worker Edge Function with normalized rows)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_channels(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with src as (
    select distinct on (r.kind, r.tvmaze_id) r.*
      from jsonb_to_recordset(p_rows) as r(
        kind public.channel_kind, tvmaze_id integer, name text,
        country_code text, country_name text, timezone text, official_site text)
     where r.tvmaze_id is not null and r.name is not null
  ), up as (
    insert into public.channels (kind, tvmaze_id, name, country_code, country_name, timezone, official_site)
    select kind, tvmaze_id, name, country_code, country_name, timezone, official_site from src
    on conflict (kind, tvmaze_id) do update
      set name = excluded.name,
          country_code = excluded.country_code,
          country_name = excluded.country_name,
          timezone = excluded.timezone,
          official_site = excluded.official_site
      where (channels.name, channels.country_code, channels.country_name, channels.timezone, channels.official_site)
            is distinct from
            (excluded.name, excluded.country_code, excluded.country_name, excluded.timezone, excluded.official_site)
    returning 1
  )
  select count(*) into v_count from up;
  return v_count;
end;
$$;

-- Returns {"inserted": n, "updated": n}. Also maintains show_external_ids and the
-- 'tvmaze' row of show_ratings. Channels must be upserted first.
create or replace function public.upsert_shows(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  create temp table tmp_shows on commit drop as
    select distinct on (r.tvmaze_id) r.*
      from jsonb_to_recordset(p_rows) as r(
        tvmaze_id integer, name text, type text, language text, genres text[], status text,
        runtime integer, average_runtime integer, premiered date, ended date, official_site text,
        schedule_time text, schedule_days text[], weight integer,
        network_tvmaze_id integer, web_channel_tvmaze_id integer, dvd_country_code text,
        image_medium text, image_original text, summary_html text, tvmaze_url text,
        tvmaze_updated_at timestamptz, externals jsonb, rating_average numeric)
     where r.tvmaze_id is not null and r.name is not null
     order by r.tvmaze_id, r.tvmaze_updated_at desc nulls last;

  with up as (
    insert into public.shows (
      tvmaze_id, name, type, language, genres, status, runtime, average_runtime, premiered, ended,
      official_site, schedule_time, schedule_days, weight, network_id, web_channel_id, dvd_country_code,
      image_medium, image_original, summary_html, tvmaze_url, tvmaze_updated_at, synced_at)
    select s.tvmaze_id, s.name, s.type, s.language, coalesce(s.genres, '{}'), s.status, s.runtime,
           s.average_runtime, s.premiered, s.ended, s.official_site, nullif(s.schedule_time, ''),
           coalesce(s.schedule_days, '{}'), coalesce(s.weight, 0), n.id, w.id, s.dvd_country_code,
           s.image_medium, s.image_original, s.summary_html, s.tvmaze_url, s.tvmaze_updated_at, now()
      from tmp_shows s
      left join public.channels n on n.kind = 'network' and n.tvmaze_id = s.network_tvmaze_id
      left join public.channels w on w.kind = 'web_channel' and w.tvmaze_id = s.web_channel_tvmaze_id
    on conflict (tvmaze_id) do update
      set name = excluded.name,
          type = excluded.type,
          language = excluded.language,
          genres = excluded.genres,
          status = excluded.status,
          runtime = excluded.runtime,
          average_runtime = excluded.average_runtime,
          premiered = excluded.premiered,
          ended = excluded.ended,
          official_site = excluded.official_site,
          schedule_time = excluded.schedule_time,
          schedule_days = excluded.schedule_days,
          weight = excluded.weight,
          network_id = excluded.network_id,
          web_channel_id = excluded.web_channel_id,
          dvd_country_code = excluded.dvd_country_code,
          image_medium = excluded.image_medium,
          image_original = excluded.image_original,
          summary_html = excluded.summary_html,
          tvmaze_url = excluded.tvmaze_url,
          tvmaze_updated_at = excluded.tvmaze_updated_at,
          synced_at = now()
      where shows.tvmaze_updated_at is distinct from excluded.tvmaze_updated_at
         or shows.status is distinct from excluded.status
         or shows.name is distinct from excluded.name
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into v_inserted, v_updated
    from up;

  insert into public.show_external_ids (show_id, provider, external_id)
  select sh.id, e.key, e.value
    from tmp_shows s
    join public.shows sh on sh.tvmaze_id = s.tvmaze_id
    cross join lateral jsonb_each_text(coalesce(s.externals, '{}'::jsonb)) as e(key, value)
   where e.value is not null and e.value <> ''
  on conflict (show_id, provider) do update set external_id = excluded.external_id
    where show_external_ids.external_id is distinct from excluded.external_id;

  insert into public.show_ratings (show_id, provider, value, scale, fetched_at)
  select sh.id, 'tvmaze', s.rating_average, 10, now()
    from tmp_shows s
    join public.shows sh on sh.tvmaze_id = s.tvmaze_id
   where s.rating_average is not null
  on conflict (show_id, provider) do update set value = excluded.value, fetched_at = now()
    where show_ratings.value is distinct from excluded.value;

  drop table if exists tmp_shows;
  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;

-- Returns {"inserted_ids": [...], "updated": n, "skipped": n}.
-- Rows whose show is unknown locally are skipped.
create or replace function public.upsert_episodes(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_ids bigint[];
  v_updated integer := 0;
  v_total integer := 0;
begin
  create temp table tmp_episodes on commit drop as
    select distinct on (r.tvmaze_id) r.*, sh.id as show_id
      from jsonb_to_recordset(p_rows) as r(
        tvmaze_id integer, show_tvmaze_id integer, season integer, number integer, type text, name text,
        airdate date, airtime text, airstamp timestamptz, runtime integer,
        image_medium text, image_original text, summary_html text, tvmaze_url text, rating_average numeric)
      join public.shows sh on sh.tvmaze_id = r.show_tvmaze_id
     where r.tvmaze_id is not null and r.season is not null;

  select count(*) into v_total from jsonb_array_elements(p_rows);

  with up as (
    insert into public.episodes (
      tvmaze_id, show_id, season, number, type, name, airdate, airtime, airstamp, runtime,
      image_medium, image_original, summary_html, tvmaze_url, synced_at)
    select tvmaze_id, show_id, season, number, coalesce(type, 'regular'), name, airdate,
           nullif(airtime, ''), airstamp, runtime, image_medium, image_original, summary_html, tvmaze_url, now()
      from tmp_episodes
    on conflict (tvmaze_id) do update
      set show_id = excluded.show_id,
          season = excluded.season,
          number = excluded.number,
          type = excluded.type,
          name = excluded.name,
          airdate = excluded.airdate,
          airtime = excluded.airtime,
          airstamp = excluded.airstamp,
          runtime = excluded.runtime,
          image_medium = excluded.image_medium,
          image_original = excluded.image_original,
          summary_html = excluded.summary_html,
          tvmaze_url = excluded.tvmaze_url,
          synced_at = now()
      where (episodes.show_id, episodes.season, episodes.number, episodes.type, episodes.name, episodes.airdate,
             episodes.airtime, episodes.airstamp, episodes.runtime, episodes.image_medium, episodes.summary_html)
            is distinct from
            (excluded.show_id, excluded.season, excluded.number, excluded.type, excluded.name, excluded.airdate,
             excluded.airtime, excluded.airstamp, excluded.runtime, excluded.image_medium, excluded.summary_html)
    returning id, (xmax = 0) as inserted
  )
  select coalesce(array_agg(id) filter (where inserted), '{}'), count(*) filter (where not inserted)
    into v_inserted_ids, v_updated
    from up;

  insert into public.episode_ratings (episode_id, provider, value, scale, fetched_at)
  select e.id, 'tvmaze', t.rating_average, 10, now()
    from tmp_episodes t
    join public.episodes e on e.tvmaze_id = t.tvmaze_id
   where t.rating_average is not null
  on conflict (episode_id, provider) do update set value = excluded.value, fetched_at = now()
    where episode_ratings.value is distinct from excluded.value;

  drop table if exists tmp_episodes;
  return jsonb_build_object(
    'inserted_ids', to_jsonb(v_inserted_ids),
    'inserted', coalesce(array_length(v_inserted_ids, 1), 0),
    'updated', v_updated,
    'skipped', v_total - coalesce(array_length(v_inserted_ids, 1), 0) - v_updated);
end;
$$;

create or replace function public.mark_show_episodes_synced(p_tvmaze_id integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.shows set episodes_synced_at = now() where tvmaze_id = p_tvmaze_id;
$$;

-- Shows whose TVMaze `updated` stamp is older than the one reported by /updates/shows.
create or replace function public.stale_shows(p_updates jsonb)
returns table (tvmaze_id integer, episodes_synced boolean)
language sql
security definer
set search_path = public
as $$
  select s.tvmaze_id, s.episodes_synced_at is not null
    from jsonb_each_text(p_updates) as u(key, value)
    join public.shows s on s.tvmaze_id = u.key::integer
   where s.tvmaze_updated_at is null
      or s.tvmaze_updated_at < to_timestamp(u.value::bigint);
$$;

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

revoke all on function public.upsert_channels(jsonb) from public, anon, authenticated;
revoke all on function public.upsert_shows(jsonb) from public, anon, authenticated;
revoke all on function public.upsert_episodes(jsonb) from public, anon, authenticated;
revoke all on function public.mark_show_episodes_synced(integer) from public, anon, authenticated;
revoke all on function public.stale_shows(jsonb) from public, anon, authenticated;
revoke all on function public.create_new_episode_notifications(bigint[]) from public, anon, authenticated;
revoke all on function public.create_airing_today_notifications() from public, anon, authenticated;
