/**
 * Generates public/sample-monthly-report.pdf from the same deterministic
 * demo dataset /demo uses, so the two stay numerically consistent. Run via
 * `npm run generate:sample-pdf`. Standalone — not deployed with the app.
 */
import path from "node:path";
import { renderToFile } from "@react-pdf/renderer";
import { DEMO_SITE, DEMO_INVERTERS, getDemoDashboardData, generateDemoReadings } from "../lib/demo-data";
import { computeMonthlyReport } from "../lib/calc/monthlyReport";
import { SampleMonthlyReportPDF } from "./SampleMonthlyReportPDF";

const demo = getDemoDashboardData();
const readings = generateDemoReadings(demo.today);

function previousMonthOf(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function monthRange(year: number, month: number) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  return { daysInMonth, start, end };
}

const { year, month } = previousMonthOf(demo.today);
const { daysInMonth, start, end } = monthRange(year, month);
const { year: prevYear, month: prevMonth } = previousMonthOf(`${start}`);
const prevRange = monthRange(prevYear, prevMonth);

const monthReadings = readings.filter((r) => r.date >= start && r.date <= end);
const prevMonthReadings = readings.filter((r) => r.date >= prevRange.start && r.date <= prevRange.end);

const totalKwh = monthReadings.reduce((sum, r) => sum + r.kwh, 0);
const previousMonthKwh = prevMonthReadings.length > 0
  ? prevMonthReadings.reduce((sum, r) => sum + r.kwh, 0)
  : null;
const perInverterKwh = DEMO_INVERTERS.map((inv) => ({
  name: inv.name,
  kwh: monthReadings.filter((r) => r.inverterId === inv.id).reduce((sum, r) => sum + r.kwh, 0),
}));
const totalDcCapacityKwp = DEMO_INVERTERS.reduce((sum, inv) => sum + inv.dcCapacityKwp, 0);
const baselineRow = demo.baseline.find((b) => b.month === month);

const report = computeMonthlyReport({
  siteName: DEMO_SITE.name,
  year,
  month,
  daysInMonth,
  totalKwh,
  previousMonthKwh,
  expectedDailyKwhMid: baselineRow?.expectedDailyKwhMid ?? null,
  totalDcCapacityKwp,
  tariffRateInrPerKwh: DEMO_SITE.tariffRateInrPerKwh,
  gridEmissionFactorKgPerKwh: DEMO_SITE.gridEmissionFactorKgPerKwh,
  perInverterKwh,
  alertMessages: demo.alerts.map((a) => a.message),
  dashboardUrl: "https://your-solar-dashboard.vercel.app/dashboard",
});

const outPath = path.resolve(__dirname, "../public/sample-monthly-report.pdf");

renderToFile(<SampleMonthlyReportPDF report={report} />, outPath).then(() => {
  console.log(`Generated ${outPath}`);
});
