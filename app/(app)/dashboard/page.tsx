import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";
import { getDashboardData } from "@/lib/data/dashboard";
import { computeHealthStatus } from "@/lib/calc/health";
import { SummaryRow } from "./SummaryRow";
import { InverterBarChart } from "./InverterBarChart";
import { TrendChart } from "./TrendChart";
import { ImpactFigures } from "./ImpactFigures";
import { PerformanceMetrics } from "./PerformanceMetrics";
import { GenerationHeatmap } from "./GenerationHeatmap";
import { LifetimeTrend } from "./LifetimeTrend";

export default async function DashboardPage() {
  const site = await getCurrentSite();
  if (!site) {
    redirect("/setup");
  }

  const data = await getDashboardData(site);
  const healthStatus = computeHealthStatus(data.alerts);

  const currentMonthNumber = Number(data.today.slice(5, 7));
  const dayOfMonth = Number(data.today.slice(8, 10));
  const currentMonthBaseline = data.baseline.find((b) => b.month === currentMonthNumber);
  const monthExpectedMidKwh = currentMonthBaseline
    ? currentMonthBaseline.expectedDailyKwhMid * dayOfMonth
    : null;
  const totalDcCapacityKwp = site.inverters
    .filter((inv) => inv.is_active)
    .reduce((sum, inv) => sum + inv.dc_capacity_kwp, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{site.name}</h1>

      <SummaryRow
        todayKwh={data.todayKwh}
        monthKwh={data.monthKwh}
        lifetimeKwh={data.lifetimeKwh}
        healthStatus={healthStatus}
      />

      <InverterBarChart today={data.perInverterToday} month={data.perInverterMonth} />

      <TrendChart readings={data.allReadings} baseline={data.baseline} today={data.today} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ImpactFigures
          monthKwh={data.monthKwh}
          monthExpectedMidKwh={monthExpectedMidKwh}
          tariffRateInrPerKwh={site.tariff_rate_inr_per_kwh}
          gridEmissionFactorKgPerKwh={site.grid_emission_factor_kg_per_kwh}
        />
        <PerformanceMetrics
          monthKwh={data.monthKwh}
          totalDcCapacityKwp={totalDcCapacityKwp}
          dayOfMonth={dayOfMonth}
        />
      </div>

      <GenerationHeatmap readings={data.allReadings} today={data.today} />

      <LifetimeTrend readings={data.allReadings} today={data.today} />
    </div>
  );
}
