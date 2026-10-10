-- Run the trigram (typo) pass only when prefix full-text finds fewer than 10 shows,
-- and never for inputs under 4 characters. Short common words were costing 300-500 ms.
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
           (select to_tsquery('simple', string_agg(w || ':*', ' & '))
              from (select regexp_replace(t, '[^a-z0-9]+', '', 'g') as w
                      from regexp_split_to_table(lower(trim(p_query)), '\s+') t) x
             where w <> '') as tsq
  ),
  fts as (
    select s.id, s.weight
      from public.shows s, q
     where q.tsq is not null and s.search @@ q.tsq
     order by s.weight desc
     limit 150
  ),
  near as (
    select s.id, similarity(s.name, q.raw)::real as sim
      from public.shows s, q
     where length(q.raw) >= 4
       and (select count(*) from fts) < 10
       and s.name % q.raw
     order by similarity(s.name, q.raw) desc, s.weight desc
     limit 50
  ),
  cand as (
    select coalesce(f.id, n.id) as id,
           greatest(case when f.id is not null then 0.6 else 0 end, coalesce(n.sim, 0))::real as score
      from fts f full outer join near n on n.id = f.id
  )
  select s.id, s.tvmaze_id, s.name, s.type, s.status, s.premiered, s.genres, s.image_medium, s.language,
         coalesce(n.name, w.name) as network_name,
         r.value as rating,
         (c.score + (lower(s.name) = lower(q.raw))::int
            + case when lower(s.name) like lower(q.raw) || '%' then 0.2 else 0 end)::real as rank
    from cand c
    join public.shows s on s.id = c.id
    cross join q
    left join public.channels n on n.id = s.network_id
    left join public.channels w on w.id = s.web_channel_id
    left join public.show_ratings r on r.show_id = s.id and r.provider = 'tvmaze'
   where length(q.raw) > 0
   order by rank desc, s.weight desc, s.id
   limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
$$;
