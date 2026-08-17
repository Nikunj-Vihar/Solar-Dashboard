import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/date";
import { computeRangeFields, type RawReadingRow } from "@/lib/calc/dashboardCompute";
import { computeHealthStatus, pickHealthReason } from "@/lib/calc/health";
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
  rangeLastMonthKwh: number | null;
  rangeLastYearKwh: number | null;
  rangeIsSingleDay: boolean;
  perInverterRange: { inverterId: string; name: string; kwh: number; noReading: boolean }[];
  allReadings: { date: string; kwh: number | null }[];
  earliestDate: string;
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

  const rangeFields = computeRangeFields(payload.readings, payload.inverters, range);

  const healthStatus = computeHealthStatus(payload.alerts);
  const healthReason = pickHealthReason(payload.alerts, healthStatus);

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
    rangeLastMonthKwh: rangeFields.rangeLastMonthKwh,
    rangeLastYearKwh: rangeFields.rangeLastYearKwh,
    rangeIsSingleDay: rangeFields.rangeIsSingleDay,
    perInverterRange: rangeFields.perInverterRange,
    allReadings,
    earliestDate,
    healthStatus,
    healthReason,
  };
}
