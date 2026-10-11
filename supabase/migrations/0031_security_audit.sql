-- Security audit before publishing the repository.
--
-- 1. anon and authenticated held TRUNCATE, REFERENCES and TRIGGER on every table (the
--    project's default ACL). TRUNCATE bypasses Row Level Security, so none of these belong
--    to API roles. Take them away and stop future tables from inheriting them.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- 2. Trigger functions are not API endpoints (flagged by the security advisor).
revoke execute on function public.expire_discover_cache() from public, anon, authenticated;
revoke execute on function public.mark_completed_show_watched() from public, anon, authenticated;
