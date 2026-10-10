-- Discover was slow on a cold cache: thousands of random heap reads on the wide shows and
-- episodes rows. Covering indexes make those scans index-only, and a per-user cache makes
-- repeat visits instant.

-- 1. Index-only scans for "episodes airing in the next N days" and for card-building joins.
create index if not exists episodes_airstamp_covering_idx
  on public.episodes (airstamp) include (show_id, season, number);
create index if not exists shows_card_covering_idx
  on public.shows (id) include (weight, status, image_medium, genres, network_id, web_channel_id);

-- 2. Per-user cache of the computed rails.
create table if not exists public.discover_cache (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  payload     jsonb not null,
  computed_at timestamptz not null default now()
);
alter table public.discover_cache enable row level security;
create policy "discover_cache owner" on public.discover_cache
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.discover_cache to authenticated;
grant all on public.discover_cache to service_role;

-- 3. The existing computation becomes compute_discover_rails(); discover_rails() serves the cache.
alter function public.discover_rails() rename to compute_discover_rails;

create function public.discover_rails()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cached jsonb;
begin
  select payload into v_cached
    from public.discover_cache
   where user_id = v_uid and computed_at > now() - interval '6 hours';
  if v_cached is not null then
    return v_cached;
  end if;

  v_cached := public.compute_discover_rails();
  insert into public.discover_cache (user_id, payload, computed_at)
  values (v_uid, v_cached, now())
  on conflict (user_id) do update set payload = excluded.payload, computed_at = excluded.computed_at;
  return v_cached;
end;
$$;
grant execute on function public.discover_rails() to authenticated;
revoke execute on function public.discover_rails() from anon, public;
revoke execute on function public.compute_discover_rails() from anon, public;
grant execute on function public.compute_discover_rails() to authenticated;

-- 4. Library changes expire the cache (an update, so the next visit recomputes).
create or replace function public.expire_discover_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discover_cache set computed_at = '-infinity'::timestamptz
   where user_id = coalesce(new.user_id, old.user_id);
  return coalesce(new, old);
end;
$$;
create trigger user_shows_expire_discover
  after insert or update of status, rating or delete on public.user_shows
  for each row execute function public.expire_discover_cache();
