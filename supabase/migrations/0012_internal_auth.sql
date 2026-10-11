-- Cron -> Edge Function authentication without the service-role key:
-- anon JWT as bearer (passes the gateway) + x-sync-secret shared secret that the
-- functions compare against app_settings.sync_secret (see _shared/auth.ts).
-- The vault secret `project_url` was created manually during setup:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'anon_key';
  select value #>> '{}' into v_secret from public.app_settings where key = 'sync_secret';
  if v_url is null or v_key is null or v_secret is null then
    raise warning 'invoke_edge_function(%): project_url / anon_key vault secrets or app_settings.sync_secret missing', p_name;
    return null;
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key,
      'x-sync-secret', v_secret),
    body := p_body,
    timeout_milliseconds := 10000);
end;
$$;
revoke all on function public.invoke_edge_function(text, jsonb) from public, anon, authenticated;

insert into public.app_settings (key, value)
values ('sync_secret', to_jsonb(encode(gen_random_bytes(32), 'hex')))
on conflict do nothing;

-- The anon key is public (it ships in the frontend bundle) but is still kept out of
-- source control. Create the vault secret once by hand in the SQL editor with the value
-- from Settings -> API (this project already has it):
--   select vault.create_secret('<anon key>', 'anon_key')
--    where not exists (select 1 from vault.secrets where name = 'anon_key');
