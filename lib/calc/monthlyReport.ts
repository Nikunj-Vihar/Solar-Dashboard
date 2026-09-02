import {
  computeCUF,
  computeSpecificYield,
  computeRupeeSaved,
  computeCo2OffsetKg,
  computeVsBaselinePercent,
} from "./kpis";

export type MonthlyReportInput = {
  siteName: string;
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  totalKwh: number;
  previousMonthKwh: number | null;
  previousYearKwh: number | null;
  totalDcCapacityKwp: number;
  tariffRateInrPerKwh: number | null;
  gridEmissionFactorKgPerKwh: number;
  perInverterKwh: { name: string; kwh: number }[];
  alertMessages: string[];
  dashboardUrl: string;
  /** Days in this month with at least one real (non-skipped) reading, out of daysInMonth. */
  rangeDaysWithData: number;
  rangeTotalDays: number;
  /** One point per day of the month, summed across inverters -- null means no reading that day (not a fabricated 0), for the trend chart. */
  dailySeries: { date: string; kwh: number | null }[];
  lifetimeKwh: number;
};

export type MonthlyReportData = {
  siteName: string;
  monthLabel: string;
  totalKwh: number;
  previousMonthKwh: number | null;
  previousYearKwh: number | null;
  vsPreviousMonthPercent: number | null;
  vsLastYearPercent: number | null;
  cufPercent: number;
  specificYieldKwhPerKwp: number;
  rupeeSaved: number | null;
  co2OffsetKg: number;
  /** Rule-of-thumb ~21 kg CO2 absorbed per mature tree per year -- an estimate, same caveat as co2OffsetKg. */
  treesEquivalent: number;
  perInverterKwh: { name: string; kwh: number }[];
  alertMessages: string[];
  dashboardUrl: string;
  dataCompleteness: { logged: number; total: number };
  dailySeries: { date: string; kwh: number | null }[];
  lifetimeKwh: number;
};

/** ~21 kg CO2 absorbed per mature tree per year (commonly-cited estimate) -> per month. */
const CO2_KG_PER_TREE_PER_MONTH = 21 / 12;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function computeMonthlyReport(input: MonthlyReportInput): MonthlyReportData {
  const co2OffsetKg = computeCo2OffsetKg(input.totalKwh, input.gridEmissionFactorKgPerKwh);
  return {
    siteName: input.siteName,
    monthLabel: `${MONTH_NAMES[input.month - 1]} ${input.year}`,
    totalKwh: round2(input.totalKwh),
    previousMonthKwh: input.previousMonthKwh !== null ? round2(input.previousMonthKwh) : null,
    previousYearKwh: input.previousYearKwh !== null ? round2(input.previousYearKwh) : null,
    vsPreviousMonthPercent:
      input.previousMonthKwh !== null
        ? computeVsBaselinePercent(input.totalKwh, input.previousMonthKwh)
        : null,
    vsLastYearPercent:
      input.previousYearKwh !== null
        ? computeVsBaselinePercent(input.totalKwh, input.previousYearKwh)
        : null,
    cufPercent: round2(computeCUF(input.totalKwh, input.totalDcCapacityKwp, input.daysInMonth)),
    specificYieldKwhPerKwp: round2(
      computeSpecificYield(input.totalKwh, input.totalDcCapacityKwp),
    ),
    rupeeSaved: computeRupeeSaved(input.totalKwh, input.tariffRateInrPerKwh),
    co2OffsetKg: round2(co2OffsetKg),
    treesEquivalent: Math.round(co2OffsetKg / CO2_KG_PER_TREE_PER_MONTH),
    perInverterKwh: input.perInverterKwh.map((i) => ({ name: i.name, kwh: round2(i.kwh) })),
    alertMessages: input.alertMessages,
    dashboardUrl: input.dashboardUrl,
    dataCompleteness: { logged: input.rangeDaysWithData, total: input.rangeTotalDays },
    dailySeries: input.dailySeries.map((d) => ({
      date: d.date,
      kwh: d.kwh === null ? null : round2(d.kwh),
    })),
    lifetimeKwh: round2(input.lifetimeKwh),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
