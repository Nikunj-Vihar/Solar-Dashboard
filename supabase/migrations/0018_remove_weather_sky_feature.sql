-- Remove the NASA-POWER-driven "sky condition" trend-chart context feature
-- entirely (both the client-entered categorical picks and the NASA
-- daily-actuals half), per the same no-external-data-source decision as
-- 0017_self_referential_baseline.sql.

select cron.unschedule('weather-sync-job');

drop table daily_weather_readings;
drop table daily_sky_conditions;
