import { describe, it, expect } from "vitest";
import { computeMonthlyReport } from "@/lib/calc/monthlyReport";

describe("computeMonthlyReport", () => {
  const baseInput = {
    siteName: "Test Site",
    year: 2026,
    month: 7,
    daysInMonth: 31,
    totalKwh: 3100,
    previousMonthKwh: 2800,
    previousYearKwh: null,
    totalDcCapacityKwp: 26.4,
    tariffRateInrPerKwh: 8.5,
    gridEmissionFactorKgPerKwh: 0.716,
    perInverterKwh: [
      { name: "Inverter 1", kwh: 800 },
      { name: "Inverter 2", kwh: 780 },
      { name: "Inverter 3", kwh: 770 },
      { name: "Inverter 4", kwh: 750 },
    ],
    alertMessages: ["Inverter 4 underperforming"],
    dashboardUrl: "https://example.com/dashboard",
    rangeDaysWithData: 29,
    rangeTotalDays: 31,
    dailySeries: Array.from({ length: 31 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, "0")}`,
      kwh: 100,
    })),
    lifetimeKwh: 50000,
  };

  it("computes a full report with all figures present", () => {
    const report = computeMonthlyReport(baseInput);
    expect(report.monthLabel).toBe("July 2026");
    expect(report.totalKwh).toBe(3100);
    expect(report.vsPreviousMonthPercent).toBeCloseTo(((3100 - 2800) / 2800) * 100, 5);
    expect(report.rupeeSaved).toBe(3100 * 8.5);
    expect(report.co2OffsetKg).toBeCloseTo(3100 * 0.716, 1);
    expect(report.perInverterKwh).toHaveLength(4);
    expect(report.alertMessages).toEqual(["Inverter 4 underperforming"]);
  });

  it("computes a sane CUF and specific yield", () => {
    const report = computeMonthlyReport(baseInput);
    // CUF = 3100 / (26.4 * 24 * 31) -> ~15.9%, within the 15-25% typical range.
    expect(report.cufPercent).toBeGreaterThan(10);
    expect(report.cufPercent).toBeLessThan(25);
    expect(report.specificYieldKwhPerKwp).toBeCloseTo(3100 / 26.4, 1);
  });

  it("handles no tariff rate configured", () => {
    const report = computeMonthlyReport({ ...baseInput, tariffRateInrPerKwh: null });
    expect(report.rupeeSaved).toBeNull();
  });

  it("handles no previous month data (first month of operation)", () => {
    const report = computeMonthlyReport({ ...baseInput, previousMonthKwh: null });
    expect(report.vsPreviousMonthPercent).toBeNull();
  });

  it("handles no year-ago data (site under a year old)", () => {
    const report = computeMonthlyReport(baseInput);
    expect(report.vsLastYearPercent).toBeNull();
  });

  it("computes vs last year when data exists", () => {
    const report = computeMonthlyReport({ ...baseInput, previousYearKwh: 2500 });
    expect(report.vsLastYearPercent).toBeCloseTo(((3100 - 2500) / 2500) * 100, 5);
  });

  it("reports data completeness and passes through daily series/lifetime totals", () => {
    const report = computeMonthlyReport(baseInput);
    expect(report.dataCompleteness).toEqual({ logged: 29, total: 31 });
    expect(report.dailySeries).toHaveLength(31);
    expect(report.lifetimeKwh).toBe(50000);
  });

  it("derives a trees-equivalent estimate from the CO2 offset", () => {
    const report = computeMonthlyReport(baseInput);
    expect(report.treesEquivalent).toBe(Math.round(report.co2OffsetKg / (21 / 12)));
  });
});
