import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";
import { getDashboardData } from "@/lib/data/dashboard";
import { computeHealthStatus, pickHealthReason } from "@/lib/calc/health";
import { computeVsBaselinePercent } from "@/lib/calc/kpis";
import { resolveDateRange } from "@/lib/calc/range";
import { formatRangeLabel } from "@/lib/format";
import { todayInTimezone } from "@/lib/date";
import { DashboardHero } from "./components/DashboardHero";
import { SummaryRow } from "./components/SummaryRow";
import { InverterBarChart } from "./components/InverterBarChart";
import { TrendChart } from "./components/TrendChart";
import { ImpactFigures } from "./components/ImpactFigures";
import { PerformanceMetrics } from "./components/PerformanceMetrics";
import { GenerationHeatmap } from "./components/GenerationHeatmap";
import { LifetimeTrend } from "./components/LifetimeTrend";
import { SkyConditionImpact } from "./components/SkyConditionImpact";
import { DateRangeFilter } from "./components/DateRangeFilter";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const site = await getCurrentSite();
  if (!site) {
    redirect("/setup");
  }

  const { from, to } = await searchParams;
  const today = todayInTimezone(site.timezone);
  const range = resolveDateRange(from, to, today);
  const data = await getDashboardData(site, range);

  const healthStatus = computeHealthStatus(data.alerts);
  const healthReason = pickHealthReason(data.alerts, healthStatus);
  const vsLastMonthPercent =
    data.rangeLastMonthKwh !== null
      ? computeVsBaselinePercent(data.rangeKwh, data.rangeLastMonthKwh)
      : null;
  const earliestDate = data.allReadings.reduce((min, r) => (r.date < min ? r.date : min), today);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const rangeAvgPerDayKwh =
    data.rangeTotalDays > 0 ? Math.round((data.rangeKwh / data.rangeTotalDays) * 100) / 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{site.name}</h1>
        <DateRangeFilter today={today} earliestDate={earliestDate} />
      </div>

      <DashboardHero
        rangeLabel={rangeLabel}
        rangeKwh={data.rangeKwh}
        vsLastMonthPercent={vsLastMonthPercent}
        healthStatus={healthStatus}
        healthReason={healthReason}
      />

      <SummaryRow
        rangeKwh={data.rangeKwh}
        rangeLastMonthKwh={data.rangeLastMonthKwh}
        rangeLastYearKwh={data.rangeLastYearKwh}
        rangeAvgPerDayKwh={rangeAvgPerDayKwh}
        lifetimeKwh={data.lifetimeKwh}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InverterBarChart data={data.perInverterRange} singleDay={data.rangeIsSingleDay} />
        <TrendChart readings={data.allReadings} range={range} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ImpactFigures
          rangeKwh={data.rangeKwh}
          rangeLastMonthKwh={data.rangeLastMonthKwh}
          rangeLabel={rangeLabel}
          tariffRateInrPerKwh={site.tariff_rate_inr_per_kwh}
        />
        <PerformanceMetrics activeAlertsCount={data.alerts.length} bestDay={data.bestDay} />
      </div>

      <GenerationHeatmap readings={data.allReadings} range={range} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LifetimeTrend readings={data.allReadings} today={data.today} />
        <SkyConditionImpact data={data.skyConditionImpact} />
      </div>
    </div>
  );
}
