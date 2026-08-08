-- The client no longer enters a per-inverter cumulative meter reading --
-- just Daily (kWh), with a simple site-wide total shown as the sum of that
-- day's entries. Historical cumulative_mwh/is_reset/mismatch_confirmed
-- values are left exactly as they are (nothing is dropped or backfilled);
-- a real reading going forward just no longer requires one.
alter table daily_readings drop constraint chk_no_reading_shape;
alter table daily_readings add constraint chk_no_reading_shape check (
  (no_reading = true
    and daily_kwh is null and cumulative_mwh is null
    and is_reset = false and mismatch_confirmed = false)
  or
  (no_reading = false
    and daily_kwh is not null)
);
