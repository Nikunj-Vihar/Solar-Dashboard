-- Per-site report cadence, replacing the fixed monthly-only cron. The
-- generation-report Edge Function (renamed from monthly-report) now decides,
-- per site and per day, whether today is that site's send day.

alter table sites add column report_frequency text not null default 'monthly'
  check (report_frequency in ('daily', 'weekly', 'monthly', 'off'));

select cron.unschedule('monthly-report-job');

-- Runs daily; the function itself skips sites whose frequency doesn't call
-- for a send today. Reuses the existing monthly_report_secret Vault entry.
select cron.schedule(
  'generation-report-job',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://ccsjplaivbkdamdeupsk.supabase.co/functions/v1/generation-report',
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
