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
  expectedDailyKwhMid: number | null;
  totalDcCapacityKwp: number;
  tariffRateInrPerKwh: number | null;
  gridEmissionFactorKgPerKwh: number;
  perInverterKwh: { name: string; kwh: number }[];
  alertMessages: string[];
  dashboardUrl: string;
};

export type MonthlyReportData = {
  siteName: string;
  monthLabel: string;
  totalKwh: number;
  vsPreviousMonthPercent: number | null;
  vsExpectedPercent: number | null;
  expectedKwh: number | null;
  cufPercent: number;
  specificYieldKwhPerKwp: number;
  rupeeSaved: number | null;
  co2OffsetKg: number;
  perInverterKwh: { name: string; kwh: number }[];
  alertMessages: string[];
  dashboardUrl: string;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function computeMonthlyReport(input: MonthlyReportInput): MonthlyReportData {
  const expectedKwh = input.expectedDailyKwhMid !== null
    ? input.expectedDailyKwhMid * input.daysInMonth
    : null;

  return {
    siteName: input.siteName,
    monthLabel: `${MONTH_NAMES[input.month - 1]} ${input.year}`,
    totalKwh: round2(input.totalKwh),
    vsPreviousMonthPercent:
      input.previousMonthKwh !== null
        ? computeVsBaselinePercent(input.totalKwh, input.previousMonthKwh)
        : null,
    vsExpectedPercent:
      expectedKwh !== null ? computeVsBaselinePercent(input.totalKwh, expectedKwh) : null,
    expectedKwh: expectedKwh !== null ? round2(expectedKwh) : null,
    cufPercent: round2(computeCUF(input.totalKwh, input.totalDcCapacityKwp, input.daysInMonth)),
    specificYieldKwhPerKwp: round2(
      computeSpecificYield(input.totalKwh, input.totalDcCapacityKwp),
    ),
    rupeeSaved: computeRupeeSaved(input.totalKwh, input.tariffRateInrPerKwh),
    co2OffsetKg: round2(computeCo2OffsetKg(input.totalKwh, input.gridEmissionFactorKgPerKwh)),
    perInverterKwh: input.perInverterKwh.map((i) => ({ name: i.name, kwh: round2(i.kwh) })),
    alertMessages: input.alertMessages,
    dashboardUrl: input.dashboardUrl,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
