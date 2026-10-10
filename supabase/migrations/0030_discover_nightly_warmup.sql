-- Precompute Discover rails for every user after the nightly sync so the first visit
-- of the day never pays the cold compute cost.
create or replace function public.refresh_discover_cache_all()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in select id from public.profiles loop
    -- compute_discover_rails() reads auth.uid(); impersonate the user for this statement.
    perform set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, true);
    insert into public.discover_cache (user_id, payload, computed_at)
    values (r.id, public.compute_discover_rails(), now())
    on conflict (user_id) do update set payload = excluded.payload, computed_at = excluded.computed_at;
    n := n + 1;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return n;
end;
$$;
revoke execute on function public.refresh_discover_cache_all() from public, anon, authenticated;
grant execute on function public.refresh_discover_cache_all() to service_role;

select cron.schedule('airtime-discover-warmup', '45 6 * * *', $$select public.refresh_discover_cache_all()$$);
