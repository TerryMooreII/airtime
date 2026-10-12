-- Discover: cheaper compute and stale-while-revalidate caching.
--
-- Cold compute took 2–3.5 s: each rail called show_card(id) once per card (~70 calls, each a
-- four-table join), and any library change set the cache to -infinity so the next visit paid
-- the full cost again. Now:
--   * show_cards(ids) builds a whole rail in one set-based query;
--   * discover_rails() always serves the cached payload when one exists;
--   * library changes only mark the row stale (one statement-level update, not one per row);
--   * refresh_discover_cache_stale() recomputes stale / >6 h rows every 5 minutes, and the
--     nightly sync marks every row stale once the catalog has changed.

create or replace function public.show_cards(p_ids bigint[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'tvmaze_id', s.tvmaze_id, 'name', s.name,
           'image_medium', s.image_medium, 'image_original', s.image_original,
           'premiered', s.premiered, 'genres', to_jsonb(s.genres), 'status', s.status,
           'summary_html', s.summary_html, 'network_name', coalesce(n.name, w.name), 'rating', r.value)
           order by i.ord), '[]'::jsonb)
    from unnest(p_ids) with ordinality as i(id, ord)
    join public.shows s on s.id = i.id
    left join public.channels n on n.id = s.network_id
    left join public.channels w on w.id = s.web_channel_id
    left join public.show_ratings r on r.show_id = s.id and r.provider = 'tvmaze';
$$;
revoke execute on function public.show_cards(bigint[]) from public, anon, authenticated;
grant execute on function public.show_cards(bigint[]) to service_role;

create or replace function public.compute_discover_rails()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trending jsonb;
  v_new jsonb;
  v_genres jsonb;
  v_net_id bigint;
  v_net_name text;
  v_network jsonb := '[]'::jsonb;
  v_top jsonb;
  v_pick jsonb;
begin
  -- Airing in the next 7 days, not followed, heaviest first.
  select public.show_cards(array_agg(t.id order by t.weight desc)) into v_trending
    from (
      select s.id, s.weight
        from (select distinct e.show_id from public.episodes e
               where e.airstamp between now() and now() + interval '7 days') up
        join public.shows s on s.id = up.show_id
       where s.image_medium is not null and s.status is distinct from 'Ended'
         and not exists (select 1 from public.user_shows us where us.user_id = v_uid and us.show_id = s.id)
       order by s.weight desc limit 14) t;

  -- Series premieres (S1E1) in the next 7 days.
  select public.show_cards(array_agg(t.id order by t.weight desc)) into v_new
    from (
      select s.id, s.weight
        from (select distinct e.show_id from public.episodes e
               where e.season = 1 and e.number = 1 and e.airstamp between now() and now() + interval '7 days') up
        join public.shows s on s.id = up.show_id
       where s.image_medium is not null
         and not exists (select 1 from public.user_shows us where us.user_id = v_uid and us.show_id = s.id)
       order by s.weight desc limit 14) t;

  -- The two genres the user rates highest, each with a "because you rated X" anchor.
  select coalesce(jsonb_agg(jsonb_build_object(
           'genre', g.genre,
           'score', g.score,
           'because', (select public.show_card(f2.show_id) || jsonb_build_object('my_rating', f2.rating)
                         from public.user_shows f2 join public.shows s2 on s2.id = f2.show_id
                        where f2.user_id = v_uid and s2.genres @> array[g.genre]
                        order by f2.rating desc nulls last, s2.weight desc limit 1),
           'items', (select public.show_cards(array_agg(c.id order by c.rating desc, c.weight desc))
                       from (select s.id, r.value as rating, s.weight
                               from public.show_ratings r
                               join public.shows s on s.id = r.show_id
                              where r.provider = 'tvmaze' and r.value >= 7
                                and s.genres @> array[g.genre] and s.image_medium is not null
                                and not exists (select 1 from public.user_shows us where us.user_id = v_uid and us.show_id = s.id)
                              order by r.value desc, s.weight desc limit 14) c)
         ) order by g.score desc), '[]'::jsonb) into v_genres
    from (
      select x.genre, sum(coalesce(f.rating, 2.5)) as score
        from public.user_shows f
        join public.shows s on s.id = f.show_id
        cross join lateral unnest(s.genres) as x(genre)
       where f.user_id = v_uid
       group by x.genre order by score desc limit 2) g;

  -- The network the user watches most.
  select ch.id, ch.name into v_net_id, v_net_name
    from public.user_shows f
    join public.shows s on s.id = f.show_id
    join public.channels ch on ch.id = coalesce(s.network_id, s.web_channel_id)
   where f.user_id = v_uid
   group by ch.id, ch.name
   order by sum(coalesce(f.rating, 2.5)) desc limit 1;
  if v_net_id is not null then
    select public.show_cards(array_agg(t.id order by t.weight desc)) into v_network
      from (select s.id, s.weight from public.shows s
             where (s.network_id = v_net_id or s.web_channel_id = v_net_id)
               and s.image_medium is not null and s.status is distinct from 'Ended'
               and not exists (select 1 from public.user_shows us where us.user_id = v_uid and us.show_id = s.id)
             order by s.weight desc limit 14) t;
  end if;

  select jsonb_build_object('id', s.id, 'tvmaze_id', s.tvmaze_id, 'name', s.name, 'my_rating', f.rating) into v_top
    from public.user_shows f join public.shows s on s.id = f.show_id
   where f.user_id = v_uid
   order by f.rating desc nulls last, s.weight desc limit 1;

  select elem into v_pick
    from jsonb_array_elements(coalesce(v_genres -> 0 -> 'items', '[]'::jsonb)) elem
   where elem ->> 'summary_html' is not null limit 1;
  if v_pick is null then
    select elem into v_pick from jsonb_array_elements(coalesce(v_trending, '[]'::jsonb)) elem
     where elem ->> 'summary_html' is not null limit 1;
  end if;

  return jsonb_build_object(
    'trending', coalesce(v_trending, '[]'::jsonb),
    'new_series', coalesce(v_new, '[]'::jsonb),
    'genres', v_genres,
    'network', jsonb_build_object('name', v_net_name, 'items', coalesce(v_network, '[]'::jsonb)),
    'top_rated_show', v_top,
    'pick', v_pick,
    'pick_reason', case when v_pick is not null and v_genres -> 0 -> 'because' is not null
                        then v_genres -> 0 -> 'because' else null end);
end;
$$;
-- Clients go through discover_rails(); only the cache refreshers call this directly.
revoke execute on function public.compute_discover_rails() from public, anon, authenticated;
grant execute on function public.compute_discover_rails() to service_role;

alter table public.discover_cache add column if not exists stale boolean not null default false;

-- Serve the cache whenever a row exists (stale or not); compute inline only for a first visit.
create or replace function public.discover_rails()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cached jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select payload into v_cached from public.discover_cache where user_id = v_uid;
  if v_cached is not null then
    return v_cached;
  end if;

  v_cached := public.compute_discover_rails();
  insert into public.discover_cache (user_id, payload, computed_at, stale)
  values (v_uid, v_cached, now(), false)
  on conflict (user_id) do update
    set payload = excluded.payload, computed_at = excluded.computed_at, stale = false;
  return v_cached;
end;
$$;
grant execute on function public.discover_rails() to authenticated;
revoke execute on function public.discover_rails() from anon, public;

-- Library changes mark the cache stale: one statement-level update per statement (a CSV
-- import used to fire one UPDATE per imported row). Ratings no longer invalidate anything.
drop trigger if exists user_shows_expire_discover on public.user_shows;
create or replace function public.expire_discover_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.discover_cache c set stale = true
     where not c.stale and c.user_id in (select user_id from new_rows);
  elsif tg_op = 'DELETE' then
    update public.discover_cache c set stale = true
     where not c.stale and c.user_id in (select user_id from old_rows);
  else
    -- Transition tables cannot be combined with `update of status`, so filter here:
    -- only a status change affects the rails (ratings and notes do not).
    update public.discover_cache c set stale = true
     where not c.stale and c.user_id in (
       select n.user_id from new_rows n
       join old_rows o on o.user_id = n.user_id and o.show_id = n.show_id
       where o.status is distinct from n.status);
  end if;
  return null;
end;
$$;
create trigger user_shows_expire_discover_ins
  after insert on public.user_shows
  referencing new table as new_rows
  for each statement execute function public.expire_discover_cache();
create trigger user_shows_expire_discover_upd
  after update on public.user_shows
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.expire_discover_cache();
create trigger user_shows_expire_discover_del
  after delete on public.user_shows
  referencing old table as old_rows
  for each statement execute function public.expire_discover_cache();

-- Recompute stale or old rows. Runs every 5 minutes; only users who have opened Discover
-- (and therefore have a row) are ever computed.
drop function if exists public.refresh_discover_cache_all();
create or replace function public.refresh_discover_cache_stale()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select user_id from public.discover_cache
     where stale or computed_at < now() - interval '6 hours'
  loop
    -- compute_discover_rails() reads auth.uid(); impersonate the user for this statement.
    perform set_config('request.jwt.claims', json_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);
    update public.discover_cache
       set payload = public.compute_discover_rails(), computed_at = now(), stale = false
     where user_id = r.user_id;
    n := n + 1;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return n;
end;
$$;
revoke execute on function public.refresh_discover_cache_stale() from public, anon, authenticated;
grant execute on function public.refresh_discover_cache_stale() to service_role;

select cron.unschedule('airtime-discover-warmup');
select cron.schedule('airtime-discover-refresh', '*/5 * * * *', $$select public.refresh_discover_cache_stale()$$);
-- After the nightly catalog sync (06:00) the rails are out of date for everyone.
select cron.schedule('airtime-discover-nightly-stale', '45 6 * * *', $$update public.discover_cache set stale = true$$);
