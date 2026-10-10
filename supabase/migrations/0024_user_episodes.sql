-- Per-episode watched tracking.
create table public.user_episodes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  episode_id bigint not null references public.episodes(id) on delete cascade,
  watched_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index user_episodes_user_idx on public.user_episodes (user_id);
create index user_episodes_episode_idx on public.user_episodes (episode_id);

alter table public.user_episodes enable row level security;
create policy "user_episodes owner" on public.user_episodes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.user_episodes to authenticated;
grant all on public.user_episodes to service_role;

-- Mark every aired episode of a season watched (unwatching is a plain delete from the client).
create or replace function public.mark_season_watched(p_show_id bigint, p_season integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  with ins as (
    insert into public.user_episodes (user_id, episode_id)
    select auth.uid(), e.id
      from public.episodes e
     where e.show_id = p_show_id and e.season = p_season and e.airstamp <= now()
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;
grant execute on function public.mark_season_watched(bigint, integer) to authenticated;
revoke execute on function public.mark_season_watched(bigint, integer) from anon, public;

-- Progress per followed show for the Library and show header.
create or replace function public.my_show_progress()
returns table (show_id bigint, aired integer, watched integer, next_unwatched_episode_id bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select us.show_id,
         (select count(*) from public.episodes e where e.show_id = us.show_id and e.airstamp <= now())::integer as aired,
         (select count(*) from public.user_episodes ue join public.episodes e on e.id = ue.episode_id
           where ue.user_id = auth.uid() and e.show_id = us.show_id)::integer as watched,
         (select e.id from public.episodes e
           where e.show_id = us.show_id and e.airstamp <= now()
             and not exists (select 1 from public.user_episodes ue where ue.user_id = auth.uid() and ue.episode_id = e.id)
           order by e.season, e.number nulls last, e.airstamp limit 1) as next_unwatched_episode_id
    from public.user_shows us
   where us.user_id = auth.uid();
$$;
grant execute on function public.my_show_progress() to authenticated;
revoke execute on function public.my_show_progress() from anon, public;

-- Marking a show Completed marks every aired episode watched (mock behaviour).
create or replace function public.mark_completed_show_watched()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.user_episodes (user_id, episode_id)
    select new.user_id, e.id from public.episodes e
     where e.show_id = new.show_id and e.airstamp <= now()
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger user_shows_completed_marks_watched
  after insert or update of status on public.user_shows
  for each row execute function public.mark_completed_show_watched();

-- When a show's episode history arrives later, catch up users who already marked it Completed.
create or replace function public.mark_show_episodes_synced(p_tvmaze_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_show_id bigint;
begin
  update public.shows set episodes_synced_at = now() where tvmaze_id = p_tvmaze_id returning id into v_show_id;
  if v_show_id is null then
    return;
  end if;
  insert into public.user_episodes (user_id, episode_id)
  select us.user_id, e.id
    from public.user_shows us
    join public.episodes e on e.show_id = us.show_id and e.airstamp <= now()
   where us.show_id = v_show_id and us.status = 'completed'
  on conflict do nothing;
end;
$$;

-- Backfill for shows already marked Completed.
insert into public.user_episodes (user_id, episode_id)
select us.user_id, e.id
  from public.user_shows us
  join public.episodes e on e.show_id = us.show_id and e.airstamp <= now()
 where us.status = 'completed'
on conflict do nothing;
