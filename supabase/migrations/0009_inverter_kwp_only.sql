-- Setup now only collects DC capacity (kWp) -- the separate AC "rated
-- capacity" (kW) field wasn't used anywhere in the app's own math (baseline,
-- CUF, and specific yield already all key off kWp; the physical-capacity
-- sanity check in daily logging has been repointed to kWp too). Column kept
-- nullable rather than dropped so previously entered values aren't
-- destroyed -- the app just stops collecting/requiring it going forward.

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'inverters'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%rated_capacity_kw%'
  loop
    execute format('alter table inverters drop constraint %I', con.conname);
  end loop;
end $$;

alter table inverters alter column rated_capacity_kw drop not null;
