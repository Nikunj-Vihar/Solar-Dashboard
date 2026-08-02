-- baseline_deviation is a per-day event log by design (one row per date a
-- site's total deviated from its baseline), not an ongoing condition --
-- unlike underperformance/missing_reading, nothing ever marks an old day's
-- deviation "resolved" once that day has passed. get_public_dashboard's
-- health_status counted every unresolved alert regardless of age, so a
-- single bad day months ago left the public share page stuck on "Watch"
-- forever. Only count baseline_deviation within a short recent window; the
-- other alert types self-resolve correctly on their own and stay unbounded.
-- Matches the equivalent fix applied to the private dashboard's query
-- (lib/data/dashboard.ts).
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
    'today_kwh', (
      select coalesce(sum(daily_kwh), 0) from daily_readings
      where site_id = v_site.id and reading_date = current_date
    ),
    'month_kwh', (
      select coalesce(sum(daily_kwh), 0) from daily_readings
      where site_id = v_site.id
        and date_trunc('month', reading_date) = date_trunc('month', current_date)
    ),
    'lifetime_kwh', (
      select coalesce(sum(daily_kwh), 0) from daily_readings where site_id = v_site.id
    ),
    'per_inverter_today', (
      select coalesce(json_agg(json_build_object('name', i.name, 'kwh', r.daily_kwh)), '[]'::json)
      from inverters i
      left join daily_readings r on r.inverter_id = i.id and r.reading_date = current_date
      where i.site_id = v_site.id
    ),
    'trend_90d', (
      select coalesce(json_agg(json_build_object('date', reading_date, 'kwh', total)), '[]'::json)
      from (
        select reading_date, sum(daily_kwh) as total
        from daily_readings
        where site_id = v_site.id and reading_date >= current_date - 90
        group by reading_date
        order by reading_date
      ) t
    ),
    'health_status', (
      select case
        when count(*) filter (where severity = 'needs_attention') > 0 then 'Needs Attention'
        when count(*) filter (where severity = 'watch') > 0 then 'Watch'
        else 'Good'
      end
      from alerts
      where site_id = v_site.id and is_resolved = false
        and (alert_type != 'baseline_deviation' or reading_date >= current_date - 3)
    )
  ) into v_result;

  return v_result;
end;
$$;
