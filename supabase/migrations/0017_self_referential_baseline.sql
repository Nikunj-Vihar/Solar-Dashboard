-- Replace the NASA-POWER-driven baseline_deviation alert with a
-- self-referential site-wide check, modeled on the existing per-inverter
-- underperformance check in refresh_alerts(): trailing 7-day average vs. the
-- 30 days before that, >20% drop. Self-resolving (unlike the old
-- per-day-event-log baseline_deviation), so it's picked up by both the row
-- trigger and the daily refresh_all_sites_alerts() cron sweep automatically.

-- All rows of the retired alert type must go before the check constraint
-- below is tightened (Postgres validates existing rows against a new
-- constraint unless added NOT VALID).
delete from alerts where alert_type = 'baseline_deviation';

alter table alerts drop constraint alerts_alert_type_check;
alter table alerts add constraint alerts_alert_type_check check (alert_type in
  ('underperformance', 'missing_reading', 'site_underperformance', 'cumulative_mismatch'));

drop function if exists check_daily_baseline_deviation(uuid, date);

create or replace function trg_after_reading_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform refresh_alerts(new.site_id);
  return new;
end;
$$;

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
      where inverter_id = v_inverter.id and reading_date > v_today - 7 and reading_date <= v_today;
    select avg(daily_kwh) into v_baseline_avg from daily_readings
      where inverter_id = v_inverter.id and reading_date > v_today - 37 and reading_date <= v_today - 7;

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
  -- above, summed across all active inverters instead of one. Replaces the
  -- old NASA-baseline-derived check_daily_baseline_deviation(). sum()/avg()
  -- ignore NULLs, so a fully-no_reading day is excluded rather than counted
  -- as a real zero, matching the rest of the codebase's semantics.
  select avg(daily_total) into v_recent_avg from (
    select reading_date, sum(daily_kwh) as daily_total
    from daily_readings
    where site_id = p_site_id and reading_date > v_today - 7 and reading_date <= v_today
    group by reading_date
  ) recent;
  select avg(daily_total) into v_baseline_avg from (
    select reading_date, sum(daily_kwh) as daily_total
    from daily_readings
    where site_id = p_site_id and reading_date > v_today - 37 and reading_date <= v_today - 7
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

-- Drop the 'baseline' key from the public share payload (table's gone below).
create or replace function get_public_dashboard(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site sites%rowtype;
  v_result json;
begin
  select * into v_site from sites where public_share_slug = p_slug and is_public = true;
  if not found then
    return null;
  end if;

  select json_build_object(
    'site_name', v_site.name,
    'timezone', v_site.timezone,
    'tariff_rate_inr_per_kwh', v_site.tariff_rate_inr_per_kwh,
    'grid_emission_factor_kg_per_kwh', v_site.grid_emission_factor_kg_per_kwh,
    'inverters', (
      select coalesce(json_agg(json_build_object(
        'id', id, 'name', name, 'dc_capacity_kwp', dc_capacity_kwp
      )), '[]'::json)
      from inverters where site_id = v_site.id and is_active = true
    ),
    'readings', (
      select coalesce(json_agg(json_build_object(
        'reading_date', reading_date,
        'inverter_id', inverter_id,
        'daily_kwh', daily_kwh,
        'no_reading', no_reading
      )), '[]'::json)
      from daily_readings where site_id = v_site.id
    ),
    'alerts', (
      select coalesce(json_agg(json_build_object(
        'id', id,
        'alert_type', alert_type,
        'message', message,
        'severity', severity,
        'inverter_id', inverter_id,
        'reading_date', reading_date
      )), '[]'::json)
      from alerts where site_id = v_site.id and is_resolved = false
    )
  ) into v_result;

  return v_result;
end;
$$;

drop table expected_baseline_monthly;
