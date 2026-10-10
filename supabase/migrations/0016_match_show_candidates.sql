-- Fuzzy-match a batch of show names (CSV import) against the local catalog.
-- Returns up to p_limit candidates per input name, best first.
-- Only the trigram % predicate is used so the GIN index applies; an exact match
-- always clears the similarity threshold. (0017 re-applied this fix in production.)
create or replace function public.match_show_candidates(p_names text[], p_limit integer default 5)
returns table (
  query_name text, id bigint, tvmaze_id integer, name text, type text, status text, premiered date,
  image_medium text, network_name text, rating numeric, score real, is_exact boolean
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select q.name as query_name, c.id, c.tvmaze_id, c.name, c.type, c.status, c.premiered,
         c.image_medium, c.network_name, c.rating, c.score, c.is_exact
    from unnest(p_names) as q(name)
    cross join lateral (
      select s.id, s.tvmaze_id, s.name, s.type, s.status, s.premiered, s.image_medium,
             coalesce(n.name, w.name) as network_name,
             r.value as rating,
             similarity(s.name, trim(q.name))::real as score,
             (lower(s.name) = lower(trim(q.name))) as is_exact
        from public.shows s
        left join public.channels n on n.id = s.network_id
        left join public.channels w on w.id = s.web_channel_id
        left join public.show_ratings r on r.show_id = s.id and r.provider = 'tvmaze'
       where s.name % trim(q.name)
       order by (lower(s.name) = lower(trim(q.name))) desc, similarity(s.name, trim(q.name)) desc, s.weight desc
       limit greatest(1, least(p_limit, 10))
    ) c
   where length(trim(q.name)) > 0;
$$;
grant execute on function public.match_show_candidates(text[], integer) to authenticated;
revoke execute on function public.match_show_candidates(text[], integer) from anon, public;
