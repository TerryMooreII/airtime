-- ---------------------------------------------------------------------------
-- Users: profiles mirror auth.users (1:1), roles, tracked shows.
-- ---------------------------------------------------------------------------
create table public.admin_bootstrap_emails (
  email      text primary key,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text,
  avatar_url         text,
  timezone           text not null default 'UTC',
  role               public.app_role not null default 'user',
  notify_in_app      boolean not null default true,
  notify_push        boolean not null default false,
  airing_digest_hour smallint not null default 9 check (airing_digest_hour between 0 and 23),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- is_admin() is used inside RLS policies; security definer avoids recursive policy checks.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to authenticated;

-- Create a profile for every new auth user; grant admin to bootstrap emails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.admin_bootstrap_emails where lower(email) = lower(new.email))
         then 'admin'::public.app_role else 'user'::public.app_role end
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Validate timezone names and protect the role column from self-service edits.
create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.timezone is distinct from old.timezone
     and not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;

  if new.role is distinct from old.role then
    -- auth.uid() is null for service-role / cron / internal callers.
    if auth.uid() is not null and (not public.is_admin() or old.id = auth.uid()) then
      raise exception 'not allowed to change role' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------------------------------------------------------------------------
-- Tracked shows
-- ---------------------------------------------------------------------------
create table public.user_shows (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  show_id    bigint not null references public.shows(id) on delete cascade,
  status     public.user_show_status not null default 'watching',
  rating     smallint check (rating between 1 and 5),
  notes      text,
  notify     boolean not null default true,
  added_at   timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, show_id)
);
create index user_shows_show_idx on public.user_shows (show_id);
create index user_shows_user_status_idx on public.user_shows (user_id, status);
create trigger user_shows_set_updated_at before update on public.user_shows
  for each row execute function public.set_updated_at();

-- When a show is tracked for the first time, fetch its complete episode list.
create or replace function public.enqueue_episodes_for_tracked_show()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tvmaze_id integer;
begin
  select tvmaze_id into v_tvmaze_id
    from public.shows
   where id = new.show_id and episodes_synced_at is null;
  if v_tvmaze_id is not null then
    perform public.enqueue_sync_job('show_episodes', jsonb_build_object('tvmaze_id', v_tvmaze_id), 10, now(), 'track');
  end if;
  return new;
end;
$$;
create trigger user_shows_enqueue_episodes after insert on public.user_shows
  for each row execute function public.enqueue_episodes_for_tracked_show();
