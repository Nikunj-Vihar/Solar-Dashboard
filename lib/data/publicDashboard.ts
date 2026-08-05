import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/date";
import { computeRangeFields, type RawReadingRow } from "@/lib/calc/dashboardCompute";
import { computeHealthStatus, pickHealthReason, filterActiveAlerts } from "@/lib/calc/health";
import type { HealthStatus } from "@/lib/calc/health";

type RpcAlert = {
  id: string;
  alert_type: string;
  message: string;
  severity: "watch" | "needs_attention";
  inverter_id: string | null;
  reading_date: string;
};

export type PublicSitePayload = {
  site_name: string;
  timezone: string;
  tariff_rate_inr_per_kwh: number | null;
  grid_emission_factor_kg_per_kwh: number;
  inverters: { id: string; name: string; dc_capacity_kwp: number }[];
  readings: RawReadingRow[];
  baseline: {
    month: number;
    expected_daily_kwh_low: number;
    expected_daily_kwh_mid: number;
    expected_daily_kwh_high: number;
  }[];
  alerts: RpcAlert[];
};

export type PublicDashboardData = {
  siteName: string;
  tariffRateInrPerKwh: number | null;
  gridEmissionFactorKgPerKwh: number;
  totalDcCapacityKwp: number;
  rangeKwh: number;
  rangeTotalDays: number;
  lifetimeKwh: number;
  rangeExpectedMidKwh: number | null;
  rangeIsSingleDay: boolean;
  perInverterRange: { inverterId: string; name: string; kwh: number; noReading: boolean }[];
  allReadings: { date: string; kwh: number | null }[];
  earliestDate: string;
  baseline: {
    month: number;
    expectedDailyKwhLow: number;
    expectedDailyKwhMid: number;
    expectedDailyKwhHigh: number;
  }[];
  healthStatus: HealthStatus;
  healthReason: string | null;
};

/** One RPC call for the whole public page -- split from the computation below so a caller only needs it once, even though "today" (derived from the site's own timezone) has to be known before a date range can be resolved. */
export async function fetchPublicSitePayload(slug: string): Promise<PublicSitePayload | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_dashboard", { p_slug: slug });
  return (data as PublicSitePayload | null) ?? null;
}

/**
 * Computes everything the public share page needs from one already-fetched
 * RPC payload, using the exact same pure functions the private dashboard
 * uses (see lib/calc/dashboardCompute.ts's docstring) rather than
 * duplicating that logic in SQL.
 */
export function computePublicDashboardData(
  payload: PublicSitePayload,
  range: { from: string; to: string },
): PublicDashboardData {
  const today = todayInTimezone(payload.timezone);

  const baseline = payload.baseline.map((b) => ({
    month: b.month,
    expectedDailyKwhLow: b.expected_daily_kwh_low,
    expectedDailyKwhMid: b.expected_daily_kwh_mid,
    expectedDailyKwhHigh: b.expected_daily_kwh_high,
  }));

  const rangeFields = computeRangeFields(payload.readings, payload.inverters, range, baseline);

  const activeAlerts = filterActiveAlerts(
    payload.alerts.map((a) => ({ ...a, alertType: a.alert_type, readingDate: a.reading_date })),
    today,
  );
  const healthStatus = computeHealthStatus(activeAlerts);
  const healthReason = pickHealthReason(activeAlerts, healthStatus);

  const allReadings = payload.readings.map((r) => ({ date: r.reading_date, kwh: r.daily_kwh }));
  const earliestDate = allReadings.reduce((min, r) => (r.date < min ? r.date : min), today);

  return {
    siteName: payload.site_name,
    tariffRateInrPerKwh: payload.tariff_rate_inr_per_kwh,
    gridEmissionFactorKgPerKwh: payload.grid_emission_factor_kg_per_kwh,
    totalDcCapacityKwp: payload.inverters.reduce((sum, inv) => sum + inv.dc_capacity_kwp, 0),
    rangeKwh: rangeFields.rangeKwh,
    rangeTotalDays: rangeFields.rangeTotalDays,
    lifetimeKwh: rangeFields.lifetimeKwh,
    rangeExpectedMidKwh: rangeFields.rangeExpectedMidKwh,
    rangeIsSingleDay: rangeFields.rangeIsSingleDay,
    perInverterRange: rangeFields.perInverterRange,
    allReadings,
    earliestDate,
    baseline,
    healthStatus,
    healthReason,
  };
}
