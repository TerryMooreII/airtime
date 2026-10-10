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
-- The temp table lives for the transaction only (on commit drop).
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

revoke all on function public.upsert_channels(jsonb) from public, anon, authenticated;
revoke all on function public.upsert_shows(jsonb) from public, anon, authenticated;
revoke all on function public.upsert_episodes(jsonb) from public, anon, authenticated;
revoke all on function public.mark_show_episodes_synced(integer) from public, anon, authenticated;
revoke all on function public.stale_shows(jsonb) from public, anon, authenticated;
