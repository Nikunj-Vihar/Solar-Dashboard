-- Client-entered "was there a grid power outage today, and for how long"
-- log, mirroring daily_sky_conditions (0019): a row only exists when an
-- outage happened. Grid-tied inverters with no battery shut completely off
-- during a grid outage (anti-islanding safety), so this explains an
-- otherwise-mysterious low-generation day and, more importantly, lets the
-- underperformance-alert check below tell a real fault from a day that was
-- just grid-starved.

create table daily_grid_outages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  reading_date date not null,
  outage_hours numeric not null check (outage_hours > 0 and outage_hours <= 24),
  note text,
  entered_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (site_id, reading_date)
);

alter table daily_grid_outages enable row level security;

create policy "own grid outages" on daily_grid_outages for all
  using (is_site_owner(site_id)) with check (is_site_owner(site_id));

-- refresh_alerts(), recreated from 0017 with one addition: every recent/
-- baseline average (per-inverter and site-wide) now excludes any date with
-- a logged grid outage, the same way a "no reading" day is already excluded
-- via NULL -- an outage day can neither trigger nor mask a real drop, and
-- doesn't get counted in the baseline either.
create or replace function refresh_alerts(p_site_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inverter record;
  v_recent_avg numeric;
  v_baseline_avg numeric;
  v_pct_diff numeric;
  v_today date;
  v_site_timezone text;
  v_last_reading_date date;
  v_days_missing int;
  v_message text;
  v_updated int;
begin
  select timezone into v_site_timezone from sites where id = p_site_id;
  v_today := (now() at time zone coalesce(v_site_timezone, 'Asia/Kolkata'))::date;

  for v_inverter in select id, name from inverters where site_id = p_site_id and is_active = true
  loop
    -- Underperformance
    select avg(daily_kwh) into v_recent_avg from daily_readings
      where inverter_id = v_inverter.id and reading_date > v_today - 7 and reading_date <= v_today
        and reading_date not in (select reading_date from daily_grid_outages where site_id = p_site_id);
    select avg(daily_kwh) into v_baseline_avg from daily_readings
      where inverter_id = v_inverter.id and reading_date > v_today - 37 and reading_date <= v_today - 7
        and reading_date not in (select reading_date from daily_grid_outages where site_id = p_site_id);

    if v_recent_avg is not null and v_baseline_avg is not null and v_baseline_avg > 0 then
      v_pct_diff := ((v_recent_avg - v_baseline_avg) / v_baseline_avg) * 100;
    else
      v_pct_diff := null;
    end if;

    if v_pct_diff is not null and v_pct_diff < -20 then
      v_message := format(
        '%s''s generation is %s%% below its 30-day average (last 7 days: %s kWh/day vs %s kWh/day).',
        v_inverter.name, round(abs(v_pct_diff))::text, round(v_recent_avg, 1)::text, round(v_baseline_avg, 1)::text
      );
      update alerts set message = v_message, reading_date = v_today, created_at = now(), is_resolved = false
        where site_id = p_site_id and inverter_id = v_inverter.id
          and alert_type = 'underperformance' and is_resolved = false;
      get diagnostics v_updated = row_count;
      if v_updated = 0 then
        insert into alerts (site_id, inverter_id, alert_type, severity, message, reading_date)
        values (p_site_id, v_inverter.id, 'underperformance', 'watch', v_message, v_today)
        on conflict (site_id, alert_type, coalesce(inverter_id, '00000000-0000-0000-0000-000000000000'), reading_date)
        do update set message = excluded.message, is_resolved = false, created_at = now();
      end if;
    else
      update alerts set is_resolved = true
        where site_id = p_site_id and inverter_id = v_inverter.id
          and alert_type = 'underperformance' and is_resolved = false;
    end if;

    -- Missing reading
    select max(reading_date) into v_last_reading_date from daily_readings where inverter_id = v_inverter.id;
    v_days_missing := case when v_last_reading_date is null then null else v_today - v_last_reading_date end;

    if v_days_missing is not null and v_days_missing >= 2 then
      v_message := format('No reading logged for %s for %s days (last: %s).',
        v_inverter.name, v_days_missing, to_char(v_last_reading_date, 'Mon DD'));
      update alerts set message = v_message, reading_date = v_today, created_at = now(), is_resolved = false
        where site_id = p_site_id and inverter_id = v_inverter.id
          and alert_type = 'missing_reading' and is_resolved = false;
      get diagnostics v_updated = row_count;
      if v_updated = 0 then
        insert into alerts (site_id, inverter_id, alert_type, severity, message, reading_date)
        values (p_site_id, v_inverter.id, 'missing_reading', 'watch', v_message, v_today)
        on conflict (site_id, alert_type, coalesce(inverter_id, '00000000-0000-0000-0000-000000000000'), reading_date)
        do update set message = excluded.message, is_resolved = false, created_at = now();
      end if;
    else
      update alerts set is_resolved = true
        where site_id = p_site_id and inverter_id = v_inverter.id
          and alert_type = 'missing_reading' and is_resolved = false;
    end if;
  end loop;

  -- Site-wide underperformance: same 7-day-vs-30-day-before comparison as
  -- above, summed across all active inverters instead of one, and same
  -- outage-day exclusion.
  select avg(daily_total) into v_recent_avg from (
    select reading_date, sum(daily_kwh) as daily_total
    from daily_readings
    where site_id = p_site_id and reading_date > v_today - 7 and reading_date <= v_today
      and reading_date not in (select reading_date from daily_grid_outages where site_id = p_site_id)
    group by reading_date
  ) recent;
  select avg(daily_total) into v_baseline_avg from (
    select reading_date, sum(daily_kwh) as daily_total
    from daily_readings
    where site_id = p_site_id and reading_date > v_today - 37 and reading_date <= v_today - 7
      and reading_date not in (select reading_date from daily_grid_outages where site_id = p_site_id)
    group by reading_date
  ) base;

  if v_recent_avg is not null and v_baseline_avg is not null and v_baseline_avg > 0 then
    v_pct_diff := ((v_recent_avg - v_baseline_avg) / v_baseline_avg) * 100;
  else
    v_pct_diff := null;
  end if;

  if v_pct_diff is not null and v_pct_diff < -20 then
    v_message := format(
      'Total site generation is %s%% below its own 30-day average (last 7 days: %s kWh/day vs %s kWh/day).',
      round(abs(v_pct_diff))::text, round(v_recent_avg, 1)::text, round(v_baseline_avg, 1)::text
    );
    update alerts set message = v_message, reading_date = v_today, created_at = now(), is_resolved = false
      where site_id = p_site_id and inverter_id is null
        and alert_type = 'site_underperformance' and is_resolved = false;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      insert into alerts (site_id, inverter_id, alert_type, severity, message, reading_date)
      values (p_site_id, null, 'site_underperformance', 'watch', v_message, v_today)
      on conflict (site_id, alert_type, coalesce(inverter_id, '00000000-0000-0000-0000-000000000000'), reading_date)
      do update set message = excluded.message, is_resolved = false, created_at = now();
    end if;
  else
    update alerts set is_resolved = true
      where site_id = p_site_id and inverter_id is null
        and alert_type = 'site_underperformance' and is_resolved = false;
  end if;
end;
$$;

-- Logging (or editing/removing) an outage should re-evaluate alerts right
-- away, same as logging a reading already does via trg_after_reading_change.
create or replace function trg_after_grid_outage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform refresh_alerts(coalesce(new.site_id, old.site_id));
  return coalesce(new, old);
end;
$$;

create trigger after_grid_outage_change
after insert or update or delete on daily_grid_outages
for each row execute function trg_after_grid_outage_change();
