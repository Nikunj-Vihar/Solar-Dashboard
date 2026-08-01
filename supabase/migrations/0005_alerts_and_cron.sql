-- Alert generation (spec §5, §10.3): baseline deviation fires per-day off a
-- trigger; underperformance and missing-reading are "current state" checks
-- that run inline after every reading submit AND daily via pg_cron, since
-- absence can only be caught by a periodic sweep, not an insert trigger.

-- Site-wide: today's total generation vs. the expected baseline for this
-- month, flagged at >35% deviation (spec §4). One row per (site, date) —
-- each day's deviation is its own event, not an ongoing condition.
create or replace function check_daily_baseline_deviation(p_site_id uuid, p_reading_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual numeric;
  v_expected numeric;
  v_deviation_pct numeric;
  v_logged_count int;
  v_active_count int;
begin
  select count(*) into v_active_count from inverters where site_id = p_site_id and is_active = true;
  select count(*) into v_logged_count from daily_readings dr
    join inverters i on i.id = dr.inverter_id
    where dr.site_id = p_site_id and dr.reading_date = p_reading_date and i.is_active = true;

  -- Only evaluate once every active inverter has a reading for this date —
  -- otherwise a single early entry mid-logging looks like a huge shortfall.
  if v_active_count = 0 or v_logged_count < v_active_count then
    update alerts set is_resolved = true
      where site_id = p_site_id and alert_type = 'baseline_deviation'
        and reading_date = p_reading_date and is_resolved = false;
    return;
  end if;

  select sum(daily_kwh) into v_actual from daily_readings
    where site_id = p_site_id and reading_date = p_reading_date;

  select expected_daily_kwh_mid into v_expected from expected_baseline_monthly
    where site_id = p_site_id and month = extract(month from p_reading_date)::smallint;

  if v_expected is null or v_expected = 0 then
    return;
  end if;

  v_deviation_pct := ((v_actual - v_expected) / v_expected) * 100;

  if abs(v_deviation_pct) > 35 then
    insert into alerts (site_id, alert_type, severity, message, reading_date)
    values (
      p_site_id, 'baseline_deviation', 'watch',
      format('Total generation on %s was %s%% %s the expected baseline (%s kWh vs %s kWh expected).',
        to_char(p_reading_date, 'Mon DD'),
        round(abs(v_deviation_pct))::text,
        case when v_deviation_pct < 0 then 'below' else 'above' end,
        round(v_actual, 1)::text, round(v_expected, 1)::text),
      p_reading_date
    )
    on conflict (site_id, alert_type, coalesce(inverter_id, '00000000-0000-0000-0000-000000000000'), reading_date)
    do update set message = excluded.message, is_resolved = false, created_at = now();
  else
    update alerts set is_resolved = true
      where site_id = p_site_id and alert_type = 'baseline_deviation'
        and reading_date = p_reading_date and is_resolved = false;
  end if;
end;
$$;

-- Per-inverter "current state" checks: underperformance (trailing 7-day avg
-- vs. the 30 days before that, spec §5) and missing readings. Each keeps at
-- most one unresolved row per (site, inverter, type), refreshed in place
-- rather than accumulating a new row every day the condition persists.
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
end;
$$;

-- Fires both checks after every reading write, for near-real-time dashboard feedback.
create or replace function trg_after_reading_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform check_daily_baseline_deviation(new.site_id, new.reading_date);
  perform refresh_alerts(new.site_id);
  return new;
end;
$$;

create trigger trg_readings_refresh_checks
  after insert or update on daily_readings
  for each row execute function trg_after_reading_change();

-- Daily sweep so a site nobody logs into still gets its missing-reading
-- alert (an insert trigger can't fire on the absence of an insert).
create or replace function refresh_all_sites_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site record;
begin
  for v_site in select id from sites loop
    perform refresh_alerts(v_site.id);
  end loop;
end;
$$;

create extension if not exists pg_cron with schema extensions;

select cron.schedule('daily-refresh-alerts', '30 0 * * *', $$select refresh_all_sites_alerts()$$);
