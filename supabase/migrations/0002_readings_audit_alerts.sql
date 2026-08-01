-- Daily readings, audit trail, expected-generation baseline, and alerts.

create table daily_readings (
  id uuid primary key default gen_random_uuid(),
  inverter_id uuid not null references inverters(id) on delete cascade,
  -- denormalized for simpler/faster RLS + queries (avoids a join through inverters on every policy check)
  site_id uuid not null references sites(id) on delete cascade,
  reading_date date not null,
  daily_kwh numeric(9,2) not null check (daily_kwh >= 0),
  cumulative_mwh numeric(12,3) not null check (cumulative_mwh >= 0),
  is_reset boolean not null default false,
  mismatch_confirmed boolean not null default false,
  entered_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inverter_id, reading_date)
);
create index idx_readings_site_date on daily_readings(site_id, reading_date);
create index idx_readings_inverter_date on daily_readings(inverter_id, reading_date desc);

create trigger trg_readings_updated_at
  before update on daily_readings
  for each row execute function set_updated_at();

-- Append-only audit trail: who entered/changed each reading and when (spec §8).
-- Populated by a trigger rather than app code so it can never be bypassed by a
-- direct insert/update through any path (Server Action today, CSV import later).
create table reading_audit_log (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references daily_readings(id) on delete cascade,
  action text not null check (action in ('insert', 'update')),
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now(),
  old_values jsonb,
  new_values jsonb
);
create index idx_audit_reading on reading_audit_log(reading_id, changed_at desc);

-- SECURITY DEFINER: must write the audit row regardless of the acting user's own
-- RLS grants on reading_audit_log (that table only grants owners SELECT, not INSERT).
create or replace function log_reading_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into reading_audit_log (reading_id, action, changed_by, new_values)
    values (new.id, 'insert', new.entered_by, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    insert into reading_audit_log (reading_id, action, changed_by, old_values, new_values)
    values (new.id, 'update', new.entered_by, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

create trigger trg_log_reading_change
  after insert or update on daily_readings
  for each row execute function log_reading_change();

-- Expected generation baseline computed once at setup from NASA POWER irradiance
-- (see lib/baseline/computeBaseline.ts) — a genuine low/mid/high band, not a padded line.
create table expected_baseline_monthly (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  avg_daily_irradiance_kwh_per_m2 numeric(6,3) not null,
  expected_daily_kwh_low numeric(9,2) not null,
  expected_daily_kwh_mid numeric(9,2) not null,
  expected_daily_kwh_high numeric(9,2) not null,
  source text not null default 'NASA_POWER',
  fetched_at timestamptz not null default now(),
  unique (site_id, month)
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  inverter_id uuid references inverters(id) on delete cascade,
  alert_type text not null check (alert_type in
    ('underperformance', 'missing_reading', 'baseline_deviation', 'cumulative_mismatch')),
  severity text not null check (severity in ('watch', 'needs_attention')),
  message text not null,
  reading_date date not null,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now()
);
-- table-level UNIQUE only accepts column names, not expressions, so the
-- coalesce-based de-dup key (nullable inverter_id = site-wide alert) needs a unique index.
create unique index idx_alerts_dedup on alerts (
  site_id, alert_type, coalesce(inverter_id, '00000000-0000-0000-0000-000000000000'), reading_date
);
create index idx_alerts_site_active on alerts(site_id, is_resolved, created_at desc);
