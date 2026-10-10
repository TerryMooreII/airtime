insert into public.admin_bootstrap_emails (email) values ('terry@mooreii.com')
on conflict do nothing;

-- If the account already exists, promote it now.
update public.profiles p
   set role = 'admin'
  from auth.users u
 where u.id = p.id and lower(u.email) in (select lower(email) from public.admin_bootstrap_emails)
   and p.role <> 'admin';

insert into public.app_settings (key, value) values
  ('catalog_import', jsonb_build_object('last_page', null, 'completed_at', null, 'started_at', null))
on conflict do nothing;

-- Kick off the one-time catalog import and a first schedule import.
select public.enqueue_sync_job('catalog_page', jsonb_build_object('page', 0), 50, now(), 'setup');
select public.enqueue_sync_job('full_schedule', '{}'::jsonb, 20, now(), 'setup');
