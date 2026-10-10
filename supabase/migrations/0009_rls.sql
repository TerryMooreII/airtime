-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.channels              enable row level security;
alter table public.shows                 enable row level security;
alter table public.show_external_ids     enable row level security;
alter table public.show_ratings          enable row level security;
alter table public.episodes              enable row level security;
alter table public.episode_ratings       enable row level security;
alter table public.profiles              enable row level security;
alter table public.admin_bootstrap_emails enable row level security;
alter table public.user_shows            enable row level security;
alter table public.notifications         enable row level security;
alter table public.push_subscriptions    enable row level security;
alter table public.sync_queue            enable row level security;
alter table public.sync_runs             enable row level security;
alter table public.app_settings          enable row level security;

-- Catalog: readable by signed-in users, written only by the service role (bypasses RLS).
create policy "catalog read" on public.channels          for select to authenticated using (true);
create policy "catalog read" on public.shows             for select to authenticated using (true);
create policy "catalog read" on public.show_external_ids for select to authenticated using (true);
create policy "catalog read" on public.show_ratings      for select to authenticated using (true);
create policy "catalog read" on public.episodes          for select to authenticated using (true);
create policy "catalog read" on public.episode_ratings   for select to authenticated using (true);

-- Profiles: owners see/edit their own row; admins see everyone.
create policy "profiles select own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "bootstrap emails admin read" on public.admin_bootstrap_emails
  for select to authenticated using (public.is_admin());

-- Tracked shows, notifications, push subscriptions: owner-only.
create policy "user_shows owner" on public.user_shows
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_shows admin read" on public.user_shows
  for select to authenticated using (public.is_admin());

create policy "notifications owner select" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications owner update" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications owner delete" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

create policy "push_subscriptions owner" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ops tables: admins read; writes happen through RPCs / service role.
create policy "sync_queue admin read" on public.sync_queue   for select to authenticated using (public.is_admin());
create policy "sync_runs admin read" on public.sync_runs     for select to authenticated using (public.is_admin());
create policy "app_settings admin read" on public.app_settings for select to authenticated using (public.is_admin());
