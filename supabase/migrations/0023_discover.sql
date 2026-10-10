-- Guide "Everything" scope and the Discover page.
-- (Applied through the Supabase MCP; definitions: show_card(), upcoming_episodes_all(), discover_rails().)
create index if not exists shows_genres_idx on public.shows using gin (genres);

-- One show rendered as a card payload (used by discover_rails).
create or replace function public.show_card(p_show_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id, 'tvmaze_id', s.tvmaze_id, 'name', s.name,
    'image_medium', s.image_medium, 'image_original', s.image_original,
    'premiered', s.premiered, 'genres', to_jsonb(s.genres), 'status', s.status,
    'summary_html', s.summary_html, 'network_name', coalesce(n.name, w.name), 'rating', r.value)
    from public.shows s
    left join public.channels n on n.id = s.network_id
    left join public.channels w on w.id = s.web_channel_id
    left join public.show_ratings r on r.show_id = s.id and r.provider = 'tvmaze'
   where s.id = p_show_id;
$$;
grant execute on function public.show_card(bigint) to authenticated;
revoke execute on function public.show_card(bigint) from anon, public;

-- Upcoming episodes across the whole catalog, capped to the 40 heaviest shows per local day.
create or replace function public.upcoming_episodes_all(p_days integer default 7, p_limit integer default 400)
returns table (
  episode_id bigint, show_id bigint, show_name text, show_image text, season integer, number integer,
  episode_name text, airstamp timestamptz, runtime integer, status public.user_show_status,
  show_weight integer, followed boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with tz as (select coalesce((select p.timezone from public.profiles p where p.id = auth.uid()), 'UTC') as name),
  ranked as (
    select e.id as episode_id, s.id as show_id, s.name as show_name, s.image_medium as show_image,
           e.season, e.number, e.name as episode_name, e.airstamp, e.runtime, us.status,
           s.weight as show_weight, (us.user_id is not null) as followed,
           row_number() over (partition by (e.airstamp at time zone (select name from tz))::date order by s.weight desc, e.airstamp) as rn
      from public.episodes e
      join public.shows s on s.id = e.show_id
      left join public.user_shows us on us.show_id = s.id and us.user_id = auth.uid()
     where s.status is distinct from 'Ended'
       and s.image_medium is not null
       and e.airstamp >= now() - interval '1 day'
       and e.airstamp < now() + make_interval(days => greatest(1, least(p_days, 30)))
  )
  select episode_id, show_id, show_name, show_image, season, number, episode_name, airstamp, runtime, status, show_weight, followed
    from ranked
   where rn <= 40
   order by airstamp
   limit greatest(1, least(p_limit, 1000));
$$;
grant execute on function public.upcoming_episodes_all(integer, integer) to authenticated;
revoke execute on function public.upcoming_episodes_all(integer, integer) from anon, public;

-- Recommendation rails for the signed-in user. See the applied migration for the full body;
-- it builds: trending (airing in 7 days, not followed), new_series (S1E1 in 7 days), the two
-- top-rated genres with a "because you rated X" anchor, the most-watched network, the
-- top-rated followed show (anchor for the client-side cast rail) and a hero pick.
create or replace function public.discover_rails()
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
  select coalesce(jsonb_agg(public.show_card(t.id) order by t.weight desc), '[]'::jsonb) into v_trending
    from (
      select s.id, s.weight from public.shows s
       where s.image_medium is not null and s.status is distinct from 'Ended'
         and exists (select 1 from public.episodes e where e.show_id = s.id and e.airstamp between now() and now() + interval '7 days')
         and not exists (select 1 from public.user_shows us where us.user_id = v_uid and us.show_id = s.id)
       order by s.weight desc limit 14) t;

  select coalesce(jsonb_agg(public.show_card(t.id) order by t.weight desc), '[]'::jsonb) into v_new
    from (
      select distinct s.id, s.weight from public.shows s
        join public.episodes e on e.show_id = s.id
       where e.season = 1 and e.number = 1 and e.airstamp between now() and now() + interval '7 days'
         and s.image_medium is not null
         and not exists (select 1 from public.user_shows us where us.user_id = v_uid and us.show_id = s.id)
       order by s.weight desc limit 14) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'genre', g.genre,
           'score', g.score,
           'because', (select public.show_card(f2.show_id) || jsonb_build_object('my_rating', f2.rating)
                         from public.user_shows f2 join public.shows s2 on s2.id = f2.show_id
                        where f2.user_id = v_uid and s2.genres @> array[g.genre]
                        order by f2.rating desc nulls last, s2.weight desc limit 1),
           'items', (select coalesce(jsonb_agg(public.show_card(c.id) order by c.rating desc, c.weight desc), '[]'::jsonb)
                       from (select s.id, r.value as rating, s.weight
                               from public.shows s
                               join public.show_ratings r on r.show_id = s.id and r.provider = 'tvmaze'
                              where s.genres @> array[g.genre] and s.image_medium is not null and r.value >= 7
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

  select ch.id, ch.name into v_net_id, v_net_name
    from public.user_shows f
    join public.shows s on s.id = f.show_id
    join public.channels ch on ch.id = coalesce(s.network_id, s.web_channel_id)
   where f.user_id = v_uid
   group by ch.id, ch.name
   order by sum(coalesce(f.rating, 2.5)) desc limit 1;
  if v_net_id is not null then
    select coalesce(jsonb_agg(public.show_card(t.id) order by t.weight desc), '[]'::jsonb) into v_network
      from (select s.id, s.weight from public.shows s
             where coalesce(s.network_id, s.web_channel_id) = v_net_id
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
    select elem into v_pick from jsonb_array_elements(v_trending) elem where elem ->> 'summary_html' is not null limit 1;
  end if;

  return jsonb_build_object(
    'trending', v_trending,
    'new_series', v_new,
    'genres', v_genres,
    'network', jsonb_build_object('name', v_net_name, 'items', v_network),
    'top_rated_show', v_top,
    'pick', v_pick,
    'pick_reason', case when v_pick is not null and v_genres -> 0 -> 'because' is not null
                        then v_genres -> 0 -> 'because' else null end);
end;
$$;
grant execute on function public.discover_rails() to authenticated;
revoke execute on function public.discover_rails() from anon, public;
