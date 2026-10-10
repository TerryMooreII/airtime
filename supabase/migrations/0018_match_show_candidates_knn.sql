-- GiST trigram index enables k-nearest-neighbour ordering (name <-> query), which
-- avoids rechecking thousands of candidate rows per lookup.
create index if not exists shows_name_trgm_gist_idx on public.shows using gist (name extensions.gist_trgm_ops);

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
      -- KNN pass: the 25 nearest names by trigram distance (index-ordered, no recheck).
      with nearest as (
        select s.id, s.tvmaze_id, s.name, s.type, s.status, s.premiered, s.image_medium,
               s.network_id, s.web_channel_id, s.weight,
               similarity(s.name, trim(q.name))::real as score
          from public.shows s
         order by s.name <-> trim(q.name)
         limit 25
      )
      select n.id, n.tvmaze_id, n.name, n.type, n.status, n.premiered, n.image_medium,
             coalesce(ch.name, wc.name) as network_name,
             r.value as rating,
             n.score,
             (lower(n.name) = lower(trim(q.name))) as is_exact
        from nearest n
        left join public.channels ch on ch.id = n.network_id
        left join public.channels wc on wc.id = n.web_channel_id
        left join public.show_ratings r on r.show_id = n.id and r.provider = 'tvmaze'
       where n.score >= 0.3
       order by (lower(n.name) = lower(trim(q.name))) desc, n.score desc, n.weight desc
       limit greatest(1, least(p_limit, 10))
    ) c
   where length(trim(q.name)) > 0;
$$;
