-- Lets a user explicitly mark a day as "no reading available" (inverter was
-- off, nobody visited site, etc.) instead of either leaving it blank forever
-- or typing a fabricated 0. A skipped row carries no numbers at all, so
-- totals/trend charts can tell "confirmed zero" apart from "no data" and
-- treat the latter as a genuine gap rather than measured generation.

alter table daily_readings alter column daily_kwh drop not null;
alter table daily_readings alter column cumulative_mwh drop not null;

alter table daily_readings add column no_reading boolean not null default false;

-- A skipped row carries no numbers and no reset/mismatch flags; a real
-- reading always carries its numbers. Keeps the two shapes from drifting.
alter table daily_readings add constraint chk_no_reading_shape check (
  (no_reading = true
    and daily_kwh is null and cumulative_mwh is null
    and is_reset = false and mismatch_confirmed = false)
  or
  (no_reading = false
    and daily_kwh is not null and cumulative_mwh is not null)
);

-- A no_reading row has no real daily_kwh, so it must not count toward "has
-- everyone logged a real reading yet" -- otherwise a site with one inverter
-- marked no_reading would look artificially short on generation and could
-- fire a false baseline-deviation alert instead of being skipped like any
-- other incompletely-logged day.
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
    where dr.site_id = p_site_id and dr.reading_date = p_reading_date and i.is_active = true
      and dr.no_reading = false;

  -- Only evaluate once every active inverter has a real reading for this
  -- date -- otherwise a single early entry (or a skipped inverter) looks
  -- like a huge shortfall.
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
