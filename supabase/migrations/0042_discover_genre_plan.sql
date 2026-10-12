-- The genre rails were still ~1 s each after 0037: with the genre arriving as a correlated
-- subplan parameter the planner cannot use the most-common-element statistics on shows.genres,
-- so it bitmap-scanned every show of the genre (20k rows for Drama) before joining ratings.
-- With the genre as a literal it walks show_ratings in rating order and stops after 14 matches
-- (80 ms). Run each genre's query from a plpgsql loop with custom plans so the value is a
-- literal at plan time.
create or replace function public.compute_discover_rails()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
declare
  v_uid uuid := auth.uid();
  v_trending jsonb;
  v_new jsonb;
  v_genres jsonb := '[]'::jsonb;
  v_genre record;
  v_items jsonb;
  v_because jsonb;
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
  for v_genre in
    select x.genre, sum(coalesce(f.rating, 2.5)) as score
      from public.user_shows f
      join public.shows s on s.id = f.show_id
      cross join lateral unnest(s.genres) as x(genre)
     where f.user_id = v_uid
     group by x.genre order by score desc limit 2
  loop
    select public.show_card(f2.show_id) || jsonb_build_object('my_rating', f2.rating) into v_because
      from public.user_shows f2 join public.shows s2 on s2.id = f2.show_id
     where f2.user_id = v_uid and s2.genres @> array[v_genre.genre]
     order by f2.rating desc nulls last, s2.weight desc limit 1;

    select public.show_cards(array_agg(c.id order by c.rating desc, c.weight desc)) into v_items
      from (select s.id, r.value as rating, s.weight
              from public.show_ratings r
              join public.shows s on s.id = r.show_id
             where r.provider = 'tvmaze' and r.value >= 7
               and s.genres @> array[v_genre.genre] and s.image_medium is not null
               and not exists (select 1 from public.user_shows us where us.user_id = v_uid and us.show_id = s.id)
             order by r.value desc, s.weight desc limit 14) c;

    v_genres := v_genres || jsonb_build_object(
      'genre', v_genre.genre, 'score', v_genre.score, 'because', v_because,
      'items', coalesce(v_items, '[]'::jsonb));
  end loop;

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
revoke execute on function public.compute_discover_rails() from public, anon, authenticated;
grant execute on function public.compute_discover_rails() to service_role;
