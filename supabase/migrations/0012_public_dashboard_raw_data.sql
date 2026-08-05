-- Previously this function pre-computed today/month/lifetime totals and a
-- Good/Watch/Needs Attention string directly in SQL -- logic that had to be
-- kept in lockstep with the equivalent TypeScript in lib/data/dashboard.ts
-- by hand (see migration 0011's fix, which had to be applied to both).
-- Instead, this now returns raw rows (readings, baseline, unresolved
-- alerts) for the public site and lets the Next.js app compute everything
-- with the exact same pure functions the private dashboard already uses
-- (lib/calc/dashboardCompute.ts, lib/calc/health.ts) -- one implementation,
-- shared, instead of two that can silently drift.
--
-- This also enables the public share page to get its own date-range
-- filter, matching the private dashboard, since the full reading history is
-- now available to slice client-side per request instead of only today's/
-- this month's/lifetime's fixed totals.
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
    'baseline', (
      select coalesce(json_agg(json_build_object(
        'month', month,
        'expected_daily_kwh_low', expected_daily_kwh_low,
        'expected_daily_kwh_mid', expected_daily_kwh_mid,
        'expected_daily_kwh_high', expected_daily_kwh_high
      )), '[]'::json)
      from expected_baseline_monthly where site_id = v_site.id
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
