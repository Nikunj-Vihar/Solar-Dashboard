-- Restore the client-entered "today's sky condition" categorical pick on the
-- Log page (dropped in 0018 alongside the whole NASA POWER weather-sync
-- feature). This is the client's own quick manual entry, not fetched from an
-- external source, so it comes back on its own -- the NASA-driven
-- daily_weather_readings table and weather-sync cron stay removed.

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

alter table daily_sky_conditions enable row level security;

create policy "own sky conditions" on daily_sky_conditions for all
  using (is_site_owner(site_id)) with check (is_site_owner(site_id));
