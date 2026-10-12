-- "Send test" notifications get their own type (they were typed airing_today).
-- A new enum value cannot be used in the transaction that adds it, so this is its own file.
alter type public.notification_type add value if not exists 'test';
