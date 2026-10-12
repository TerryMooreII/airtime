-- "More like this" for the show page: the best-rated catalog shows that share a genre with the
-- given show, re-ranked by how many genres overlap, then same type / language / network, then
-- rating. Shows the caller already follows (and the show itself) are left out.
--
-- Scoring every genre match is too slow on the nano instance (28k candidates for a Drama /
-- Sci-Fi / Thriller show, 2.4 s). Only ~12k shows carry a TVmaze rating, so the inner query
-- walks show_ratings_provider_value_idx in rating order and stops after 300 overlapping shows;
-- the score is then computed for those 300 only. force_custom_plan makes the planner see the
-- genre array as a literal, the same trick as 0042.
--
-- Security definer because show_cards() is granted to service_role only (0037).
create or replace function public.similar_shows(p_show_id bigint, p_limit int default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
declare
  v_uid uuid := auth.uid();
  v_genres text[];
  v_type text;
  v_language text;
  v_network_id bigint;
  v_web_channel_id bigint;
  v_ids bigint[];
begin
  select s.genres, s.type, s.language, s.network_id, s.web_channel_id
    into v_genres, v_type, v_language, v_network_id, v_web_channel_id
    from public.shows s
   where s.id = p_show_id;
  if not found or coalesce(cardinality(v_genres), 0) = 0 then
    return '[]'::jsonb;
  end if;

  select array_agg(c.id order by c.rank) into v_ids
    from (
      select k.id,
             row_number() over (
               order by 2 * cardinality(array(select unnest(k.genres) intersect select unnest(v_genres)))
                        + (k.type is not distinct from v_type)::int
                        + (k.language is not distinct from v_language)::int
                        -- "is not distinct from" so a candidate with no network scores 0, not null
                        -- (a null score would sort first under "desc").
                        + ((v_network_id is not null and k.network_id is not distinct from v_network_id)
                           or (v_web_channel_id is not null and k.web_channel_id is not distinct from v_web_channel_id))::int
                        + k.rating / 10 desc,
                        k.rating desc, k.weight desc) as rank
        from (
          select s.id, s.genres, s.type, s.language, s.network_id, s.web_channel_id, s.weight,
                 r.value as rating
            from public.show_ratings r
            join public.shows s on s.id = r.show_id
           where r.provider = 'tvmaze'
             and s.id <> p_show_id
             and s.image_medium is not null
             and s.genres && v_genres
             and not exists (select 1 from public.user_shows us
                              where us.user_id = v_uid and us.show_id = s.id)
           order by r.value desc
           limit 300
        ) k
       order by rank
       limit greatest(1, least(p_limit, 60))
    ) c;

  return coalesce(public.show_cards(v_ids), '[]'::jsonb);
end;
$$;
revoke execute on function public.similar_shows(bigint, int) from public, anon;
grant execute on function public.similar_shows(bigint, int) to authenticated;
