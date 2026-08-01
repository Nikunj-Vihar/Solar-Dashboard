-- Row Level Security: every table isolated by owner, plus a safely-scoped
-- public read path for share links that never grants anon direct table access.

alter table profiles enable row level security;
alter table sites enable row level security;
alter table inverters enable row level security;
alter table daily_readings enable row level security;
alter table reading_audit_log enable row level security;
alter table expected_baseline_monthly enable row level security;
alter table alerts enable row level security;

create policy "own profile" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own sites" on sites for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Shared helper so every child-table policy is a one-liner, indexed via sites.owner_id.
create or replace function is_site_owner(p_site_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (select 1 from sites where id = p_site_id and owner_id = auth.uid());
$$;

create policy "own inverters" on inverters for all
  using (is_site_owner(site_id)) with check (is_site_owner(site_id));

create policy "own readings" on daily_readings for all
  using (is_site_owner(site_id)) with check (is_site_owner(site_id));

create policy "own audit log" on reading_audit_log for select
  using (is_site_owner((select site_id from daily_readings where id = reading_id)));

create policy "own baseline" on expected_baseline_monthly for all
  using (is_site_owner(site_id)) with check (is_site_owner(site_id));

create policy "own alerts" on alerts for all
  using (is_site_owner(site_id)) with check (is_site_owner(site_id));

-- Public share link: anon gets zero direct grants on any table above (no policy
-- matches auth.uid() = null). The only anonymous read path is this single
-- SECURITY DEFINER function, which looks up by an unguessable random slug,
-- confirms is_public, and returns a hand-shaped JSON object — never raw rows,
-- never entered_by, never the audit log.
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
      from alerts where site_id = v_site.id and is_resolved = false
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function get_public_dashboard(text) from public;
grant execute on function get_public_dashboard(text) to anon, authenticated;
