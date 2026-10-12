-- Replace client-side loops with one statement each, and stop creating temp tables per batch.

-- 1. sync-worker issued up to 400 sequential enqueue_sync_job RPCs after /updates/shows.
create or replace function public.enqueue_stale_shows(p_updates jsonb, p_max integer default 400)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with stale as (
    select * from public.stale_shows(p_updates)
  ), picked as (
    -- Tracked shows (with episodes) first, then known shows, then shows new to TVmaze.
    select * from stale
     order by case when episodes_synced then 0 when is_new then 2 else 1 end, tvmaze_id
     limit greatest(1, p_max)
  ), ins as (
    insert into public.sync_queue (job_type, payload, priority, triggered_by)
    select 'show_refresh', jsonb_build_object('tvmaze_id', p.tvmaze_id),
           case when p.episodes_synced then 40 when p.is_new then 80 else 70 end, 'updates'
      from picked p
    on conflict (job_type, payload) where status in ('queued', 'running') do nothing
    returning (payload ->> 'tvmaze_id')::integer as tvmaze_id
  )
  select jsonb_build_object(
    'stale', (select count(*) from stale),
    'enqueued', (select count(*) from ins),
    'new_shows', (select count(*) from ins i join picked p on p.tvmaze_id = i.tvmaze_id where p.is_new));
$$;
revoke execute on function public.enqueue_stale_shows(jsonb, integer) from public, anon, authenticated;
grant execute on function public.enqueue_stale_shows(jsonb, integer) to service_role;

-- 2. admin-users downloaded every user_shows row to count follows in JavaScript, and
--    PostgREST's 1,000-row cap silently truncated the result.
create or replace function public.admin_user_summaries(p_ids uuid[])
returns table (id uuid, display_name text, role public.app_role, timezone text, created_at timestamptz, tracked_shows bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.role, p.timezone, p.created_at,
         (select count(*) from public.user_shows us where us.user_id = p.id) as tracked_shows
    from public.profiles p
   where p.id = any (p_ids);
$$;
revoke execute on function public.admin_user_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_user_summaries(uuid[]) to service_role;

-- 3. upsert_shows / upsert_episodes created a temp table per call (thousands a day during
--    imports), churning pg_class/pg_attribute. One statement with a materialized CTE instead.
--    Rows that conflict without changing are not returned by the INSERT, so the ids used by the
--    dependent inserts come from the INSERT's RETURNING unioned with the pre-statement snapshot.
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
  with src as materialized (
    select distinct on (r.tvmaze_id) r.*
      from jsonb_to_recordset(p_rows) as r(
        tvmaze_id integer, name text, type text, language text, genres text[], status text,
        runtime integer, average_runtime integer, premiered date, ended date, official_site text,
        schedule_time text, schedule_days text[], weight integer,
        network_tvmaze_id integer, web_channel_tvmaze_id integer, dvd_country_code text,
        image_medium text, image_original text, summary_html text, tvmaze_url text,
        tvmaze_updated_at timestamptz, externals jsonb, rating_average numeric)
     where r.tvmaze_id is not null and r.name is not null
     order by r.tvmaze_id, r.tvmaze_updated_at desc nulls last
  ), up as (
    insert into public.shows (
      tvmaze_id, name, type, language, genres, status, runtime, average_runtime, premiered, ended,
      official_site, schedule_time, schedule_days, weight, network_id, web_channel_id, dvd_country_code,
      image_medium, image_original, summary_html, tvmaze_url, tvmaze_updated_at, synced_at)
    select s.tvmaze_id, s.name, s.type, s.language, coalesce(s.genres, '{}'), s.status, s.runtime,
           s.average_runtime, s.premiered, s.ended, s.official_site, nullif(s.schedule_time, ''),
           coalesce(s.schedule_days, '{}'), coalesce(s.weight, 0), n.id, w.id, s.dvd_country_code,
           s.image_medium, s.image_original, s.summary_html, s.tvmaze_url, s.tvmaze_updated_at, now()
      from src s
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
    returning id, tvmaze_id, (xmax = 0) as inserted
  ), ids as (
    select id, tvmaze_id from up
    union
    select sh.id, sh.tvmaze_id from public.shows sh join src on src.tvmaze_id = sh.tvmaze_id
  ), ext as (
    insert into public.show_external_ids (show_id, provider, external_id)
    select i.id, e.key, e.value
      from src s
      join ids i on i.tvmaze_id = s.tvmaze_id
      cross join lateral jsonb_each_text(coalesce(s.externals, '{}'::jsonb)) as e(key, value)
     where e.value is not null and e.value <> ''
    on conflict (show_id, provider) do update set external_id = excluded.external_id
      where show_external_ids.external_id is distinct from excluded.external_id
    returning 1
  ), rat as (
    insert into public.show_ratings (show_id, provider, value, scale, fetched_at)
    select i.id, 'tvmaze', s.rating_average, 10, now()
      from src s
      join ids i on i.tvmaze_id = s.tvmaze_id
     where s.rating_average is not null
    on conflict (show_id, provider) do update set value = excluded.value, fetched_at = now()
      where show_ratings.value is distinct from excluded.value
    returning 1
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into v_inserted, v_updated
    from up;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;

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
  select jsonb_array_length(p_rows) into v_total;

  with src as materialized (
    select distinct on (r.tvmaze_id) r.*, sh.id as show_id
      from jsonb_to_recordset(p_rows) as r(
        tvmaze_id integer, show_tvmaze_id integer, season integer, number integer, type text, name text,
        airdate date, airtime text, airstamp timestamptz, runtime integer,
        image_medium text, image_original text, summary_html text, tvmaze_url text, rating_average numeric)
      join public.shows sh on sh.tvmaze_id = r.show_tvmaze_id
     where r.tvmaze_id is not null and r.season is not null
  ), up as (
    insert into public.episodes (
      tvmaze_id, show_id, season, number, type, name, airdate, airtime, airstamp, runtime,
      image_medium, image_original, summary_html, tvmaze_url, synced_at)
    select tvmaze_id, show_id, season, number, coalesce(type, 'regular'), name, airdate,
           nullif(airtime, ''), airstamp, runtime, image_medium, image_original, summary_html, tvmaze_url, now()
      from src
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
    returning id, tvmaze_id, (xmax = 0) as inserted
  ), ids as (
    select id, tvmaze_id from up
    union
    select e.id, e.tvmaze_id from public.episodes e join src on src.tvmaze_id = e.tvmaze_id
  ), rat as (
    insert into public.episode_ratings (episode_id, provider, value, scale, fetched_at)
    select i.id, 'tvmaze', t.rating_average, 10, now()
      from src t
      join ids i on i.tvmaze_id = t.tvmaze_id
     where t.rating_average is not null
    on conflict (episode_id, provider) do update set value = excluded.value, fetched_at = now()
      where episode_ratings.value is distinct from excluded.value
    returning 1
  )
  select coalesce(array_agg(id) filter (where inserted), '{}'), count(*) filter (where not inserted)
    into v_inserted_ids, v_updated
    from up;

  return jsonb_build_object(
    'inserted_ids', to_jsonb(v_inserted_ids),
    'inserted', coalesce(array_length(v_inserted_ids, 1), 0),
    'updated', v_updated,
    'skipped', v_total - coalesce(array_length(v_inserted_ids, 1), 0) - v_updated);
end;
$$;
