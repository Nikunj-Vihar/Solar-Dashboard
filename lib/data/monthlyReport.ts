import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRangeFields } from "@/lib/calc/dashboardCompute";
import { densifyDailyTotals } from "@/lib/calc/trend";
import { computeMonthlyReport, type MonthlyReportData } from "@/lib/calc/monthlyReport";
import { monthBounds } from "@/lib/calc/reportPeriod";
import type { SiteWithInverters } from "./site";

/**
 * Builds a full monthly report for one site/month from real data. Takes an
 * already-authorized Supabase client so the same function serves both the
 * user-session route (RLS-scoped) and the internal, service-role route the
 * generation-report Edge Function calls to attach a PDF to its email --
 * one implementation instead of two that could drift.
 *
 * Returns null when nothing was logged that month (nothing to report).
 */
export async function getMonthlyReportData(
  supabase: SupabaseClient,
  site: SiteWithInverters,
  year: number,
  month: number,
): Promise<MonthlyReportData | null> {
  const { from, to, daysInMonth } = monthBounds(year, month);
  const activeInverters = site.inverters.filter((inv) => inv.is_active);

  const [{ data: readings }, { data: alertRows }] = await Promise.all([
    supabase
      .from("daily_readings")
      .select("reading_date, inverter_id, daily_kwh, no_reading")
      .eq("site_id", site.id)
      .order("reading_date"),
    supabase
      .from("alerts")
      .select("message")
      .eq("site_id", site.id)
      .eq("is_resolved", false)
      .gte("reading_date", from)
      .lte("reading_date", to),
  ]);

  const rows = readings ?? [];
  const rangeFields = computeRangeFields(rows, activeInverters, { from, to });
  if (rangeFields.rangeDaysWithData === 0) return null;

  const monthRows = rows.filter((r) => r.reading_date >= from && r.reading_date <= to);
  const dailySeries = densifyDailyTotals(
    monthRows.map((r) => ({ date: r.reading_date, kwh: r.daily_kwh })),
    from,
    to,
  ).map((d) => ({ date: d.date, kwh: d.totalKwh }));

  const totalDcCapacityKwp = activeInverters.reduce((sum, inv) => sum + inv.dc_capacity_kwp, 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://solar-dashboard-flax.vercel.app";

  return computeMonthlyReport({
    siteName: site.name,
    year,
    month,
    daysInMonth,
    totalKwh: rangeFields.rangeKwh,
    previousMonthKwh: rangeFields.rangeLastMonthKwh,
    previousYearKwh: rangeFields.rangeLastYearKwh,
    totalDcCapacityKwp,
    tariffRateInrPerKwh: site.tariff_rate_inr_per_kwh,
    gridEmissionFactorKgPerKwh: site.grid_emission_factor_kg_per_kwh,
    perInverterKwh: rangeFields.perInverterRange.map((p) => ({ name: p.name, kwh: p.kwh })),
    alertMessages: (alertRows ?? []).map((a) => a.message),
    dashboardUrl: `${siteUrl}/dashboard`,
    rangeDaysWithData: rangeFields.rangeDaysWithData,
    rangeTotalDays: rangeFields.rangeTotalDays,
    dailySeries,
    lifetimeKwh: rangeFields.lifetimeKwh,
  });
}
