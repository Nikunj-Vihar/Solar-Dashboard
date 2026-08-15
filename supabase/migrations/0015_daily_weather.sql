-- Two tables backing the "how is climate affecting my generation" feature:
--
-- daily_sky_conditions -- what the client logs themselves, alongside their
-- daily readings (a quick categorical pick, not a number they can't
-- accurately measure without on-site equipment). Available immediately.
--
-- daily_weather_readings -- what the weather-sync Edge Function fetches from
-- NASA POWER's daily (not climatology) endpoint: real historical values for
-- actual dates, not a 20-year average. Published with a lag (roughly 1-2
-- weeks) after the fact, so this fills in after the client's own entry, not
-- instead of it.

create table daily_sky_conditions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  reading_date date not null,
  sky_condition text not null check (sky_condition in (
    'clear', 'partly_cloudy', 'mostly_cloudy', 'overcast',
    'light_rain', 'heavy_rain_storm', 'hazy_dusty', 'foggy'
  )),
  note text,
  entered_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (site_id, reading_date)
);

create table daily_weather_readings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  reading_date date not null,
  avg_daily_irradiance_kwh_per_m2 numeric(6,3),
  cloud_amt_pct numeric(5,2),
  temperature_c numeric(5,2),
  precipitation_mm numeric(7,2),
  source text not null default 'NASA_POWER',
  fetched_at timestamptz not null default now(),
  unique (site_id, reading_date)
);

alter table daily_sky_conditions enable row level security;
alter table daily_weather_readings enable row level security;

-- Client writes their own sky-condition entries directly, same as daily_readings.
create policy "own sky conditions" on daily_sky_conditions for all
  using (is_site_owner(site_id)) with check (is_site_owner(site_id));

-- Read-only for the client -- only the weather-sync Edge Function (service
-- role, bypasses RLS) ever writes here, so there's no legitimate client-side
-- write path to grant.
create policy "own weather readings" on daily_weather_readings for select
  using (is_site_owner(site_id));

-- Scheduling for the weather-sync Edge Function, same shape as
-- 0006/0008's generation-report cron. The bearer secret is pulled from
-- Supabase Vault at call-time, not inlined here (this file is committed to
-- git). Create it out-of-band before this cron job can succeed:
--   select vault.create_secret('<value>', 'weather_sync_secret', 'Bearer token for the weather-sync Edge Function');
-- and set the same value via `supabase secrets set WEATHER_SYNC_SECRET=<value>`
-- so the deployed function's own Deno.env.get(...) check matches.
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'weather-sync-job',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://ccsjplaivbkdamdeupsk.supabase.co/functions/v1/weather-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'weather_sync_secret'
      )
    )
  ) as request_id;
  $$
);
