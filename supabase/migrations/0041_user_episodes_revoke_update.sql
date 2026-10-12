-- The client marks episodes watched with ON CONFLICT DO NOTHING (ignoreDuplicates) since the
-- data-layer pass, so the UPDATE grant from 0025 is no longer needed. Apply after that client
-- build is deployed.
revoke update on public.user_episodes from authenticated;
