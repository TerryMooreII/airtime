-- Mirror TVmaze's external ids instead of only adding to them.
--
-- TVmaze sometimes moves an external id between shows, usually while merging duplicates:
-- thetvdb 471152 moved from show 88749 to 24505. upsert_shows never removed ids a show no
-- longer lists, so 88749 kept 471152 and every refresh of 24505 failed on
-- show_external_ids (provider, external_id). In a multi-show batch one such row fails the
-- whole batch.
--
-- The ids are now written in separate steps after the show upsert, so each step sees the
-- previous one's changes:
--   1. drop ids the batch's shows no longer list;
--   2. take over ids another show still holds (that show is stale until its own refresh);
--   3. upsert the rest.
-- When two shows in one batch claim the same id, the more recently updated one wins.
-- Otherwise identical to 0040.
create or replace function public.upsert_shows(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_updated integer := 0;
  v_show_ids bigint[];
  v_ext_show bigint[];
  v_ext_provider text[];
  v_ext_value text[];
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

  -- The external ids TVmaze lists for this batch, one owner per (provider, id).
  with src as (
    select distinct on (r.tvmaze_id) r.*
      from jsonb_to_recordset(p_rows) as r(
        tvmaze_id integer, name text, tvmaze_updated_at timestamptz, externals jsonb)
     where r.tvmaze_id is not null and r.name is not null and r.externals is not null
     order by r.tvmaze_id, r.tvmaze_updated_at desc nulls last
  ), shows_in as (
    select sh.id, s.externals, s.tvmaze_updated_at
      from src s join public.shows sh on sh.tvmaze_id = s.tvmaze_id
  ), want as (
    select distinct on (e.key, e.value) si.id as show_id, e.key as provider, e.value as external_id
      from shows_in si
      cross join lateral jsonb_each_text(si.externals) as e(key, value)
     where e.value is not null and e.value <> ''
     order by e.key, e.value, si.tvmaze_updated_at desc nulls last, si.id
  )
  select (select coalesce(array_agg(id), '{}') from shows_in),
         coalesce(array_agg(show_id), '{}'), coalesce(array_agg(provider), '{}'),
         coalesce(array_agg(external_id), '{}')
    into v_show_ids, v_ext_show, v_ext_provider, v_ext_value
    from want;

  -- 1. Ids these shows no longer list.
  delete from public.show_external_ids x
   where x.show_id = any (v_show_ids)
     and not exists (
       select 1 from unnest(v_ext_show, v_ext_provider, v_ext_value) as w(show_id, provider, external_id)
        where w.show_id = x.show_id and w.provider = x.provider and w.external_id = x.external_id);

  -- 2. Ids TVmaze now gives to a show in this batch but another show still holds.
  delete from public.show_external_ids x
   using unnest(v_ext_show, v_ext_provider, v_ext_value) as w(show_id, provider, external_id)
   where x.provider = w.provider and x.external_id = w.external_id and x.show_id <> w.show_id;

  -- 3. Everything else.
  insert into public.show_external_ids (show_id, provider, external_id)
  select w.show_id, w.provider, w.external_id
    from unnest(v_ext_show, v_ext_provider, v_ext_value) as w(show_id, provider, external_id)
  on conflict (show_id, provider) do update set external_id = excluded.external_id
    where show_external_ids.external_id is distinct from excluded.external_id;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;
