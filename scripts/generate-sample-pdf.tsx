/**
 * Generates public/sample-monthly-report.pdf from the same deterministic
 * demo dataset /demo uses, via the exact same calc path the real feature
 * uses (computeRangeFields -> computeMonthlyReport -> MonthlyReportPDF), so
 * the sample preview and a real report never drift apart. Run via
 * `npm run generate:sample-pdf`. Standalone — not deployed with the app.
 */
import path from "node:path";
import { renderToFile } from "@react-pdf/renderer";
import { DEMO_SITE, DEMO_INVERTERS, getDemoDashboardData, generateDemoReadings } from "../lib/demo-data";
import { computeMonthlyReport } from "../lib/calc/monthlyReport";
import { computeRangeFields, type RawReadingRow } from "../lib/calc/dashboardCompute";
import { densifyDailyTotals } from "../lib/calc/trend";
import { monthBounds } from "../lib/calc/reportPeriod";
import { MonthlyReportPDF } from "../components/reports/MonthlyReportPDF";

const demo = getDemoDashboardData();
const readings = generateDemoReadings(demo.today);

function previousMonthOf(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

const { year, month } = previousMonthOf(demo.today);
const { from, to, daysInMonth } = monthBounds(year, month);

const rows: RawReadingRow[] = readings.map((r) => ({
  reading_date: r.date,
  inverter_id: r.inverterId,
  daily_kwh: r.kwh,
  no_reading: false,
}));
const inverters = DEMO_INVERTERS.map((inv) => ({ id: inv.id, name: inv.name }));
const rangeFields = computeRangeFields(rows, inverters, { from, to });

const monthRows = rows.filter((r) => r.reading_date >= from && r.reading_date <= to);
const dailySeries = densifyDailyTotals(
  monthRows.map((r) => ({ date: r.reading_date, kwh: r.daily_kwh })),
  from,
  to,
).map((d) => ({ date: d.date, kwh: d.totalKwh }));

const perInverterDailySeries = inverters.map((inv) => ({
  name: inv.name,
  series: densifyDailyTotals(
    monthRows.filter((r) => r.inverter_id === inv.id).map((r) => ({ date: r.reading_date, kwh: r.daily_kwh })),
    from,
    to,
  ).map((d) => ({ date: d.date, kwh: d.totalKwh })),
}));

const totalDcCapacityKwp = DEMO_INVERTERS.reduce((sum, inv) => sum + inv.dcCapacityKwp, 0);

const report = computeMonthlyReport({
  siteName: DEMO_SITE.name,
  year,
  month,
  daysInMonth,
  totalKwh: rangeFields.rangeKwh,
  previousMonthKwh: rangeFields.rangeLastMonthKwh,
  previousYearKwh: rangeFields.rangeLastYearKwh,
  totalDcCapacityKwp,
  tariffRateInrPerKwh: DEMO_SITE.tariffRateInrPerKwh,
  perInverterKwh: rangeFields.perInverterRange.map((p) => ({ name: p.name, kwh: p.kwh })),
  alertMessages: demo.alerts.map((a) => a.message),
  dashboardUrl: "https://your-solar-dashboard.vercel.app/dashboard",
  rangeDaysWithData: rangeFields.rangeDaysWithData,
  rangeTotalDays: rangeFields.rangeTotalDays,
  dailySeries,
  perInverterDailySeries,
  lifetimeKwh: rangeFields.lifetimeKwh,
  // The demo dataset only models daily kWh, not a cumulative meter reading,
  // so this cross-check has nothing to compute from -- shows "--" like a
  // real site would before it has two logged cumulative readings in a month.
  cumulativeGenerationMwh: null,
  // The demo dataset doesn't model grid outages either -- the section simply
  // doesn't render, like a real site with no logged outage that month.
  gridOutageDays: [],
});

const outPath = path.resolve(__dirname, "../public/sample-monthly-report.pdf");

renderToFile(
  <MonthlyReportPDF
    report={report}
    watermark="SAMPLE REPORT — illustrative data, not a real client's figures. This is what your monthly report will look like once you're logging data."
  />,
  outPath,
).then(() => {
  console.log(`Generated ${outPath}`);
});
