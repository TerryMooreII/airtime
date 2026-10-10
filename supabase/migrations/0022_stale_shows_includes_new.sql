-- /updates/shows also reports shows that do not exist locally yet (new on TVmaze).
-- Return those too so the worker imports them; previously they were silently dropped.
alter function public.stale_shows(jsonb) rename to stale_shows_v1;

create function public.stale_shows(p_updates jsonb)
returns table (tvmaze_id integer, episodes_synced boolean, is_new boolean)
language sql
security definer
set search_path = public
as $$
  select u.key::integer as tvmaze_id,
         coalesce(s.episodes_synced_at is not null, false) as episodes_synced,
         (s.id is null) as is_new
    from jsonb_each_text(p_updates) as u(key, value)
    left join public.shows s on s.tvmaze_id = u.key::integer
   where u.key ~ '^[0-9]+$'
     and (s.id is null
          or s.tvmaze_updated_at is null
          or s.tvmaze_updated_at < to_timestamp(u.value::bigint));
$$;
revoke all on function public.stale_shows(jsonb) from public, anon, authenticated;
grant execute on function public.stale_shows(jsonb) to service_role;
revoke all on function public.stale_shows_v1(jsonb) from public, anon, authenticated;
