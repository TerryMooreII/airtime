-- The guide hides shows the user dropped or muted. The previous (unfiltered)
-- function lives on as my_upcoming_episodes_all for the Library's next-air badges.
alter function public.my_upcoming_episodes(integer, integer) rename to my_upcoming_episodes_all;

create function public.my_upcoming_episodes(p_days integer default 14, p_limit integer default 200)
returns table (
  episode_id bigint, show_id bigint, show_name text, show_image text, season integer, number integer,
  episode_name text, airstamp timestamptz, runtime integer, status public.user_show_status
)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, s.id, s.name, s.image_medium, e.season, e.number, e.name, e.airstamp, e.runtime, us.status
    from public.user_shows us
    join public.shows s on s.id = us.show_id
    join public.episodes e on e.show_id = s.id
   where us.user_id = auth.uid()
     and s.status is distinct from 'Ended'
     and us.status <> 'dropped'
     and us.notify
     and e.airstamp >= now() - interval '1 day'
     and e.airstamp < now() + make_interval(days => greatest(1, least(p_days, 90)))
   order by e.airstamp
   limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.my_upcoming_episodes(integer, integer) to authenticated;
revoke execute on function public.my_upcoming_episodes(integer, integer) from anon, public;
grant execute on function public.my_upcoming_episodes_all(integer, integer) to authenticated;
revoke execute on function public.my_upcoming_episodes_all(integer, integer) from anon, public;
