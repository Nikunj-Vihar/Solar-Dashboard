-- Schedules the monthly-report Edge Function (spec §6) for real, unattended
-- delivery. Runs 1st of month at 03:00 UTC = 08:30 IST, comfortably after
-- midnight local so the previous month is fully closed out everywhere.
--
-- The bearer secret is deliberately NOT inlined here -- this file is
-- committed to git. It's pulled at call-time from Supabase Vault instead;
-- the vault entry itself is created out-of-band via `supabase db execute`
-- or the SQL editor, e.g.:
--   select vault.create_secret('<value>', 'monthly_report_secret', 'Bearer token for the monthly-report Edge Function');
-- and must match the MONTHLY_REPORT_SECRET already set via `supabase secrets set`.

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'monthly-report-job',
  '0 3 1 * *',
  $$
  select net.http_post(
    url := 'https://ccsjplaivbkdamdeupsk.supabase.co/functions/v1/monthly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'monthly_report_secret'
      )
    )
  ) as request_id;
  $$
);
