-- Admins no longer read other users' libraries through RLS. The admin Shows page
-- gets follower counts from a guarded function instead.
alter policy "user_shows admin read" on public.user_shows using (false);

create or replace function public.admin_shows(p_query text default '', p_limit integer default 40)
returns table (
  id bigint, tvmaze_id integer, name text, status text, premiered date, image_medium text,
  episodes_synced_at timestamptz, synced_at timestamptz, tvmaze_updated_at timestamptz, followers bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select s.id, s.tvmaze_id, s.name, s.status, s.premiered, s.image_medium,
           s.episodes_synced_at, s.synced_at, s.tvmaze_updated_at,
           (select count(*) from public.user_shows us where us.show_id = s.id) as followers
      from public.shows s
     where coalesce(trim(p_query), '') = '' or s.name ilike '%' || trim(p_query) || '%'
     order by s.weight desc, s.id
     limit greatest(1, least(p_limit, 200));
end;
$$;
grant execute on function public.admin_shows(text, integer) to authenticated;
revoke execute on function public.admin_shows(text, integer) from anon, public;
