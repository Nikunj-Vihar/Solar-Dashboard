-- Reverses 0013: the client still wants the per-inverter cumulative meter
-- reading logged alongside daily kWh (it now feeds the Log page's Total ET
-- summary, the site-wide sum of every inverter's own cumulative counter), so
-- a real reading requires cumulative_mwh again, same as before 0013.
alter table daily_readings drop constraint chk_no_reading_shape;
alter table daily_readings add constraint chk_no_reading_shape check (
  (no_reading = true
    and daily_kwh is null and cumulative_mwh is null
    and is_reset = false and mismatch_confirmed = false)
  or
  (no_reading = false
    and daily_kwh is not null and cumulative_mwh is not null)
);
