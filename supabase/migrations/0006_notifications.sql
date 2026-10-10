create table public.notifications (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         public.notification_type not null,
  title        text not null,
  body         text,
  show_id      bigint references public.shows(id) on delete cascade,
  episode_id   bigint references public.episodes(id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  push_sent_at timestamptz,
  created_at   timestamptz not null default now()
);
create unique index notifications_dedupe_idx
  on public.notifications (user_id, type, episode_id) where episode_id is not null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_push_pending_idx on public.notifications (id) where push_sent_at is null;

create table public.push_subscriptions (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failed_at       timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Live badge updates in the UI.
alter publication supabase_realtime add table public.notifications;
