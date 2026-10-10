-- Upserts (insert ... on conflict do update) need UPDATE as well.
grant update on public.user_episodes to authenticated;
